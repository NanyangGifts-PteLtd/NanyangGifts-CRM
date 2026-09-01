"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, PaintBucket, Trash2, X } from "lucide-react";
import { FileDropTarget } from "@/components/ui/file-drop-target";

export type ShipperRow = {
    id: string;
    subitem_id?: string | null;
    client_id?: string | null;
    shipper_id?: string | null;

    serial_number: string | null;
    waybill_date: string | null;
    waybill_number: string | null;
    pieces: number | string | null;
    chargeable_weight_kg: number | string | null;
    destination: string | null;
    freight_unit_price: number | string | null;
    freight_cost: number | string | null;
    gst: number | string | null;
    other_fees: number | string | null;
    total_cost: number | string | null;
    channel: string | null;
    logistics_remarks: string | null;

    ic: string | null;
    info_provided_date: string | null;
    cn_tracking_no: string | null;
    cartons: number | string | null;
    item_name: string | null;
    delivery_info: string | null;
    qty: number | string | null;
    up: number | string | null;
    value: number | string | null;
    sea_or_air: string | null;
    tax_refund: string | null;
    shipper_remarks: string | null;
    samples_by_air: string | null;
    samples_by_sea: string | null;
    air_received: string | null;
    sea_received: string | null;
    pushed_at?: string | null;
    cell_fills?: Record<string, string> | null;
};

type ShipperGridProps = {
    rows: ShipperRow[];
    mode: "pm" | "shipper" | "dev";
    token?: string;
};

function display(value: unknown) {
    if (value === null || value === undefined || value === "") return "-";
    return String(value);
}

