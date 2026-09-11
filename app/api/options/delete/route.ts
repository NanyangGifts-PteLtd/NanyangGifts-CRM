import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type LabelField = {
  table: "clients" | "subitems";
  valueColumn: string;
  optionIdColumn?: string;
};

const LABEL_FIELDS: Record<string, LabelField> = {
  reply_status: { table: "clients", valueColumn: "reply_status", optionIdColumn: "reply_status_option_id" },
  client_status: { table: "clients", valueColumn: "status", optionIdColumn: "status_option_id" },
  channel: { table: "clients", valueColumn: "channel", optionIdColumn: "channel_option_id" },
  importance: { table: "clients", valueColumn: "importance", optionIdColumn: "importance_option_id" },
  progress: { table: "clients", valueColumn: "progress", optionIdColumn: "progress_option_id" },
  payment: { table: "subitems", valueColumn: "payment", optionIdColumn: "payment_option_id" },
  payment_status: { table: "subitems", valueColumn: "payment_status", optionIdColumn: "payment_status_option_id" },
  mode_of_payment: { table: "subitems", valueColumn: "mode_of_payment", optionIdColumn: "mode_of_payment_option_id" },
  shipper: { table: "subitems", valueColumn: "shipper", optionIdColumn: "shipper_option_id" },
  local_overseas: { table: "subitems", valueColumn: "local_overseas", optionIdColumn: "local_overseas_option_id" },
  subitem_status: { table: "subitems", valueColumn: "status", optionIdColumn: "status_option_id" },
  currency: { table: "subitems", valueColumn: "currency", optionIdColumn: "currency_option_id" },
};
const TRACKING_CUSTOM_FIELD_BY_CODE: Record<string, string> = {
  tracking_summary: "trackingSummary",
  tracking_invoice_created: "trackingInvoiceCreated",
  tracking_multiple_invoices: "trackingMultipleInvoices",
  tracking_payment_status: "trackingPaymentStatus",
  tracking_price_invoice_match: "trackingPriceInvoiceMatch",
};

async function canManageLabels() {
  const caller = await createClient();
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return ["admin", "director", "dev"].includes(
    profile?.role?.trim().toLowerCase() ?? "",
  );
}

async function findOption(code: string, name: string) {
  const { data: group, error: groupError } = await supabaseAdmin
    .from("option_groups")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (groupError || !group) return { error: groupError?.message ?? "Label group was not found." };

  const { data: option, error: optionError } = await supabaseAdmin
    .from("option_values")
    .select("id, system_key")
    .eq("group_id", group.id)
    .eq("value", name)
    .maybeSingle();
  if (optionError || !option) return { error: optionError?.message ?? "Label option was not found." };
  return { option };
}

async function usageFor(code: string, name: string, optionId: string) {
  const trackingField = TRACKING_CUSTOM_FIELD_BY_CODE[code];
  if (trackingField) {
    const { data, error } = await supabaseAdmin.from("clients").select("id, custom_fields");
    if (error) return { error: error.message, ids: new Set<string>() };
    return {
      ids: new Set(
        (data ?? [])
          .filter((row) => row.custom_fields?.[trackingField] === name)
          .map((row) => row.id),
      ),
    };
  }
  if (code === "subitem_subprogress") {
    const { data, error } = await supabaseAdmin.from("subitems").select("id, timeline_rows");
    if (error) return { error: error.message, ids: new Set<string>() };
    return {
      ids: new Set(
        (data ?? [])
          .filter((row) => Array.isArray(row.timeline_rows) && row.timeline_rows.some((item: { subProgress?: string }) => item?.subProgress === name))
          .map((row) => row.id),
      ),
    };
  }

  const field = LABEL_FIELDS[code];
  if (!field) return { ids: new Set<string>() };
  const textResult = await supabaseAdmin
    .from(field.table)
    .select("id")
    .eq(field.valueColumn, name);
  if (textResult.error) return { error: textResult.error.message, ids: new Set<string>() };

  const ids = new Set((textResult.data ?? []).map((row) => row.id));
  if (field.optionIdColumn) {
    const idResult = await supabaseAdmin
      .from(field.table)
      .select("id")
      .eq(field.optionIdColumn, optionId);
    if (idResult.error) return { error: idResult.error.message, ids };
    for (const row of idResult.data ?? []) ids.add(row.id);
  }
  return { ids };
}

