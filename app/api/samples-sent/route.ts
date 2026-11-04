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
    { data: items, error: itemsError },
    { data: profiles, error: profilesError },
  ] = await Promise.all([
    clientIds.length
      ? supabaseAdmin
          .from("clients")
          .select("id, name, display_id, phone")
          .in("id", clientIds)
      : Promise.resolve({ data: [], error: null }),
    recordIds.length
      ? supabaseAdmin
          .from("samples_sent_items")
          .select("sample_sent_id, item_name, qty, sort_order")
          .in("sample_sent_id", recordIds)
          .order("sort_order")
      : Promise.resolve({ data: [], error: null }),
    personIds.length
      ? supabaseAdmin
          .from("profiles")
          .select("id, full_name, email, avatar_color")
          .in("id", personIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (clientsError || itemsError || profilesError)
    throw clientsError ?? itemsError ?? profilesError;
  const clientsById = new Map(
    (clients ?? []).map((client) => [client.id, client]),
  );
  const profilesById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  );
  const itemsByRecord = new Map<string, unknown[]>();
  for (const item of items ?? []) {
    const current = itemsByRecord.get(item.sample_sent_id) ?? [];
    current.push(item);
    itemsByRecord.set(item.sample_sent_id, current);
  }
  return rows.map((row) => ({
    ...row,
    referenceId: `SS${row.reference_number}`,
    linkedClient: clientsById.get(String(row.client_id)) ?? null,
    people: ((row.people_ids as string[] | null) ?? [])
      .map((id) => profilesById.get(id))
      .filter(Boolean),
    createdByProfile: row.created_by
      ? (profilesById.get(String(row.created_by)) ?? null)
      : null,
    items: itemsByRecord.get(String(row.id)) ?? [],
  }));
}

export async function GET() {
  try {
    await authorize();
    const { data, error } = await supabaseAdmin
      .from("samples_sent")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({
      rows: await hydrateRows((data ?? []) as Array<Record<string, unknown>>),
    });
  } catch (error) {
    return failure(error);
  }
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
    const [hydrated] = await hydrateRows([record as Record<string, unknown>]);
    return NextResponse.json({ row: hydrated });
  } catch (error) {
    return failure(error);
  }
}