function numberValue(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function formulaValue(row: ShipperRow, key: string) {
    if (key === "value") return numberValue(row.qty) * numberValue(row.up);
    if (key === "freight_cost") return numberValue(row.chargeable_weight_kg) * numberValue(row.freight_unit_price);
    if (key === "total_cost") return numberValue(row.freight_cost) + numberValue(row.gst) + numberValue(row.other_fees);
    return row[key as keyof ShipperRow];
}

function rowWithCellValue(row: ShipperRow, field: string, value: string): ShipperRow {
    const next = { ...row, [field]: field === "cell_fills" ? JSON.parse(value) : value } as ShipperRow;
    if (field === "qty" || field === "up") next.value = numberValue(next.qty) * numberValue(next.up);
    if (field === "chargeable_weight_kg" || field === "freight_unit_price") next.freight_cost = numberValue(next.chargeable_weight_kg) * numberValue(next.freight_unit_price);
    if (field === "chargeable_weight_kg" || field === "freight_unit_price" || field === "gst" || field === "other_fees") next.total_cost = numberValue(next.freight_cost) + numberValue(next.gst) + numberValue(next.other_fees);
    return next;
}

function formatDmy(value: string | null | undefined) {
    if (!value) return "";
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function parseDmy(value: string) {
    const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    const [, day, month, year] = match;
    const date = new Date(`${year}-${month}-${day}T00:00:00`);
    return !Number.isNaN(date.getTime()) && date.getFullYear() === Number(year) && date.getMonth() + 1 === Number(month) && date.getDate() === Number(day) ? `${year}-${month}-${day}` : null;
}

function dateCellTooltip(value: string | null | undefined) {
    const formatted = formatDmy(value);
    return /^\d{2}\/\d{2}\/\d{4}$/.test(formatted) ? `${formatted}, UTC+08:00` : "";
}

function DateCell({ value, editable, tooltip, onSave }: { value: string | null; editable: boolean; tooltip: string; onSave: (value: string) => Promise<void> }) {
    const [draft, setDraft] = useState(formatDmy(value));
    const [error, setError] = useState(false);
    if (!editable) return <div title={tooltip} className="flex min-h-[42px] items-center justify-center px-2">{formatDmy(value) || "-"}</div>;
    return <input value={draft} onChange={(event) => { setDraft(event.target.value); setError(false); }} onBlur={() => { if (!draft.trim()) { void onSave(""); return; } const parsed = parseDmy(draft); if (!parsed) { setError(true); return; } void onSave(parsed); }} title={tooltip || "Use DD/MM/YYYY"} placeholder="DD/MM/YYYY" className={`min-h-[42px] w-full border-0 bg-transparent px-2 text-center outline-none focus:bg-blue-50 ${error ? "bg-red-50 text-red-700" : ""}`} />;
}

function SpreadsheetTextCell({ value, onSave }: { value: unknown; onSave: (value: string) => Promise<void> }) {
    const [draft, setDraft] = useState(value == null ? "" : String(value));
    const ref = useRef<HTMLTextAreaElement>(null);
    const resize = () => {
        if (!ref.current) return;
        ref.current.style.height = "auto";
        ref.current.style.height = `${Math.max(42, ref.current.scrollHeight)}px`;
    };
    useEffect(() => { setDraft(value == null ? "" : String(value)); }, [value]);
    useEffect(() => { resize(); }, [draft]);
    return <textarea ref={ref} value={draft} rows={1} onChange={(event) => setDraft(event.target.value)} onBlur={() => void onSave(draft)} className="block min-h-[42px] w-full resize-none overflow-hidden border-0 bg-transparent px-2 py-2 text-center text-[13px] whitespace-pre-wrap break-words outline-none focus:bg-blue-50" />;
}

const IMAGE_MARKER = /\[\[shipper-image:(https?:\/\/[^\]]+)\]\]/g;

function parseRemarks(value: unknown) {
    const raw = String(value ?? "");
    const images: string[] = [];
    const text = raw.replace(IMAGE_MARKER, (_match, url: string) => {
        images.push(url);
        return "";
    }).replace(/\n{3,}/g, "\n\n").trim();
    return { text, images };
}

function serializeRemarks(text: string, images: string[]) {
    const markers = images.map((url) => `[[shipper-image:${url}]]`).join("\n");
    return markers ? `${text.trim()}\n\n${markers}`.trim() : text;
}

function RemarksCell({
    row,
    field,
    editable,
    token,
    saveCell,
}: {
    row: ShipperRow;
    field: "logistics_remarks" | "shipper_remarks";
    editable: boolean;
    token?: string;
    saveCell: (row: ShipperRow, field: string, value: string) => Promise<void>;
}) {
    const initial = useMemo(() => parseRemarks(row[field]), [row, field]);
    const [text, setText] = useState(initial.text);
    const [images, setImages] = useState(initial.images);
    const [uploading, setUploading] = useState(false);

    const save = async (nextText = text, nextImages = images) => {
        await saveCell(row, field, serializeRemarks(nextText, nextImages));
    };

    const uploadImage = async (file: File) => {
        if (!file.type.startsWith("image/")) return;
        setUploading(true);
        try {
            const form = new FormData();
            form.append("file", file);
            form.append("subitemId", row.subitem_id ?? "");
            form.append("shipperId", row.shipper_id ?? "");
            form.append("shipperToken", token ?? "");
            const response = await fetch("/api/shipper/upload-image", { method: "POST", body: form });
            const result = await response.json();
            if (!response.ok) throw new Error(result?.error || "Failed to upload image");
            const nextImages = [...images, result.url as string];
            setImages(nextImages);
            await save(text, nextImages);
        } finally {
            setUploading(false);
        }
    };

    const removeImage = async (url: string) => {
        setUploading(true);
        try {
            const response = await fetch("/api/shipper/delete-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result?.error || "Failed to remove image");

            const nextImages = images.filter((image) => image !== url);
            setImages(nextImages);
            await save(text, nextImages);
        } finally {
            setUploading(false);
        }
    };

    const imagePreview = images.map((url) => (
        <div key={url} className="relative mt-2 w-fit max-w-full">
            <a href={url} target="_blank" rel="noreferrer" className="block">
                <img src={url} alt="Attached remark" className="max-h-48 max-w-[240px] rounded border border-slate-200 object-contain" />
            </a>
            <div className="mt-1 text-[11px] leading-4 text-slate-400">点击图片放大</div>
            {editable && (
                <button
                    type="button"
                    onClick={() => void removeImage(url)}
                    disabled={uploading}
                    className="absolute right-1 top-1 rounded bg-white/90 p-1 text-red-500 shadow hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Remove attached image"
                >
                    <Trash2 size={12} />
                </button>
            )}
        </div>
    ));

    if (!editable) return <div>{text || "-"}{imagePreview}</div>;

    return (
        <FileDropTarget onFiles={(files) => { const image = files.find((file) => file.type.startsWith("image/")); if (image) void uploadImage(image); }} disabled={uploading} className="min-h-[42px] min-w-[240px]"><div className="min-h-[42px] min-w-[240px]" onPaste={(event) => {
            const image = Array.from(event.clipboardData.files).find((file) => file.type.startsWith("image/"));
            if (image) {
                event.preventDefault();
                void uploadImage(image);
            }
        }}>
            <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={3}
                className="min-h-[42px] w-full min-w-[50px] resize-none border-0 bg-transparent px-2 py-2 text-center text-[13px] outline-none focus:bg-blue-50"
                onBlur={() => void save()}
            />
            {imagePreview}
            <label className="mt-2 flex cursor-pointer items-center gap-1 whitespace-nowrap text-[11px] leading-4 text-slate-400 hover:text-slate-600">
                <ImagePlus size={12} />
                <span>{uploading ? "加载中..." : "在此粘贴或附上图片"}</span>
                <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadImage(file);
                    event.target.value = "";
                }} />
            </label>
        </div></FileDropTarget>
    );
}