async function clearUsage(code: string, name: string, optionId: string) {
  const trackingField = TRACKING_CUSTOM_FIELD_BY_CODE[code];
  if (trackingField) {
    const { data, error } = await supabaseAdmin.from("clients").select("id, custom_fields");
    if (error) return error;
    for (const row of data ?? []) {
      if (row.custom_fields?.[trackingField] !== name) continue;
      const { error: updateError } = await supabaseAdmin
        .from("clients")
        .update({ custom_fields: { ...(row.custom_fields ?? {}), [trackingField]: "" } })
        .eq("id", row.id);
      if (updateError) return updateError;
    }
    return null;
  }
  if (code === "subitem_subprogress") {
    const { data, error } = await supabaseAdmin.from("subitems").select("id, timeline_rows");
    if (error) return error;
    for (const row of data ?? []) {
      if (!Array.isArray(row.timeline_rows)) continue;
      const timelineRows = row.timeline_rows.map((item: { subProgress?: string }) =>
        item?.subProgress === name ? { ...item, subProgress: "" } : item,
      );
      if (JSON.stringify(timelineRows) === JSON.stringify(row.timeline_rows)) continue;
      const { error: updateError } = await supabaseAdmin
        .from("subitems")
        .update({ timeline_rows: timelineRows })
        .eq("id", row.id);
      if (updateError) return updateError;
    }
    return null;
  }

  const field = LABEL_FIELDS[code];
  if (!field) return null;
  const values: Record<string, string | null> = { [field.valueColumn]: "" };
  if (field.optionIdColumn) values[field.optionIdColumn] = null;
  const textResult = await supabaseAdmin.from(field.table).update(values).eq(field.valueColumn, name);
  if (textResult.error) return textResult.error;
  if (!field.optionIdColumn) return null;
  const idResult = await supabaseAdmin.from(field.table).update(values).eq(field.optionIdColumn, optionId);
  return idResult.error;
}

export async function POST(request: NextRequest) {
  if (!(await canManageLabels())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json() as { action?: "preview" | "delete"; code?: string; name?: string };
  const code = body.code?.trim() ?? "";
  const name = body.name?.trim() ?? "";
  if (!code || !name || ![...Object.keys(LABEL_FIELDS), "subitem_subprogress", ...Object.keys(TRACKING_CUSTOM_FIELD_BY_CODE)].includes(code)) {
    return NextResponse.json({ error: "Invalid label option." }, { status: 400 });
  }

  const found = await findOption(code, name);
  if ("error" in found) return NextResponse.json({ error: found.error }, { status: 404 });
  if (found.option.system_key) {
    return NextResponse.json({
      error: `“${name}” is required by backend automation (${code}.${found.option.system_key}) and cannot be deleted. You may rename or recolour it without interrupting the automation.`,
      protected: true,
      reason: "backend_automation",
    }, { status: 409 });
  }
  const usage = await usageFor(code, name, found.option.id);
  if (usage.error) return NextResponse.json({ error: usage.error }, { status: 500 });
  if (body.action === "preview") {
    return NextResponse.json({ optionId: found.option.id, usageCount: usage.ids.size });
  }
  if (body.action !== "delete") return NextResponse.json({ error: "Invalid action." }, { status: 400 });

  const clearError = await clearUsage(code, name, found.option.id);
  if (clearError) return NextResponse.json({ error: clearError.message }, { status: 500 });
  const { error: deleteError } = await supabaseAdmin.from("option_values").delete().eq("id", found.option.id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ ok: true, usageCount: usage.ids.size });
}
