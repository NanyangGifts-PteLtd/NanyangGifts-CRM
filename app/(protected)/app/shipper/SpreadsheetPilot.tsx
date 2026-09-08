"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { CompactSelection, DataEditor, GridCellKind, type DataEditorRef, type GridCell, type GridColumn, type GridSelection, type Item } from "@glideapps/glide-data-grid";
import { PaintBucket } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import "@glideapps/glide-data-grid/dist/index.css";

type Row = { id: string; values: Record<string, unknown>; cell_fills: Record<string, string>; is_locked: boolean; version: number; row_type: "item" | "blank_spacer"; sort_key: number };
const columns: GridColumn[] = [
  { id: "__lock", title: "", width: 48 },
  { id: "serial_number", title: "序号", width: 100 },
  { id: "waybill_date", title: "运单日期", width: 130 },
  { id: "waybill_number", title: "运单号码", width: 170 },
  { id: "pieces", title: "件数", width: 90 },
  { id: "chargeable_weight_kg", title: "计费重量 (KG)", width: 145 },
  { id: "destination", title: "目的地", width: 150 },
  { id: "freight_unit_price", title: "单价", width: 115 },
  { id: "freight_cost", title: "运费", width: 115 },
  { id: "gst", title: "消费税", width: 105 },
  { id: "other_fees", title: "其他费用", width: 120 },
  { id: "total_cost", title: "总计费用", width: 125 },
  { id: "channel", title: "渠道", width: 130 },
  { id: "logistics_remarks", title: "备注", width: 220 },
  { id: "ic", title: "谁下单 / I/C", width: 135 },
  { id: "info_provided_date", title: "提供资料日期", width: 145 },
  { id: "cn_tracking_no", title: "单号 / CN Tracking #", width: 180 },
  { id: "cartons", title: "箱子 / Cartons", width: 120 },
  { id: "item_name", title: "货名 / Item name", width: 210 },
  { id: "delivery_info", title: "地址 / Address", width: 240 },
  { id: "qty", title: "数量 / Qty", width: 100 },
  { id: "up", title: "单价 / Unit Price", width: 130 },
  { id: "value", title: "货值 / Value", width: 125 },
  { id: "sea_or_air", title: "海运、空运 / Sea or Air?", width: 175 },
  { id: "tax_refund", title: "退税?", width: 95 },
  { id: "shipper_remarks", title: "备注 / Remarks", width: 220 },
  { id: "samples_by_air", title: "发样品空运 / Samples by air", width: 190 },
  { id: "samples_by_sea", title: "发样品海运 / Samples by sea", width: 190 },
  { id: "air_received", title: "空运收到 / Air received", width: 165 },
  { id: "sea_received", title: "海运收到 / Sea received", width: 165 },
];

const shipperEditableFields = new Set(["serial_number", "waybill_date", "waybill_number", "pieces", "chargeable_weight_kg", "destination", "freight_unit_price", "gst", "other_fees", "channel", "logistics_remarks", "air_received", "sea_received"]);
const formulaFields = new Set(["freight_cost", "total_cost", "value"]);
const clearableFields = columns.map((column) => String(column.id)).filter((field) => field !== "__lock" && !formulaFields.has(field));
const dateFields = new Set(["waybill_date", "info_provided_date"]);
const numberFields = new Set(["pieces", "chargeable_weight_kg", "cartons", "qty"]);
const currencyFields = new Set(["freight_unit_price", "freight_cost", "gst", "other_fees", "total_cost", "up", "value"]);
const seaOrAirOptions = ["\u7a7a\u8fd0", "\u6d77\u8fd0", "\u6d77\u8fd0/\u5c0f\u5305"];
const selectOptions: Record<string, string[]> = {
  channel: seaOrAirOptions,
  sea_or_air: seaOrAirOptions,
  tax_refund: ["\u9000", "X"],
};
const fillColors = ["#ffffff", "#f3f4f6", "#d1d5db", "#9ca3af", "#6b7280", "#374151", "#fff200", "#fde68a", "#fed7aa", "#fdba74", "#fb923c", "#f97316", "#fecdd3", "#fda4af", "#fb7185", "#f43f5e", "#e11d48", "#be123c", "#e9d5ff", "#ddd6fe", "#c4b5fd", "#a78bfa", "#8b5cf6", "#7c3aed", "#bae6fd"];

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formulaValues(values: Record<string, unknown>) {
  const weight = numberOrNull(values.chargeable_weight_kg);
  const freightRate = numberOrNull(values.freight_unit_price);
  const freight = weight !== null && freightRate !== null ? weight * freightRate : null;
  const gst = numberOrNull(values.gst);
  const other = numberOrNull(values.other_fees);
  const total = freight !== null && gst !== null && other !== null ? freight + gst + other : null;
  const qty = numberOrNull(values.qty);
  const unitPrice = numberOrNull(values.up);
  return { freight_cost: freight, total_cost: total, value: qty !== null && unitPrice !== null ? qty * unitPrice : null };
}

function formattedValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  if (dateFields.has(key) && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const [year, month, day] = String(value).split("-");
    return `${day}/${month}/${year}`;
  }
  const number = numberOrNull(value);
  if (number !== null && currencyFields.has(key)) return new Intl.NumberFormat("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number);
  if (number !== null && numberFields.has(key)) return new Intl.NumberFormat("en-SG", { maximumFractionDigits: 2 }).format(number);
  return String(value);
}

function hasRowContent(row: Row | undefined) {
  return Object.entries(row?.values ?? {}).some(([key, value]) => clearableFields.includes(key) && value !== null && value !== undefined && (typeof value !== "string" || value.trim().length > 0));
}

function fillTextColor(fill: string | undefined) {
  if (!fill) return undefined;
  const rgb = [fill.slice(1, 3), fill.slice(3, 5), fill.slice(5, 7)].map((part) => Number.parseInt(part, 16));
  return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 < 145 ? "#ffffff" : "#1f2937";
}

function validationMessage(field: string, value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  if (numberFields.has(field) || currencyFields.has(field) && !formulaFields.has(field)) {
    return Number.isFinite(Number(value)) ? null : "This cell must contain a number.";
  }
  if (dateFields.has(field)) return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? null : "Dates must use YYYY-MM-DD.";
  if (["channel", "sea_or_air"].includes(field)) return seaOrAirOptions.includes(String(value)) ? null : "Choose 空运, 海运, or 海运/小包.";
  if (field === "tax_refund") return selectOptions.tax_refund.includes(String(value)) ? null : "Choose 退 or X.";
  return null;
}

