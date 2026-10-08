// fetches clients with nested subitems
// maps db rows to client
// maps client/subitem updates back into db column names
// maps & fetches activity log
// exposes crud functions

import { createClient } from "@/lib/supabase/client";
import type {
  TimelineRow,
  Client,
  Subitem,
  ActivityEntry,
  PaymentRow,
} from "@/app/types";
import { addClientAssignee } from "./assignments";
import { capitaliseFirstCharacter } from "./text-format";

const supabase = createClient();

// Supplier cells occasionally hold a contact/link rather than a supplier
// identity. Those values must stay as Board text only, never as profiles.
const supplierValueContainsUrl = (value: string) =>
  /(?:https?:\/\/|ftp:\/\/|www\.|Wechat:|mailto:)[^\s]+/i.test(value);

const CLIENT_LOG_IGNORE_FIELDS = new Set<keyof Client>([
  "expanded",
  "activityLog",
  "color",
  "subitems",
  "customFields",
  // These are implementation IDs for the label columns. The corresponding
  // human-readable fields (status, channel, etc.) are logged separately.
  "replyStatusOptionId",
  "statusOptionId",
  "channelOptionId",
  "importanceOptionId",
  "progressOptionId",
]);

const SUBITEM_LOG_IGNORE_FIELDS = new Set<keyof Subitem>([
  "showTimeline",
  "showPayments",
  "showSample",
  "customFields",
]);

export const isAdditionalCostSubitem = (
  subitem: Pick<Subitem, "customFields">,
) => subitem.customFields?.additionalCostLinked === "true";

export type RoundRobinQueueRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  position: number;
  is_active: boolean;
  is_current: boolean;
  list_name?: "sales" | "whatsapp" | "out";
};

export type RoundRobinQueueResponse = {
  queue: RoundRobinQueueRow[];
  pointer: number;
  canEdit: boolean;
  members: Array<{
    id: string;
    full_name: string | null;
    email: string | null;
    avatar_url?: string | null;
    role?: string | null;
  }>;
};

export async function saveSalesRoundRobinLayout(
  rows: Array<{
    user_id: string;
    list_name: "sales" | "whatsapp" | "out";
    position: number;
  }>,
) {
  const response = await fetch("/api/round-robin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "save-layout", layout: rows }),
  });
  if (!response.ok)
    throw new Error(
      (await response.json()).error ?? "Could not save round robin layout.",
    );
}

export async function getSalesRoundRobinPointer() {
  const response = await fetch("/api/round-robin");
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "Could not load round robin.");
  return Number(result.pointer ?? 0);
}

export async function setSalesRoundRobinPointer(position: number) {
  const response = await fetch("/api/round-robin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "set-pointer", position }),
  });
  if (!response.ok)
    throw new Error(
      (await response.json()).error ?? "Could not set round robin pointer.",
    );
}

export async function getSalesRoundRobinQueue() {
  const response = await fetch("/api/round-robin");
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "Could not load round robin.");
  return {
    queue: (result.queue ?? []) as RoundRobinQueueRow[],
    pointer: Number(result.pointer ?? 0),
    canEdit: result.canEdit === true,
    members: result.members ?? [],
  } satisfies RoundRobinQueueResponse;
}

export async function getNextSalesAssignee() {
  const response = await fetch("/api/round-robin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "get-next" }),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "Could not load round robin.");
  return (result.next ?? null) as { user_id: string; position: number } | null;
}

export async function swapSalesRoundRobinFunctions(
  firstUserId: string,
  secondUserId: string,
) {
  const response = await fetch("/api/round-robin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "swap", firstUserId, secondUserId }),
  });
  if (!response.ok)
    throw new Error(
      (await response.json()).error ?? "Could not swap round robin positions.",
    );
}

export async function setSalesRoundRobinActive(
  userId: string,
  isActive: boolean,
) {
  const response = await fetch("/api/round-robin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "set-active", userId, isActive }),
  });
  if (!response.ok)
    throw new Error(
      (await response.json()).error ?? "Could not update round robin member.",
    );
}
type Subitems = {
  id: string;
  display_id?: string | null;
  client_id: string;
  position: number | null;
  created_at: string | null;
  waiting_started_at: string | null;
  name: string | null;
  people: string | null;
  status: string | null;
  status_option_id?: string | null;
  local_overseas: string | null;
  local_overseas_option_id?: string | null;
  qty: string | null;
  description: string | null;
  remarks: string | null;
  shipper: string | null;
  shipper_option_id?: string | null;
  supplier: string | null;
  cost: string | null;
  manpower: string | null;
  manpower_rmb: string | null;
  ls: string | null;
  os: string | null;
  currency: string | null;
  currency_option_id?: string | null;
  c_sgd: string | null;
  tc: string | null;
  uc: string | null;
  tc_sgd: string | null;
  price: string | null;
  up: string | null;
  num_of_cartons: string | null;
  cn_tracking: string | null;
  sg_tracking: string | null;
  pl: string | null;
  sl: string | null;
  owner: string | null;
  payment: string | null;
  payment_option_id?: string | null;
  payment_status: string | null;
  payment_status_option_id?: string | null;
  total_uc: string | null;
  ls_rmb: string | null;
  total_c: string | null;
  mode_of_payment: string | null;
  mode_of_payment_option_id?: string | null;
  order_number: string | null;
  quantity_produced: string | null;
  qty_free: string | null;
  sample: string | null;
  qty_total: string | null;
  qty_we_keep: string | null;
  qty_for: string | null;
  payment_amount: string | null;
  difference: string | null;
  payment_remarks: string | null;
  payment_rows?: Array<{
    id: string;
    position: number | null;
    amount: string | null;
    order_number: string | null;
    payment_received: boolean | null;
    payment_received_label?: string | null;
    payment_received_option_id?: string | null;
    mode_of_payment: string | null;
    mode_of_payment_option_id: string | null;
  }> | null;
  timeline_rows: any[] | null;
  timeline_groups?: any[] | null;
  show_timeline: boolean | null;
  show_payments: boolean | null;
  show_sample: boolean | null;
  sample_rows: any[] | null;
  sample_order_status: string | null;
  sample_status: string | null;
  sample_type: string | null;
  custom_fields?: Record<string, string>;
  shipper_id: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deleted_with_client_id?: string | null;
};

type Clients = {
  id: string;
  display_id?: string | null;
  name: string | null;
  people: string | null;
  reply_status: string | null;
  reply_status_option_id?: string | null;
  follow_up: string | null;
  status: string | null;
  status_option_id?: string | null;
  channel: string | null;
  channel_option_id?: string | null;
  importance: string | null;
  importance_option_id?: string | null;
  progress: string | null;
  progress_option_id?: string | null;
  tracking_overall_price_invoice_match?: string | null;
  tracking_overall_price_invoice_match_option_id?: string | null;
  tracking_total_price?: number | null;
  tracking_quote_subtotal?: number | null;
  tracking_quote_total?: number | null;
  tracking_invoice_subtotal?: number | null;
  tracking_invoice_total?: number | null;
  tracking_invoice_numbers?: string | null;
  tracking_overall_invoice_payment_status?: string | null;
  tracking_overall_invoice_payment_status_option_id?: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  requirements: string | null;
  unqualified_reason: string | null;
  qty: string | null;
  nbd: string | null;
  total_price: string | null;
  billing_address: string | null;
  created_at: string | null;
  waiting_started_at: string | null;
  group_id: string;
  expanded: boolean | null;
  color: string | null;
  activity_log?: ActivityLogRow[] | null;
  ocf_status?: {
    hasCreated: boolean;
    hasSigned: boolean;
  };
  subitems?: Subitems[];
  custom_fields?: Record<string, string>;
  deleted_at?: string | null;
  deleted_by?: string | null;
};

export type DeletedBinItem = {
  id: string;
  type: "client" | "subitem";
  name: string;
  clientId?: string;
  clientName?: string;
  deletedAt: string;
  expiresAt: string;
  subitemCount?: number;
  parentDeleted?: boolean;
  isPaymentVoucher?: boolean;
};

type ActivityLogRow = {
  id: string;
  client_id: string;
  subitem_id: string | null;
  actor_name: string | null;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  subitem_name: string | null;
  created_at: string;
  link: string | null;
  title: string | null;
  description: string | null;
  meta: Record<string, any> | null;
};

