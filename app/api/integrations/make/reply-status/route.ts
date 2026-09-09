import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

type ReplyDetectedBody = {
  eventId?: string;
  eventType?: string;
  clientId?: string;
  clientEmail?: string;
  assigneeId?: string;
  assigneeEmail?: string;
  messageId?: string;
  sentAt?: string;
  subject?: string;
  from?: string;
  to?: Array<string | { email?: string; Email?: string }>;
  cc?: Array<string | { email?: string; Email?: string }>;
};

function recipientEmails(value: ReplyDetectedBody["to"]) {
  return (Array.isArray(value) ? value : [])
    .map((recipient) => typeof recipient === "string" ? recipient : recipient?.email ?? recipient?.Email ?? "")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function escapedIlike(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function authorized(request: NextRequest) {
  const secret = process.env.MAKE_INTEGRATION_SECRET?.trim() ?? "";
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const left = Buffer.from(supplied);
  const right = Buffer.from(secret);
  return Boolean(secret) && left.length === right.length && timingSafeEqual(left, right);
}

async function setInboundEvent(
  eventId: string,
  values: Record<string, unknown>,
) {
  await supabaseAdmin
    .from("integration_inbound_events")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("provider", "make")
    .eq("external_event_id", eventId);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ReplyDetectedBody;
  try {
    body = await request.json() as ReplyDetectedBody;
  } catch {
    return NextResponse.json({ error: "The request body must be valid JSON." }, { status: 400 });
  }

  const eventId = body.eventId?.trim() || body.messageId?.trim() || "";
  const requestedClientId = body.clientId?.trim() || "";
  const clientEmail = body.clientEmail?.trim().toLowerCase() || "";
  const assigneeEmail = body.assigneeEmail?.trim().toLowerCase() || "";
  const recipientCandidates = [...new Set([
    ...recipientEmails(body.to),
    ...recipientEmails(body.cc),
  ].filter((email) => email !== assigneeEmail))];
  if (!eventId || (!requestedClientId && !clientEmail && recipientCandidates.length === 0)) {
    return NextResponse.json({
      error: "eventId (or messageId) and either clientId, clientEmail, or To/CC recipients are required.",
    }, { status: 400 });
  }

  const eventType = body.eventType?.trim() || "client.reply_detected";
  const { error: reserveError } = await supabaseAdmin
    .from("integration_inbound_events")
    .insert({
      provider: "make",
      external_event_id: eventId,
      event_type: eventType,
      payload: body,
      status: "processing",
    });

  if (reserveError?.code === "23505") {
    const { data: existing, error } = await supabaseAdmin
      .from("integration_inbound_events")
      .select("status, result")
      .eq("provider", "make")
      .eq("external_event_id", eventId)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (existing.status === "completed") {
      return NextResponse.json({ ok: true, duplicate: true, result: existing.result });
    }
    if (existing.status === "processing") {
      return NextResponse.json({ ok: true, duplicate: true, processing: true }, { status: 202 });
    }
    await setInboundEvent(eventId, { status: "processing", payload: body, last_error: null });
  } else if (reserveError) {
    return NextResponse.json({ error: reserveError.message }, { status: 500 });
  }

  try {
    let assignee: { id: string; full_name: string | null; email: string | null } | null = null;
    if (body.assigneeId?.trim() || body.assigneeEmail?.trim()) {
      let query = supabaseAdmin.from("profiles").select("id, full_name, email");
      query = body.assigneeId?.trim()
        ? query.eq("id", body.assigneeId.trim())
        : query.ilike("email", body.assigneeEmail!.trim());
      const { data, error } = await query.maybeSingle();
      if (error || !data) throw new Error(error?.message ?? "The replying assignee was not found.");
      assignee = data;
    }

    let clientCandidates: Array<{ id: string; name: string; email: string | null; reply_status: string | null; created_at: string }> = [];
    if (requestedClientId) {
      const { data, error } = await supabaseAdmin
        .from("clients")
        .select("id, name, email, reply_status, created_at")
        .eq("id", requestedClientId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (data) clientCandidates = [data];
    } else {
      const lookupEmails = clientEmail ? [clientEmail] : recipientCandidates;
      const matches = await Promise.all(lookupEmails.map(async (email) => {
        const { data, error } = await supabaseAdmin
          .from("clients")
          .select("id, name, email, reply_status, created_at")
          .ilike("email", escapedIlike(email))
          .order("created_at", { ascending: false });
        if (error) throw new Error(error.message);
        return data ?? [];
      }));
      const uniqueMatches = new Map(matches.flat().map((candidate) => [candidate.id, candidate]));
      clientCandidates = [...uniqueMatches.values()].sort(
        (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
      );
    }
    if (!clientCandidates.length) {
      throw new Error(`No CRM client was found for ${requestedClientId ? "that client ID" : clientEmail || "the To/CC recipients"}.`);
    }

    if (assignee) {
      const candidateIds = clientCandidates.map((candidate) => candidate.id);
      const { data: assignments, error: assignmentError } = await supabaseAdmin
        .from("client_assignees")
        .select("client_id")
        .eq("user_id", assignee.id)
        .in("client_id", candidateIds);
      if (assignmentError) throw new Error(assignmentError.message);
      const assignedIds = new Set((assignments ?? []).map((assignment) => assignment.client_id));
      clientCandidates = clientCandidates.filter((candidate) => assignedIds.has(candidate.id));
      if (!clientCandidates.length) {
        throw new Error("The replying user is not assigned to a client with that email address.");
      }
    }

    // Email is only a temporary correlation key. If it matches repeat leads,
    // use the newest lead (after narrowing to the sender's assignments).
    const client = clientCandidates[0];
    const clientId = client.id;

    const oldStatus = client.reply_status ?? "";
    let repliedOptionId: string | null = null;
    const { data: replyGroup } = await supabaseAdmin
      .from("option_groups")
      .select("id")
      .eq("code", "reply_status")
      .maybeSingle();
    if (replyGroup) {
      const { data: repliedOption } = await supabaseAdmin
        .from("option_values")
        .select("id")
        .eq("group_id", replyGroup.id)
        .ilike("value", "Replied")
        .maybeSingle();
      repliedOptionId = repliedOption?.id ?? null;
    }

    if (oldStatus !== "Replied") {
      const { error: updateError } = await supabaseAdmin
        .from("clients")
        .update({
          reply_status: "Replied",
          reply_status_option_id: repliedOptionId,
          waiting_started_at: null,
        })
        .eq("id", clientId);
      if (updateError) throw new Error(updateError.message);

      const actorName = assignee?.full_name?.trim()
        || assignee?.email
        || body.assigneeEmail?.trim()
        || "Email integration (Make)";
      const { error: activityError } = await supabaseAdmin.from("activity_log").insert({
        client_id: clientId,
        subitem_id: null,
        actor_name: actorName,
        action: "field_changed",
        field_name: "replyStatus",
        old_value: oldStatus,
        new_value: "Replied",
        subitem_name: null,
        link: null,
        title: "marked this client as replied from email",
        description: body.subject?.trim() || null,
        meta: {
          provider: "make",
          eventId,
          clientEmail: client.email?.trim().toLowerCase() || clientEmail || null,
          emailMatchCount: clientCandidates.length,
          messageId: body.messageId ?? null,
          from: body.from ?? null,
          to: body.to ?? [],
          cc: body.cc ?? [],
          sentAt: body.sentAt ?? null,
        },
        created_at: new Date().toISOString(),
      });
      if (activityError) throw new Error(activityError.message);
    }

    const result = {
      clientId,
      matchedBy: requestedClientId ? "clientId" : clientEmail ? "clientEmail" : "recipients",
      clientEmail: client.email?.trim().toLowerCase() || clientEmail || null,
      replyStatus: "Replied",
      alreadyReplied: oldStatus === "Replied",
    };
    await setInboundEvent(eventId, {
      status: "completed",
      result,
      last_error: null,
      processed_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reply update failed.";
    await setInboundEvent(eventId, { status: "failed", last_error: message.slice(0, 2000) });
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
