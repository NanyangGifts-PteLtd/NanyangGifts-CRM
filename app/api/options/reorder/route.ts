import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BOARD_OPTION_CODES = new Set([
  "reply_status", "client_status", "channel", "importance", "progress",
  "payment", "payment_status", "mode_of_payment", "shipper", "local_overseas",
  "subitem_status", "currency", "subitem_subprogress",
  "tracking_summary", "tracking_invoice_created", "tracking_multiple_invoices",
  "tracking_payment_status", "tracking_price_invoice_match",
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
  const body = await request.json() as {
    code?: string;
    values?: string[];
    layout?: Array<{ value?: string; section?: number }>;
  };
  const code = body.code?.trim() ?? "";
  const layout = Array.isArray(body.layout)
    ? body.layout.map((item) => ({
        value: item.value?.trim() ?? "",
        section: Number.isInteger(item.section) && Number(item.section) >= 0
          ? Number(item.section)
          : 0,
      }))
    : (Array.isArray(body.values) ? body.values : []).map((value) => ({ value: value.trim(), section: 0 }));
  const values = layout.map((item) => item.value);
  const sectionCount = code === "client_status" ? 5 : code === "payment" ? 4 : 1;
  if (
    !BOARD_OPTION_CODES.has(code) ||
    values.length === 0 ||
    new Set(values).size !== values.length ||
    layout.some((item) => item.section >= sectionCount)
  ) {
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
    layout.map((item, sort_order) =>
      supabaseAdmin
        .from("option_values")
        .update({ sort_order, section_index: item.section })
        .eq("id", idsByValue.get(item.value)!),
    ),
  );
  const error = results.find((result) => result.error)?.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
