import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const INTERNAL_ROLES = new Set(["sales", "pm", "admin", "director", "dev"]);

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
  if (!INTERNAL_ROLES.has(String(profile?.role ?? "").toLowerCase())) {
    throw new Error("Forbidden");
  }
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not load Samples Sent records.";
  return NextResponse.json(
    { error: message },
    { status: message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400 },
  );
}

function dateOnly(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function todayPlus(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return dateOnly(date);
}

export async function POST(request: NextRequest) {
  try {
    await authorize();
    const body = await request.json();
    const clientIds = [...new Set(
      (Array.isArray(body?.clientIds) ? (body.clientIds as unknown[]) : [])
        .map((id: unknown) => String(id ?? "").trim())
        .filter(Boolean),
    )];
    if (clientIds.length > 500) throw new Error("Too many client IDs requested.");
    if (!clientIds.length) return NextResponse.json({ summaries: {} });

    const { data, error } = await supabaseAdmin
      .from("samples_sent")
      .select("client_id, return_by, status_option_id")
      .in("client_id", clientIds)
      .is("deactivated_at", null);
    if (error) throw error;

    const statusOptionIds = [...new Set(
      (data ?? []).map((record) => record.status_option_id).filter(Boolean),
    )] as string[];
    const { data: statusOptions, error: statusOptionsError } = statusOptionIds.length
      ? await supabaseAdmin
          .from("option_values")
          .select("id, system_key")
          .in("id", statusOptionIds)
      : { data: [], error: null };
    if (statusOptionsError) throw statusOptionsError;
    const statusSystemKeyById = new Map(
      (statusOptions ?? []).map((option) => [option.id, option.system_key]),
    );

    const today = todayPlus(0);
    const dueSoonEnd = todayPlus(3);
    const summaries: Record<string, { activeCount: number; notice: "overdue" | "dueSoon" | "allReturned" | null }> = {};
    const allReturnedByClient = new Map(clientIds.map((clientId) => [clientId, true]));
    for (const clientId of clientIds) summaries[clientId] = { activeCount: 0, notice: null };
    for (const record of (data ?? []) as Array<{ client_id: string; return_by: string | null; status_option_id: string | null }>) {
      const summary = summaries[record.client_id] ?? { activeCount: 0, notice: null };
      summary.activeCount += 1;
      const isReturned = statusSystemKeyById.get(record.status_option_id ?? "") === "samples_sent_status_returned";
      if (isReturned) {
        summaries[record.client_id] = summary;
        continue;
      }
      allReturnedByClient.set(record.client_id, false);
      if (record.return_by && record.return_by < today) summary.notice = "overdue";
      else if (record.return_by && record.return_by <= dueSoonEnd && summary.notice !== "overdue") {
        summary.notice = "dueSoon";
      }
      summaries[record.client_id] = summary;
    }
    for (const clientId of clientIds) {
      if (summaries[clientId].activeCount > 0 && allReturnedByClient.get(clientId)) {
        summaries[clientId].notice = "allReturned";
      }
    }
    return NextResponse.json({ summaries });
  } catch (error) {
    return failure(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    await authorize();
    const clientId = new URL(request.url).searchParams.get("clientId")?.trim();
    if (!clientId) throw new Error("A client is required.");

    const { data: records, error } = await supabaseAdmin
      .from("samples_sent")
      .select("id, group_id, reference_number, people_ids, status, status_option_id, return_by, created_by, created_at, deactivated_at, photo_files")
      .eq("client_id", clientId)
      .order("deactivated_at", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: false });
    if (error) throw error;

    const recordIds = (records ?? []).map((record) => record.id);
    const { data: items, error: itemsError } = recordIds.length
      ? await supabaseAdmin
          .from("samples_sent_items")
          .select("sample_sent_id, item_name, qty, sort_order")
          .in("sample_sent_id", recordIds)
          .order("sort_order", { ascending: true })
      : { data: [], error: null };
    if (itemsError) throw itemsError;

    const peopleIds = [...new Set(
      (records ?? []).flatMap((record) => [record.created_by, ...(record.people_ids ?? [])]).filter(Boolean),
    )] as string[];
    const { data: profiles, error: profilesError } = peopleIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, email, avatar_color").in("id", peopleIds)
      : { data: [], error: null };
    if (profilesError) throw profilesError;
    const statusOptionIds = [...new Set((records ?? []).map((record) => record.status_option_id).filter(Boolean))] as string[];
    const { data: statusOptions, error: statusOptionsError } = statusOptionIds.length
      ? await supabaseAdmin.from("option_values").select("id, value, color, system_key").in("id", statusOptionIds)
      : { data: [], error: null };
    if (statusOptionsError) throw statusOptionsError;
    const [
      { data: returnedStatusOption, error: returnedStatusOptionError },
      { data: groups, error: groupsError },
    ] = await Promise.all([
      supabaseAdmin
        .from("option_values")
        .select("id, value, color, system_key")
        .eq("system_key", "samples_sent_status_returned")
        .maybeSingle(),
      supabaseAdmin.from("samples_sent_groups").select("id, name"),
    ]);
    if (returnedStatusOptionError || groupsError) throw returnedStatusOptionError ?? groupsError;
    const statusById = Object.fromEntries((statusOptions ?? []).map((option) => [
      option.id,
      { id: option.id, value: option.value, color: option.color, systemKey: option.system_key },
    ]));
    const groupsById = Object.fromEntries((groups ?? []).map((group) => [group.id, group.name]));
    const profilesById = Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile]));
    const itemsByRecordId = new Map<string, Array<{ item_name: string; qty: number }>>();
    for (const item of items ?? []) {
      const current = itemsByRecordId.get(item.sample_sent_id) ?? [];
      current.push(item);
      itemsByRecordId.set(item.sample_sent_id, current);
    }

    return NextResponse.json({
      returnedStatusOption: returnedStatusOption
        ? { id: returnedStatusOption.id, value: returnedStatusOption.value, color: returnedStatusOption.color, systemKey: returnedStatusOption.system_key }
        : null,
      records: (records ?? []).map((record) => ({
        id: record.id,
        groupName: record.group_id ? groupsById[record.group_id] ?? null : null,
        referenceId: `SS${record.reference_number}`,
        status: record.status,
        statusOption: record.status_option_id ? statusById[record.status_option_id] ?? null : null,
        returnBy: record.return_by,
        createdAt: record.created_at,
        deactivatedAt: record.deactivated_at,
        photoFiles: Array.isArray(record.photo_files) ? record.photo_files : [],
        createdBy: record.created_by ? profilesById[record.created_by] ?? null : null,
        people: (record.people_ids ?? []).map((id: string) => profilesById[id]).filter(Boolean),
        items: itemsByRecordId.get(record.id) ?? [],
      })),
    });
  } catch (error) {
    return failure(error);
  }
}
