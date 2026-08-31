import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureCustomerProfilesForLead } from "@/lib/customer-profile-links";

export type InboundSubitem = { name: string; qty: string };

export type NormalizedInboundLead = {
  source: "wpforms" | "woocommerce";
  submissionType: string;
  externalId: string;
  customerName: string;
  companyName: string;
  email: string;
  phone: string;
  notes: string;
  nbd: string;
  channel: "Forms" | "E-comm";
  orderNumber: string;
  currency: string;
  orderTotal: string;
  companyAddress: string;
  billingAddress: string;
  qty: string;
  subitems: InboundSubitem[];
};

type IngestionRow = {
  id: string;
  source: string;
  external_id: string;
  status: "processing" | "completed" | "failed";
  client_id: string | null;
  assigned_user_id: string | null;
  subitems_created: boolean;
  activity_logged: boolean;
  notification_sent: boolean;
  attempt_count: number;
  updated_at: string;
};

export type InboundResult = {
  ok: true;
  duplicate?: boolean;
  processing?: boolean;
  clientId?: string | null;
  assignedUserId?: string | null;
  subitemsInserted?: number;
  statusCode: number;
  message: string;
};

export class InboundLeadError extends Error {
  constructor(message: string, public readonly statusCode = 500) {
    super(message);
  }
}

const INGESTION_COLUMNS = "id, source, external_id, status, client_id, assigned_user_id, subitems_created, activity_logged, notification_sent, attempt_count, updated_at";

export function asText(value: unknown, fallback = "") {
  if (value == null) return fallback;
  return String(value).trim();
}

export function asNumberString(value: unknown, fallback = "") {
  if (value == null || value === "") return fallback;
  const number = typeof value === "number" ? value : Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(number) ? String(number) : fallback;
}

export function formatOptionalDate(value: unknown) {
  if (value == null || value === "") return "";
  const text = asText(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new InboundLeadError("Invalid NBD date", 400);
  return singaporeDate(date);
}

export function normalizeSubitems(input: unknown): InboundSubitem[] {
  let value = input;
  if (typeof value === "string" && value.trim()) {
    try {
      value = JSON.parse(value);
      if (typeof value === "string") value = JSON.parse(value);
    } catch {
      const raw = input as string;
      return raw.split("\n").map((line) => line.trim()).filter(Boolean).map((name) => ({ name, qty: "" }));
    }
  }
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return { name: asText(record.name, "Untitled subitem"), qty: asNumberString(record.qty) };
  });
}

export function validateInboundLead(lead: NormalizedInboundLead) {
  if (!lead.externalId) throw new InboundLeadError("Missing externalId", 400);
  if (!lead.customerName && !lead.companyName) throw new InboundLeadError("A customer or company name is required", 400);
  if (!lead.email && !lead.phone) throw new InboundLeadError("An email address or phone number is required", 400);
}

function singaporeDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addWorkingDays(dateText: string, days: number) {
  const date = new Date(`${dateText}T04:00:00Z`);
  let remaining = days;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return date.toISOString().slice(0, 10);
}

function safePayload(lead: NormalizedInboundLead) {
  return {
    customerName: lead.customerName,
    companyName: lead.companyName,
    email: lead.email,
    phone: lead.phone,
    notes: lead.notes,
    nbd: lead.nbd,
    channel: lead.channel,
    orderNumber: lead.orderNumber,
    currency: lead.currency,
    orderTotal: lead.orderTotal,
    companyAddress: lead.companyAddress,
    billingAddress: lead.billingAddress,
    qty: lead.qty,
    subitems: lead.subitems,
  };
}

async function reserveIngestion(lead: NormalizedInboundLead): Promise<{ row: IngestionRow; earlyResult?: InboundResult }> {
  const { data: existing, error: readError } = await supabaseAdmin.from("lead_ingestions").select(INGESTION_COLUMNS).eq("source", lead.source).eq("external_id", lead.externalId).maybeSingle();
  if (readError) throw new InboundLeadError(readError.message);

  if (existing) {
    const row = existing as IngestionRow;
    if (row.status === "completed") return { row, earlyResult: { ok: true, duplicate: true, clientId: row.client_id, assignedUserId: row.assigned_user_id, statusCode: 200, message: "This inbound lead was already processed" } };
    const updatedAt = new Date(row.updated_at).getTime();
    if (row.status === "processing" && Number.isFinite(updatedAt) && Date.now() - updatedAt < 120_000) {
      return { row, earlyResult: { ok: true, processing: true, clientId: row.client_id, assignedUserId: row.assigned_user_id, statusCode: 202, message: "This inbound lead is currently being processed" } };
    }
    const { data, error } = await supabaseAdmin.from("lead_ingestions").update({ status: "processing", payload: safePayload(lead), last_error: null, attempt_count: row.attempt_count + 1, updated_at: new Date().toISOString() }).eq("id", row.id).select(INGESTION_COLUMNS).single();
    if (error) throw new InboundLeadError(error.message);
    return { row: data as IngestionRow };
  }

  const { data, error } = await supabaseAdmin.from("lead_ingestions").insert({ source: lead.source, external_id: lead.externalId, submission_type: lead.submissionType, payload: safePayload(lead) }).select(INGESTION_COLUMNS).single();
  if (error?.code === "23505") return reserveIngestion(lead);
  if (error) throw new InboundLeadError(error.message);
  return { row: data as IngestionRow };
}

