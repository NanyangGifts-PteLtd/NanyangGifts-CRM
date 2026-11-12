import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const INTERNAL_ROLES = new Set(["sales", "pm", "admin", "director", "dev"]);
const PRIVILEGED_ROLES = new Set(["admin", "director", "dev"]);

async function authorize() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  const role = String(profile?.role ?? "").toLowerCase();
  if (!INTERNAL_ROLES.has(role)) throw new Error("Forbidden");
  return { user, role };
}

function failure(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Samples Sent request failed.";
  return NextResponse.json(
    { error: message },
    {
      status:
        message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400,
    },
  );
}

async function recordActivity(sampleSentId: string, userId: string, title: string) {
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("full_name, email").eq("id", userId).maybeSingle();
  const { error } = await supabaseAdmin.from("samples_sent_activity_log").insert({
    sample_sent_id: sampleSentId,
    actor_id: userId,
    actor_name: profile?.full_name?.trim() || profile?.email || "Unknown user",
    action: "samples_sent_updated",
    title,
  });
  if (error) console.error("Samples Sent activity log failed", error);
}

async function assertClientEditor(
  clientId: string,
  userId: string,
  role: string,
) {
  const { data: client, error } = await supabaseAdmin
    .from("clients")
    .select("id, custom_fields")
    .eq("id", clientId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !client)
    throw new Error("The selected client is no longer available.");
  if (client.custom_fields?.subitemsLocked === "true")
    throw new Error("This client is locked.");
  if (!PRIVILEGED_ROLES.has(role)) {
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from("client_assignees")
      .select("client_id")
      .eq("client_id", clientId)
      .eq("user_id", userId)
      .in("assignment_type", ["people", "pm"])
      .maybeSingle();
    if (assignmentError) throw assignmentError;
    if (!assignment)
      throw new Error(
        "You can only create Samples Sent records for clients assigned to you.",
      );
  }
}

// Existing Samples Sent records remain editable even when CRM subitems are
// locked. Samples are not a subitem-cost workflow.
async function assertRecordEditor(clientId: string | null, userId: string, role: string) {
  // A migrated record can be deliberately unlinked until a team member finds
  // its CRM client. There is no assignment to evaluate yet; the caller has
  // already passed the internal-user check in authorize().
  if (!clientId) return;
  const { data: client, error } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !client) throw new Error("The linked client is no longer available.");
  if (PRIVILEGED_ROLES.has(role)) return;
  const { data: assignment, error: assignmentError } = await supabaseAdmin
    .from("client_assignees")
    .select("client_id")
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .in("assignment_type", ["people", "pm"])
    .maybeSingle();
  if (assignmentError) throw assignmentError;
  if (!assignment) throw new Error("You can only edit Samples Sent records for clients assigned to you.");
}

