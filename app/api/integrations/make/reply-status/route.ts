import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

type ReplyDetectedBody = {
  eventId?: string;
  eventType?: string;
  clientId?: string;
  assigneeId?: string;
  assigneeEmail?: string;
  messageId?: string;
  sentAt?: string;
  subject?: string;
  from?: string;
  to?: string[];
  cc?: string[];
};

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
  const clientId = body.clientId?.trim() || "";
  if (!eventId || !clientId) {
    return NextResponse.json({ error: "eventId (or messageId) and clientId are required." }, { status: 400 });
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
    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id, name, reply_status")
      .eq("id", clientId)
      .single();
    if (clientError || !client) throw new Error(clientError?.message ?? "Client was not found.");

    let assignee: { id: string; full_name: string | null; email: string | null } | null = null;
    if (body.assigneeId?.trim() || body.assigneeEmail?.trim()) {
      let query = supabaseAdmin.from("profiles").select("id, full_name, email");
      query = body.assigneeId?.trim()
        ? query.eq("id", body.assigneeId.trim())
        : query.ilike("email", body.assigneeEmail!.trim());
      const { data, error } = await query.maybeSingle();
      if (error || !data) throw new Error(error?.message ?? "The replying assignee was not found.");
      assignee = data;

      const { data: assignment, error: assignmentError } = await supabaseAdmin
        .from("client_assignees")
        .select("client_id")
        .eq("client_id", clientId)
        .eq("user_id", assignee.id)
        .maybeSingle();
      if (assignmentError) throw new Error(assignmentError.message);
      if (!assignment) throw new Error("The replying user is not assigned to this client.");
    }

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

    const result = { clientId, replyStatus: "Replied", alreadyReplied: oldStatus === "Replied" };
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