async function updateIngestion(id: string, values: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin.from("lead_ingestions").update({ ...values, updated_at: new Date().toISOString() }).eq("id", id).select(INGESTION_COLUMNS).single();
  if (error) throw new InboundLeadError(error.message);
  return data as IngestionRow;
}

async function createSubitems(clientId: string, lead: NormalizedInboundLead) {
  if (!lead.subitems.length) return 0;
  const { data: existing, error: existingError } = await supabaseAdmin.from("subitems").select("id").eq("client_id", clientId).contains("custom_fields", { inbound_source: lead.source, inbound_external_id: lead.externalId }).limit(1);
  if (existingError) throw new InboundLeadError(existingError.message);
  if (existing?.length) return 0;
  const { data: lastSubitem, error: positionError } = await supabaseAdmin.from("subitems").select("position").eq("client_id", clientId).order("position", { ascending: false }).limit(1).maybeSingle();
  if (positionError) throw new InboundLeadError(positionError.message);
  const firstPosition = Number(lastSubitem?.position ?? -1) + 1;
  const rows = lead.subitems.map((item, index) => ({
    position: firstPosition + index,
    client_id: clientId, name: item.name, people: "", status: "", qty: item.qty, description: "", remarks: "", shipper: "", supplier: "", cost: "", ls: "", os: "", tc: "", uc: "", tc_sgd: "", price: "", up: "", owner: "", payment_status: "", manpower: "", ls_rmb: "", total_c: "", mode_of_payment: "", order_number: lead.orderNumber, quantity_produced: "", sample: "", qty_for: "", payment_amount: "", difference: "", local_overseas: "Local", num_of_cartons: "", payment_remarks: "", cn_tracking: "", sg_tracking: "", sample_order_status: "", sample_status: "", sample_type: "", timeline_rows: [], show_timeline: false, show_payments: false, sample_rows: [], show_sample: false, pl: null, sl: null, currency: lead.currency, c_sgd: null, manpower_rmb: null, total_uc: null, custom_fields: { inbound_source: lead.source, inbound_external_id: lead.externalId },
  }));
  const { error } = await supabaseAdmin.from("subitems").insert(rows);
  if (error) throw new InboundLeadError(error.message);
  return rows.length;
}