const TIMELINE_LOG_FIELDS: Array<keyof TimelineRow> = [
  "person",
  "remarks",
  "subProgress",
  "timelineStart",
  "timelineEnd",
  "duration",
  "dependency",
];
const BIN_RETENTION_MS = 30 * 86_400_000;
function isEqualForLog(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function formatValueForLog(value: unknown): unknown {
  if (value == null) return null;

  if (Array.isArray(value)) {
    return value;
  }

  return value;
}
async function logTimelineRowDiffs(params: {
  clientId: string;
  subitemId: string;
  subitemName: string;
  oldRows: TimelineRow[];
  newRows: TimelineRow[];
}) {
  const oldMap = new Map(params.oldRows.map((row) => [row.id, row]));
  const newMap = new Map(params.newRows.map((row) => [row.id, row]));

  for (const [rowId, newRow] of newMap.entries()) {
    const oldRow = oldMap.get(rowId);

    if (!oldRow) {
      await insertActivityLog({
        clientId: params.clientId,
        subitemId: params.subitemId,
        subitemName: params.subitemName,
        action: "subitem_field_changed",
        fieldName: `timeline row ${newRow.name ?? rowId} added`,
        oldValue: null,
        newValue: newRow,
      });
      continue;
    }

    for (const field of TIMELINE_LOG_FIELDS) {
      const oldValue = oldRow[field] ?? "";
      const newValue = newRow[field] ?? "";

      if (isEqualForLog(oldValue, newValue)) continue;

      await insertActivityLog({
        clientId: params.clientId,
        subitemId: params.subitemId,
        subitemName: params.subitemName,
        action: "subitem_field_changed",
        fieldName: `timeline:${newRow.name ?? rowId}:${String(field)}`,
        oldValue,
        newValue,
      });
    }
  }
  for (const [rowId, oldRow] of oldMap.entries()) {
    if (newMap.has(rowId)) continue;

    await insertActivityLog({
      clientId: params.clientId,
      subitemId: params.subitemId,
      subitemName: params.subitemName,
      action: "subitem_field_changed",
      fieldName: `timeline row ${oldRow.name ?? rowId} removed`,
      oldValue: oldRow,
      newValue: null,
    });
  }
}

function mapActivityEntry(row: ActivityLogRow): ActivityEntry {
  return {
    id: row.id,
    clientId: row.client_id,
    actorName: row.actor_name ?? "Unknown user",
    action: row.action as ActivityEntry["action"],
    fieldName: row.field_name ?? "",
    oldValue: row.old_value ?? "",
    newValue: row.new_value ?? "",
    subitemId: row.subitem_id ?? undefined,
    subitemName: row.subitem_name ?? "",
    createdAt: row.created_at,
    link: row.link ?? null,
    title: row.title ?? null,
    description: row.description ?? null,
    meta: row.meta ?? null,
  };
}
export function mapSubitems(row: Subitems): Subitem {
  return {
    id: row.id,
    displayId: row.display_id ?? "",
    createdAt: row.created_at ?? null,
    position: row.position ?? Number.MAX_SAFE_INTEGER,
    name: row.name ?? "",
    people: row.people ?? "",
    status: row.status ?? "",
    statusOptionId: row.status_option_id ?? null,
    localOverseas: row.local_overseas ?? "Local",
    localOverseasOptionId: row.local_overseas_option_id ?? null,
    qty: row.qty ?? "",
    description: row.description ?? "",
    remarks: row.remarks ?? "",
    shipper: row.shipper ?? "",
    shipperOptionId: row.shipper_option_id ?? null,
    supplier: row.supplier ?? "",
    cost: row.cost ?? "",
    manpower: row.manpower ?? "",
    manpowerRmb: row.manpower_rmb ?? "",
    ls: row.ls ?? "",
    os: row.os ?? "",
    currency: row.currency ?? "",
    currencyOptionId: row.currency_option_id ?? null,
    cSgd: row.c_sgd ?? "",
    tc: row.tc ?? "",
    uc: row.uc ?? "",
    tcSgd: row.tc_sgd ?? "",
    price: row.price ?? "",
    up: row.up ?? "",
    numOfCartons: row.num_of_cartons ?? "",
    cnTracking: row.cn_tracking ?? "",
    sgTracking: row.sg_tracking ?? "",
    pl: row.pl ?? "",
    sl: row.sl ?? "",
    owner: row.owner ?? "",
    payment: row.payment ?? "",
    paymentOptionId: row.payment_option_id ?? null,
    paymentStatus: row.payment_status ?? "",
    paymentStatusOptionId: row.payment_status_option_id ?? null,
    totalUc: row.total_uc ?? "",
    lsRmb: row.ls_rmb ?? "",
    totalC: row.total_c ?? "",
    modeOfPayment: row.mode_of_payment ?? "",
    modeOfPaymentOptionId: row.mode_of_payment_option_id ?? null,
    orderNumber: row.order_number ?? "",
    quantityProduced: row.quantity_produced ?? "",
    qtyFree: row.qty_free ?? "",
    sample: row.sample ?? "",
    qtyTotal: row.qty_total ?? "",
    qtyWeKeep: row.qty_we_keep ?? "",
    qtyFor: row.qty_for ?? "",
    paymentAmount: row.payment_amount ?? "",
    difference: row.difference ?? "",
    paymentRemarks: row.payment_remarks ?? "",
    paymentRows: (row.payment_rows ?? [])
      .map((paymentRow) => ({
        id: paymentRow.id,
        position: paymentRow.position ?? 0,
        amount: paymentRow.amount ?? "",
        orderNumber: paymentRow.order_number ?? "",
        paymentReceived: paymentRow.payment_received ?? null,
        paymentReceivedLabel:
          paymentRow.payment_received_label ??
          (paymentRow.payment_received === null
            ? ""
            : paymentRow.payment_received
              ? "Yes"
              : "No"),
        paymentReceivedOptionId: paymentRow.payment_received_option_id ?? null,
        modeOfPayment: paymentRow.mode_of_payment ?? "",
        modeOfPaymentOptionId: paymentRow.mode_of_payment_option_id ?? null,
      }))
      .sort((first, second) => first.position - second.position),
    timelineRows: row.timeline_rows ?? [],
    timelineGroups:
      Array.isArray(row.timeline_groups) && row.timeline_groups.length
        ? row.timeline_groups
        : [
            {
              id: "default",
              cnTracking: row.cn_tracking ?? "",
              sgTracking: row.sg_tracking ?? "",
              rows: row.timeline_rows ?? [],
              isDefault: true,
            },
          ],
    showTimeline: row.show_timeline ?? false,
    showPayments: row.show_payments ?? false,
    showSample: row.show_sample ?? false,
    sampleRows: row.sample_rows ?? [],
    sampleOrderStatus: row.sample_order_status ?? "",
    sampleStatus: row.sample_status ?? "",
    sampleType: row.sample_type ?? "",
    customFields: row.custom_fields ?? {},
    shipperId: row.shipper_id ?? null,
  };
}

function mapClients(row: Clients): Client {
  return {
    id: row.id,
    displayId: row.display_id ?? "",
    name: row.name ?? "",
    people: row.people ?? "",
    replyStatus: row.reply_status ?? "",
    replyStatusOptionId: row.reply_status_option_id ?? null,
    followUp: row.follow_up ?? "",
    status: (row.status as Client["status"]) ?? "New Lead",
    statusOptionId: row.status_option_id ?? null,
    channel: row.channel ?? "",
    channelOptionId: row.channel_option_id ?? null,
    importance: row.importance ?? "",
    importanceOptionId: row.importance_option_id ?? null,
    progress: row.progress ?? "",
    progressOptionId: row.progress_option_id ?? null,
    trackingOverallPriceInvoiceMatch:
      row.tracking_overall_price_invoice_match ?? null,
    trackingOverallPriceInvoiceMatchOptionId:
      row.tracking_overall_price_invoice_match_option_id ?? null,
    trackingTotalPrice: row.tracking_total_price ?? null,
    trackingQuoteSubtotal: row.tracking_quote_subtotal ?? null,
    trackingQuoteTotal: row.tracking_quote_total ?? null,
    trackingInvoiceSubtotal: row.tracking_invoice_subtotal ?? null,
    trackingInvoiceTotal: row.tracking_invoice_total ?? null,
    trackingInvoiceNumbers: row.tracking_invoice_numbers ?? "",
    trackingOverallInvoicePaymentStatus:
      row.tracking_overall_invoice_payment_status ?? null,
    trackingOverallInvoicePaymentStatusOptionId:
      row.tracking_overall_invoice_payment_status_option_id ?? null,
    company: row.company ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    requirements: row.requirements ?? "",
    unqualifiedReason: row.unqualified_reason ?? "",
    nbd: row.nbd ?? "",
    totalPrice: row.total_price ?? "",
    billingAddress: row.billing_address ?? "",
    createdAt: row.created_at ?? "",
    waitingStartedAt: row.waiting_started_at ?? null,
    groupId: row.group_id ?? null,
    expanded: row.expanded ?? false,
    color: row.color ?? "#7BCBD5",
    // Board snapshots deliberately omit activity history. It is loaded on
    // demand after a user expands a client or opens a detail/timeline view.
    ...(row.activity_log === undefined
      ? {}
      : { activityLog: (row.activity_log ?? []).map(mapActivityEntry) }),
    ocfStatus: row.ocf_status,
    subitems: (row.subitems ?? [])
      .filter((subitem) => !subitem.deleted_at)
      .map(mapSubitems)
      .sort(
        (first, second) =>
          first.position - second.position ||
          (first.createdAt ?? "").localeCompare(second.createdAt ?? ""),
      ),
    customFields: row.custom_fields ?? {},
  };
}

async function insertActivityLog(params: {
  clientId: string;
  subitemId?: string | null;
  action:
    | "field_changed"
    | "assignment_changed"
    | "client_added"
    | "client_deleted"
    | "client_restored"
    | "subitem_added"
    | "subitem_deleted"
    | "subitem_restored"
    | "subitem_field_changed"
    | "ocf_created"
    | "ocf_signed"
    | "ocf_updated"
    | "estimate_created"
    | "file_uploaded"
    | "file_replaced"
    | "file_removed"
    | "shipper_pushed";
  fieldName?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  subitemName?: string | null;
  link?: string | null;
  title?: string | null;
  description?: string | null;
  meta?: Record<string, any> | null;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: actorProfile } = user
    ? await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };
  const actorName =
    actorProfile?.full_name?.trim() ||
    actorProfile?.email ||
    user?.email ||
    "Unknown user";

  const { data, error } = await supabase
    .from("activity_log")
    .insert({
      client_id: params.clientId,
      subitem_id: params.subitemId ?? null,
      actor_name: actorName,
      action: params.action,
      field_name: params.fieldName ?? null,
      old_value: params.oldValue ?? null,
      new_value: params.newValue ?? null,
      subitem_name: params.subitemName ?? null,
      link: params.link ?? null,
      title: params.title ?? null,
      description: params.description ?? null,
      meta: params.meta ?? null,
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    console.error("insertActivityLog error:", error);
    throw error;
  }
  return data;
}

type LoggedAttachment = {
  id?: string;
  name: string;
  url: string;
  storagePath?: string;
};

function fileAttachmentsForLog(value: unknown): LoggedAttachment[] {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    const items = Array.isArray(parsed) ? parsed : [parsed];
    return items
      .filter((item): item is Record<string, unknown> =>
        Boolean(
          item &&
          typeof item === "object" &&
          typeof (item as Record<string, unknown>).url === "string",
        ),
      )
      .map((item) => ({
        id: typeof item.id === "string" ? item.id : undefined,
        name: typeof item.name === "string" ? item.name : "File",
        url: String(item.url),
        storagePath:
          typeof item.storagePath === "string" ? item.storagePath : undefined,
      }));
  } catch {
    return [];
  }
}

async function logFileAttachmentDiffs(params: {
  clientId: string;
  subitemId?: string | null;
  subitemName?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}) {
  const before = params.before ?? {};
  const after = params.after ?? {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const oldFiles = fileAttachmentsForLog(before[key]);
    const newFiles = fileAttachmentsForLog(after[key]);
    if (!oldFiles.length && !newFiles.length) continue;
    const oldByIdentity = new Map(
      oldFiles.map((file) => [file.id ?? file.url, file]),
    );
    const newByIdentity = new Map(
      newFiles.map((file) => [file.id ?? file.url, file]),
    );
    if (
      oldFiles.length === 1 &&
      newFiles.length === 1 &&
      !oldByIdentity.has(newFiles[0].id ?? newFiles[0].url)
    ) {
      const retire = supabase
        .from("activity_log")
        .update({ link: null, description: "File has been replaced" })
        .eq("client_id", params.clientId);
      if (oldFiles[0].storagePath)
        await retire.contains("meta", { storagePath: oldFiles[0].storagePath });
      else
        await retire
          .eq("field_name", key)
          .contains("meta", { fileName: oldFiles[0].name });
      await insertActivityLog({
        clientId: params.clientId,
        subitemId: params.subitemId,
        subitemName: params.subitemName,
        action: "file_replaced",
        fieldName: key,
        title: `replaced ${oldFiles[0].name} with ${newFiles[0].name}`,
        link: newFiles[0].url,
        meta: {
          field: key,
          previousFileName: oldFiles[0].name,
          fileName: newFiles[0].name,
          storagePath: newFiles[0].storagePath,
        },
      });
      continue;
    }
    for (const file of newFiles) {
      const previous = oldByIdentity.get(file.id ?? file.url);
      if (!previous)
        await insertActivityLog({
          clientId: params.clientId,
          subitemId: params.subitemId,
          subitemName: params.subitemName,
          action: "file_uploaded",
          fieldName: key,
          title: `uploaded ${file.name}`,
          link: file.url,
          meta: {
            field: key,
            fileName: file.name,
            storagePath: file.storagePath,
          },
        });
      else if (previous.url !== file.url || previous.name !== file.name)
        await insertActivityLog({
          clientId: params.clientId,
          subitemId: params.subitemId,
          subitemName: params.subitemName,
          action: "file_replaced",
          fieldName: key,
          title: `replaced ${previous.name} with ${file.name}`,
          link: file.url,
          meta: {
            field: key,
            previousFileName: previous.name,
            fileName: file.name,
            storagePath: file.storagePath,
          },
        });
    }
    for (const file of oldFiles) {
      if (newByIdentity.has(file.id ?? file.url)) continue;
      // Retire prior activity links so a removed attachment cannot still be opened from its old log entry.
      const retire = supabase
        .from("activity_log")
        .update({ link: null, description: "File has been removed" })
        .eq("client_id", params.clientId);
      if (file.storagePath)
        await retire.contains("meta", { storagePath: file.storagePath });
      else
        await retire
          .eq("field_name", key)
          .contains("meta", { fileName: file.name });
      await insertActivityLog({
        clientId: params.clientId,
        subitemId: params.subitemId,
        subitemName: params.subitemName,
        action: "file_removed",
        fieldName: key,
        title: `removed ${file.name}`,
        meta: {
          field: key,
          fileName: file.name,
          storagePath: file.storagePath,
        },
      });
    }
  }
}

export async function logOcfCreated(params: {
  clientId: string;
  ocfId: string;
  title?: string;
  description?: string;
}) {
  return insertActivityLog({
    clientId: params.clientId,
    action: "ocf_created",
    title: "generated an Order Confirmation Form",
    link: `/order-confirmations/${params.ocfId}`,
    meta: { ocfId: params.ocfId },
  });
}

