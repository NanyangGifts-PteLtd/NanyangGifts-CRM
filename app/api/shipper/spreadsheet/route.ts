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
const SHIPPER_EDITABLE_FIELDS = new Set(["serial_number", "waybill_date", "waybill_number", "pieces", "chargeable_weight_kg", "destination", "freight_unit_price", "gst", "other_fees", "channel", "logistics_remarks"]);
// Receipt confirmations remain editable by internal staff even after the
// rest of a completed shipment row has been locked.
const ALWAYS_EDITABLE_AFTER_LOCK_FIELDS = new Set(["air_received", "sea_received"]);
const FORMULA_FIELDS = new Set(["freight_cost", "total_cost", "value"]);
const SHIPMENT_FIELDS = new Set(["serial_number", "waybill_date", "waybill_number", "pieces", "chargeable_weight_kg", "freight_unit_price", "destination", "freight_cost", "gst", "other_fees", "total_cost", "channel", "logistics_remarks", "ic", "info_provided_date", "delivery_info", "sea_or_air", "tax_refund"]);
const SHIPMENT_INPUT_FIELDS = [...SHIPMENT_FIELDS].filter((field) => !FORMULA_FIELDS.has(field));
const NUMERIC_FIELDS = new Set(["pieces", "chargeable_weight_kg", "freight_unit_price", "gst", "other_fees", "cartons", "qty", "up"]);
const DATE_FIELDS = new Set(["waybill_date", "info_provided_date"]);
const SEA_OR_AIR_OPTIONS = new Set(["空运", "海运", "海运/小包"]);
const TAX_REFUND_OPTIONS = new Set(["退", "X"]);
// Mirrors the previous Shipment view: receipt confirmations and remarks are
// not shipment-completion requirements and must not block its auto-lock.
const AUTO_LOCK_FIELDS = ["serial_number", "waybill_date", "waybill_number", "pieces", "chargeable_weight_kg", "destination", "freight_unit_price", "gst", "other_fees", "channel"];
const AUTO_LOCK_DELAY_MS = 10 * 60 * 1000;

function hasValue(value: unknown) {
  return value !== null && value !== undefined && (typeof value !== "string" || value.trim().length > 0);
}

function shouldAutoLock(values: Record<string, unknown>) {
  return AUTO_LOCK_FIELDS.every((field) => hasValue(values[field]));
}

function autoLockAt(values: Record<string, unknown>, existingAutoLockAt?: string | null) {
  return shouldAutoLock(values) ? existingAutoLockAt ?? new Date(Date.now() + AUTO_LOCK_DELAY_MS).toISOString() : null;
}

async function lockExpiredRows(workbookId: string) {
  const { error } = await supabaseAdmin
    .from("shipper_spreadsheet_rows")
    .update({ is_locked: true, auto_lock_at: null })
    .eq("workbook_id", workbookId)
    .eq("is_locked", false)
    .not("auto_lock_at", "is", null)
    .lte("auto_lock_at", new Date().toISOString());
  if (error) throw error;
}

