import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BOARD_OPTION_CODES = new Set([
  "reply_status", "client_status", "channel", "importance", "progress",
  "payment", "payment_status", "mode_of_payment", "shipper", "local_overseas",
  "subitem_status", "currency", "subitem_subprogress",
]);

async function canManageLabels() {
  const caller = await createClient();
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return ["admin", "director", "dev"].includes(profile?.role?.trim().toLowerCase() ?? "");
}

export async function POST(request: NextRequest) {
  if (!(await canManageLabels())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json() as { code?: string; values?: string[] };
  const code = body.code?.trim() ?? "";
  const values = Array.isArray(body.values) ? body.values.map((value) => value.trim()) : [];
  if (!BOARD_OPTION_CODES.has(code) || values.length === 0 || new Set(values).size !== values.length) {
    return NextResponse.json({ error: "Invalid label order." }, { status: 400 });
  }

  const { data: group, error: groupError } = await supabaseAdmin
    .from("option_groups")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (groupError || !group) return NextResponse.json({ error: groupError?.message ?? "Label group was not found." }, { status: 404 });

  const { data: options, error: optionsError } = await supabaseAdmin
    .from("option_values")
    .select("id, value")
    .eq("group_id", group.id);
  if (optionsError) return NextResponse.json({ error: optionsError.message }, { status: 500 });
  const idsByValue = new Map((options ?? []).map((option) => [option.value, option.id]));
  if (values.length !== idsByValue.size || values.some((value) => !idsByValue.has(value))) {
    return NextResponse.json({ error: "The label list changed. Refresh and try again." }, { status: 409 });
  }

  const results = await Promise.all(
    values.map((value, sort_order) =>
      supabaseAdmin.from("option_values").update({ sort_order }).eq("id", idsByValue.get(value)!),
    ),
  );
  const error = results.find((result) => result.error)?.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