export async function fetchClientsWithSubitems(params?: {
  clientIds?: string[];
  groupId?: string;
  offset?: number;
  limit?: number;
  excludeGroupNames?: string[];
}) {
  // Keep the board payload intentional. These are the fields consumed by
  // `mapClients` and the board's calculated/search columns; avoid transferring
  // unrelated columns as the clients table grows.
  const clientBoardSelect = [
    "id", "display_id", "name", "people", "reply_status",
    "reply_status_option_id", "follow_up", "status", "status_option_id",
    "channel", "channel_option_id", "importance", "importance_option_id",
    "progress", "progress_option_id", "tracking_overall_price_invoice_match",
    "tracking_overall_price_invoice_match_option_id", "tracking_total_price",
    "tracking_quote_subtotal", "tracking_quote_total", "tracking_invoice_subtotal",
    "tracking_invoice_total", "tracking_invoice_numbers",
    "tracking_overall_invoice_payment_status",
    "tracking_overall_invoice_payment_status_option_id", "company", "email",
    "phone", "requirements", "unqualified_reason", "nbd",
    "total_price", "billing_address", "created_at", "waiting_started_at",
    "group_id", "expanded", "color", "custom_fields", "deleted_at",
    "deleted_by",
  ].join(", ");
  const subitemBoardSelect = [
    "id", "display_id", "client_id", "position", "created_at", "name",
    "people", "status", "status_option_id",
    "local_overseas", "local_overseas_option_id", "qty", "description",
    "remarks", "shipper", "shipper_option_id", "supplier", "cost",
    "manpower", "manpower_rmb", "ls", "os", "currency",
    "currency_option_id", "c_sgd", "tc", "uc", "tc_sgd", "price", "up",
    "num_of_cartons", "cn_tracking", "sg_tracking", "pl", "sl", "owner",
    "payment", "payment_option_id", "payment_status", "payment_status_option_id",
    "total_uc", "ls_rmb", "total_c", "mode_of_payment",
    "mode_of_payment_option_id", "order_number", "quantity_produced",
    "qty_free", "sample", "qty_total", "qty_we_keep", "qty_for",
    "payment_amount", "difference", "payment_remarks", "timeline_rows",
    "timeline_groups", "show_timeline", "show_payments", "show_sample",
    "sample_rows", "sample_order_status", "sample_status", "sample_type",
    "custom_fields", "shipper_id", "deleted_at", "deleted_by",
    "deleted_with_client_id",
  ].join(", ");
  const paymentRowSelect = [
    "id", "subitem_id", "position", "amount", "order_number",
    "payment_received", "payment_received_label", "payment_received_option_id",
    "mode_of_payment", "mode_of_payment_option_id",
  ].join(", ");
  let excludedGroupIds: string[] = [];
  if (params?.excludeGroupNames?.length) {
    const normalizedNames = params.excludeGroupNames.map((name) =>
      name.trim(),
    );
    const { data: groups, error: groupsError } = await supabase
      .from("crm_groups")
      .select("id")
      .in("name", normalizedNames);
    if (groupsError) throw groupsError;
    excludedGroupIds = (groups ?? []).map((group) => String(group.id));
  }
  let clientsQuery = supabase
    .from("clients")
    .select(clientBoardSelect)
    .is("deleted_at", null)
    // Match CRM Board's default "Date created: newest first" ordering so a
    // page always starts at the visible top of a group.
    .order("created_at", { ascending: false });
  if (params?.clientIds) clientsQuery = clientsQuery.in("id", params.clientIds);
  if (params?.groupId) clientsQuery = clientsQuery.eq("group_id", params.groupId);
  if (excludedGroupIds.length)
    clientsQuery = clientsQuery.not("group_id", "in", `(${excludedGroupIds.join(",")})`);
  if (params?.limit !== undefined) {
    const offset = params.offset ?? 0;
    clientsQuery = clientsQuery.range(offset, offset + params.limit - 1);
  }
  const { data: clientsData, error: clientsError } = await clientsQuery;

  if (clientsError) {
    console.error("fetchClientsWithSubitems clients error:", clientsError);
    throw clientsError;
  }

  const typedClientsData = (clientsData ?? []) as unknown as Clients[];
  const activeClientIds = typedClientsData.map((row) => String(row.id));
  const clientIdChunks = Array.from(
    { length: Math.ceil(activeClientIds.length / 200) },
    (_, index) => activeClientIds.slice(index * 200, (index + 1) * 200),
  );
  const subitemResults = await Promise.all(
    clientIdChunks.map((clientIds) =>
      supabase
        .from("subitems")
        .select(subitemBoardSelect)
        .in("client_id", clientIds)
        .is("deleted_at", null),
    ),
  );
  const subitemsError = subitemResults.find((result) => result.error)?.error;
  if (subitemsError) {
    console.error("fetchClientsWithSubitems subitems error:", subitemsError);
    throw subitemsError;
  }
  const subitemsData = subitemResults.flatMap(
    (result) => (result.data ?? []) as unknown as Subitems[],
  );
  const activeSubitemIds = subitemsData.map((row) => String(row.id));
  const subitemIdChunks = Array.from(
    { length: Math.ceil(activeSubitemIds.length / 200) },
    (_, index) => activeSubitemIds.slice(index * 200, (index + 1) * 200),
  );
  const paymentRowResults = await Promise.all(
    subitemIdChunks.map((subitemIds) =>
      supabase
        .from("subitem_payment_rows")
        .select(paymentRowSelect)
        .in("subitem_id", subitemIds),
    ),
  );
  const paymentRowsError = paymentRowResults.find(
    (result) => result.error,
  )?.error;
  if (paymentRowsError) {
    console.error(
      "fetchClientsWithSubitems payment rows error:",
      paymentRowsError,
    );
    throw paymentRowsError;
  }
  const paymentRowsBySubitemId = new Map<
    string,
    NonNullable<Subitems["payment_rows"]>
  >();
  for (const paymentRow of paymentRowResults.flatMap(
    (result) =>
      (result.data ?? []) as unknown as Array<
        NonNullable<Subitems["payment_rows"]>[number] & { subitem_id: string }
      >,
  )) {
    const subitemId = String(paymentRow.subitem_id);
    const rows = paymentRowsBySubitemId.get(subitemId) ?? [];
    rows.push(paymentRow as NonNullable<Subitems["payment_rows"]>[number]);
    paymentRowsBySubitemId.set(subitemId, rows);
  }
  const subitemsByClientId = new Map<string, Subitems[]>();
  for (const subitem of subitemsData) {
    const clientId = String(subitem.client_id);
    const rows = subitemsByClientId.get(clientId) ?? [];
    rows.push({
      ...(subitem as Subitems),
      payment_rows: paymentRowsBySubitemId.get(String(subitem.id)) ?? [],
    });
    subitemsByClientId.set(clientId, rows);
  }

  // Assignment maps are loaded separately by the Board, so embedding them in
  // every client response only duplicated a large payload. Activity history is
  // intentionally not part of this initial board snapshot: it is unbounded and
  // is loaded on demand for expanded clients and detail/timeline views.
  const { data: ocfData, error: ocfError } = activeClientIds.length
    ? await supabase
        .from("order_confirmations")
        .select("client_id, client_signed_at, status")
        .in("client_id", activeClientIds)
    : { data: [], error: null };

  // OCF activity logs are useful history but are not the source of truth for
  // the board badge. Older OCFs predate that logging, and a form can still be
  // valid if the best-effort log insert failed.
  if (ocfError) {
    console.warn("fetchClientsWithSubitems OCF status error:", ocfError);
  }
  const ocfStatusByClientId = new Map<
    string,
    { hasCreated: boolean; hasSigned: boolean }
  >();
  if (!ocfError) {
    for (const ocf of ocfData ?? []) {
      const current = ocfStatusByClientId.get(ocf.client_id) ?? {
        hasCreated: false,
        hasSigned: false,
      };
      current.hasCreated = true;
      current.hasSigned ||=
        Boolean(ocf.client_signed_at) || ocf.status === "submitted";
      ocfStatusByClientId.set(ocf.client_id, current);
    }
  }
  return typedClientsData.map((row) =>
    mapClients({
      ...(row as Clients),
      subitems: subitemsByClientId.get(String(row.id)) ?? [],
      ...(ocfError
        ? {}
        : {
            ocf_status: ocfStatusByClientId.get((row as Clients).id) ?? {
              hasCreated: false,
              hasSigned: false,
            },
          }),
    }),
  );
}

export type CrmBoardQuery = {
  search?: string;
  searchColumns?: string[];
  sortCategory?: "client" | "subitem" | "payment";
  sortColumn?: string;
  sortValueType?: "text" | "number" | "date";
  sortDirection?: "asc" | "desc";
  advancedRules?: Array<{
    column: string;
    condition: string;
    value: string;
    valueType?: "text" | "number" | "date";
  }>;
  advancedJoin?: "and" | "or";
  statusOptionId?: string | null;
  importanceOptionId?: string | null;
  replyStatusOptionId?: string | null;
  channelOptionId?: string | null;
  subitemStatusOptionId?: string | null;
  paymentOptionId?: string | null;
  paymentStatusOptionId?: string | null;
  subprogressOptionId?: string | null;
  personId?: string | null;
};

export type CrmQuickFilterCounts = Record<string, Record<string, number>>;

export type GanttServerQuery = {
  search: string;
  searchScope: "all" | "group" | "client" | "subitem";
  groupIds: string[];
  clientIds: string[];
  pmIds: string[];
  peopleIds: string[];
  processStatuses: string[];
  dateFrom: string;
  dateTo: string;
};

export type GanttResourceCursor = {
  groupSort: number;
  clientCreatedAt: string;
  clientId: string;
  subitemPosition: number;
  subitemId: string;
  timelineIndex: number;
};

export type GanttResourcePage = {
  clients: Client[];
  resourceIds: string[];
  total: number;
  hasMore: boolean;
  nextCursor: GanttResourceCursor | null;
};

export async function fetchGanttResourcePage(
  query: GanttServerQuery,
  cursor: GanttResourceCursor | null = null,
  limit = 30,
): Promise<GanttResourcePage> {
  const { data, error } = await supabase.rpc("gantt_resource_page", {
    // Ask for one look-ahead row so cursor pagination can determine whether
    // another page exists without a separate count/offset calculation.
    p_limit: limit + 1,
    p_after_group_sort: cursor?.groupSort ?? null,
    p_after_client_created_at: cursor?.clientCreatedAt ?? null,
    p_after_client_id: cursor?.clientId ?? null,
    p_after_subitem_position: cursor?.subitemPosition ?? null,
    p_after_subitem_id: cursor?.subitemId ?? null,
    p_after_timeline_index: cursor?.timelineIndex ?? null,
    p_search: query.search.trim() || null,
    p_search_scope: query.searchScope,
    p_group_ids: query.groupIds.length ? query.groupIds : null,
    p_client_ids: query.clientIds.length ? query.clientIds : null,
    p_pm_ids: query.pmIds.length ? query.pmIds : null,
    p_people_ids: query.peopleIds.length ? query.peopleIds : null,
    p_process_statuses: query.processStatuses.length
      ? query.processStatuses
      : null,
    p_date_from: query.dateFrom || null,
    p_date_to: query.dateTo || null,
  });
  if (error) throw error;

  const responseRows = (data ?? []) as Array<{
    client_id: string;
    subitem_id: string;
    timeline_id: string;
    timeline_index: number;
    group_sort: number;
    client_created_at: string;
    subitem_position: number;
    total_count: number | string;
  }>;
  const hasMore = responseRows.length > limit;
  const rows = responseRows.slice(0, limit);
  const clientIds = Array.from(new Set(rows.map((row) => String(row.client_id))));
  const hydratedClients = clientIds.length
    ? await fetchClientsWithSubitems({ clientIds })
    : [];
  const clientsById = new Map(hydratedClients.map((client) => [client.id, client]));
  const orderedClients = clientIds.flatMap((clientId) => {
    const client = clientsById.get(clientId);
    return client ? [client] : [];
  });
  const last = rows.at(-1);
  const total = Number(rows[0]?.total_count ?? 0);

  return {
    clients: orderedClients,
    resourceIds: rows.map(
      (row) => `${row.client_id}::${row.subitem_id}::${row.timeline_id}`,
    ),
    total,
    hasMore,
    nextCursor: last
      ? {
          groupSort: Number(last.group_sort),
          clientCreatedAt: String(last.client_created_at),
          clientId: String(last.client_id),
          subitemPosition: Number(last.subitem_position),
          subitemId: String(last.subitem_id),
          timelineIndex: Number(last.timeline_index),
        }
      : null,
  };
}

export async function fetchGanttClientFilterOptions(): Promise<
  Array<{ value: string; label: string }>
> {
  const { data, error } = await supabase.rpc("gantt_client_filter_options");
  if (error) throw error;
  return (data ?? []).map((row: {
    client_id: string;
    client_name: string;
    group_name: string;
  }) => ({
    value: String(row.client_id),
    label: `${row.client_name || "Unnamed client"} - ${row.group_name || "No group"}`,
  }));
}

// Quick-filter badges are fixed whole-board reference totals. They are not
// facets of the active search/filter context, so never send Board query
// parameters to the count RPC.
export async function fetchCrmBoardQuickFilterCounts(): Promise<CrmQuickFilterCounts> {
  const { data, error } = await supabase.rpc(
    "crm_board_quick_filter_counts_v2",
    {},
  );
  if (error) throw error;
  const counts: CrmQuickFilterCounts = {};
  for (const row of data ?? []) {
    const filterKey = String(row.filter_key);
    const optionId = String(row.option_id);
    counts[filterKey] ??= {};
    counts[filterKey][optionId] = Number(row.total_count ?? 0);
  }
  return counts;
}