async function canDeleteRecord(record: { client_id: string | null; created_at: string }, userId: string, role: string) {
  if (PRIVILEGED_ROLES.has(role)) return true;
  if (Date.now() - new Date(record.created_at).getTime() >= 72 * 60 * 60 * 1000)
    return false;
  if (!record.client_id) return false;
  const { data, error } = await supabaseAdmin.from("client_assignees")
    .select("client_id").eq("client_id", record.client_id).eq("user_id", userId)
    .in("assignment_type", ["people", "pm"]).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function resolveLabel(code: string, optionId: unknown) {
  const id = String(optionId ?? "").trim();
  if (!id) return { value: "", id: null, systemKey: null };
  const { data, error } = await supabaseAdmin
    .from("option_values")
    .select("id, value, system_key, option_groups!inner(code)")
    .eq("id", id)
    .eq("option_groups.code", code)
    .maybeSingle();
  if (error || !data) throw new Error("The selected label is no longer available.");
  return { value: data.value, id: data.id, systemKey: data.system_key };
}

const STATUS_GROUP_BY_SYSTEM_KEY: Record<string, string> = {
  samples_sent_status_overdue: "Outstanding",
  samples_sent_status_request_to_not_return: "Request not to return",
  samples_sent_status_fail_to_return_remarks: "Failed to return",
  samples_sent_status_returned: "Returned",
  samples_sent_status_no_need_to_return: "No need to return",
};

async function groupIdForStatusSystemKey(systemKey: string | null) {
  const groupName = systemKey ? STATUS_GROUP_BY_SYSTEM_KEY[systemKey] : null;
  if (!groupName) return null;
  return groupIdForName(groupName);
}

async function groupIdForName(groupName: string) {
  const { data, error } = await supabaseAdmin
    .from("samples_sent_groups")
    .select("id")
    .eq("name", groupName)
    .maybeSingle();
  if (error || !data) {
    throw new Error(`The Samples Sent group “${groupName}” is not configured.`);
  }
  return data.id;
}

async function hydrateRows(rows: Array<Record<string, unknown>>) {
  const clientIds = [
    ...new Set(rows.map((row) => String(row.client_id ?? "")).filter(Boolean)),
  ];
  const recordIds = rows.map((row) => String(row.id));
  const personIds = [
    ...new Set(
      rows
        .flatMap((row) => [
          row.created_by,
          ...((row.people_ids as string[] | null) ?? []),
        ])
        .filter(Boolean)
        .map(String),
    ),
  ];
  const [
    { data: clients, error: clientsError },
    { data: clientSubitems, error: clientSubitemsError },
    { data: items, error: itemsError },
    { data: profiles, error: profilesError },
  ] = await Promise.all([
    clientIds.length
      ? selectSamplesRows("clients", "id, name, display_id, phone", "id", clientIds)
      : Promise.resolve({ data: [], error: null }),
    clientIds.length
      ? selectSamplesRows("subitems", "id, client_id, name", "client_id", clientIds, (query) =>
          query.is("deleted_at", null).order("position"),
        )
      : Promise.resolve({ data: [], error: null }),
    recordIds.length
      ? selectSamplesRows(
          "samples_sent_items",
          "sample_sent_id, linked_subitem_id, item_name, qty, sort_order",
          "sample_sent_id",
          recordIds,
          (query) => query.order("sort_order"),
        )
      : Promise.resolve({ data: [], error: null }),
    personIds.length
      ? selectSamplesRows("profiles", "id, full_name, email, avatar_color", "id", personIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (clientsError || clientSubitemsError || itemsError || profilesError)
    throw clientsError ?? clientSubitemsError ?? itemsError ?? profilesError;
  const clientsById = new Map(
    (clients ?? []).map((client) => [client.id, client]),
  );
  const profilesById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  );
  const subitemsByClient = new Map<string, unknown[]>();
  for (const subitem of clientSubitems ?? []) {
    const current = subitemsByClient.get(subitem.client_id) ?? [];
    current.push(subitem);
    subitemsByClient.set(subitem.client_id, current);
  }
  const itemsByRecord = new Map<string, unknown[]>();
  for (const item of items ?? []) {
    const current = itemsByRecord.get(item.sample_sent_id) ?? [];
    current.push(item);
    itemsByRecord.set(item.sample_sent_id, current);
  }
  return rows.map((row) => ({
    ...row,
    referenceId: String(row.external_reference_id ?? "").trim() || `SS${row.reference_number}`,
    legacyClientName: String(row.legacy_client_name ?? ""),
    legacyMobile: String(row.legacy_mobile ?? ""),
    mondayItemsSent: String(row.monday_items_sent ?? ""),
    linkedClient: (() => {
      const client = clientsById.get(String(row.client_id));
      return client ? { ...client, subitems: subitemsByClient.get(client.id) ?? [] } : null;
    })(),
    people: ((row.people_ids as string[] | null) ?? [])
      .map((id) => profilesById.get(id))
      .filter(Boolean),
    createdByProfile: row.created_by
      ? (profilesById.get(String(row.created_by)) ?? null)
      : null,
    items: itemsByRecord.get(String(row.id)) ?? [],
  }));
}

// PostgREST encodes an IN list into the request URL. The migrated Samples
// Sent board can contain hundreds of records, so keep each hydration request
// comfortably below proxy/header limits instead of sending one giant list.
async function selectSamplesRows(
  table: string,
  columns: string,
  idColumn: string,
  ids: string[],
  refine?: (query: any) => any,
) {
  const rows: Array<Record<string, any>> = [];
  for (let start = 0; start < ids.length; start += 100) {
    let query = supabaseAdmin
      .from(table)
      .select(columns)
      .in(idColumn, ids.slice(start, start + 100));
    if (refine) query = refine(query);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...((data ?? []) as Array<Record<string, any>>));
  }
  return { data: rows, error: null };
}

export async function GET(request: NextRequest) {
  try {
    const { user, role } = await authorize();
    const offsetValue = Number(request.nextUrl.searchParams.get("offset") ?? 0);
    const limitValue = Number(request.nextUrl.searchParams.get("limit") ?? 100);
    const offset = Number.isFinite(offsetValue) ? Math.max(0, Math.floor(offsetValue)) : 0;
    // A bounded page avoids hydrating every related client/subitem/item for
    // large migrated groups in one request.
    const limit = Number.isFinite(limitValue)
      ? Math.min(100, Math.max(1, Math.floor(limitValue)))
      : 100;
    const [pageResult, groupCountResult] = await Promise.all([
      supabaseAdmin
        .from("samples_sent")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1),
      // Group headers still need their true record totals even though only a
      // page of full records is hydrated at a time.
      supabaseAdmin.from("samples_sent").select("group_id"),
    ]);
    const { data, error, count } = pageResult;
    if (error || groupCountResult.error) throw error ?? groupCountResult.error;
    const groupCounts = (groupCountResult.data ?? []).reduce<Record<string, number>>(
      (counts, row) => {
        const groupId = String(row.group_id ?? "");
        if (groupId) counts[groupId] = (counts[groupId] ?? 0) + 1;
        return counts;
      },
      {},
    );
    const rows = await hydrateRows((data ?? []) as Array<Record<string, unknown>>) as Array<Record<string, unknown>>;
    const clientIds = [...new Set(rows.map((row) => String(row.client_id ?? "")).filter(Boolean))];
    let assignedClientIds = new Set<string>();
    if (PRIVILEGED_ROLES.has(role)) assignedClientIds = new Set(clientIds);
    else if (clientIds.length) {
      const { data: assignments, error: assignmentsError } = await supabaseAdmin
        .from("client_assignees").select("client_id").eq("user_id", user.id)
        .in("assignment_type", ["people", "pm"]).in("client_id", clientIds);
      if (assignmentsError) throw assignmentsError;
      assignedClientIds = new Set((assignments ?? []).map((assignment) => assignment.client_id));
    }
    return NextResponse.json({ rows: rows.map((row) => ({
      ...row,
      can_delete: PRIVILEGED_ROLES.has(role) || (
        Boolean(row.client_id && assignedClientIds.has(String(row.client_id))) &&
        Date.now() - new Date(String(row.created_at)).getTime() < 72 * 60 * 60 * 1000
      ),
    })), total: count ?? 0, groupCounts, nextOffset: offset + rows.length });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, role } = await authorize();
    const id = request.nextUrl.searchParams.get("id")?.trim();
    if (!id) throw new Error("A Samples Sent record is required.");
    const { data: record, error } = await supabaseAdmin.from("samples_sent")
      .select("id, client_id, created_at, photo_files").eq("id", id).maybeSingle();
    if (error || !record) throw new Error("Samples Sent record not found.");
    if (!await canDeleteRecord(record, user.id, role))
      throw new Error("You can only delete assigned items created within the last 72 hours.");
    const { error: itemsError } = await supabaseAdmin.from("samples_sent_items").delete().eq("sample_sent_id", id);
    if (itemsError) throw itemsError;
    const { error: activityError } = await supabaseAdmin.from("samples_sent_activity_log").delete().eq("sample_sent_id", id);
    if (activityError) throw activityError;
    const { error: deleteError } = await supabaseAdmin.from("samples_sent").delete().eq("id", id);
    if (deleteError) throw deleteError;
    const paths = Array.isArray(record.photo_files)
      ? record.photo_files.map((file: { storagePath?: unknown }) => String(file.storagePath ?? "")).filter(Boolean)
      : [];
    if (paths.length) await supabaseAdmin.storage.from("crm-files").remove(paths);
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    const { user, role } = await authorize();
    const body = await request.json();
    const clientId = String(body?.clientId ?? "").trim();
    const groupId = String(body?.groupId ?? "").trim();
    const address = String(body?.address ?? "").trim();
    const dateSent = String(body?.dateSent ?? "").trim();
    const items = Array.isArray(body?.items) ? body.items : [];
    if (!clientId) throw new Error("Choose a client.");
    if (!groupId) throw new Error("Choose a Samples Sent group.");
    if (!address) throw new Error("Address is required.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateSent))
      throw new Error("Date Sent is required.");
    if (!items.length) throw new Error("Add at least one item sent.");
    await assertClientEditor(clientId, user.id, role);

    const { data: group, error: groupError } = await supabaseAdmin
      .from("samples_sent_groups")
      .select("id")
      .eq("id", groupId)
      .maybeSingle();
    if (groupError || !group)
      throw new Error("The selected Samples Sent group is unavailable.");

    const normalizedItems = items.map((item: unknown, index: number) => {
      const source = (item && typeof item === "object" ? item : {}) as Record<
        string,
        unknown
      >;
      const linkedSubitemId =
        String(source.linkedSubitemId ?? "").trim() || null;
      const itemName = String(source.itemName ?? "").trim();
      const qty = Number(source.qty);
      if (!itemName || !Number.isFinite(qty) || qty <= 0) {
        throw new Error(
          `Item row ${index + 1} needs an item name and a quantity above zero.`,
        );
      }
      return { linkedSubitemId, itemName, qty, sortOrder: index };
    });
    const linkedIds = normalizedItems.flatMap(
      (item: { linkedSubitemId: string | null }) =>
        item.linkedSubitemId ? [item.linkedSubitemId] : [],
    );
    if (linkedIds.length) {
      const { data: subitems, error: subitemsError } = await supabaseAdmin
        .from("subitems")
        .select("id")
        .eq("client_id", clientId)
        .is("deleted_at", null)
        .in("id", linkedIds);
      if (subitemsError) throw subitemsError;
      if ((subitems ?? []).length !== new Set(linkedIds).size)
        throw new Error(
          "One or more linked items are unavailable for this client.",
        );
    }
    const costText = String(body?.cost ?? "").trim();
    const cost = costText ? Number(costText) : 0;
    if (!Number.isFinite(cost) || cost < 0)
      throw new Error("Cost must be zero or greater.");
    const peopleIds = [
      ...new Set(
        (Array.isArray(body?.peopleIds) ? body.peopleIds : [user.id])
          .map((id: unknown) => String(id ?? "").trim())
          .filter(Boolean),
      ),
    ];

    const { data: record, error: recordError } = await supabaseAdmin
      .from("samples_sent")
      .insert({
        client_id: clientId,
        group_id: groupId,
        people_ids: peopleIds.length ? peopleIds : [user.id],
        address,
        date_sent: dateSent,
        return_by: String(body?.returnBy ?? "").trim() || null,
        cost,
        remarks: String(body?.remarks ?? "").trim(),
        photo_files: Array.isArray(body?.photoFiles) ? body.photoFiles : [],
        created_by: user.id,
      })
      .select("*")
      .single();
    if (recordError || !record)
      throw recordError ?? new Error("Could not create Samples Sent record.");
    const { error: itemsError } = await supabaseAdmin
      .from("samples_sent_items")
      .insert(
        normalizedItems.map(
          (item: {
            linkedSubitemId: string | null;
            itemName: string;
            qty: number;
            sortOrder: number;
          }) => ({
            sample_sent_id: record.id,
            linked_subitem_id: item.linkedSubitemId,
            item_name: item.itemName,
            qty: item.qty,
            sort_order: item.sortOrder,
          }),
        ),
      );
    if (itemsError) {
      await supabaseAdmin.from("samples_sent").delete().eq("id", record.id);
      throw itemsError;
    }
    await recordActivity(record.id, user.id, "created this Samples Sent record");
    const [hydrated] = await hydrateRows([record as Record<string, unknown>]);
    return NextResponse.json({ row: hydrated });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user, role } = await authorize();
    const body = await request.json();
    const id = String(body?.id ?? "").trim();
    const values = body?.values;
    if (!id || !values || typeof values !== "object")
      throw new Error("A Samples Sent record and changes are required.");
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("samples_sent")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (existingError || !existing) throw new Error("Samples Sent record not found.");
    if (existing.deactivated_at) throw new Error("A deactivated Samples Sent record cannot be edited.");
    await assertRecordEditor(existing.client_id ?? null, user.id, role);

    const allowed = new Set([
      "peopleIds", "address", "dateSent", "returnBy", "dateReturned", "cost",
      "remarks", "mondayItemsSent", "photoFiles", "status", "reason", "courier", "items", "confirmFailure", "clientId",
    ]);
    const supplied = Object.fromEntries(Object.entries(values).filter(([key]) => allowed.has(key)));
    if (!Object.keys(supplied).length) throw new Error("No editable changes were supplied.");
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (supplied.clientId !== undefined) {
      const clientId = String(supplied.clientId ?? "").trim();
      if (!clientId) throw new Error("Choose a CRM client to link this Samples Sent record.");
      await assertRecordEditor(clientId, user.id, role);
      updates.client_id = clientId;
    }
    if (supplied.peopleIds !== undefined) {
      if (!Array.isArray(supplied.peopleIds) || supplied.peopleIds.some((value) => typeof value !== "string"))
        throw new Error("People must be internal staff.");
      updates.people_ids = [...new Set(supplied.peopleIds.map(String).filter(Boolean))];
    }
    if (supplied.address !== undefined) {
      const address = String(supplied.address ?? "").trim();
      if (!address) throw new Error("Address is required.");
      updates.address = address;
    }
    const dateFields: Array<[string, string]> = [["dateSent", "date_sent"], ["returnBy", "return_by"], ["dateReturned", "date_returned"]];
    for (const [input, column] of dateFields) {
      if (supplied[input] === undefined) continue;
      const value = String(supplied[input] ?? "").trim();
      if (input === "dateSent" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Date Sent is required.");
      if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("A valid date is required.");
      updates[column] = value || null;
    }
    if (supplied.cost !== undefined) {
      const cost = String(supplied.cost ?? "").trim() ? Number(supplied.cost) : 0;
      if (!Number.isFinite(cost) || cost < 0) throw new Error("Cost must be zero or greater.");
      updates.cost = cost;
    }
    if (supplied.remarks !== undefined) updates.remarks = String(supplied.remarks ?? "");
    if (supplied.mondayItemsSent !== undefined) {
      updates.monday_items_sent = String(supplied.mondayItemsSent ?? "");
    }
    if (supplied.photoFiles !== undefined) updates.photo_files = Array.isArray(supplied.photoFiles) ? supplied.photoFiles : [];
    let selectedStatusSystemKey: string | null = null;
    for (const [input, code, valueColumn, idColumn] of [
      ["status", "samples_sent_status", "status", "status_option_id"],
      ["reason", "samples_sent_reason", "reason", "reason_option_id"],
      ["courier", "samples_sent_courier", "courier", "courier_option_id"],
    ] as const) {
      if (supplied[input] === undefined) continue;
      const label = await resolveLabel(code, supplied[input]);
      updates[valueColumn] = label.value;
      updates[idColumn] = label.id;
      if (input === "status") selectedStatusSystemKey = label.systemKey;
    }
    if (selectedStatusSystemKey === "samples_sent_status_fail_to_return_remarks") {
      const remarks = String(supplied.remarks ?? existing.remarks ?? "").trim();
      if (supplied.confirmFailure !== true || !remarks) {
        throw new Error("Add remarks and confirm the failed return before changing this status.");
      }
      updates.remarks = remarks;
    }
    const mappedGroupId = supplied.status !== undefined && !String(supplied.status ?? "").trim()
      ? await groupIdForName("New Group")
      : await groupIdForStatusSystemKey(selectedStatusSystemKey);
    if (mappedGroupId) updates.group_id = mappedGroupId;
    if (selectedStatusSystemKey === "samples_sent_status_returned" && !existing.date_returned) {
      updates.date_returned = new Date().toISOString().slice(0, 10);
    }
    if (supplied.items !== undefined) {
      if (!Array.isArray(supplied.items) || !supplied.items.length) throw new Error("Add at least one item sent.");
      const normalized = supplied.items.map((item: unknown, index: number) => {
        const source = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
        const itemName = String(source.itemName ?? "").trim();
        const qty = Number(source.qty);
        if (!itemName || !Number.isFinite(qty) || qty <= 0) throw new Error(`Item row ${index + 1} needs an item name and a quantity above zero.`);
        return { linked_subitem_id: String(source.linkedSubitemId ?? "").trim() || null, item_name: itemName, qty, sort_order: index };
      });
      const linkedIds = normalized.flatMap((item) => item.linked_subitem_id ? [item.linked_subitem_id] : []);
      if (linkedIds.length) {
        const { data: linkedSubitems, error: linkedSubitemsError } = await supabaseAdmin
          .from("subitems")
          .select("id")
          .eq("client_id", String(updates.client_id ?? existing.client_id))
          .is("deleted_at", null)
          .in("id", linkedIds);
        if (linkedSubitemsError) throw linkedSubitemsError;
        if ((linkedSubitems ?? []).length !== new Set(linkedIds).size) {
          throw new Error("One or more linked items are unavailable for this client.");
        }
      }
      const { error: deleteError } = await supabaseAdmin.from("samples_sent_items").delete().eq("sample_sent_id", id);
      if (deleteError) throw deleteError;
      const { error: insertError } = await supabaseAdmin.from("samples_sent_items").insert(normalized.map((item) => ({ ...item, sample_sent_id: id })));
      if (insertError) throw insertError;
    }
    const { data, error } = await supabaseAdmin.from("samples_sent").update(updates).eq("id", id).select("*").single();
    if (error) throw error;
    await recordActivity(id, user.id, "updated this Samples Sent record");
    const [row] = await hydrateRows([data as Record<string, unknown>]);
    return NextResponse.json({ row });
  } catch (error) {
    return failure(error);
  }
}
