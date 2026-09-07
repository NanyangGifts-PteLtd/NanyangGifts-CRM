import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type SpreadsheetRow = {
  id: string;
  workbook_id: string;
  row_type: "item" | "blank_spacer";
  source_type: "crm_push" | "manual_draft";
  source_subitem_id: string | null;
  shipment_group_id: string | null;
  planned_for: string | null;
  sort_key: number;
  is_locked: boolean;
  values: Record<string, unknown>;
  version: number;
};

const SPREADSHEET_MANUAL_FIELDS = new Set([
  "serial_number", "waybill_date", "waybill_number", "pieces", "chargeable_weight_kg",
  "destination", "freight_unit_price", "gst", "other_fees", "channel", "logistics_remarks",
  "ic", "info_provided_date", "cn_tracking_no", "cartons", "item_name", "delivery_info",
  "qty", "up", "sea_or_air", "tax_refund", "shipper_remarks", "samples_by_air",
  "samples_by_sea", "air_received", "sea_received",
]);

// A row that only contains nulls or empty strings is an unused working row,
// even though an earlier pilot interaction may have persisted its JSON keys.
export function hasSpreadsheetContent(values: Record<string, unknown> | null | undefined) {
  // Legacy push metadata can remain in a row JSON object even after the user
  // clears every visible cell. Only visible, manually editable worksheet
  // fields count as content (and therefore as a visible lock marker).
  const manualValues = Object.fromEntries(
    Object.entries(values ?? {}).filter(([key]) => SPREADSHEET_MANUAL_FIELDS.has(key)),
  );
  return Object.values(manualValues).some((value) => {
    if (value === null || value === undefined) return false;
    return typeof value !== "string" || value.trim().length > 0;
  });
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Formula fields are stored with the row so exports and API consumers receive
 * the same results that are visible in the spreadsheet. */
export function calculateSpreadsheetFormulaValues(values: Record<string, unknown>) {
  const chargeableWeight = numberOrNull(values.chargeable_weight_kg);
  const freightUnitPrice = numberOrNull(values.freight_unit_price);
  const freightCost = chargeableWeight !== null && freightUnitPrice !== null
    ? chargeableWeight * freightUnitPrice
    : null;
  const gst = numberOrNull(values.gst);
  const otherFees = numberOrNull(values.other_fees);
  const totalCost = freightCost !== null && gst !== null && otherFees !== null
    ? freightCost + gst + otherFees
    : null;
  const qty = numberOrNull(values.qty);
  const unitPrice = numberOrNull(values.up);
  const declaredValue = qty !== null && unitPrice !== null ? qty * unitPrice : null;
  return {
    ...values,
    freight_cost: freightCost,
    total_cost: totalCost,
    value: declaredValue,
  };
}

export async function getOrCreateShipperWorkbook(shipperId: string, name: string) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("shipper_workbooks")
    .select("id, shipper_id, name")
    .eq("shipper_id", shipperId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing;

  const { data, error } = await supabaseAdmin
    .from("shipper_workbooks")
    .insert({ shipper_id: shipperId, name: `${name || "Shipper"} workbook` })
    .select("id, shipper_id, name")
    .single();
  if (error) throw error;
  return data;
}

export async function getShipperSpreadsheetRows(shipperId: string, shipperName: string) {
  const workbook = await getOrCreateShipperWorkbook(shipperId, shipperName);
  const { data, error } = await supabaseAdmin
    .from("shipper_spreadsheet_rows")
    .select("id, workbook_id, row_type, source_type, source_subitem_id, shipment_group_id, planned_for, sort_key, is_locked, values, version")
    .eq("workbook_id", workbook.id)
    .order("sort_key", { ascending: true });
  if (error) throw error;
  // Empty rows are intentional spreadsheet space. They stay in their saved
  // position, but are never considered content for push placement.
  return { workbook, rows: (data ?? []) as SpreadsheetRow[] };
}

export async function createCrmSpreadsheetRows(params: {
  shipperId: string;
  shipperName: string;
  createdBy: string;
  rows: Array<{
    sourceSubitemId: string;
    plannedFor: string;
    values: Record<string, unknown>;
  }>;
}) {
  const workbook = await getOrCreateShipperWorkbook(
    params.shipperId,
    params.shipperName,
  );
  const { data: existingRows, error: lastError } = await supabaseAdmin
    .from("shipper_spreadsheet_rows")
    .select("id, sort_key, values, row_type")
    .eq("workbook_id", workbook.id);
  if (lastError) throw lastError;
  const orderedRows = [...(existingRows ?? [])].sort((left, right) => Number(left.sort_key) - Number(right.sort_key));

  // The lock control is only rendered for item rows that contain an actual
  // manual value. Use that exact same marker to decide where a CRM push goes.
  // Formula-only JSON keys and previously activated-but-cleared rows therefore
  // cannot push an incoming record farther down the sheet.
  const lastMarkerIndex = orderedRows.reduce((lastIndex, row, index) => (
    row.row_type === "item" && hasSpreadsheetContent((row.values ?? {}) as Record<string, unknown>)
      ? index
      : lastIndex
  ), -1);
  const reusableRows = orderedRows
    .slice(lastMarkerIndex + 1)
    .filter((row) => !hasSpreadsheetContent((row.values ?? {}) as Record<string, unknown>));

  if (reusableRows.length) {
    const reused = await Promise.all(params.rows.slice(0, reusableRows.length).map(async (row, index) => {
      const { data, error } = await supabaseAdmin
        .from("shipper_spreadsheet_rows")
        .update({
          row_type: "item",
          source_type: "crm_push",
          source_subitem_id: row.sourceSubitemId,
          planned_for: row.plannedFor,
          values: calculateSpreadsheetFormulaValues(row.values),
        })
        .eq("id", reusableRows[index].id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }));
    const remaining = params.rows.slice(reused.length);
    if (!remaining.length) return reused;
    // There were not enough materialized empty rows. Add the rest directly
    // after the reused block, before any later row if one exists.
    const previousKey = Number(reusableRows[reusableRows.length - 1]?.sort_key ?? 0);
    const nextRow = orderedRows[lastMarkerIndex + reusableRows.length + 1];
    const nextKey = nextRow ? Number(nextRow.sort_key) : null;
    const step = nextKey !== null && nextKey > previousKey
      ? (nextKey - previousKey) / (remaining.length + 1)
      : 1000;
    const { data, error } = await supabaseAdmin
      .from("shipper_spreadsheet_rows")
      .insert(remaining.map((row, index) => ({
        workbook_id: workbook.id, row_type: "item", source_type: "crm_push",
        source_subitem_id: row.sourceSubitemId, planned_for: row.plannedFor,
        sort_key: previousKey + step * (index + 1),
        values: calculateSpreadsheetFormulaValues(row.values), created_by: params.createdBy,
      })))
      .select();
    if (error) throw error;
    return [...reused, ...(data ?? [])];
  }

  const markerKey = lastMarkerIndex >= 0 ? Number(orderedRows[lastMarkerIndex].sort_key) : 0;
  const nextRow = orderedRows[lastMarkerIndex + 1];
  const nextKey = nextRow ? Number(nextRow.sort_key) : null;
  // Insert one contiguous block immediately after the final visible lock
  // marker. Fractional keys preserve any blank row already below that marker.
  const step = nextKey !== null && nextKey > markerKey
    ? (nextKey - markerKey) / (params.rows.length + 1)
    : 1000;
  const { data, error } = await supabaseAdmin
    .from("shipper_spreadsheet_rows")
    .insert(params.rows.map((row, index) => ({
      workbook_id: workbook.id,
      row_type: "item",
      source_type: "crm_push",
      source_subitem_id: row.sourceSubitemId,
      planned_for: row.plannedFor,
      sort_key: markerKey + step * (index + 1),
      values: calculateSpreadsheetFormulaValues(row.values),
      created_by: params.createdBy,
    })))
    .select();
  if (error) throw error;
  return data ?? [];
}