export async function fetchClientGroupPage(
  groupId: string | null,
  offset = 0,
  limit = 30,
  query: CrmBoardQuery = {},
) {
  const { data, error } = await supabase.rpc("crm_board_client_page_v2", {
    p_group_id: groupId,
    p_limit: limit,
    p_offset: offset,
    p_search: query.search?.trim() || null,
    p_search_columns: query.searchColumns ?? null,
    p_sort_category: query.sortCategory ?? "client",
    p_sort_column: query.sortColumn ?? "dateCreated",
    p_sort_value_type: query.sortValueType ?? "date",
    p_sort_direction: query.sortDirection ?? "desc",
    p_advanced_rules: query.advancedRules ?? [],
    p_advanced_join: query.advancedJoin ?? "and",
    p_status_option_id: query.statusOptionId ?? null,
    p_importance_option_id: query.importanceOptionId ?? null,
    p_reply_status_option_id: query.replyStatusOptionId ?? null,
    p_channel_option_id: query.channelOptionId ?? null,
    p_subitem_status_option_id: query.subitemStatusOptionId ?? null,
    p_payment_option_id: query.paymentOptionId ?? null,
    p_payment_status_option_id: query.paymentStatusOptionId ?? null,
    p_subprogress_option_id: query.subprogressOptionId ?? null,
    p_person_id: query.personId ?? null,
  });
  if (error) throw error;
  const clientIds: string[] = (data ?? []).map((row: { client_id: string }) =>
    String(row.client_id),
  );
  const total = Number(data?.[0]?.total_count ?? 0);
  const hydratedClients: Client[] = clientIds.length
    ? await fetchClientsWithSubitems({ clientIds })
    : [];
  // `in(id, …)` has no ordering contract. Restore the RPC order so a
  // name/company/follow-up sort does not silently revert to created_at when
  // the records are hydrated with subitems.
  const clientsById = new Map(
    hydratedClients.map((client) => [client.id, client]),
  );
  const clients = clientIds.flatMap((clientId) => {
    const client = clientsById.get(clientId);
    return client ? [client] : [];
  });
  return {
    clients,
    total,
    hasMore: offset + clientIds.length < total,
    nextOffset: offset + clientIds.length,
  };
}

/** Finds CRM records globally for the universal search overlay. */
export async function searchCrmClients(query: string, limit = 40) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [] as Client[];
  const { data, error } = await supabase.rpc("crm_universal_search_clients", {
    p_search: trimmedQuery,
    p_limit: limit,
  });
  if (error) throw error;
  const clientIds: string[] = (data ?? []).map((row: { client_id: string }) =>
    String(row.client_id),
  );
  if (!clientIds.length) return [];
  const hydratedClients: Client[] = await fetchClientsWithSubitems({
    clientIds,
  });
  const clientsById = new Map(
    hydratedClients.map((client) => [client.id, client]),
  );
  return clientIds.flatMap((clientId) => {
    const client = clientsById.get(clientId);
    return client ? [client] : [];
  });
}

/** Lightweight metadata for collapsed CRM group headers. */
export async function fetchClientGroupCounts(query: CrmBoardQuery = {}) {
  if (Object.keys(query).length) {
    const { data, error } = await supabase.rpc(
      "crm_board_client_group_counts_v2",
      {
        p_search: query.search?.trim() || null,
        p_search_columns: query.searchColumns ?? null,
        p_advanced_rules: query.advancedRules ?? [],
        p_advanced_join: query.advancedJoin ?? "and",
        p_status_option_id: query.statusOptionId ?? null,
        p_importance_option_id: query.importanceOptionId ?? null,
        p_reply_status_option_id: query.replyStatusOptionId ?? null,
        p_channel_option_id: query.channelOptionId ?? null,
        p_subitem_status_option_id: query.subitemStatusOptionId ?? null,
        p_payment_option_id: query.paymentOptionId ?? null,
        p_payment_status_option_id: query.paymentStatusOptionId ?? null,
        p_subprogress_option_id: query.subprogressOptionId ?? null,
        p_person_id: query.personId ?? null,
      },
    );
    if (error) throw error;
    const rows = (data ?? []) as Array<{
      group_id: string | null;
      total_count: number | string | null;
    }>;
    return rows.reduce<Record<string, number>>((counts, row) => {
      const groupId = String(row.group_id ?? "");
      if (groupId) counts[groupId] = Number(row.total_count ?? 0);
      return counts;
    }, {});
  }
  const { data, error } = await supabase
    .from("clients")
    .select("group_id")
    .is("deleted_at", null);
  if (error) throw error;
  return (data ?? []).reduce<Record<string, number>>((counts, row) => {
    const groupId = String(row.group_id ?? "");
    if (groupId) counts[groupId] = (counts[groupId] ?? 0) + 1;
    return counts;
  }, {});
}

/** Loads a single client's history only when the user needs to see it. */
export async function fetchClientActivityLog(
  clientId: string,
): Promise<ActivityEntry[]> {
  const { data, error } = await supabase
    .from("activity_log")
    .select(
      "id, client_id, subitem_id, actor_name, action, field_name, old_value, new_value, subitem_name, created_at, link, title, description, meta",
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchClientActivityLog error:", error);
    throw error;
  }

  return (data ?? []).map((row) => mapActivityEntry(row as ActivityLogRow));
}

export async function fetchDeletedBinItems(): Promise<DeletedBinItem[]> {
  const [clientsResult, subitemsResult] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, name, deleted_at, subitems!subitems_client_id_fkey(id, deleted_at)",
      )
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("subitems")
      .select(
        "id, name, client_id, deleted_at, deleted_with_client_id, custom_fields, clients!subitems_client_id_fkey(name, deleted_at)",
      )
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
  ]);
  if (clientsResult.error) throw clientsResult.error;
  if (subitemsResult.error) throw subitemsResult.error;
  const expiresAt = (value: string) => {
    const date = new Date(value);
    date.setUTCDate(date.getUTCDate() + 30);
    return date.toISOString();
  };
  const clientItems: DeletedBinItem[] = (clientsResult.data ?? []).map(
    (client: any) => ({
      id: client.id,
      type: "client",
      name: client.name ?? "Unnamed client",
      deletedAt: client.deleted_at,
      expiresAt: expiresAt(client.deleted_at),
      subitemCount: (client.subitems ?? []).filter((subitem: any) =>
        Boolean(subitem.deleted_at),
      ).length,
    }),
  );
  const subitemItems: DeletedBinItem[] = (subitemsResult.data ?? [])
    .filter((subitem: any) => !subitem.deleted_with_client_id)
    .map((subitem: any) => ({
      id: subitem.id,
      type: "subitem",
      name: subitem.name ?? "Unnamed subitem",
      clientId: subitem.client_id,
      clientName: subitem.clients?.name ?? "Deleted client",
      deletedAt: subitem.deleted_at,
      expiresAt: expiresAt(subitem.deleted_at),
      parentDeleted: Boolean(subitem.clients?.deleted_at),
      isPaymentVoucher: subitem.custom_fields?.additionalCostLinked === "true",
    }));
  return [...clientItems, ...subitemItems].sort(
    (first, second) =>
      new Date(second.deletedAt).getTime() -
      new Date(first.deletedAt).getTime(),
  );
}

export async function createClientRow(
  currentUserId?: string | null,
  groupId?: string | null,
  name?: string | null,
) {
  const [waitingLabel, newLeadLabel] = await Promise.all([
    resolveSystemOption("reply_status", "waiting"),
    resolveSystemOption("client_status", "new_lead"),
  ]);
  const { data, error } = await supabase
    .from("clients")
    .insert({
      name: capitaliseFirstCharacter(name?.trim() || "New Client"),
      people: "",
      reply_status: waitingLabel.value,
      reply_status_option_id: waitingLabel.id,
      follow_up: "",
      status: newLeadLabel.value,
      status_option_id: newLeadLabel.id,
      channel: "",
      importance: "",
      progress: "",
      company: "",
      email: "",
      phone: "",
      requirements: "",
      unqualified_reason: "",
      nbd: "",
      total_price: "",
      billing_address: "",
      group_id: groupId ?? null,
      expanded: true,
      color: "#7BCBD5",
      activity_log: [],
      custom_fields: {},
    })
    .select("*")
    .single();

  if (error) throw error;

  // The client row is durable at this point. Keep its auxiliary setup out of
  // the critical path so the user can start working immediately.
  const setup = Promise.all([
    currentUserId
      ? addClientAssignee(data.id, currentUserId, currentUserId)
      : Promise.resolve(),
    insertActivityLog({
      clientId: data.id,
      action: "client_added",
      title: "created this client",
    }),
  ]).then(() => undefined);

  return { client: data, setup };
}

async function resolveSystemOption(groupCode: string, systemKey: string) {
  const prefix = `${groupCode}_`;
  const candidates = [
    ...new Set([
      systemKey,
      systemKey.startsWith(prefix) ? systemKey.slice(prefix.length) : systemKey,
      systemKey.startsWith(prefix) ? systemKey : `${prefix}${systemKey}`,
    ]),
  ];
  const { data, error } = await supabase
    .from("option_values")
    .select("id, value, system_key, option_groups!inner(code)")
    .eq("option_groups.code", groupCode)
    .in("system_key", candidates);
  if (error) throw error;

  const option =
    (data ?? []).find((item) => item.system_key === systemKey) ?? data?.[0];

  if (!option)
    throw new Error(
      `Required system label ${groupCode}.${systemKey} is not configured.`,
    );
  return { id: option.id, value: option.value };
}

async function resolveOptionId(groupCode: string, value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  const { data, error } = await supabase
    .from("option_values")
    .select("id, option_groups!inner(code)")
    .eq("option_groups.code", groupCode)
    .eq("value", normalized)
    .maybeSingle();
  if (error) throw error;
  if (!data)
    throw new Error(
      `“${normalized}” is not a valid ${groupCode.replaceAll("_", " ")} label.`,
    );
  return data.id;
}

async function resolveOptionById(groupCode: string, optionId: string) {
  if (!optionId.trim()) return null;
  const { data, error } = await supabase
    .from("option_values")
    .select("id, value, option_groups!inner(code)")
    .eq("id", optionId)
    .eq("option_groups.code", groupCode)
    .maybeSingle();
  if (error) throw error;
  if (!data)
    throw new Error(
      `The selected ${groupCode.replaceAll("_", " ")} label is no longer available.`,
    );
  return { id: data.id, value: data.value };
}

async function resolveOptionEntry(groupCode: string, value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  const { data, error } = await supabase
    .from("option_values")
    .select("id, system_key, option_groups!inner(code)")
    .eq("option_groups.code", groupCode)
    .eq("value", normalized)
    .maybeSingle();
  if (error) throw error;
  if (!data)
    throw new Error(
      `â€œ${normalized}â€ is not a valid ${groupCode.replaceAll("_", " ")} label.`,
    );
  return { id: data.id, system_key: data.system_key ?? null };
}