export async function ingestLead(lead: NormalizedInboundLead): Promise<InboundResult> {
  validateInboundLead(lead);
  const reservation = await reserveIngestion(lead);
  if (reservation.earlyResult) return reservation.earlyResult;
  let ingestion = reservation.row;

  try {
    if (!ingestion.assigned_user_id) {
      const { data, error } = await supabaseAdmin.rpc("assign_lead_ingestion_sales_user", { ingestion_id: ingestion.id });
      if (error) throw new InboundLeadError(error.message);
      if (typeof data !== "string" || !data) throw new InboundLeadError("No sales assignee returned from Round Robin");
      ingestion = await updateIngestion(ingestion.id, { assigned_user_id: data });
    }

    if (!ingestion.client_id) {
      const { data: recoveredClients, error: recoveryError } = await supabaseAdmin.from("clients").select("id").contains("custom_fields", { source: lead.source, external_id: lead.externalId }).limit(1);
      if (recoveryError) throw new InboundLeadError(recoveryError.message);
      if (recoveredClients?.[0]?.id) ingestion = await updateIngestion(ingestion.id, { client_id: recoveredClients[0].id });
    }

    if (!ingestion.client_id) {
      const { data: groups, error: groupError } = await supabaseAdmin.from("crm_groups").select("id, name").ilike("name", "New Lead").order("sort_order").limit(1);
      if (groupError) throw new InboundLeadError(groupError.message);
      const groupId = groups?.[0]?.id;
      if (!groupId) throw new InboundLeadError('crm_groups row "New Lead" not found');
      const createdAt = new Date().toISOString();
      const dateCreated = singaporeDate();
      const { data: client, error: clientError } = await supabaseAdmin.from("clients").insert({
        name: lead.customerName || lead.companyName,
        people: "",
        reply_status: "Waiting...",
        follow_up: addWorkingDays(dateCreated, 3),
        status: "New Lead",
        channel: lead.channel,
        importance: "",
        company: lead.companyName,
        email: lead.email,
        phone: lead.phone,
        requirements: lead.notes,
        nbd: lead.nbd,
        total_price: lead.orderTotal,
        company_address: lead.companyAddress,
        billing_address: lead.billingAddress,
        created_at: createdAt,
        waiting_started_at: createdAt,
        expanded: false,
        color: "#7BCBD5",
        activity_log: [],
        group_id: groupId,
        custom_fields: { source: lead.source, submissionType: lead.submissionType, external_id: lead.externalId, qty: lead.qty, orderNumber: lead.orderNumber, currency: lead.currency, requested_nbd: lead.nbd },
      }).select("id").single();
      if (clientError) throw new InboundLeadError(clientError.message);
      ingestion = await updateIngestion(ingestion.id, { client_id: client.id });
    }

    const clientId = ingestion.client_id;
    const assignedUserId = ingestion.assigned_user_id;
    if (!clientId || !assignedUserId) throw new InboundLeadError("Inbound processing did not retain its client or assignee");

    await ensureCustomerProfilesForLead({ clientId, clientName: lead.customerName || lead.companyName, phone: lead.phone, company: lead.companyName, createdBy: assignedUserId });

    const { data: assignment, error: assignmentReadError } = await supabaseAdmin.from("client_assignees").select("client_id").eq("client_id", clientId).eq("user_id", assignedUserId).maybeSingle();
    if (assignmentReadError) throw new InboundLeadError(assignmentReadError.message);
    if (!assignment) {
      const { error } = await supabaseAdmin.from("client_assignees").insert({ client_id: clientId, user_id: assignedUserId, assigned_by: null });
      if (error) throw new InboundLeadError(error.message);
    }

    let subitemsInserted = 0;
    if (!ingestion.subitems_created) {
      subitemsInserted = await createSubitems(clientId, lead);
      ingestion = await updateIngestion(ingestion.id, { subitems_created: true });
    }

    if (!ingestion.activity_logged) {
      const sourceLabel = lead.source === "woocommerce" ? "WooCommerce" : "WPForms";
      const { data: existingActivity, error: activityReadError } = await supabaseAdmin.from("activity_log").select("id").eq("client_id", clientId).contains("meta", { ingestionId: ingestion.id }).limit(1);
      if (activityReadError) throw new InboundLeadError(activityReadError.message);
      if (!existingActivity?.length) {
        const { error } = await supabaseAdmin.from("activity_log").insert({ client_id: clientId, subitem_id: null, actor_name: "Inbound integration", action: "client_added", field_name: null, old_value: null, new_value: null, subitem_name: null, link: null, title: `created this client from ${sourceLabel}`, description: `Inbound reference: ${lead.externalId}`, meta: { ingestionId: ingestion.id, source: lead.source, submissionType: lead.submissionType, externalId: lead.externalId, assignedUserId }, created_at: new Date().toISOString() });
        if (error) throw new InboundLeadError(error.message);
      }
      ingestion = await updateIngestion(ingestion.id, { activity_logged: true });
    }

    if (!ingestion.notification_sent) {
      const dedupeKey = `inbound:${lead.source}:${lead.externalId}:${assignedUserId}`;
      const { data: existingNotification, error: notificationReadError } = await supabaseAdmin.from("notifications").select("id").eq("dedupe_key", dedupeKey).maybeSingle();
      if (notificationReadError) throw new InboundLeadError(notificationReadError.message);
      if (!existingNotification) {
        const { error } = await supabaseAdmin.from("notifications").insert({ user_id: assignedUserId, client_id: clientId, type: "info", message: `${lead.customerName || lead.companyName} was assigned to you as a new ${lead.source === "woocommerce" ? "WooCommerce" : "WPForms"} lead.`, read: false, dedupe_key: dedupeKey });
        if (error) throw new InboundLeadError(error.message);
      }
      ingestion = await updateIngestion(ingestion.id, { notification_sent: true });
    }

    const { error: completionError } = await supabaseAdmin.from("lead_ingestions").update({ status: "completed", last_error: null, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", ingestion.id);
    if (completionError) throw new InboundLeadError(completionError.message);
    return { ok: true, clientId, assignedUserId, subitemsInserted, statusCode: 201, message: `${lead.source === "woocommerce" ? "WooCommerce" : "WPForms"} lead created successfully` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inbound lead processing failed";
    await supabaseAdmin.from("lead_ingestions").update({ status: "failed", last_error: message.slice(0, 2000), updated_at: new Date().toISOString() }).eq("id", ingestion.id);
    throw error instanceof InboundLeadError ? error : new InboundLeadError(message);
  }
}
