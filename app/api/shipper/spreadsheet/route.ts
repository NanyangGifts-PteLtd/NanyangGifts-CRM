import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getOrCreateShipperWorkbook,
  getShipperSpreadsheetRows,
  hasSpreadsheetContent,
  calculateSpreadsheetFormulaValues,
} from "@/lib/shipper/spreadsheet";
import { supabaseAdmin } from "@/lib/supabase/admin";

const INTERNAL_ROLES = new Set(["pm", "admin", "director", "dev"]);
const SHIPPER_EDITABLE_FIELDS = new Set(["serial_number", "waybill_date", "waybill_number", "pieces", "chargeable_weight_kg", "destination", "freight_unit_price", "gst", "other_fees", "channel", "logistics_remarks", "air_received", "sea_received"]);
const FORMULA_FIELDS = new Set(["freight_cost", "total_cost", "value"]);

async function authorize(shipperId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, shipper_id")
    .eq("id", user.id)
    .maybeSingle();
  const role = String(profile?.role ?? "").toLowerCase();
  if (!INTERNAL_ROLES.has(role) && !(role === "shipper" && profile?.shipper_id === shipperId)) {
    throw new Error("Forbidden");
  }
  const { data: shipper, error } = await supabaseAdmin
    .from("shippers")
    .select("id, name")
    .eq("id", shipperId)
    .maybeSingle();
  if (error || !shipper) throw new Error("Shipper not found");
  return { userId: user.id, role, shipper };
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Spreadsheet request failed";
  const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const shipperId = request.nextUrl.searchParams.get("shipperId");
    if (!shipperId) throw new Error("shipperId is required");
    const { shipper } = await authorize(shipperId);
    return NextResponse.json(await getShipperSpreadsheetRows(shipperId, shipper.name ?? "Shipper"));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      shipperId?: string;
      rowType?: "item" | "blank_spacer";
      plannedFor?: string | null;
      values?: Record<string, unknown>;
      trailingBlankCount?: number;
    };
    if (!body.shipperId) throw new Error("shipperId is required");
    const { userId, role, shipper } = await authorize(body.shipperId);
    const fields = Object.keys(body.values ?? {});
    if (fields.some((field) => FORMULA_FIELDS.has(field))) {
      throw new Error("Formula cells cannot be edited directly");
    }
    if (role === "shipper" && fields.some((field) => !SHIPPER_EDITABLE_FIELDS.has(field))) {
      throw new Error("You do not have permission to edit one or more selected columns");
    }
    const workbook = await getOrCreateShipperWorkbook(body.shipperId, shipper.name ?? "Shipper");
    const { data: existingRows, error: rowsError } = await supabaseAdmin
      .from("shipper_spreadsheet_rows")
      .select("sort_key")
      .eq("workbook_id", workbook.id);
    if (rowsError) throw rowsError;
    const baseSortKey = Math.max(
      Date.now(),
      ...(existingRows ?? []).map((row) => Number(row.sort_key ?? 0) + 1000),
    );
    const trailingBlankCount = Math.max(0, Math.min(100, Math.floor(Number(body.trailingBlankCount ?? 0))));
    const inserts = [
      ...Array.from({ length: trailingBlankCount }, (_, index) => ({
        workbook_id: workbook.id,
        row_type: "blank_spacer" as const,
        sort_key: baseSortKey + (index + 1) * 1000,
        created_by: userId,
      })),
      {
        workbook_id: workbook.id,
        row_type: body.rowType ?? "item",
        planned_for: body.plannedFor ?? null,
        sort_key: baseSortKey + (trailingBlankCount + 1) * 1000,
        values: calculateSpreadsheetFormulaValues(body.values ?? {}),
        created_by: userId,
      },
    ];
    const { data, error } = await supabaseAdmin
      .from("shipper_spreadsheet_rows")
      .insert(inserts)
      .select()
      .order("sort_key", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ row: data?.[data.length - 1], rows: data ?? [] }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as { shipperId?: string; rowId?: string; values?: Record<string, unknown>; cellFills?: Record<string, string>; replaceValues?: boolean; isLocked?: boolean; version?: number };
    if (!body.shipperId || !body.rowId) throw new Error("shipperId and rowId are required");
    const { role } = await authorize(body.shipperId);
    const workbook = await getOrCreateShipperWorkbook(body.shipperId, "Shipper");
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("shipper_spreadsheet_rows")
      .select("id, values, is_locked, cell_fills, version")
      .eq("id", body.rowId)
      .eq("workbook_id", workbook.id)
      .maybeSingle();
    if (existingError || !existing) throw new Error("Spreadsheet row not found");
    if (existing.is_locked && (body.values || body.cellFills)) throw new Error("This spreadsheet row is locked");
    if (body.values) {
      const fields = Object.keys(body.values);
      if (fields.some((field) => FORMULA_FIELDS.has(field))) throw new Error("Formula cells cannot be edited directly");
      if (role === "shipper" && fields.some((field) => !SHIPPER_EDITABLE_FIELDS.has(field))) {
        throw new Error("You do not have permission to edit one or more selected columns");
      }
    }
    if (body.version !== undefined && body.version !== existing.version) throw new Error("This row was changed by another user. Refresh and try again.");
    const payload: Record<string, unknown> = {};
    if (body.values) {
      payload.values = calculateSpreadsheetFormulaValues(body.replaceValues ? body.values : { ...(existing.values ?? {}), ...body.values });
      if (hasSpreadsheetContent(payload.values as Record<string, unknown>)) payload.row_type = "item";
    }
    if (body.cellFills) {
      const invalidFill = Object.entries(body.cellFills).some(([field, color]) =>
        !field || typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color),
      );
      if (invalidFill) throw new Error("Invalid spreadsheet cell fill");
      if (role === "shipper" && Object.keys(body.cellFills).some((field) => !SHIPPER_EDITABLE_FIELDS.has(field))) {
        throw new Error("You do not have permission to format one or more selected columns");
      }
      payload.cell_fills = body.cellFills;
    }
    if (body.isLocked !== undefined) payload.is_locked = body.isLocked;
    if (!Object.keys(payload).length) throw new Error("No changes supplied");
    const { data, error } = await supabaseAdmin
      .from("shipper_spreadsheet_rows")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ row: data, role });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const shipperId = request.nextUrl.searchParams.get("shipperId");
    const rowId = request.nextUrl.searchParams.get("rowId");
    if (!shipperId || !rowId) throw new Error("shipperId and rowId are required");
    await authorize(shipperId);
    const workbook = await getOrCreateShipperWorkbook(shipperId, "Shipper");
    const { error } = await supabaseAdmin
      .from("shipper_spreadsheet_rows")
      .delete()
      .eq("id", rowId)
      .eq("workbook_id", workbook.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