export async function updateClientRow(
  clientId: string,
  updates: Partial<Client> & { customFields?: Record<string, string> },
  activityMeta?: Record<string, any>,
) {
  const { data: existing, error: fetchError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (fetchError) throw fetchError;

  const nextUpdates = { ...updates } as Partial<Client>;
  if (nextUpdates.name !== undefined)
    nextUpdates.name = capitaliseFirstCharacter(nextUpdates.name);
  if (nextUpdates.company !== undefined)
    nextUpdates.company = capitaliseFirstCharacter(nextUpdates.company);
  const mapped = {
    ...updates,
    group_id: updates.groupId,
  };
  delete mapped.groupId;

  const clientLabelFields = [
    [
      "replyStatus",
      "reply_status",
      "reply_status_option_id",
      "reply_status",
      "replyStatusOptionId",
    ],
    ["status", "status", "status_option_id", "client_status", "statusOptionId"],
    ["channel", "channel", "channel_option_id", "channel", "channelOptionId"],
    [
      "importance",
      "importance",
      "importance_option_id",
      "importance",
      "importanceOptionId",
    ],
    [
      "progress",
      "progress",
      "progress_option_id",
      "progress",
      "progressOptionId",
    ],
  ] as const;
  const clientOptionIds: Record<string, string | null> = {};
  for (const [
    modelKey,
    ,
    idColumn,
    groupCode,
    modelIdKey,
  ] of clientLabelFields) {
    const explicitId = nextUpdates[modelIdKey];
    const value = nextUpdates[modelKey];
    if (explicitId === undefined && value === undefined) continue;
    const option =
      explicitId !== undefined
        ? await resolveOptionById(groupCode, String(explicitId ?? ""))
        : null;
    if (option) {
      (nextUpdates as Record<string, unknown>)[modelKey] = option.value;
      clientOptionIds[idColumn] = option.id;
    } else {
      clientOptionIds[idColumn] = await resolveOptionId(
        groupCode,
        String(value ?? ""),
      );
    }
  }
  if (
    updates.replyStatus !== undefined &&
    updates.replyStatus !== existing.reply_status
  ) {
    const waitingLabel = await resolveSystemOption("reply_status", "waiting");
    nextUpdates.waitingStartedAt =
      clientOptionIds.reply_status_option_id === waitingLabel.id
        ? new Date().toISOString()
        : null;
  }

  const payload = {
    ...(nextUpdates.name !== undefined ? { name: nextUpdates.name } : {}),
    ...(updates.people !== undefined ? { people: updates.people } : {}),
    ...(nextUpdates.replyStatus !== undefined
      ? { reply_status: nextUpdates.replyStatus }
      : {}),
    ...(updates.followUp !== undefined ? { follow_up: updates.followUp } : {}),
    ...(updates.status !== undefined ? { status: updates.status } : {}),
    ...(updates.channel !== undefined ? { channel: updates.channel } : {}),
    ...(updates.importance !== undefined
      ? { importance: updates.importance }
      : {}),
    ...(updates.progress !== undefined ? { progress: updates.progress } : {}),
    ...(nextUpdates.company !== undefined
      ? { company: nextUpdates.company }
      : {}),
    ...(updates.email !== undefined ? { email: updates.email } : {}),
    ...(updates.phone !== undefined ? { phone: updates.phone } : {}),
    ...(updates.requirements !== undefined
      ? { requirements: updates.requirements }
      : {}),
    ...(updates.unqualifiedReason !== undefined
      ? { unqualified_reason: updates.unqualifiedReason }
      : {}),
    ...(updates.nbd !== undefined ? { nbd: updates.nbd } : {}),
    ...(updates.totalPrice !== undefined
      ? { total_price: updates.totalPrice }
      : {}),
    ...(updates.billingAddress !== undefined
      ? { billing_address: updates.billingAddress }
      : {}),
    ...(updates.groupId !== undefined ? { group_id: updates.groupId } : {}),
    ...(updates.expanded !== undefined ? { expanded: updates.expanded } : {}),
    ...(updates.color !== undefined ? { color: updates.color } : {}),
    ...(updates.activityLog !== undefined
      ? { activity_log: updates.activityLog }
      : {}),
    ...(updates.customFields !== undefined
      ? { custom_fields: updates.customFields }
      : {}),
    ...(nextUpdates.waitingStartedAt !== undefined
      ? { waiting_started_at: nextUpdates.waitingStartedAt }
      : {}),
    ...clientOptionIds,
  };

  const { error } = await supabase
    .from("clients")
    .update(payload)
    .eq("id", clientId);

  if (error) throw error;

  if (updates.email !== undefined && updates.email !== existing.email) {
    // Profile enrichment is deliberately best-effort and non-blocking. The
    // client edit has already succeeded; this endpoint only fills a blank
    // profile email and never overwrites one.
    void fetch("/api/customer-profiles/auto-save-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    }).catch((autoSaveError) =>
      console.warn("Unable to auto-save the client profile email", autoSaveError),
    );
  }

  for (const [key, value] of Object.entries(nextUpdates) as [
    keyof Client,
    unknown,
  ][]) {
    if (CLIENT_LOG_IGNORE_FIELDS.has(key)) continue;

    const oldValue =
      existing[
        key === "replyStatus"
          ? "reply_status"
          : key === "followUp"
            ? "follow_up"
            : key === "totalPrice"
              ? "total_price"
              : key === "billingAddress"
                ? "billing_address"
                : key === "unqualifiedReason"
                  ? "unqualified_reason"
                  : key === "createdAt"
                    ? "created_at"
                    : key === "groupId"
                      ? "group_id"
                      : key
      ];

    if (isEqualForLog(oldValue, value)) continue;

    await insertActivityLog({
      clientId,
      action: "field_changed",
      fieldName: key,
      oldValue: formatValueForLog(oldValue),
      newValue: formatValueForLog(value),
      meta: activityMeta,
    });
  }
  if (updates.customFields !== undefined)
    await logFileAttachmentDiffs({
      clientId,
      before: existing.custom_fields,
      after: updates.customFields,
    });
}

async function assertCreatorActionAllowed(
  table: "clients" | "subitems",
  id: string,
  action: "soft-delete" | "restore",
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to delete this item.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profileError) throw profileError;
  if (["director", "dev"].includes(String(profile?.role ?? "").toLowerCase()))
    return;

  const { data: item, error: itemError } = await supabase
    .from(table)
    .select("created_at, deletion_owner_id")
    .eq("id", id)
    .single();
  if (itemError) throw itemError;

  const createdAt = item.created_at;
  const actionDescription =
    action === "soft-delete" ? "moved to the Bin" : "restored";
  if (action === "soft-delete" && !createdAt)
    throw new Error(
      `This item has no creation date and cannot be ${actionDescription} by this role.`,
    );
  const ageInHours = createdAt
    ? (Date.now() - new Date(createdAt).getTime()) / 3_600_000
    : null;
  if (action === "soft-delete" && ageInHours !== null && ageInHours >= 72)
    throw new Error(
      `This item is more than 72 hours old and can only be ${actionDescription} by a director or developer.`,
    );

  if (!item.deletion_owner_id || item.deletion_owner_id !== user.id) {
    throw new Error(
      `You can only ${action === "soft-delete" ? "move items created by you to the Bin" : "restore items created by you"}, unless you are a director or developer.`,
    );
  }
}

export async function deleteClientRow(clientId: string) {
  await assertCreatorActionAllowed("clients", clientId, "soft-delete");
  const deletedAt = new Date().toISOString();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("clients")
    .update({ deleted_at: deletedAt, deleted_by: user?.id ?? null })
    .eq("id", clientId);
  if (error) throw error;
  const { error: subitemsError } = await supabase
    .from("subitems")
    .update({
      deleted_at: deletedAt,
      deleted_by: user?.id ?? null,
      deleted_with_client_id: clientId,
    })
    .eq("client_id", clientId)
    .is("deleted_at", null);
  if (subitemsError) throw subitemsError;
  await insertActivityLog({
    clientId,
    action: "client_deleted",
    title: "moved this client to the Bin",
    meta: { deletedEntity: "client", deletedId: clientId, deletedAt },
  });
}

export async function restoreClientRow(clientId: string) {
  await assertCreatorActionAllowed("clients", clientId, "restore");
  const { data: client, error: fetchError } = await supabase
    .from("clients")
    .select("id, deleted_at")
    .eq("id", clientId)
    .single();
  if (fetchError) throw fetchError;
  if (!client.deleted_at)
    throw new Error("This client is no longer in the Bin.");
  if (Date.now() - new Date(client.deleted_at).getTime() >= BIN_RETENTION_MS)
    throw new Error("The 30-day Bin retention period has ended.");
  const { error } = await supabase
    .from("clients")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", clientId);
  if (error) throw error;
  const { error: subitemsError } = await supabase
    .from("subitems")
    .update({
      deleted_at: null,
      deleted_by: null,
      deleted_with_client_id: null,
    })
    .eq("deleted_with_client_id", clientId);
  if (subitemsError) throw subitemsError;
  await insertActivityLog({
    clientId,
    action: "client_restored",
    title: "restored this client from the Bin",
    meta: { deletedEntity: "client", deletedId: clientId },
  });
}

// subitem functions
export async function createSubitemRow(
  clientId: string,
  name: string,
  currentUserId?: string | null,
) {
  const { data: existingSubitems, error: existingSubitemsError } =
    await supabase
      .from("subitems")
      .select("position")
      .eq("client_id", clientId)
      .is("deleted_at", null)
      .order("position", { ascending: false })
      .limit(1);
  if (existingSubitemsError) throw existingSubitemsError;
  const position = Number(existingSubitems?.[0]?.position ?? -1) + 1;
  const timelineRows = [
    {
      id: crypto.randomUUID(),
      name: "Sample",
      person: "",
      remarks: "",
      subProgress: "",
      timelineStart: "",
      timelineEnd: "",
      duration: "",
      dependency: "",
    },
    {
      id: crypto.randomUUID(),
      name: "Production 📦",
      person: "",
      remarks: "",
      subProgress: "",
      timelineStart: "",
      timelineEnd: "",
      duration: "",
      dependency: "Sample",
    },
    {
      id: crypto.randomUUID(),
      name: "Check Production Status (+3 from production start)",
      person: "",
      remarks: "",
      subProgress: "",
      timelineStart: "",
      timelineEnd: "",
      duration: "",
      dependency: "",
    },
    {
      id: crypto.randomUUID(),
      name: "Local Shipping 🚚",
      person: "",
      remarks: "",
      subProgress: "",
      timelineStart: "",
      timelineEnd: "",
      duration: "",
      dependency: "Production 📦",
    },
    {
      id: crypto.randomUUID(),
      name: "Sea/Air Freight ⛵✈️",
      person: "",
      remarks: "",
      subProgress: "",
      timelineStart: "",
      timelineEnd: "",
      duration: "",
      dependency: "Local Shipping 🚚",
    },
    {
      id: crypto.randomUUID(),
      name: "Check Shipment Status (+3 from shipment start)",
      person: "",
      remarks: "",
      subProgress: "",
      timelineStart: "",
      timelineEnd: "",
      duration: "",
      dependency: "",
    },
    {
      id: crypto.randomUUID(),
      name: "NBD",
      person: "",
      remarks: "",
      subProgress: "",
      timelineStart: "",
      timelineEnd: "",
      duration: "",
      dependency: "",
      status: "",
    },
  ];

  const { data, error } = await supabase
    .from("subitems")
    .insert({
      client_id: clientId,
      position,
      name: name.trim(),
      people: "",
      status: "",
      local_overseas: "Local",
      qty: "",
      description: "",
      remarks: "",
      shipper: "",
      supplier: "",
      cost: "",
      manpower: "",
      manpower_rmb: "",
      ls: "",
      os: "",
      currency: "",
      c_sgd: "",
      tc: "",
      uc: "",
      tc_sgd: "",
      price: "",
      up: "",
      num_of_cartons: "",
      cn_tracking: "",
      sg_tracking: "",
      owner: "",
      payment: "",
      payment_status: "",
      total_uc: "",
      ls_rmb: "",
      total_c: "",
      mode_of_payment: "",
      order_number: "",
      quantity_produced: "",
      qty_free: "",
      sample: "",
      qty_total: "",
      qty_we_keep: "",
      qty_for: "",
      payment_amount: "",
      difference: "",
      payment_remarks: "",
      timeline_rows: timelineRows,
      timeline_groups: [
        {
          id: "default",
          cnTracking: "",
          sgTracking: "",
          rows: timelineRows,
          isDefault: true,
        },
      ],
      show_timeline: false,
      show_payments: false,
      show_sample: false,
      sample_rows: [],
      sample_order_status: "",
      sample_status: "",
      sample_type: "",
      custom_fields: {},
      shipper_id: null,
    })
    .select("*")
    .single();

  if (error) throw error;

  const initialPaymentRow = supabase
    .from("subitem_payment_rows")
    .insert({
      subitem_id: data.id,
      position: 0,
      amount: "",
      order_number: "",
      payment_received: null,
      payment_received_label: "",
      payment_received_option_id: null,
      mode_of_payment: "",
      mode_of_payment_option_id: null,
    })
    .select(
      "id, position, amount, order_number, payment_received, payment_received_label, payment_received_option_id, mode_of_payment, mode_of_payment_option_id",
    )
    .single();

  // The row can be displayed as soon as its primary insert succeeds. These
  // independent writes do not affect its editable CRM fields, so run them in
  // parallel after returning the durable row to the Board.
  const setup = Promise.all([
    initialPaymentRow.then(({ data: paymentRow, error: paymentRowError }) => {
      if (paymentRowError || !paymentRow) {
        throw paymentRowError ?? new Error("Could not create the initial payment row.");
      }
      return paymentRow;
    }),
    currentUserId
      ? supabase
          .from("subitem_assignees")
          .insert({
            subitem_id: data.id,
            user_id: currentUserId,
            assigned_by: currentUserId,
          })
          .then(({ error: assigneeError }) => {
            if (assigneeError) throw assigneeError;
          })
      : Promise.resolve(),
    insertActivityLog({
      clientId,
      subitemId: data.id,
      subitemName: data.name,
      action: "subitem_added",
    }),
  ]).then(([paymentRow]) => paymentRow);

  return {
    subitem: {
      ...mapSubitems(data as Subitems),
      paymentRows: [],
    },
    setup,
  };
}