function validateSpreadsheetValues(values: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(values).map(([field, value]) => {
    if (value === "" || value === null || value === undefined) return [field, null];
    if (NUMERIC_FIELDS.has(field)) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) throw new Error(`${field} must be a number`);
      return [field, parsed];
    }
    const text = String(value);
    if (DATE_FIELDS.has(field) && !/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(`${field} must use YYYY-MM-DD`);
    if (["channel", "sea_or_air"].includes(field) && !SEA_OR_AIR_OPTIONS.has(text)) throw new Error(`${field} must be 空运, 海运, or 海运/小包`);
    if (field === "tax_refund" && !TAX_REFUND_OPTIONS.has(text)) throw new Error("退税 must be 退 or X");
    return [field, value];
  }));
}

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
    const spreadsheet = await getShipperSpreadsheetRows(shipperId, shipper.name ?? "Shipper");
    await lockExpiredRows(spreadsheet.workbook.id);
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
      referenceRowId?: string;
      placement?: "above" | "below";
      copiedRows?: Array<{ values: Record<string, unknown>; cellFills?: Record<string, string> }>;
    };
    if (!body.shipperId) throw new Error("shipperId is required");
    const { userId, role, shipper } = await authorize(body.shipperId);
    const copiedRows = body.copiedRows ?? [];
    const fields = [...Object.keys(body.values ?? {}), ...copiedRows.flatMap((row) => Object.keys(row.values ?? {}))];
    if (fields.some((field) => FORMULA_FIELDS.has(field))) {
      throw new Error("Formula cells cannot be edited directly");
    }
    if (role === "shipper" && fields.some((field) => !SHIPPER_EDITABLE_FIELDS.has(field))) {
      throw new Error("You do not have permission to edit one or more selected columns");
    }
    const workbook = await getOrCreateShipperWorkbook(body.shipperId, shipper.name ?? "Shipper");
    const { data: existingRows, error: rowsError } = await supabaseAdmin
      .from("shipper_spreadsheet_rows")
      .select("id, sort_key")
      .eq("workbook_id", workbook.id);
    if (rowsError) throw rowsError;
    if (body.referenceRowId && body.placement) {
      const ordered = [...(existingRows ?? [])].sort((left, right) => (
        Number(left.sort_key) - Number(right.sort_key) || String(left.id).localeCompare(String(right.id))
      ));
      const referenceIndex = ordered.findIndex((row) => row.id === body.referenceRowId);
      if (referenceIndex < 0) throw new Error("Spreadsheet row not found");
      const insertionIndex = body.placement === "above" ? referenceIndex : referenceIndex + 1;
      const before = ordered[insertionIndex - 1];
      const after = ordered[insertionIndex];
      const rowCount = Math.max(1, copiedRows.length);
      const firstSortKey = before && after
        ? Number(before.sort_key) + (Number(after.sort_key) - Number(before.sort_key)) / (rowCount + 1)
        : before
          ? Number(before.sort_key) + 1000
          : Number(after?.sort_key ?? 1000) - 1000 * rowCount;
      if (copiedRows.length) {
        if (role === "shipper" && copiedRows.some((row) => Object.keys(row.cellFills ?? {}).some((field) => !SHIPPER_EDITABLE_FIELDS.has(field)))) {
          throw new Error("You do not have permission to format one or more copied columns");
        }
        const sortStep = before && after
          ? (Number(after.sort_key) - Number(before.sort_key)) / (rowCount + 1)
          : 1000;
        const { data, error } = await supabaseAdmin
          .from("shipper_spreadsheet_rows")
          .insert(copiedRows.map((row, index) => {
            const values = calculateSpreadsheetFormulaValues(validateSpreadsheetValues(row.values ?? {}));
            return {
              workbook_id: workbook.id,
              row_type: "item",
              source_type: "manual_draft",
              sort_key: firstSortKey + sortStep * index,
              values,
              auto_lock_at: autoLockAt(values),
              cell_fills: row.cellFills ?? {},
              created_by: userId,
            };
          }))
          .select()
          .order("sort_key", { ascending: true });
        if (error) throw error;
        return NextResponse.json({ row: data?.[0], rows: data ?? [] }, { status: 201 });
      }
      const { data, error } = await supabaseAdmin
        .from("shipper_spreadsheet_rows")
        .insert({ workbook_id: workbook.id, row_type: "blank_spacer", sort_key: firstSortKey, values: {}, created_by: userId })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ row: data, rows: [data] }, { status: 201 });
    }
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
      (() => {
        const values = calculateSpreadsheetFormulaValues(validateSpreadsheetValues(body.values ?? {}));
        return {
        workbook_id: workbook.id,
        row_type: body.rowType ?? "item",
        planned_for: body.plannedFor ?? null,
        sort_key: baseSortKey + (trailingBlankCount + 1) * 1000,
        values,
        auto_lock_at: autoLockAt(values),
        created_by: userId,
      }; })(),
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
    const body = await request.json() as { shipperId?: string; rowId?: string; values?: Record<string, unknown>; cellFills?: Record<string, string>; replaceValues?: boolean; isLocked?: boolean; version?: number; operation?: "merge" | "unmerge" | "update-shared"; rowIds?: string[]; resolvedValues?: Record<string, unknown> };
    if (!body.shipperId || (!body.rowId && !body.operation)) throw new Error("shipperId and rowId are required");
    const { role } = await authorize(body.shipperId);
    const workbook = await getOrCreateShipperWorkbook(body.shipperId, "Shipper");
    await lockExpiredRows(workbook.id);
    if (body.operation) {
      // A shipper may update only the explicitly shipper-editable fields. Row
      // grouping changes, ungrouping, and conflict resolution can rewrite
      // internal shipment fields, so they remain internal-staff actions.
      if (role === "shipper" && body.operation !== "update-shared") {
        throw new Error("Only internal staff can merge or unmerge shipment rows");
      }
      const rowIds = [...new Set(body.rowIds ?? [])];
      if (rowIds.length < 2) throw new Error("Select at least two rows to change a shipment grouping");
      const { data: allRows, error: rowsError } = await supabaseAdmin
        .from("shipper_spreadsheet_rows")
        .select("id, values, is_locked, auto_lock_at, shipment_group_id, sort_key")
        .eq("workbook_id", workbook.id)
        .order("sort_key", { ascending: true })
        .order("id", { ascending: true });
      if (rowsError) throw rowsError;
      const ordered = allRows ?? [];
      const selected = ordered.filter((row) => rowIds.includes(row.id));
      if (selected.length !== rowIds.length) throw new Error("One or more spreadsheet rows could not be found");
      if (selected.some((row) => row.is_locked)) throw new Error("Unlock every selected row before changing its shipment grouping");
      const selectedIdSet = new Set(rowIds);
      const selectedIndexes = ordered.map((row, index) => selectedIdSet.has(row.id) ? index : -1).filter((index) => index >= 0);
      if (selectedIndexes.some((index, position) => position > 0 && index !== selectedIndexes[position - 1] + 1)) {
        throw new Error("Shipment rows must be consecutive");
      }
      const existingGroupIds = new Set(selected.map((row) => row.shipment_group_id).filter((groupId): groupId is string => Boolean(groupId)));
      if ([...existingGroupIds].some((groupId) => ordered.some((row) => row.shipment_group_id === groupId && !selectedIdSet.has(row.id)))) {
        throw new Error("Select every row in an existing shipment before changing its grouping");
      }
      if (body.operation === "update-shared") {
        if (existingGroupIds.size !== 1 || selected.some((row) => row.shipment_group_id !== [...existingGroupIds][0])) {
          throw new Error("The selected rows are not one shipment");
        }
        const sharedUpdate = validateSpreadsheetValues(body.values ?? {});
        if (!Object.keys(sharedUpdate).length || Object.keys(sharedUpdate).some((field) => !SHIPMENT_INPUT_FIELDS.includes(field))) {
          throw new Error("Only editable shipment fields can be updated here");
        }
        if (role === "shipper" && Object.keys(sharedUpdate).some((field) => !SHIPPER_EDITABLE_FIELDS.has(field))) {
          throw new Error("You do not have permission to edit one or more selected columns");
        }
        const data = await Promise.all(selected.map(async (row) => {
          const values = calculateSpreadsheetFormulaValues({ ...(row.values ?? {}), ...sharedUpdate });
          const { data: updated, error } = await supabaseAdmin
            .from("shipper_spreadsheet_rows")
            .update({ values, auto_lock_at: autoLockAt(values, row.auto_lock_at) })
            .eq("id", row.id)
            .select()
            .single();
          if (error) throw error;
          return updated;
        }));
        return NextResponse.json({ rows: data });
      }
      if (body.operation === "unmerge") {
        if (existingGroupIds.size !== 1 || selected.some((row) => row.shipment_group_id !== [...existingGroupIds][0])) {
          throw new Error("Select all rows in one shipment to unmerge it");
        }
        const { data, error } = await supabaseAdmin
          .from("shipper_spreadsheet_rows")
          .update({ shipment_group_id: null })
          .in("id", rowIds)
          .select();
        if (error) throw error;
        return NextResponse.json({ rows: data ?? [] });
      }

      const resolvedInput = validateSpreadsheetValues(body.resolvedValues ?? {});
      if (Object.keys(resolvedInput).some((field) => !SHIPMENT_INPUT_FIELDS.includes(field))) {
        throw new Error("Only shipment fields can be resolved while merging");
      }
      const sharedValues: Record<string, unknown> = {};
      for (const field of SHIPMENT_INPUT_FIELDS) {
        const values = [...new Set(selected.map((row) => row.values?.[field]).filter((value) => value !== null && value !== undefined && String(value).trim() !== ""))];
        if (values.length > 1 && resolvedInput[field] === undefined) {
          throw new Error(`Choose one ${field} value before merging`);
        }
        if (resolvedInput[field] !== undefined) {
          if (values.length && !values.some((value) => String(value) === String(resolvedInput[field]))) {
            throw new Error(`The selected ${field} value is not present in the rows being merged`);
          }
          sharedValues[field] = resolvedInput[field];
        } else if (values.length === 1) {
          sharedValues[field] = values[0];
        }
      }
      const shipmentGroupId = crypto.randomUUID();
      const updates = await Promise.all(selected.map(async (row) => {
        const values = calculateSpreadsheetFormulaValues({ ...(row.values ?? {}), ...sharedValues });
        const { data, error } = await supabaseAdmin
          .from("shipper_spreadsheet_rows")
          .update({ shipment_group_id: shipmentGroupId, values, auto_lock_at: autoLockAt(values, row.auto_lock_at) })
          .eq("id", row.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }));
      return NextResponse.json({ rows: updates });
    }
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("shipper_spreadsheet_rows")
      .select("id, values, is_locked, auto_lock_at, cell_fills, version")
      .eq("id", body.rowId)
      .eq("workbook_id", workbook.id)
      .maybeSingle();
    if (existingError || !existing) throw new Error("Spreadsheet row not found");
    const lockedValueFields = body.values ? Object.keys(body.values) : [];
    const canEditLockedValues = lockedValueFields.length > 0 && lockedValueFields.every((field) => ALWAYS_EDITABLE_AFTER_LOCK_FIELDS.has(field));
    if (existing.is_locked && ((body.values && !canEditLockedValues) || body.cellFills)) throw new Error("This spreadsheet row is locked");
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
      payload.values = calculateSpreadsheetFormulaValues(validateSpreadsheetValues(body.replaceValues ? body.values : { ...(existing.values ?? {}), ...body.values }));
      if (hasSpreadsheetContent(payload.values as Record<string, unknown>)) payload.row_type = "item";
      const changedRequiredField = Object.keys(body.values).some((field) => AUTO_LOCK_FIELDS.includes(field));
      if (changedRequiredField) {
        payload.auto_lock_at = autoLockAt(payload.values as Record<string, unknown>, existing.auto_lock_at);
      }
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
    if (body.isLocked !== undefined) {
      payload.is_locked = body.isLocked;
      payload.auto_lock_at = body.isLocked
        ? null
        : autoLockAt((payload.values as Record<string, unknown> | undefined) ?? (existing.values ?? {}));
    }
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
    const { role } = await authorize(shipperId);
    if (role === "shipper") throw new Error("Only internal staff can delete spreadsheet rows");
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
