import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const INTERNAL_ROLES = new Set(["sales", "pm", "admin", "director", "dev"]);
const UPDATE_BATCH_SIZE = 250;

type SubitemCandidate = { id: string; client_id: string };

async function splitLockedSubitems(rows: SubitemCandidate[]) {
  const clientIds = [...new Set(rows.map((row) => row.client_id))];
  const lockedClientIds = new Set<string>();
  for (let start = 0; start < clientIds.length; start += UPDATE_BATCH_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("clients")
      .select("id, custom_fields")
      .in("id", clientIds.slice(start, start + UPDATE_BATCH_SIZE));
    if (error) throw error;
    for (const client of data ?? []) {
      if (client.custom_fields?.subitemsLocked === "true")
        lockedClientIds.add(client.id);
    }
  }
  return {
    unlockedIds: rows
      .filter((row) => !lockedClientIds.has(row.client_id))
      .map((row) => row.id),
    lockedCount: rows.filter((row) => lockedClientIds.has(row.client_id)).length,
  };
}

async function updateSubitemsInBatches(
  ids: string[],
  values: Record<string, string>,
) {
  for (let start = 0; start < ids.length; start += UPDATE_BATCH_SIZE) {
    const { error } = await supabaseAdmin
      .from("subitems")
      .update(values)
      .in("id", ids.slice(start, start + UPDATE_BATCH_SIZE));
    if (error) throw error;
  }
}

export async function POST(request: NextRequest) {
  const caller = await createClient();
  const {
    data: { user },
  } = await caller.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError)
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (!INTERNAL_ROLES.has(String(profile?.role ?? "").trim().toLowerCase()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as {
    optionId?: string;
    previousValue?: string;
    nextValue?: string;
  };
  const optionId = body.optionId?.trim() ?? "";
  const previousValue = body.previousValue?.trim() ?? "";
  const nextValue = body.nextValue?.trim() ?? "";
  if (!optionId || !previousValue || !nextValue)
    return NextResponse.json(
      { error: "A label ID and both label names are required." },
      { status: 400 },
    );

  const { data: group, error: groupError } = await supabaseAdmin
    .from("option_groups")
    .select("id")
    .eq("code", "subitem_status")
    .maybeSingle();
  if (groupError)
    return NextResponse.json({ error: groupError.message }, { status: 500 });
  if (!group)
    return NextResponse.json(
      { error: "The subitem status label group was not found." },
      { status: 404 },
    );

  const { data: option, error: optionError } = await supabaseAdmin
    .from("option_values")
    .select("id, value")
    .eq("id", optionId)
    .eq("group_id", group.id)
    .maybeSingle();
  if (optionError)
    return NextResponse.json({ error: optionError.message }, { status: 500 });
  if (!option)
    return NextResponse.json({ error: "The label was not found." }, { status: 404 });
  // Before this route existed, the browser could update the option before RLS
  // blocked propagation to subitems. Use the stable option ID, rather than a
  // stale displayed value, so any authorized retry can complete that repair.
  const didRenameOption = option.value !== nextValue;
  if (didRenameOption) {
    const { error: renameError } = await supabaseAdmin
      .from("option_values")
      .update({ value: nextValue })
      .eq("id", option.id);
    if (renameError)
      return NextResponse.json({ error: renameError.message }, { status: 500 });
  }

  const { data: linkedRows, error: linkedRowsError } = await supabaseAdmin
    .from("subitems")
    .select("id, client_id")
    .eq("status_option_id", option.id)
    .is("deleted_at", null);
  if (linkedRowsError) {
    if (didRenameOption)
      await supabaseAdmin
        .from("option_values")
        .update({ value: previousValue })
        .eq("id", option.id);
    return NextResponse.json({ error: linkedRowsError.message }, { status: 500 });
  }

  // Legacy rows may predate stable option IDs. Keep their display value and
  // ID aligned while the old label text is still known.
  const { data: legacyRows, error: legacyRowsError } = await supabaseAdmin
    .from("subitems")
    .select("id, client_id")
    .is("status_option_id", null)
    .in("status", Array.from(new Set([previousValue, option.value])))
    .is("deleted_at", null);
  if (legacyRowsError) {
    if (didRenameOption)
      await supabaseAdmin
        .from("option_values")
        .update({ value: previousValue })
        .eq("id", option.id);
    return NextResponse.json({ error: legacyRowsError.message }, { status: 500 });
  }

  try {
    const linked = await splitLockedSubitems(
      (linkedRows ?? []) as SubitemCandidate[],
    );
    const legacy = await splitLockedSubitems(
      (legacyRows ?? []) as SubitemCandidate[],
    );
    await updateSubitemsInBatches(linked.unlockedIds, { status: nextValue });
    await updateSubitemsInBatches(legacy.unlockedIds, {
      status: nextValue,
      status_option_id: option.id,
    });
    return NextResponse.json({
      ok: true,
      skippedLockedSubitems: linked.lockedCount + legacy.lockedCount,
    });
  } catch (error) {
    if (didRenameOption)
      await supabaseAdmin
        .from("option_values")
        .update({ value: previousValue })
        .eq("id", option.id);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Linked subitems could not be updated." },
      { status: 500 },
    );
  }
}