export async function duplicateSubitemRow(subitemId: string) {
  const { data: existing, error: fetchError } = await supabase
    .from("subitems")
    .select("*")
    .eq("id", subitemId)
    .is("deleted_at", null)
    .single();
  if (fetchError) throw fetchError;
  if (existing.custom_fields?.additionalCostLinked === "true") {
    throw new Error("Additional Cost subitems cannot be duplicated.");
  }

  const copy = { ...existing };
  delete copy.id;
  delete copy.display_id;
  delete copy.created_at;
  delete copy.waiting_started_at;
  if (
    copy.custom_fields &&
    typeof copy.custom_fields === "object" &&
    !Array.isArray(copy.custom_fields)
  ) {
    copy.custom_fields = Object.fromEntries(
      Object.entries(copy.custom_fields as Record<string, unknown>).filter(
        ([key]) => {
          const tokens = key
            .replace(/([a-z])([A-Z])/g, "$1_$2")
            .toLowerCase()
            .split(/[^a-z0-9]+/);
          return !tokens.some((token) =>
            ["file", "files", "attachment", "attachments", "artwork"].includes(
              token,
            ),
          );
        },
      ),
    );
  }
  const duplicateTimelineRows = Array.isArray(copy.timeline_rows)
    ? copy.timeline_rows.map((row: TimelineRow) => ({
        ...row,
        id: crypto.randomUUID(),
      }))
    : [];
  const duplicateTimelineGroups = Array.isArray(copy.timeline_groups)
    ? copy.timeline_groups.map((group: Record<string, unknown>) => ({
        ...group,
        id: crypto.randomUUID(),
        rows: Array.isArray(group.rows)
          ? group.rows.map((row: TimelineRow) => ({
              ...row,
              id: crypto.randomUUID(),
            }))
          : group.rows,
      }))
    : copy.timeline_groups;

  const { data: siblings, error: siblingsError } = await supabase
    .from("subitems")
    .select("id, position, created_at")
    .eq("client_id", existing.client_id)
    .is("deleted_at", null)
    .order("position", { ascending: true });
  if (siblingsError) throw siblingsError;
  const orderedSiblingIds = (siblings ?? [])
    .sort(
      (first, second) =>
        Number(first.position ?? Number.MAX_SAFE_INTEGER) -
          Number(second.position ?? Number.MAX_SAFE_INTEGER) ||
        String(first.created_at ?? "").localeCompare(
          String(second.created_at ?? ""),
        ),
    )
    .map((sibling) => sibling.id);
  const sourceIndex = orderedSiblingIds.indexOf(existing.id);
  if (sourceIndex < 0) throw new Error("Subitem is no longer available.");
  const appendPosition = Math.max(
    -1,
    ...(siblings ?? []).map((sibling) => Number(sibling.position ?? -1)),
  ) + 1;

  const { data: duplicate, error: duplicateError } = await supabase
    .from("subitems")
    .insert({
      ...copy,
      name: existing.name ?? "New Item",
      position: appendPosition,
      timeline_rows: duplicateTimelineRows,
      timeline_groups: duplicateTimelineGroups,
    })
    .select("*")
    .single();
  if (duplicateError) throw duplicateError;

  const nextOrder = [...orderedSiblingIds];
  nextOrder.splice(sourceIndex + 1, 0, duplicate.id);
  // The duplicate itself is committed. Keeping its supplementary records and
  // sibling reordering out of the foreground makes duplication responsive
  // without exposing an unsaved row.
  const setup = () =>
    Promise.all([
      supabase
        .from("subitem_payment_rows")
        .insert({
          subitem_id: duplicate.id,
          position: 0,
          amount: "",
          order_number: "",
          payment_received: null,
          payment_received_label: "",
          payment_received_option_id: null,
          mode_of_payment: "",
          mode_of_payment_option_id: null,
        })
        .then(({ error: initialPaymentRowError }) => {
          if (initialPaymentRowError) throw initialPaymentRowError;
        }),
      (async () => {
        const { data: assignees, error: assigneeFetchError } = await supabase
          .from("subitem_assignees")
          .select("user_id")
          .eq("subitem_id", subitemId);
        if (assigneeFetchError) throw assigneeFetchError;
        if (!assignees?.length) return;
        const { error: assigneeCopyError } = await supabase
          .from("subitem_assignees")
          .insert(
            assignees.map((assignee) => ({
              subitem_id: duplicate.id,
              user_id: assignee.user_id,
              assigned_by: null,
            })),
          );
        if (assigneeCopyError) throw assigneeCopyError;
      })(),
      reorderSubitemRows(existing.client_id, nextOrder),
      insertActivityLog({
        clientId: duplicate.client_id,
        subitemId: duplicate.id,
        subitemName: duplicate.name,
        action: "subitem_added",
        title: "duplicated this subitem",
      }),
    ]).then(() => undefined);

  return { subitem: duplicate, setup };
}

export async function fetchOptionsByGroupCode(
  code: string,
): Promise<{ value: string; color: string }[]> {
  const supabase = createClient();
  const { data: group } = await supabase
    .from("option_groups")
    .select("id")
    .eq("code", code)
    .single();

  if (!group) return [];

  const { data } = await supabase
    .from("option_values")
    .select("value, color")
    .eq("group_id", group.id)
    .order("sort_order");

  return data ?? [];
}

