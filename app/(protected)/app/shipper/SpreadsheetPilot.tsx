"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { DataEditor, GridCellKind, type GridCell, type GridColumn, type Item } from "@glideapps/glide-data-grid";
import { createClient } from "@/lib/supabase/client";
import "@glideapps/glide-data-grid/dist/index.css";

type Row = { id: string; values: Record<string, unknown>; is_locked: boolean; version: number; row_type: "item" | "blank_spacer"; sort_key: number };
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
// This is public configuration, not a secret. Showing the host lets us verify
// that a local build and a deployed build are listening to the same Supabase
// project while diagnosing Realtime delivery.
const realtimeProjectHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
  : "Supabase URL missing";

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
  if (number !== null && currencyFields.has(key)) return new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number);
  if (number !== null && numberFields.has(key)) return new Intl.NumberFormat("en-SG", { maximumFractionDigits: 2 }).format(number);
  return String(value);
}

function hasRowContent(row: Row | undefined) {
  return Object.entries(row?.values ?? {}).some(([key, value]) => clearableFields.includes(key) && value !== null && value !== undefined && (typeof value !== "string" || value.trim().length > 0));
}

function ArrowKeyTextEditor({
  value,
  onChange,
  onFinishedEditing,
}: {
  value: GridCell;
  onChange: (next: GridCell) => void;
  onFinishedEditing: (next?: GridCell, movement?: readonly [-1 | 0 | 1, -1 | 0 | 1]) => void;
}) {
  if (value.kind !== GridCellKind.Text) return null;
  const field = (value as GridCell & { field?: string }).field ?? "";
  const [draft, setDraft] = useState(value.data);
  const draftRef = useRef(value.data);
  const finished = useRef(false);
  useEffect(() => { setDraft(value.data); draftRef.current = value.data; }, [value.data]);
  const finishOnce = (next: string, movement: readonly [-1 | 0 | 1, -1 | 0 | 1] = [0, 0]) => {
    if (finished.current) return;
    finished.current = true;
    onFinishedEditing({ ...value, data: next, displayData: next }, movement);
  };
  const finish = (movement: readonly [-1 | 0 | 1, -1 | 0 | 1] = [0, 0]) => {
    finishOnce(draftRef.current, movement);
  };
  if (selectOptions[field]) {
    return <select autoFocus value={draft} onChange={(event) => { const next = event.target.value; draftRef.current = next; setDraft(next); onChange({ ...value, data: next, displayData: next }); finishOnce(next); }} onBlur={() => finish()} className="h-full w-full border-0 bg-white px-2 outline-none"><option value="" />{selectOptions[field].map((option) => <option key={option} value={option}>{option}</option>)}</select>;
  }
  return <input autoFocus spellCheck={false} value={draft} onChange={(event) => { const next = event.target.value; draftRef.current = next; setDraft(next); onChange({ ...value, data: next, displayData: next }); }} onBlur={() => finish()} onKeyDown={(event) => {
    const movement = event.key === "ArrowLeft" ? [-1, 0] as const : event.key === "ArrowRight" ? [1, 0] as const : event.key === "ArrowUp" ? [0, -1] as const : event.key === "ArrowDown" ? [0, 1] as const : undefined;
    if (!movement) return;
    event.preventDefault();
    event.stopPropagation();
    finishOnce(event.currentTarget.value, movement);
  }} type={dateFields.has(field) ? "date" : numberFields.has(field) || currencyFields.has(field) ? "number" : "text"} step={numberFields.has(field) || currencyFields.has(field) ? "any" : undefined} className="h-full w-full border-0 bg-white px-2 outline-none" />;
}

export function SpreadsheetPilot({ shipperId, mode = "internal" }: { shipperId: string; mode?: "internal" | "shipper" }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [viewportHeight, setViewportHeight] = useState(700);
  const [workbookId, setWorkbookId] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "connected" | "unavailable">("connecting");
  const [lastRealtimeEvent, setLastRealtimeEvent] = useState<number | null>(null);
  const pendingSaves = useRef(new Map<string, { values: Record<string, unknown>; replaceValues: boolean }>());
  const saveTimer = useRef<number | null>(null);
  const savesInFlight = useRef(0);
  const localEditRevision = useRef(0);
  const latestLoadRequest = useRef(0);
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
    setRealtimeStatus("connecting");
    let refreshTimer: number | null = null;
    const scheduleRefresh = () => {
      if (pendingSaves.current.size || savesInFlight.current) return;
      setLastRealtimeEvent(Date.now());
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => { refreshTimer = null; void load(); }, 200);
    };
    const channel = supabase
      .channel(`shipper-spreadsheet-${workbookId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shipper_spreadsheet_rows", filter: `workbook_id=eq.${workbookId}` }, scheduleRefresh)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("connected");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setRealtimeStatus("unavailable");
        }
      });
    return () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
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
      return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: !readOnly, readonly: readOnly };
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
      themeOverride: formulaFields.has(key) ? { bgCell: "#fff7d6", textDark: "#7c4a03" } : undefined,
      field: key,
    } as GridCell;
  }, [mode, rows]);
  const onCellEdited = useCallback(async ([col, row]: Item, cell: GridCell) => {
    if (cell.kind !== GridCellKind.Text) return;
    const record = rows[row];
    const key = String(columns[col].id);
    if (key === "__lock") return;
    const value = cell.data;
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
  return <section className="space-y-2 p-4"><div className="flex items-center gap-2"><button disabled={!selected} onClick={() => void deleteRow()} className="rounded border border-red-200 px-3 py-1.5 text-xs text-red-700 disabled:opacity-40">Delete row</button><span className={`text-xs ${realtimeStatus === "connected" ? "text-emerald-700" : realtimeStatus === "unavailable" ? "text-amber-700" : "text-slate-500"}`}>Live updates: {realtimeStatus === "connected" ? "connected" : realtimeStatus === "unavailable" ? "unavailable" : "connecting…"}{realtimeStatus === "connected" && (lastRealtimeEvent ? " · event received" : " · awaiting an event")}</span><span className="text-xs text-slate-400">Realtime project: {realtimeProjectHost}</span>{error && <span className="text-xs text-red-600">{error}</span>}</div><DataEditor width="100%" height={height} columns={columns} rows={rows.length + 12} getCellContent={getCellContent} onCellEdited={onCellEdited} onCellsEdited={onCellsEdited} onCellClicked={([col, row]) => { const record = rows[row]; setSelectedRowId(record?.id ?? null); if (col === 0 && record) void toggleRowLock(record); }} provideEditor={(cell) => cell.kind === GridCellKind.Text && cell.allowOverlay ? { editor: ArrowKeyTextEditor, disablePadding: true } : undefined} getCellsForSelection={true} rowMarkers="number" rangeSelect="rect" /></section>;
}
