import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

type OutboxRow = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: "pending" | "processing" | "delivered" | "failed";
  attempt_count: number;
  created_at: string;
};

type LeadAssignedEvent = {
  ingestionId: string;
  clientId: string;
  assignedUserId: string;
  source: "wpforms" | "woocommerce";
  externalId: string;
  submissionType: string;
  customerName: string;
  companyName: string;
  clientEmail: string;
  clientPhone: string;
  requirements: string;
  nbd: string;
  billingAddress: string;
  orderNumber: string;
  orderTotal: string;
  currency: string;
  subitems: Array<{ name: string; qty: string }>;
};

function appBaseUrl() {
  const explicit = process.env.APP_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return vercel ? `https://${vercel.replace(/\/$/, "")}` : "";
}

function retryAt(attemptCount: number) {
  const minutes = [1, 5, 15, 60, 360, 720][Math.min(Math.max(attemptCount - 1, 0), 5)];
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export async function enqueueMakeEvent(
  eventType: string,
  dedupeKey: string,
  payload: Record<string, unknown>,
) {
  const { data, error } = await supabaseAdmin
    .from("integration_outbox")
    .insert({ event_type: eventType, dedupe_key: dedupeKey, payload })
    .select("id, event_type, payload, status, attempt_count, created_at")
    .single();

  if (!error) return data as OutboxRow;
  if (error.code !== "23505") throw new Error(error.message);

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("integration_outbox")
    .select("id, event_type, payload, status, attempt_count, created_at")
    .eq("dedupe_key", dedupeKey)
    .single();
  if (existingError) throw new Error(existingError.message);
  return existing as OutboxRow;
}

export async function deliverMakeOutboxEvent(id: string) {
  const attemptedAt = new Date().toISOString();
  const { data, error: claimError } = await supabaseAdmin
    .from("integration_outbox")
    .update({ status: "processing", last_attempt_at: attemptedAt, updated_at: attemptedAt })
    .eq("id", id)
    .in("status", ["pending", "failed"])
    .lte("available_at", attemptedAt)
    .select("id, event_type, payload, status, attempt_count, created_at")
    .maybeSingle();
  if (claimError) throw new Error(claimError.message);
  if (!data) return { id, skipped: true };

  const row = data as OutboxRow;
  const client = row.payload.client && typeof row.payload.client === "object"
    ? row.payload.client as Record<string, unknown>
    : {};
  const assignee = row.payload.assignee && typeof row.payload.assignee === "object"
    ? row.payload.assignee as Record<string, unknown>
    : {};
  const webhookUrl = process.env.MAKE_LEAD_ASSIGNED_WEBHOOK_URL?.trim();
  const secret = process.env.MAKE_INTEGRATION_SECRET?.trim();
  const nextAttemptCount = row.attempt_count + 1;

  try {
    if (!webhookUrl || !secret) {
      throw new Error("MAKE_LEAD_ASSIGNED_WEBHOOK_URL or MAKE_INTEGRATION_SECRET is not configured");
    }
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
        "X-Make-Apikey": secret,
        "X-CRM-Event-ID": row.id,
      },
      body: JSON.stringify({
        id: row.id,
        eventId: row.id,
        eventType: row.event_type,
        schemaVersion: 1,
        occurredAt: row.created_at,
        // Frequently mapped fields are duplicated at the top level because
        // Make occasionally keeps JSONB collections collapsed in its mapper.
        clientId: client.id ?? "",
        clientName: client.name ?? "",
        clientEmail: client.email ?? "",
        clientPhone: client.phone ?? "",
        clientRequirements: client.requirements ?? "",
        clientBoardUrl: client.boardUrl ?? "",
        assigneeId: assignee.id ?? "",
        assigneeName: assignee.name ?? "",
        assigneeEmail: assignee.email ?? "",
        data: row.payload,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const responseText = (await response.text()).slice(0, 2000);
    if (!response.ok) {
      throw new Error(`Make returned ${response.status}${responseText ? `: ${responseText}` : ""}`);
    }
    const deliveredAt = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("integration_outbox")
      .update({
        status: "delivered",
        attempt_count: nextAttemptCount,
        delivered_at: deliveredAt,
        response_status: response.status,
        last_error: null,
        updated_at: deliveredAt,
      })
      .eq("id", row.id);
    if (error) throw new Error(error.message);
    return { id: row.id, delivered: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Make delivery error";
    const { error: saveError } = await supabaseAdmin
      .from("integration_outbox")
      .update({
        status: "failed",
        attempt_count: nextAttemptCount,
        available_at: retryAt(nextAttemptCount),
        last_error: message.slice(0, 2000),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (saveError) console.error("Failed to record Make delivery failure", saveError);
    return { id: row.id, delivered: false, error: message };
  }
}

export async function dispatchPendingMakeEvents(limit = 20) {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - 5 * 60_000).toISOString();
  await supabaseAdmin
    .from("integration_outbox")
    .update({ status: "failed", available_at: now.toISOString(), updated_at: now.toISOString(), last_error: "Recovered stale processing claim" })
    .eq("status", "processing")
    .lt("last_attempt_at", staleBefore);

  const { data, error } = await supabaseAdmin
    .from("integration_outbox")
    .select("id")
    .in("status", ["pending", "failed"])
    .lte("available_at", now.toISOString())
    .order("created_at", { ascending: true })
    .limit(Math.max(1, Math.min(limit, 50)));
  if (error) throw new Error(error.message);
  return Promise.all((data ?? []).map((row) => deliverMakeOutboxEvent(row.id)));
}

export async function queueLeadAssignedMakeEvent(input: LeadAssignedEvent) {
  const { data: assignee, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", input.assignedUserId)
    .single();
  if (error) throw new Error(error.message);

  const row = await enqueueMakeEvent(
    "lead.assigned",
    `lead.assigned:${input.ingestionId}`,
    {
      ingestionId: input.ingestionId,
      source: input.source,
      externalId: input.externalId,
      submissionType: input.submissionType,
      client: {
        id: input.clientId,
        name: input.customerName || input.companyName,
        customerName: input.customerName,
        companyName: input.companyName,
        email: input.clientEmail,
        phone: input.clientPhone,
        requirements: input.requirements,
        nbd: input.nbd,
        billingAddress: input.billingAddress,
        orderNumber: input.orderNumber,
        orderTotal: input.orderTotal,
        currency: input.currency,
        subitems: input.subitems,
        boardUrl: appBaseUrl() ? `${appBaseUrl()}/app?clientId=${encodeURIComponent(input.clientId)}` : "",
      },
      assignee: {
        id: assignee.id,
        name: assignee.full_name?.trim() || assignee.email,
        email: assignee.email,
      },
    },
  );
  return deliverMakeOutboxEvent(row.id);
}