export default function ShipperGrid({ rows, mode, token }: ShipperGridProps) {
    const [gridRows, setGridRows] = useState(rows);
    const [selection, setSelection] = useState<{ startRow: number; startCol: number; endRow: number; endCol: number } | null>(null);
    const [dragSelecting, setDragSelecting] = useState(false);
    const [cellFills, setCellFills] = useState<Record<string, string>>({});
    const [isFillPaletteOpen, setIsFillPaletteOpen] = useState(true);
    const fillColors = [
        "#ffffff", "#f3f4f6", "#d1d5db", "#9ca3af", "#6b7280", "#374151",
        "#fff200", "#fde68a", "#fed7aa", "#fdba74", "#fb923c", "#f97316",
        "#fecdd3", "#fda4af", "#fb7185", "#f43f5e", "#e11d48", "#be123c",
        "#e9d5ff", "#ddd6fe", "#c4b5fd", "#a78bfa", "#8b5cf6", "#7c3aed",
        "#bae6fd", "#7dd3fc", "#38bdf8", "#0ea5e9", "#0284c7", "#0369a1",
        "#bbf7d0", "#86efac", "#4ade80", "#22c55e", "#16a34a", "#15803d",
        "#ccfbf1",
    ];
    const columns = [
        { key: "serial_number", label: "序号", editableByPm: true, editableByShipper: true },
        { key: "waybill_date", label: "运单日期", editableByPm: true, editableByShipper: true },
        { key: "waybill_number", label: "运单号码", editableByPm: true, editableByShipper: true },
        { key: "pieces", label: "件数", editableByPm: true, editableByShipper: true },
        { key: "chargeable_weight_kg", label: "计费重量（KG）", editableByPm: true, editableByShipper: true },
        { key: "destination", label: "目的地", editableByPm: true, editableByShipper: true },
        { key: "freight_unit_price", label: "单价", editableByPm: true, editableByShipper: true },
        { key: "freight_cost", label: "运费", editableByPm: false, editableByShipper: false, formula: true },
        { key: "gst", label: "消费税", editableByPm: true, editableByShipper: true },
        { key: "other_fees", label: "其他费用", editableByPm: true, editableByShipper: true },
        { key: "total_cost", label: "总计费用", editableByPm: false, editableByShipper: false, formula: true },
        { key: "channel", label: "渠道", editableByPm: true, editableByShipper: true },
        { key: "logistics_remarks", label: "备注", editableByPm: true, editableByShipper: true, width: 280 },

        { key: "ic", label: "谁下单 / I/C", editableByPm: true, editableByShipper: false },
        { key: "info_provided_date", label: "提供资料日期", editableByPm: true, editableByShipper: false },
        { key: "cn_tracking_no", label: "单号 / CN Tracking #", editableByPm: true, editableByShipper: false },
        { key: "cartons", label: "箱子 / Cartons", editableByPm: true, editableByShipper: false },
        { key: "item_name", label: "货名 / Item name", editableByPm: true, editableByShipper: false },
        { key: "delivery_info", label: "地址 / Address", editableByPm: true, editableByShipper: false, width: 420 },
        { key: "qty", label: "数量 / Qty", editableByPm: true, editableByShipper: false },
        { key: "up", label: "单价 / Unit Price", editableByPm: true, editableByShipper: false },
        { key: "value", label: "货值 / Value", editableByPm: false, editableByShipper: false, formula: true },
        { key: "sea_or_air", label: "海运、空运 / Sea or Air?", editableByPm: true, editableByShipper: false },
        { key: "tax_refund", label: "退税?", editableByPm: true, editableByShipper: false },
        { key: "shipper_remarks", label: "备注 / Remarks", editableByPm: true, editableByShipper: false, width: 280 },
        { key: "samples_by_air", label: "发样品空运 / Samples to send by air", editableByPm: true, editableByShipper: false },
        { key: "samples_by_sea", label: "发样品海运 / Samples to send by sea", editableByPm: true, editableByShipper: false },
        { key: "air_received", label: "空运收到 / Air received", editableByPm: true, editableByShipper: false },
        { key: "sea_received", label: "海运收到 / Sea received", editableByPm: true, editableByShipper: false },
    ];
    async function saveCell(row: ShipperRow, field: string, value: string) {
        if (!token && !row.shipper_id) return;

        setGridRows((previous) => previous.map((item) => item.id === row.id ? rowWithCellValue(item, field, value) : item));

        const res = await fetch("/api/shipper/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                subitemId: row.subitem_id,
                shipperId: row.shipper_id,
                shipperToken: token,
                field,
                value,
            }),
        });

        const json = await res.json();
        if (!res.ok) {
            throw new Error(json.error || "Failed to save shipper view row");
        }
    }

    useEffect(() => {
        const stopSelecting = () => setDragSelecting(false);
        window.addEventListener("mouseup", stopSelecting);
        return () => window.removeEventListener("mouseup", stopSelecting);
    }, []);

    useEffect(() => {
        setGridRows(rows);
    }, [rows]);

    useEffect(() => {
        setCellFills(Object.fromEntries(gridRows.flatMap((row) => Object.entries(row.cell_fills ?? {}).map(([column, color]) => [`${row.id}:${column}`, color]))));
    }, [gridRows]);

    const selectionBounds = selection && {
        firstRow: Math.min(selection.startRow, selection.endRow), lastRow: Math.max(selection.startRow, selection.endRow),
        firstCol: Math.min(selection.startCol, selection.endCol), lastCol: Math.max(selection.startCol, selection.endCol),
    };
    const cellSelected = (rowIndex: number, colIndex: number) => !!selectionBounds && rowIndex >= selectionBounds.firstRow && rowIndex <= selectionBounds.lastRow && colIndex >= selectionBounds.firstCol && colIndex <= selectionBounds.lastCol;
    const selectCell = (event: React.MouseEvent, rowIndex: number, colIndex: number) => {
        if (event.shiftKey && selection) setSelection((previous) => previous ? { ...previous, endRow: rowIndex, endCol: colIndex } : previous);
        else setSelection({ startRow: rowIndex, startCol: colIndex, endRow: rowIndex, endCol: colIndex });
        setIsFillPaletteOpen(true);
        setDragSelecting(true);
    };
    const fillSelectedCells = (color: string) => {
        if (!selectionBounds) return;
        setCellFills((previous) => {
            const next = { ...previous };
            const affectedRows = new Set<string>();
            for (let rowIndex = selectionBounds.firstRow; rowIndex <= selectionBounds.lastRow; rowIndex += 1) {
                for (let colIndex = selectionBounds.firstCol; colIndex <= selectionBounds.lastCol; colIndex += 1) {
                    const row = gridRows[rowIndex];
                    const col = columns[colIndex];
                    if (!row || !col) continue;
                    affectedRows.add(row.id);
                    const key = `${row.id}:${col.key}`;
                    if (color) next[key] = color;
                    else delete next[key];
                }
            }
            affectedRows.forEach((rowId) => {
                const row = gridRows.find((item) => item.id === rowId);
                if (!row) return;
                const rowFills = Object.fromEntries(Object.entries(next).filter(([key]) => key.startsWith(`${rowId}:`)).map(([key, fill]) => [key.slice(rowId.length + 1), fill]));
                void saveCell(row, "cell_fills", JSON.stringify(rowFills)).catch((error) => console.error("Failed to save cell fill", error));
            });
            return next;
        });
    };

    return (
        <div className="w-full overflow-auto">
            <div className="sticky left-0 z-40 mb-1 flex h-10 max-w-[calc(100vw-1rem)] items-center gap-1 rounded-md border border-slate-300 bg-white p-1.5 shadow-md">{selectionBounds && isFillPaletteOpen ? <><span className="shrink-0 px-1 text-xs font-medium text-slate-500">Fill</span><div className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-0.5">{fillColors.map((color) => <button key={color} type="button" onClick={() => fillSelectedCells(color)} className="h-5 w-5 shrink-0 rounded border border-slate-300 transition hover:scale-110" style={{ backgroundColor: color }} title="Fill selected cells" />)}<button type="button" onClick={() => fillSelectedCells("")} className="shrink-0 rounded border border-slate-300 px-2 py-1 text-[10px] text-slate-600 hover:bg-slate-50">Clear</button></div><button type="button" onClick={() => setIsFillPaletteOpen(false)} className="ml-1 shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Close fill palette" aria-label="Close fill palette"><X size={14} /></button></> : <button type="button" disabled={gridRows.length === 0} onClick={() => { if (!selectionBounds) setSelection({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 }); setIsFillPaletteOpen(true); }} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40" title={selectionBounds ? "Open fill palette" : "Select the top-left cell and choose a fill colour"}><PaintBucket size={15} /> Fill colour</button>}</div>
            <div className="rounded-md border border-slate-300 bg-white shadow-sm">
                <table className="min-w-[2400px] border-separate border-spacing-0 text-[13px] text-black">
                    <thead>
                        <tr>
                            <th className="sticky left-0 top-0 z-30 min-w-12 border-b-2 border-r-2 border-slate-400 bg-slate-100 px-2 py-2 text-center text-xs font-semibold text-slate-700 shadow-[2px_2px_4px_rgba(15,23,42,0.12)]">#</th>
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    style={col.width ? { minWidth: col.width, width: col.width } : undefined}
                                    className={`sticky top-0 z-20 border-b-2 border-r border-slate-400 px-3 py-2 text-center whitespace-nowrap shadow-[0_2px_4px_rgba(15,23,42,0.12)] ${col.editableByShipper ? "bg-white text-black" : "bg-[#4588ed] text-white"}
                                        }`}
                                >
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {gridRows.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={columns.length + 1}
                                    className="border border-slate-300 px-4 py-6 bg-white text-center text-sm text-slate-500"
                                >
                                    No shipper rows found.
                                </td>
                            </tr>
                        ) : (
                            gridRows.map((row, index) => (
                                <tr key={row.id} className="bg-white text-black align-top">
                                    <td className="sticky left-0 z-10 min-w-12 border-b border-r-2 border-slate-300 bg-slate-50 px-2 text-center text-xs text-slate-500 shadow-[2px_0_4px_rgba(15,23,42,0.10)]">{index + 1}</td>
                                    {columns.map((col, colIndex) => {
                                        const value = row[col.key as keyof ShipperRow];
                                        const editable =
                                            ((mode === "pm" || mode === "dev") && col.editableByPm) ||
                                            (mode === "shipper" && col.editableByShipper);

                                        return (
                                            <td
                                                key={col.key}
                                                onMouseDown={(event) => selectCell(event, index, colIndex)}
                                                onMouseEnter={() => { if (dragSelecting && selection) setSelection((previous) => previous ? { ...previous, endRow: index, endCol: colIndex } : previous); }}
                                                style={{ ...(col.width ? { minWidth: col.width, width: col.width } : {}), backgroundColor: cellFills[`${row.id}:${col.key}`] }}
                                                className={`border-b border-r border-slate-300 p-0 text-center align-middle whitespace-pre-wrap ${col.formula ? "bg-slate-50 font-medium" : ""} ${cellSelected(index, colIndex) ? "ring-2 ring-inset ring-sky-600" : ""}`}
                                            >
                                                {col.key === "logistics_remarks" || col.key === "shipper_remarks" ? (
                                                    <RemarksCell
                                                        row={row}
                                                        field={col.key}
                                                        editable={editable}
                                                        token={token}
                                                        saveCell={saveCell}
                                                    />
                                                ) : col.key === "info_provided_date" ? (
                                                    <DateCell value={row.info_provided_date} editable={editable} tooltip={dateCellTooltip(row.info_provided_date)} onSave={(nextValue) => saveCell(row, col.key, nextValue)} />
                                                ) : editable ? (
                                                    <SpreadsheetTextCell value={value} onSave={(nextValue) => saveCell(row, col.key, nextValue)} />
                                                ) : (
                                                    <div className="flex min-h-[42px] items-center justify-center px-2">{display(formulaValue(row, col.key))}</div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