function DropdownEditor({ value, onFinishedEditing }: { value: GridCell; onFinishedEditing: (next?: GridCell) => void }) {
  if (value.kind !== GridCellKind.Text) return null;
  const field = (value as GridCell & { field?: string }).field ?? "";
  const options = selectOptions[field] ?? [];
  return <select autoFocus defaultValue={value.data} onChange={(event) => onFinishedEditing({ ...value, data: event.target.value, displayData: event.target.value })} className="h-full w-full border-0 bg-white px-2 outline-none"><option value="" />{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
}

function DateEditor({ value, onFinishedEditing }: { value: GridCell; onFinishedEditing: (next?: GridCell) => void }) {
  if (value.kind !== GridCellKind.Text) return null;
  return <input autoFocus type="date" defaultValue={value.data} onChange={(event) => onFinishedEditing({ ...value, data: event.target.value, displayData: event.target.value })} className="h-full w-full border-0 bg-white px-2 outline-none" />;
}

export function SpreadsheetPilot({ shipperId, mode = "internal" }: { shipperId: string; mode?: "internal" | "shipper" }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [viewportHeight, setViewportHeight] = useState(700);
  const [workbookId, setWorkbookId] = useState<string | null>(null);
  const [gridSelection, setGridSelection] = useState<GridSelection | undefined>(undefined);
  const [isFillPaletteOpen, setIsFillPaletteOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; row: number } | null>(null);
  const [copiedRows, setCopiedRows] = useState<Array<{ values: Record<string, unknown>; cellFills: Record<string, string> }>>([]);
  const pendingSaves = useRef(new Map<string, { values: Record<string, unknown>; replaceValues: boolean }>());
  const saveTimer = useRef<number | null>(null);
  const savesInFlight = useRef(0);
  const localEditRevision = useRef(0);
  const latestLoadRequest = useRef(0);
  const gridRef = useRef<DataEditorRef | null>(null);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const contextPointer = useRef<{ x: number; y: number } | null>(null);
  const load = useCallback(async () => {
    if (pendingSaves.current.size || savesInFlight.current) return;
    const requestId = ++latestLoadRequest.current;
    const revisionAtStart = localEditRevision.current;
    const response = await fetch(`/api/shipper/spreadsheet?shipperId=${shipperId}`);
    const result = await response.json();
    if (!response.ok) return setError(result.error ?? "Could not load spreadsheet");
    // A slow request may have begun before an edit. It must never replace the
    // optimistic value with the older snapshot it happened to retrieve.
    if (requestId !== latestLoadRequest.current || revisionAtStart !== localEditRevision.current || pendingSaves.current.size || savesInFlight.current) return;
    setWorkbookId(result.workbook?.id ?? null);
    setRows((current) => JSON.stringify(current) === JSON.stringify(result.rows ?? []) ? current : result.rows ?? []);
  }, [shipperId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!workbookId) return;
    const supabase = createClient();
    let refreshTimer: number | null = null;
    let disposed = false;
    const scheduleRefresh = () => {
      if (pendingSaves.current.size || savesInFlight.current) return;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => { refreshTimer = null; void load(); }, 200);
    };
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const startSubscription = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (disposed) return;
      // Realtime applies RLS using the token supplied to the WebSocket, not
      // the server-side session used by our API routes. Set it explicitly so
      // deployed builds cannot accidentally join the channel as anonymous.
      if (session) supabase.realtime.setAuth(session.access_token);
      channel = supabase
        .channel(`shipper-spreadsheet-${workbookId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "shipper_spreadsheet_rows", filter: `workbook_id=eq.${workbookId}` }, scheduleRefresh)
        .subscribe();
    };
    void startSubscription();
    return () => {
      disposed = true;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [load, workbookId]);
  useEffect(() => {
    const refreshFromCrmPush = (event: StorageEvent) => {
      if (event.key === "shipper-spreadsheet-refresh") void load();
    };
    window.addEventListener("storage", refreshFromCrmPush);
    return () => window.removeEventListener("storage", refreshFromCrmPush);
  }, [load]);
  useEffect(() => {
    const updateViewportHeight = () => setViewportHeight(window.innerHeight);
    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    return () => window.removeEventListener("resize", updateViewportHeight);
  }, []);
  const toggleRowLock = useCallback(async (record: Row) => {
    if (!hasRowContent(record)) return;
    const response = await fetch("/api/shipper/spreadsheet", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shipperId, rowId: record.id, isLocked: !record.is_locked }) });
    const result = await response.json();
    if (!response.ok) return setError(result.error ?? "Could not update row lock");
    // Keep the client-side ordering intact. The server response is only the
    // updated row; it has no reason to alter the surrounding row sequence.
    setRows((current) => current.map((row) => row.id === record.id
      ? { ...row, is_locked: result.row.is_locked, version: result.row.version }
      : row));
  }, [shipperId]);
  const flushPendingSaves = useCallback(async () => {
    saveTimer.current = null;
    const pending = [...pendingSaves.current.entries()];
    pendingSaves.current.clear();
    if (!pending.length) return;
    savesInFlight.current += 1;
    let failed = false;
    try {
      const results = await Promise.all(pending.map(async ([rowId, pendingSave]) => {
        const response = await fetch("/api/shipper/spreadsheet", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shipperId, rowId, values: pendingSave.values, replaceValues: pendingSave.replaceValues }) });
        return { response, result: await response.json() };
      }));
      if (results.some(({ response }) => !response.ok)) {
        failed = true;
        setError(results.find(({ response }) => !response.ok)?.result?.error ?? "Could not save one or more cells");
      }
    } catch {
      failed = true;
      setError("Could not save one or more cells");
    } finally {
      savesInFlight.current -= 1;
      // The local value is already the authoritative optimistic value. Reload
      // only after a failed save; reloading immediately after every success
      // briefly reintroduced the previous server snapshot into Glide.
      if (failed && pendingSaves.current.size === 0) void load();
    }
  }, [load, shipperId]);
  const queueSave = useCallback((rowId: string, values: Record<string, unknown>, replaceValues = false) => {
    const existing = pendingSaves.current.get(rowId);
    pendingSaves.current.set(rowId, {
      values: replaceValues ? values : { ...(existing?.values ?? {}), ...values },
      replaceValues: replaceValues || existing?.replaceValues === true,
    });
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void flushPendingSaves(), 120);
  }, [flushPendingSaves]);
  const getCellContent = useCallback(([col, row]: Item): GridCell => {
    const record = rows[row];
    const key = String(columns[col].id);
    if (key === "__lock") {
      const symbol = hasRowContent(record) ? record!.is_locked ? "🔒" : "🔓" : "";
      return { kind: GridCellKind.Text, data: symbol, displayData: symbol, allowOverlay: false, readonly: true, contentAlign: "center", cursor: symbol ? "pointer" : "default" };
    }
    if (!record) {
      const readOnly = formulaFields.has(key) || (mode === "shipper" && !shipperEditableFields.has(key));
      return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: !readOnly, readonly: readOnly, field: key } as GridCell;
    }
    const values: Record<string, unknown> = hasRowContent(record) ? { ...record.values, ...formulaValues(record.values) } : {};
    const rawValue = values[key];
    const value = rawValue === null || rawValue === undefined ? "" : String(rawValue);
    const readOnly = record.is_locked || formulaFields.has(key) || (mode === "shipper" && !shipperEditableFields.has(key));
    return {
      kind: GridCellKind.Text,
      data: value,
      displayData: formattedValue(key, rawValue),
      allowOverlay: !readOnly,
      readonly: readOnly,
      contentAlign: numberFields.has(key) || currencyFields.has(key) ? "right" : dateFields.has(key) ? "center" : undefined,
      themeOverride: (() => {
        const fill = record.cell_fills?.[key];
        if (fill) return { bgCell: fill, textDark: fillTextColor(fill) };
        return formulaFields.has(key) ? { bgCell: "#fff7d6", textDark: "#7c4a03" } : undefined;
      })(),
      field: key,
    } as GridCell;
  }, [mode, rows]);
  const onCellEdited = useCallback(async ([col, row]: Item, cell: GridCell) => {
    if (cell.kind !== GridCellKind.Text) return;
    const record = rows[row];
    const key = String(columns[col].id);
    if (key === "__lock") return;
    const value = cell.data;
    const validationError = validationMessage(key, value);
    if (validationError) { setError(validationError); toast.error("Invalid cell value", { description: validationError }); return; }
    if (!record) {
      if (formulaFields.has(key) || (mode === "shipper" && !shipperEditableFields.has(key))) return;
      const response = await fetch("/api/shipper/spreadsheet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shipperId, rowType: "item", values: { [key]: value }, trailingBlankCount: Math.max(0, row - rows.length) }) });
      const result = await response.json();
      if (!response.ok) return setError(result.error ?? "Could not create row");
      setRows((current) => [...current, ...(result.rows ?? [result.row])]);
      return;
    }
    if (record.is_locked) return;
    localEditRevision.current += 1;
    flushSync(() => {
      setRows((current) => current.map((item) => item.id === record.id ? { ...item, values: { ...item.values, [key]: value } } : item));
    });
    queueSave(record.id, { [key]: value });
  }, [queueSave, rows, shipperId]);
  const onCellsEdited = useCallback((edits: ReadonlyArray<{ location: Item; value: GridCell }>) => {
    const updates = new Map<string, Record<string, unknown>>();
    for (const { location: [col, row], value } of edits) {
      if (value.kind !== GridCellKind.Text) continue;
      const record = rows[row];
      const key = String(columns[col].id);
      if (key === "__lock" || formulaFields.has(key)) continue;
      const validationError = validationMessage(key, value.data);
      if (validationError) { setError(validationError); toast.error("Invalid cell value", { description: validationError }); continue; }
      if (!record) { void onCellEdited([col, row], value); continue; }
      if (record.is_locked || (mode === "shipper" && !shipperEditableFields.has(key))) continue;
      updates.set(record.id, { ...(updates.get(record.id) ?? {}), [key]: value.data });
    }
    if (updates.size) {
      const fullRowClears = new Set([...updates].filter(([, values]) =>
        clearableFields.every((field) => Object.prototype.hasOwnProperty.call(values, field)) && Object.values(values).every((value) => value === ""),
      ).map(([rowId]) => rowId));
      // Glide asks for the cell again as the overlay closes. Commit before it
      // redraws so that request sees this edit rather than the old cell value.
      localEditRevision.current += 1;
      flushSync(() => {
        setRows((current) => current.map((row) => updates.has(row.id) ? { ...row, values: fullRowClears.has(row.id) ? {} : { ...row.values, ...updates.get(row.id) } } : row));
      });
      updates.forEach((values, rowId) => queueSave(rowId, fullRowClears.has(rowId) ? {} : values, fullRowClears.has(rowId)));
    }
    return true;
  }, [mode, onCellEdited, queueSave, rows]);
  const height = useMemo(() => Math.max((rows.length + 12) * 34, viewportHeight - (mode === "internal" ? 190 : 155)), [mode, rows.length, viewportHeight]);
  const selected = rows.find((row) => row.id === selectedRowId);
  const deleteRow = async () => { if (!selected || !window.confirm("Delete the selected spreadsheet row?")) return; const response = await fetch(`/api/shipper/spreadsheet?shipperId=${shipperId}&rowId=${selected.id}`, { method: "DELETE" }); if (!response.ok) return setError("Could not delete row"); setRows((current) => current.filter((row) => row.id !== selected.id)); setSelectedRowId(null); };
  const fillSelection = async (color: string | null) => {
    const range = gridSelection?.current?.range;
    const selectedRows = gridSelection?.rows.toArray() ?? [];
    if (!range && !selectedRows.length) return;
    const fillsByRow = new Map<string, Record<string, string>>();
    const rowIndexes = selectedRows.length ? selectedRows : Array.from({ length: range!.height }, (_, index) => range!.y + index);
    const columnIndexes = selectedRows.length ? columns.map((_, index) => index) : Array.from({ length: range!.width }, (_, index) => range!.x + index);
    for (const rowIndex of rowIndexes) {
      const row = rows[rowIndex];
      if (!row || row.is_locked) continue;
      for (const colIndex of columnIndexes) {
        const field = String(columns[colIndex]?.id ?? "");
        if (!field || field === "__lock" || (mode === "shipper" && !shipperEditableFields.has(field))) continue;
        const fills = fillsByRow.get(row.id) ?? { ...(row.cell_fills ?? {}) };
        if (color) fills[field] = color;
        else delete fills[field];
        fillsByRow.set(row.id, fills);
      }
    }
    if (!fillsByRow.size) return;
    setIsFillPaletteOpen(false);
    flushSync(() => setRows((current) => current.map((row) => fillsByRow.has(row.id) ? { ...row, cell_fills: fillsByRow.get(row.id)! } : row)));
    const results = await Promise.all([...fillsByRow].map(async ([rowId, cellFills]) => {
      const response = await fetch("/api/shipper/spreadsheet", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shipperId, rowId, cellFills }) });
      return { response, result: await response.json() };
    }));
    if (results.some(({ response }) => !response.ok)) {
      setError(results.find(({ response }) => !response.ok)?.result?.error ?? "Could not save cell fill");
      void load();
    }
  };
  const clearSelectionContents = () => {
    const range = gridSelection?.current?.range;
    const selectedRows = gridSelection?.rows.toArray() ?? [];
    if (!range && !selectedRows.length) return;
    const edits: Array<{ location: Item; value: GridCell }> = [];
    const rowIndexes = selectedRows.length ? selectedRows : Array.from({ length: range!.height }, (_, index) => range!.y + index);
    const columnIndexes = selectedRows.length ? columns.map((_, index) => index) : Array.from({ length: range!.width }, (_, index) => range!.x + index);
    for (const row of rowIndexes) {
      for (const col of columnIndexes) {
        const key = String(columns[col]?.id ?? "");
        const record = rows[row];
        if (!record || key === "__lock" || formulaFields.has(key) || record.is_locked || (mode === "shipper" && !shipperEditableFields.has(key))) continue;
        edits.push({ location: [col, row], value: { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: true } });
      }
    }
    if (edits.length) onCellsEdited(edits);
  };
  const pasteFromClipboard = async () => {
    const target = gridSelection?.current?.cell;
    if (!target) return;
    try {
      const clipboard = await navigator.clipboard.readText();
      if (!clipboard) return;
      const edits: Array<{ location: Item; value: GridCell }> = [];
      clipboard.replace(/\r/g, "").split("\n").forEach((line, rowOffset) => {
        line.split("\t").forEach((value, colOffset) => {
          const col = target[0] + colOffset;
          const row = target[1] + rowOffset;
          if (col >= columns.length || row >= rows.length + 12) return;
          edits.push({ location: [col, row], value: { kind: GridCellKind.Text, data: value, displayData: value, allowOverlay: true } });
        });
      });
      if (edits.length) onCellsEdited(edits);
    } catch {
      setError("Could not read the clipboard. Allow clipboard access, then try again.");
    }
  };
  const insertRow = async (placement: "above" | "below") => {
    const target = contextMenu ? rows[contextMenu.row] : undefined;
    if (!target) return;
    const response = await fetch("/api/shipper/spreadsheet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shipperId, referenceRowId: target.id, placement }) });
    const result = await response.json();
    if (!response.ok) return setError(result.error ?? "Could not insert row");
    const insertionIndex = rows.findIndex((row) => row.id === target.id) + (placement === "below" ? 1 : 0);
    setRows((current) => [...current.slice(0, insertionIndex), result.row, ...current.slice(insertionIndex)]);
  };
  const copySelectedRows = () => {
    const rowIndexes = gridSelection?.rows.toArray() ?? [];
    const copies = rowIndexes.map((rowIndex) => rows[rowIndex]).filter((row): row is Row => Boolean(row)).map((row) => ({
      values: Object.fromEntries(Object.entries(row.values).filter(([field]) => !formulaFields.has(field))),
      cellFills: { ...(row.cell_fills ?? {}) },
    }));
    if (copies.length) setCopiedRows(copies);
  };
  const insertCopiedRows = async () => {
    const target = contextMenu ? rows[contextMenu.row] : undefined;
    if (!target || !copiedRows.length) return;
    const response = await fetch("/api/shipper/spreadsheet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shipperId, referenceRowId: target.id, placement: "below", copiedRows }) });
    const result = await response.json();
    if (!response.ok) return setError(result.error ?? "Could not insert copied rows");
    const insertionIndex = rows.findIndex((row) => row.id === target.id) + 1;
    setRows((current) => [...current.slice(0, insertionIndex), ...(result.rows ?? []), ...current.slice(insertionIndex)]);
  };
  const deleteContextRow = async () => {
    const target = contextMenu ? rows[contextMenu.row] : undefined;
    if (!target || !window.confirm("Delete this spreadsheet row?")) return;
    const response = await fetch(`/api/shipper/spreadsheet?shipperId=${shipperId}&rowId=${target.id}`, { method: "DELETE" });
    if (!response.ok) return setError("Could not delete row");
    setRows((current) => current.filter((row) => row.id !== target.id));
  };
  return <section className="space-y-2 p-4">
    <div className="flex items-center gap-2">
      <button disabled={!selected} onClick={() => void deleteRow()} className="rounded border border-red-200 px-3 py-1.5 text-xs text-red-700 disabled:opacity-40">Delete row</button>
      {gridSelection?.current && <button type="button" onClick={() => setIsFillPaletteOpen((open) => !open)} className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1.5 text-xs text-slate-700"><PaintBucket size={15} />Fill colour</button>}
      {gridSelection?.current && isFillPaletteOpen && <div className="flex flex-wrap gap-1 py-1">{fillColors.map((color) => <button key={color} type="button" onClick={() => void fillSelection(color)} className="h-5 w-5 rounded border border-slate-300" style={{ backgroundColor: color }} title="Fill selected cells" />)}<button type="button" onClick={() => void fillSelection(null)} className="rounded border border-slate-300 px-2 text-[10px] text-slate-600">Clear</button></div>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
    <div ref={gridContainerRef} className="relative" onContextMenuCapture={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); contextPointer.current = { x: event.clientX - bounds.left, y: event.clientY - bounds.top }; }}>
      <DataEditor ref={gridRef} width="100%" height={height} columns={columns} rows={rows.length + 12} getCellContent={getCellContent} onCellEdited={onCellEdited} onCellsEdited={onCellsEdited} validateCell={([col], next) => { if (next.kind !== GridCellKind.Text) return true; const message = validationMessage(String(columns[col]?.id ?? ""), next.data); if (message) toast.error("Invalid cell value", { description: message }); return !message; }} provideEditor={(cell) => { if (cell.kind !== GridCellKind.Text) return undefined; const field = (cell as GridCell & { field?: string }).field ?? ""; if (dateFields.has(field)) return { editor: DateEditor, disablePadding: true }; return selectOptions[field] ? { editor: DropdownEditor, disablePadding: true } : undefined; }} onCellClicked={([col, row]) => { setContextMenu(null); const record = rows[row]; setSelectedRowId(record?.id ?? null); if (col === 0 && record) void toggleRowLock(record); }} onCellContextMenu={([col, row], event) => { event.preventDefault(); const current = gridSelection?.current?.range; const withinCurrentSelection = Boolean(gridSelection?.rows.hasIndex(row)) || Boolean(current && col >= current.x && col < current.x + current.width && row >= current.y && row < current.y + current.height); if (!withinCurrentSelection) setGridSelection({ current: { cell: [col, row], range: { x: col, y: row, width: 1, height: 1 }, rangeStack: [] }, columns: CompactSelection.empty(), rows: CompactSelection.empty() }); setSelectedRowId(rows[row]?.id ?? null); const pointer = contextPointer.current; setContextMenu({ x: pointer?.x ?? event.bounds.x, y: pointer?.y ?? event.bounds.y, row }); }} gridSelection={gridSelection} onGridSelectionChange={setGridSelection} getCellsForSelection={true} onPaste={true} fillHandle keybindings={{ downFill: true, rightFill: true }} rowMarkers="clickable-number" rowSelect="multi" rangeSelect="rect" />
      {contextMenu && <div className="absolute z-30 min-w-40 rounded-md border border-slate-200 bg-white py-1 shadow-lg" style={{ left: contextMenu.x, top: contextMenu.y }}>
        <button type="button" onClick={() => { copySelectedRows(); void gridRef.current?.emit("copy"); setContextMenu(null); }} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-100">Copy</button>
        <button type="button" onClick={() => { void (async () => { copySelectedRows(); await gridRef.current?.emit("copy"); clearSelectionContents(); })(); setContextMenu(null); }} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-100">Cut</button>
        <button type="button" onClick={() => { void pasteFromClipboard(); setContextMenu(null); }} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-100">Paste</button>
        <div className="my-1 border-t border-slate-200" />
        <button type="button" onClick={() => { void insertRow("above"); setContextMenu(null); }} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-100">Insert row above</button>
        <button type="button" onClick={() => { void insertRow("below"); setContextMenu(null); }} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-100">Insert row below</button>
        <button type="button" disabled={!copiedRows.length} onClick={() => { void insertCopiedRows(); setContextMenu(null); }} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-100 disabled:text-slate-300">Insert copied</button>
        <button type="button" onClick={() => { void deleteContextRow(); setContextMenu(null); }} className="block w-full px-3 py-1.5 text-left text-xs text-red-700 hover:bg-red-50">Delete row</button>
        <div className="my-1 border-t border-slate-200" />
        <button type="button" onClick={() => { clearSelectionContents(); setContextMenu(null); }} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-100">Clear contents</button>
        <button type="button" onClick={() => { setIsFillPaletteOpen(true); setContextMenu(null); }} className="flex w-full items-center gap-1 px-3 py-1.5 text-left text-xs hover:bg-slate-100"><PaintBucket size={14} />Colour fill</button>
        {rows[contextMenu.row] && <button type="button" disabled={!hasRowContent(rows[contextMenu.row])} onClick={() => { void toggleRowLock(rows[contextMenu.row]); setContextMenu(null); }} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-100 disabled:text-slate-300">{rows[contextMenu.row].is_locked ? "Unlock row" : "Lock row"}</button>}
      </div>}
    </div>
  </section>;
}