export async function updateSubitemRow(
  subitemId: string,
  updates: Partial<Subitem>,
) {
  const { data: existing, error: fetchError } = await supabase
    .from("subitems")
    .select("*")
    .eq("id", subitemId)
    .is("deleted_at", null)
    .single();

  if (fetchError) throw fetchError;
  if (
    existing.custom_fields?.additionalCostLinked === "true" &&
    updates.cost !== undefined
  ) {
    const unsupportedFields = Object.keys(updates).filter(
      (field) => field !== "cost",
    );
    if (unsupportedFields.length) {
      throw new Error(
        "Only Cost can be changed from the CRM Board for a Payment Voucher subitem.",
      );
    }
    const response = await fetch("/api/additional-costs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: existing.custom_fields.additionalCostId,
        values: { cost: updates.cost },
      }),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error ?? "Could not update the Payment Voucher.");
    return;
  }
  if (
    existing.custom_fields?.additionalCostLinked === "true" &&
    ["name", "status", "qty"].some(
      (field) => updates[field as keyof Subitem] !== undefined,
    )
  ) {
    throw new Error(
      "The name, Status, and Qty of an Additional Cost subitem are managed automatically.",
    );
  }

  const nextUpdates: Partial<Subitem> = { ...updates };

  // A duration without either boundary needs an anchor. Apply this here so
  // timeline edits from every CRM surface behave consistently.
  if (nextUpdates.timelineRows !== undefined) {
    const singaporeNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const today = `${singaporeNow.getUTCFullYear()}-${String(singaporeNow.getUTCMonth() + 1).padStart(2, "0")}-${String(singaporeNow.getUTCDate()).padStart(2, "0")}`;
    nextUpdates.timelineRows = nextUpdates.timelineRows.map((row) =>
      String(row.duration ?? "").trim() &&
      !String(row.timelineStart ?? "").trim() &&
      !String(row.timelineEnd ?? "").trim()
        ? { ...row, timelineStart: today }
        : row,
    );
  }

  if (nextUpdates.timelineGroups !== undefined) {
    const normalizeTracking = (value: unknown) =>
      String(value ?? "")
        .trim()
        .toLowerCase();
    const existingTimelines =
      Array.isArray(existing.timeline_groups) && existing.timeline_groups.length
        ? existing.timeline_groups
        : [{ id: "default", cnTracking: existing.cn_tracking ?? "" }];
    const existingTrackingByTimelineId = new Map(
      existingTimelines.map(
        (timeline: { id?: unknown; cnTracking?: unknown }) => [
          String(timeline.id ?? ""),
          normalizeTracking(timeline.cnTracking),
        ],
      ),
    );
    // Older records may already contain duplicate legacy tracking values.
    // They should not prevent an unrelated timeline edit. Validate values
    // only when they are new or have actually changed.
    const changedTracking = nextUpdates.timelineGroups
      .map((timeline) => ({
        id: String(timeline.id ?? ""),
        value: normalizeTracking(timeline.cnTracking),
      }))
      .filter(
        (timeline) =>
          timeline.value &&
          existingTrackingByTimelineId.get(timeline.id) !== timeline.value,
      );
    for (const changed of changedTracking) {
      if (
        nextUpdates.timelineGroups.some(
          (timeline) =>
            String(timeline.id ?? "") !== changed.id &&
            normalizeTracking(timeline.cnTracking) === changed.value,
        )
      ) {
        throw new Error("CN Tracking numbers must be unique within a subitem.");
      }
    }
    if (changedTracking.length) {
      const { data: otherSubitems, error: trackingReadError } = await supabase
        .from("subitems")
        .select("id, name, timeline_groups")
        .neq("id", subitemId)
        .is("deleted_at", null);
      if (trackingReadError) throw trackingReadError;
      const requestedSet = new Set(
        changedTracking.map((timeline) => timeline.value),
      );
      for (const other of otherSubitems ?? []) {
        const otherTimelines = Array.isArray(other.timeline_groups)
          ? other.timeline_groups
          : [];
        if (
          otherTimelines.some((timeline: { cnTracking?: unknown }) =>
            requestedSet.has(normalizeTracking(timeline.cnTracking)),
          )
        ) {
          throw new Error(
            `CN Tracking number is already used by ${other.name ?? "another subitem"}.`,
          );
        }
      }
    }
  }

  if ("qty" in updates || "up" in updates) {
    const qty = Number(updates.qty ?? 0);
    const up = Number(updates.up ?? 0);
    nextUpdates.price = String(qty * up);
  }

  if (nextUpdates.shipper !== undefined) {
    const { data: shippers, error: shippersError } = await supabase
      .from("shippers")
      .select("id, name");
    if (shippersError) throw shippersError;

    const normalizedLabel = nextUpdates.shipper.trim().toLowerCase();
    const baseName = normalizedLabel
      .replace(/\s+-\s+(sea|air)\s*$/i, "")
      .trim();
    const matchingShipper = (shippers ?? []).find((shipper) => {
      const normalizedName = (shipper.name ?? "").trim().toLowerCase();
      return normalizedName === normalizedLabel || normalizedName === baseName;
    });
    nextUpdates.shipperId = matchingShipper?.id ?? null;
  }

  const subitemLabelFields = [
    ["status", "status_option_id", "subitem_status", "statusOptionId"],
    ["shipper", "shipper_option_id", "shipper", "shipperOptionId"],
    ["currency", "currency_option_id", "currency", "currencyOptionId"],
    ["payment", "payment_option_id", "payment", "paymentOptionId"],
    [
      "paymentStatus",
      "payment_status_option_id",
      "payment_status",
      "paymentStatusOptionId",
    ],
    [
      "modeOfPayment",
      "mode_of_payment_option_id",
      "mode_of_payment",
      "modeOfPaymentOptionId",
    ],
    [
      "localOverseas",
      "local_overseas_option_id",
      "local_overseas",
      "localOverseasOptionId",
    ],
  ] as const;
  const subitemOptionIds: Record<string, string | null> = {};
  for (const [
    modelKey,
    idColumn,
    groupCode,
    modelIdKey,
  ] of subitemLabelFields) {
    const explicitId = nextUpdates[modelIdKey];
    const value = nextUpdates[modelKey];
    if (explicitId === undefined && value === undefined) continue;
    const option =
      explicitId !== undefined
        ? await resolveOptionById(groupCode, String(explicitId ?? ""))
        : null;
    if (option) {
      (nextUpdates as Record<string, unknown>)[modelKey] = option.value;
      subitemOptionIds[idColumn] = option.id;
    } else {
      subitemOptionIds[idColumn] = await resolveOptionId(
        groupCode,
        String(value ?? ""),
      );
    }
  }

  const { error } = await supabase
    .from("subitems")
    .update({
      ...(nextUpdates.status !== undefined
        ? { status: nextUpdates.status }
        : {}),
      ...(nextUpdates.shipperId !== undefined
        ? { shipper_id: nextUpdates.shipperId }
        : {}),
      ...(nextUpdates.shipper !== undefined
        ? { shipper: nextUpdates.shipper }
        : {}),
      ...(nextUpdates.price !== undefined ? { price: nextUpdates.price } : {}),
      ...(nextUpdates.qty !== undefined ? { qty: nextUpdates.qty } : {}),
      ...(nextUpdates.up !== undefined ? { up: nextUpdates.up } : {}),
      ...(nextUpdates.name !== undefined ? { name: nextUpdates.name } : {}),
      ...(nextUpdates.people !== undefined
        ? { people: nextUpdates.people }
        : {}),
      ...(nextUpdates.localOverseas !== undefined
        ? { local_overseas: nextUpdates.localOverseas }
        : {}),
      ...(nextUpdates.description !== undefined
        ? { description: nextUpdates.description }
        : {}),
      ...(nextUpdates.remarks !== undefined
        ? { remarks: nextUpdates.remarks }
        : {}),
      ...(nextUpdates.supplier !== undefined
        ? { supplier: nextUpdates.supplier }
        : {}),
      ...(nextUpdates.cost !== undefined ? { cost: nextUpdates.cost } : {}),
      ...(nextUpdates.manpower !== undefined
        ? { manpower: nextUpdates.manpower }
        : {}),
      ...(nextUpdates.manpowerRmb !== undefined
        ? { manpower_rmb: nextUpdates.manpowerRmb }
        : {}),
      ...(nextUpdates.ls !== undefined ? { ls: nextUpdates.ls } : {}),
      ...(nextUpdates.os !== undefined ? { os: nextUpdates.os } : {}),
      ...(nextUpdates.currency !== undefined
        ? { currency: nextUpdates.currency }
        : {}),
      ...(nextUpdates.cSgd !== undefined ? { c_sgd: nextUpdates.cSgd } : {}),
      ...(nextUpdates.tc !== undefined ? { tc: nextUpdates.tc } : {}),
      ...(nextUpdates.uc !== undefined ? { uc: nextUpdates.uc } : {}),
      ...(nextUpdates.tcSgd !== undefined ? { tc_sgd: nextUpdates.tcSgd } : {}),
      ...(nextUpdates.pl !== undefined ? { pl: nextUpdates.pl } : {}),
      ...(nextUpdates.sl !== undefined ? { sl: nextUpdates.sl } : {}),
      ...(nextUpdates.numOfCartons !== undefined
        ? { num_of_cartons: nextUpdates.numOfCartons }
        : {}),
      ...(nextUpdates.cnTracking !== undefined
        ? { cn_tracking: nextUpdates.cnTracking }
        : {}),
      ...(nextUpdates.sgTracking !== undefined
        ? { sg_tracking: nextUpdates.sgTracking }
        : {}),
      ...(nextUpdates.owner !== undefined ? { owner: nextUpdates.owner } : {}),
      ...(nextUpdates.payment !== undefined
        ? { payment: nextUpdates.payment }
        : {}),
      ...(nextUpdates.paymentStatus !== undefined
        ? { payment_status: nextUpdates.paymentStatus }
        : {}),
      ...(nextUpdates.totalUc !== undefined
        ? { total_uc: nextUpdates.totalUc }
        : {}),
      ...(nextUpdates.lsRmb !== undefined ? { ls_rmb: nextUpdates.lsRmb } : {}),
      ...(nextUpdates.totalC !== undefined
        ? { total_c: nextUpdates.totalC }
        : {}),
      ...(nextUpdates.modeOfPayment !== undefined
        ? { mode_of_payment: nextUpdates.modeOfPayment }
        : {}),
      ...(nextUpdates.orderNumber !== undefined
        ? { order_number: nextUpdates.orderNumber }
        : {}),
      ...(nextUpdates.quantityProduced !== undefined
        ? { quantity_produced: nextUpdates.quantityProduced }
        : {}),
      ...(nextUpdates.qtyFree !== undefined
        ? { qty_free: nextUpdates.qtyFree }
        : {}),
      ...(nextUpdates.sample !== undefined
        ? { sample: nextUpdates.sample }
        : {}),
      ...(nextUpdates.qtyTotal !== undefined
        ? { qty_total: nextUpdates.qtyTotal }
        : {}),
      ...(nextUpdates.qtyWeKeep !== undefined
        ? { qty_we_keep: nextUpdates.qtyWeKeep }
        : {}),
      ...(nextUpdates.qtyFor !== undefined
        ? { qty_for: nextUpdates.qtyFor }
        : {}),
      ...(nextUpdates.paymentAmount !== undefined
        ? { payment_amount: nextUpdates.paymentAmount }
        : {}),
      ...(nextUpdates.difference !== undefined
        ? { difference: nextUpdates.difference }
        : {}),
      ...(nextUpdates.paymentRemarks !== undefined
        ? { payment_remarks: nextUpdates.paymentRemarks }
        : {}),
      ...(nextUpdates.timelineRows !== undefined
        ? { timeline_rows: nextUpdates.timelineRows }
        : {}),
      ...(nextUpdates.timelineGroups !== undefined
        ? {
            timeline_groups: nextUpdates.timelineGroups,
            timeline_rows: nextUpdates.timelineGroups[0]?.rows ?? [],
            cn_tracking: nextUpdates.timelineGroups
              .map((timeline) => timeline.cnTracking.trim())
              .filter(Boolean)
              .join(", "),
            sg_tracking: nextUpdates.timelineGroups
              .map((timeline) => timeline.sgTracking.trim())
              .filter(Boolean)
              .join(", "),
          }
        : {}),
      ...(nextUpdates.showTimeline !== undefined
        ? { show_timeline: nextUpdates.showTimeline }
        : {}),
      ...(nextUpdates.showPayments !== undefined
        ? { show_payments: nextUpdates.showPayments }
        : {}),
      ...(nextUpdates.showSample !== undefined
        ? { show_sample: nextUpdates.showSample }
        : {}),
      ...(nextUpdates.sampleRows !== undefined
        ? { sample_rows: nextUpdates.sampleRows }
        : {}),
      ...(nextUpdates.sampleOrderStatus !== undefined
        ? { sample_order_status: nextUpdates.sampleOrderStatus }
        : {}),
      ...(nextUpdates.sampleStatus !== undefined
        ? { sample_status: nextUpdates.sampleStatus }
        : {}),
      ...(nextUpdates.sampleType !== undefined
        ? { sample_type: nextUpdates.sampleType }
        : {}),
      ...(nextUpdates.customFields !== undefined
        ? { custom_fields: nextUpdates.customFields }
        : {}),
      ...subitemOptionIds,
    })
    .eq("id", subitemId);

  if (error) throw error;

  // Supplier profiles are linked by their stable ID. URL-containing values
  // represent contact methods rather than a supplier identity, so they are
  // deliberately kept as unlinked Board text.
  if (nextUpdates.supplier !== undefined) {
    const supplierName = String(nextUpdates.supplier ?? "").trim();
    if (!supplierName || supplierValueContainsUrl(supplierName)) {
      const { error: unlinkError } = await supabase
        .from("subitems")
        .update({ supplier_profile_id: null })
        .eq("id", subitemId);
      if (unlinkError) throw unlinkError;
    } else {
      const normalizedName = supplierName.replace(/\s+/g, " ").toLowerCase();
      const { data: supplier, error: supplierError } = await supabase
        .from("supplier_profiles")
        .select("id")
        .eq("normalized_name", normalizedName)
        .maybeSingle();
      if (supplierError) throw supplierError;
      if (!supplier) {
        // Board input is allowed to remain free text, but only profiles that
        // were deliberately created in Supplier Profiles can be linked.
        const { error: unlinkError } = await supabase
          .from("subitems")
          .update({ supplier_profile_id: null })
          .eq("id", subitemId);
        if (unlinkError) throw unlinkError;
      } else {
        const { error: linkError } = await supabase
          .from("subitems")
          .update({ supplier_profile_id: supplier.id })
          .eq("id", subitemId);
        if (linkError) throw linkError;

        // Re-adding or editing a Board subitem makes the corresponding entry
        // visible again in its Supplier Profile's managed product list.
        const productName = String(
          nextUpdates.name ?? existing.name ?? "",
        ).trim();
        if (productName) {
          const normalizedProductName = productName
            .replace(/\s+/g, " ")
            .toLowerCase();
          const { data: product, error: productLookupError } = await supabase
            .from("supplier_profile_products")
            .select("id")
            .eq("supplier_profile_id", supplier.id)
            .eq("normalized_name", normalizedProductName)
            .maybeSingle();
          if (productLookupError) throw productLookupError;
          const { error: productError } = product
            ? await supabase
                .from("supplier_profile_products")
                .update({
                  name: productName,
                  is_hidden: false,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", product.id)
            : await supabase
                .from("supplier_profile_products")
                .insert({ supplier_profile_id: supplier.id, name: productName });
          if (productError) throw productError;
        }
      }
    }
  }

  // A renamed Board subitem also belongs in the profile catalogue, even when
  // its Supplier field itself was not edited in the same save.
  if (
    nextUpdates.supplier === undefined &&
    nextUpdates.name !== undefined &&
    existing.supplier_profile_id
  ) {
    const productName = String(nextUpdates.name ?? "").trim();
    if (productName) {
      const normalizedProductName = productName
        .replace(/\s+/g, " ")
        .toLowerCase();
      const { data: product, error: productLookupError } = await supabase
        .from("supplier_profile_products")
        .select("id")
        .eq("supplier_profile_id", existing.supplier_profile_id)
        .eq("normalized_name", normalizedProductName)
        .maybeSingle();
      if (productLookupError) throw productLookupError;
      const { error: productError } = product
        ? await supabase
            .from("supplier_profile_products")
            .update({
              name: productName,
              is_hidden: false,
              updated_at: new Date().toISOString(),
            })
            .eq("id", product.id)
        : await supabase
            .from("supplier_profile_products")
            .insert({
              supplier_profile_id: existing.supplier_profile_id,
              name: productName,
            });
      if (productError) throw productError;
    }
  }

  if (nextUpdates.timelineRows !== undefined) {
    await logTimelineRowDiffs({
      clientId: existing.client_id,
      subitemId,
      subitemName: existing.name,
      oldRows: existing.timeline_rows ?? [],
      newRows: nextUpdates.timelineRows,
    });
  }

  const ignoredFields = new Set([
    "showTimeline",
    "showPayments",
    "showSample",
    "customFields",
    "timelineRows",
    "timelineGroups",
  ]);
  const fieldMap: Record<string, string> = {
    replyStatus: "reply_status",
    localOverseas: "local_overseas",
    paymentStatus: "payment_status",
    totalUc: "total_uc",
    lsRmb: "ls_rmb",
    totalC: "total_c",
    modeOfPayment: "mode_of_payment",
    orderNumber: "order_number",
    quantityProduced: "quantity_produced",
    qtyFree: "qty_free",
    sample: "sample",
    qtyTotal: "qty_total",
    qtyWeKeep: "qty_we_keep",
    qtyFor: "qty_for",
    paymentAmount: "payment_amount",
    paymentRemarks: "payment_remarks",
    timelineRows: "timeline_rows",
    sampleRows: "sample_rows",
    sampleOrderStatus: "sample_order_status",
    sampleStatus: "sample_status",
    sampleType: "sample_type",
    cSgd: "c_sgd",
    tcSgd: "tc_sgd",
    numOfCartons: "num_of_cartons",
    cnTracking: "cn_tracking",
    sgTracking: "sg_tracking",
    shipperId: "shipper_id",
  };

  for (const [key, value] of Object.entries(updates)) {
    if (ignoredFields.has(key)) continue;
    const databaseKey = fieldMap[key] ?? key;
    const oldValue = existing[databaseKey];
    if (isEqualForLog(oldValue, value)) continue;

    await insertActivityLog({
      clientId: existing.client_id,
      subitemId,
      subitemName: existing.name,
      action: "subitem_field_changed",
      fieldName: key,
      oldValue: formatValueForLog(oldValue),
      newValue: formatValueForLog(value),
    });
  }
  if (updates.customFields !== undefined)
    await logFileAttachmentDiffs({
      clientId: existing.client_id,
      subitemId,
      subitemName: existing.name,
      before: existing.custom_fields,
      after: updates.customFields,
    });
}

export async function moveSubitemRow(
  subitemId: string,
  targetClientId: string,
) {
  const { data: existing, error: fetchError } = await supabase
    .from("subitems")
    .select("id, name, client_id, custom_fields")
    .eq("id", subitemId)
    .is("deleted_at", null)
    .single();
  if (fetchError) throw fetchError;
  if (existing.custom_fields?.additionalCostLinked === "true") {
    throw new Error(
      "Additional Cost subitems cannot be moved to another client.",
    );
  }
  if (existing.client_id === targetClientId) return;

  const { data: clients, error: clientsError } = await supabase
    .from("clients")
    .select("id, name")
    .in("id", [existing.client_id, targetClientId])
    .is("deleted_at", null);
  if (clientsError) throw clientsError;
  if ((clients ?? []).length !== 2) {
    throw new Error("The source or target client is no longer available.");
  }

  const oldClientName =
    clients?.find((client) => client.id === existing.client_id)?.name ??
    existing.client_id;
  const newClientName =
    clients?.find((client) => client.id === targetClientId)?.name ??
    targetClientId;

  const { data: lastTargetSubitem, error: lastTargetSubitemError } =
    await supabase
      .from("subitems")
      .select("position")
      .eq("client_id", targetClientId)
      .is("deleted_at", null)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
  if (lastTargetSubitemError) throw lastTargetSubitemError;

  const { error } = await supabase
    .from("subitems")
    .update({
      client_id: targetClientId,
      position: Number(lastTargetSubitem?.position ?? -1) + 1,
    })
    .eq("id", subitemId);

  if (error) throw error;

  const { error: activityMoveError } = await supabase
    .from("activity_log")
    .update({ client_id: targetClientId })
    .eq("subitem_id", subitemId);
  if (activityMoveError) throw activityMoveError;

  await insertActivityLog({
    clientId: existing.client_id,
    subitemId: null,
    subitemName: existing.name,
    action: "subitem_deleted",
    oldValue: { id: existing.id, name: existing.name },
    description: `Subitem moved to ${newClientName}`,
  });

  await insertActivityLog({
    clientId: targetClientId,
    subitemId,
    subitemName: existing.name,
    action: "subitem_added",
    description: `Subitem moved from ${oldClientName}`,
  });
  await insertActivityLog({
    clientId: targetClientId,
    subitemId,
    subitemName: existing.name,
    action: "subitem_field_changed",
    fieldName: "parentClient",
    oldValue: oldClientName,
    newValue: newClientName,
    meta: { oldClientId: existing.client_id, newClientId: targetClientId },
  });
}

export async function deleteSubitemRow(subitemId: string, deactivationReason?: string) {
  await assertCreatorActionAllowed("subitems", subitemId, "soft-delete");
  const { data: existing, error: fetchError } = await supabase
    .from("subitems")
    .select("*")
    .eq("id", subitemId)
    .single();

  if (fetchError) throw fetchError;

  if (existing.custom_fields?.additionalCostLinked === "true") {
    if (!deactivationReason?.trim())
      throw new Error("A Deactivation Reason is required for the linked Payment Voucher.");
    const response = await fetch(
      `/api/additional-costs?subitemId=${encodeURIComponent(subitemId)}&reason=${encodeURIComponent(deactivationReason.trim())}`,
      { method: "DELETE" },
    );
    const result = await response.json();
    if (!response.ok) {
      throw new Error(
        result.error ?? "The linked Additional Cost could not be deleted.",
      );
    }
    // The Payment Voucher endpoint has deleted both linked records. Do not
    // continue into the standard subitem delete flow, which would otherwise
    // attempt to delete the voucher a second time.
    return;
  }

  try {
    const deletedAt = new Date().toISOString();
    await insertActivityLog({
      clientId: existing.client_id,
      subitemId: null,
      subitemName: existing.name,
      action: "subitem_deleted",
      title: "moved this subitem to the Bin",
      oldValue: {
        id: existing.id,
        name: existing.name,
        qty: existing.qty,
        remarks: existing.remarks ?? null,
      },
      meta: { deletedEntity: "subitem", deletedId: existing.id, deletedAt },
    });
  } catch (logError: any) {
    console.error("Failed to insert delete activity log", {
      error: logError,
      message: logError?.message,
      details: logError?.details,
      hint: logError?.hint,
      code: logError?.code,
    });
  }

  const deletedAt = new Date().toISOString();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("subitems")
    .update({
      deleted_at: deletedAt,
      deleted_by: user?.id ?? null,
      deleted_with_client_id: null,
    })
    .eq("id", subitemId);

  if (error) throw error;
}

export async function restoreSubitemRow(subitemId: string) {
  await assertCreatorActionAllowed("subitems", subitemId, "restore");
  const { data: subitem, error: fetchError } = await supabase
    .from("subitems")
    .select("id, client_id, name, deleted_at, custom_fields")
    .eq("id", subitemId)
    .single();
  if (fetchError) throw fetchError;
  if (!subitem.deleted_at)
    throw new Error("This subitem is no longer in the Bin.");
  if (Date.now() - new Date(subitem.deleted_at).getTime() >= BIN_RETENTION_MS)
    throw new Error("The 30-day Bin retention period has ended.");
  if (subitem.custom_fields?.additionalCostLinked === "true") {
    const response = await fetch("/api/additional-costs/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subitemId }),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        result.error ?? "The linked Payment Voucher could not be restored.",
      );
    return;
  }
  const { error } = await supabase
    .from("subitems")
    .update({
      deleted_at: null,
      deleted_by: null,
      deleted_with_client_id: null,
    })
    .eq("id", subitemId);
  if (error) throw error;
  await insertActivityLog({
    clientId: subitem.client_id,
    subitemId,
    subitemName: subitem.name,
    action: "subitem_restored",
    title: "restored this subitem from the Bin",
    meta: { deletedEntity: "subitem", deletedId: subitemId },
  });
}

export async function createSubitemPaymentRow(subitemId: string) {
  const { data: subitem, error: subitemError } = await supabase
    .from("subitems")
    .select("id, client_id, name")
    .eq("id", subitemId)
    .is("deleted_at", null)
    .single();
  if (subitemError) throw subitemError;
  const { data: lastRow, error: lastRowError } = await supabase
    .from("subitem_payment_rows")
    .select("position")
    .eq("subitem_id", subitemId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastRowError) throw lastRowError;
  const { data: created, error } = await supabase
    .from("subitem_payment_rows")
    .insert({
      subitem_id: subitemId,
      position: Number(lastRow?.position ?? -1) + 1,
      amount: "",
      order_number: "",
      payment_received: null,
      payment_received_label: "",
      payment_received_option_id: null,
      mode_of_payment: "",
      mode_of_payment_option_id: null,
    })
    .select(
      "id, position, amount, order_number, payment_received, payment_received_label, payment_received_option_id, mode_of_payment, mode_of_payment_option_id",
    )
    .single();
  if (error) throw error;
  void insertActivityLog({
    clientId: subitem.client_id,
    subitemId,
    subitemName: subitem.name,
    action: "subitem_field_changed",
    fieldName: "payment row added",
  });
  return {
    id: created.id,
    position: created.position ?? 0,
    amount: created.amount ?? "",
    orderNumber: created.order_number ?? "",
    paymentReceived: created.payment_received ?? null,
    paymentReceivedLabel: created.payment_received_label ?? "",
    paymentReceivedOptionId: created.payment_received_option_id ?? null,
    modeOfPayment: created.mode_of_payment ?? "",
    modeOfPaymentOptionId: created.mode_of_payment_option_id ?? null,
  } satisfies PaymentRow;
}

export async function updateSubitemPaymentRow(
  subitemId: string,
  paymentRowId: string,
  updates: Partial<Omit<PaymentRow, "id" | "position">>,
) {
  const { data: subitem, error: subitemError } = await supabase
    .from("subitems")
    .select("client_id, name")
    .eq("id", subitemId)
    .is("deleted_at", null)
    .single();
  if (subitemError) throw subitemError;
  const { data: existing, error: existingError } = await supabase
    .from("subitem_payment_rows")
    .select("*")
    .eq("id", paymentRowId)
    .eq("subitem_id", subitemId)
    .single();
  if (existingError) throw existingError;
  const modeOfPaymentOptionId =
    updates.modeOfPayment === undefined
      ? undefined
      : await resolveOptionId("mode_of_payment", updates.modeOfPayment);
  const paymentReceivedOption =
    updates.paymentReceivedLabel === undefined
      ? undefined
      : await resolveOptionEntry(
          "payment_received",
          updates.paymentReceivedLabel,
        );
  const payload = {
    ...(updates.amount !== undefined ? { amount: updates.amount } : {}),
    ...(updates.orderNumber !== undefined
      ? { order_number: updates.orderNumber }
      : {}),
    ...(updates.paymentReceived !== undefined
      ? { payment_received: updates.paymentReceived }
      : {}),
    ...(paymentReceivedOption !== undefined
      ? {
          payment_received_label: updates.paymentReceivedLabel,
          payment_received_option_id: paymentReceivedOption?.id ?? null,
          payment_received:
            paymentReceivedOption?.system_key === "payment_received_yes"
              ? true
              : paymentReceivedOption?.system_key === "payment_received_no"
                ? false
                : null,
        }
      : {}),
    ...(updates.modeOfPayment !== undefined
      ? {
          mode_of_payment: updates.modeOfPayment,
          mode_of_payment_option_id: modeOfPaymentOptionId,
        }
      : {}),
  };
  const { data: updated, error } = await supabase
    .from("subitem_payment_rows")
    .update(payload)
    .eq("id", paymentRowId)
    .eq("subitem_id", subitemId)
    .select(
      "id, position, amount, order_number, payment_received, payment_received_label, payment_received_option_id, mode_of_payment, mode_of_payment_option_id",
    )
    .single();
  if (error) throw error;
  for (const [field, value] of Object.entries(payload)) {
    const oldValue = existing[field];
    if (isEqualForLog(oldValue, value)) continue;
    void insertActivityLog({
      clientId: subitem.client_id,
      subitemId,
      subitemName: subitem.name,
      action: "subitem_field_changed",
      fieldName: `payment row:${paymentRowId}:${field}`,
      oldValue,
      newValue: value,
    });
  }
  return {
    id: updated.id,
    position: updated.position ?? 0,
    amount: updated.amount ?? "",
    orderNumber: updated.order_number ?? "",
    paymentReceived: updated.payment_received ?? null,
    paymentReceivedLabel: updated.payment_received_label ?? "",
    paymentReceivedOptionId: updated.payment_received_option_id ?? null,
    modeOfPayment: updated.mode_of_payment ?? "",
    modeOfPaymentOptionId: updated.mode_of_payment_option_id ?? null,
  } satisfies PaymentRow;
}

export async function deleteSubitemPaymentRow(
  subitemId: string,
  paymentRowId: string,
) {
  const { data: subitem, error: subitemError } = await supabase
    .from("subitems")
    .select("client_id, name")
    .eq("id", subitemId)
    .is("deleted_at", null)
    .single();
  if (subitemError) throw subitemError;
  const { data: row, error: rowError } = await supabase
    .from("subitem_payment_rows")
    .select("*")
    .eq("id", paymentRowId)
    .eq("subitem_id", subitemId)
    .single();
  if (rowError) throw rowError;
  const { error } = await supabase
    .from("subitem_payment_rows")
    .delete()
    .eq("id", paymentRowId)
    .eq("subitem_id", subitemId);
  if (error) throw error;
  void insertActivityLog({
    clientId: subitem.client_id,
    subitemId,
    subitemName: subitem.name,
    action: "subitem_field_changed",
    fieldName: "payment row removed",
    oldValue: row,
  });
}

export async function reorderSubitemRows(
  clientId: string,
  orderedSubitemIds: string[],
) {
  const response = await fetch("/api/subitems/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, orderedSubitemIds }),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result?.error ?? "Could not reorder subitems.");
  }
}

export async function duplicateClientRow(
  clientId: string,
  includeSubitems: boolean,
) {
  const response = await fetch("/api/clients/duplicate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, includeSubitems }),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result?.error ?? "Could not duplicate client");
  return result.client;
}
