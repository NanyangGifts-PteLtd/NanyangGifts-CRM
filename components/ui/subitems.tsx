"use client";

import React, { useMemo, useState } from "react";
import type { Profile, Subitem } from "../../app/types";
import { Calendar, CreditCard, FileText, Package, Plus, Trash2 } from "lucide-react";
import { StatusBadge } from "./statusbadge";
import { EditableCell } from "./editablecell";
import { SamplesSection } from "./sample";
import { AssigneeMultiSelect } from "./assignee-multiselect";
import { TimelineSection, DEFAULT_TIMELINE_ROWS } from "./timeline";
import { CustomColumn } from "@/lib/custom-columns";

const CURRENCY_RATES: Record<string, number> = {
    RMB: 0.2,
    SGD: 1,
    MYR: 0.333,
};

type ColumnDef = {
    key: string;
    label: string;
    width: number;
    minWidth: number;
};

const SUBITEM_COLS: ColumnDef[] = [
    { key: "name", label: "Subitem", width: 320, minWidth: 170 },
    { key: "people", label: "People", width: 80, minWidth: 7 },
    { key: "localOverseas", label: "Local/Overseas", width: 110, minWidth: 7 },
    { key: "status", label: "Status", width: 90, minWidth: 7 },
    { key: "qty", label: "Qty", width: 55, minWidth: 7 },
    { key: "description", label: "Description", width: 140, minWidth: 7 },
    { key: "remarks", label: "Remarks", width: 130, minWidth: 7 },
    { key: "shipper", label: "Shipper", width: 125, minWidth: 7 },
    { key: "supplier", label: "Supplier", width: 120, minWidth: 7 },
    { key: "cost", label: "Cost", width: 70, minWidth: 7 },
    { key: "manpower", label: "Manpower", width: 80, minWidth: 7 },
    { key: "ls", label: "LS", width: 55, minWidth: 7 },
    { key: "os", label: "OS", width: 55, minWidth: 7 },
    { key: "currency", label: "Currency", width: 80, minWidth: 7 },
    { key: "cSgd", label: "C-SGD", width: 80, minWidth: 7 },
    { key: "tc", label: "T.C", width: 80, minWidth: 7 },
    { key: "uc", label: "U.C", width: 70, minWidth: 7 },
    { key: "tcSgd", label: "TC-SGD", width: 80, minWidth: 7 },
    { key: "price", label: "Price", width: 80, minWidth: 7 },
    { key: "up", label: "U.P", width: 60, minWidth: 7 },
    { key: "cnTracking", label: "CN Tracking #", width: 130, minWidth: 7 },
    { key: "sgTracking", label: "SG Tracking #", width: 130, minWidth: 7 },
    { key: "pl", label: "PL", width: 55, minWidth: 7 },
    { key: "sl", label: "SL", width: 55, minWidth: 7 },
];

const PAYMENT_COLS: ColumnDef[] = [
    { key: "name", label: "Subitem", width: 320, minWidth: 170 },
    { key: "paymentTerms", label: "Payment Terms", width: 120, minWidth: 7 },
    { key: "paymentStatus", label: "Status", width: 90, minWidth: 7 },
    { key: "shipper", label: "Shipper", width: 115, minWidth: 7 },
    { key: "supplier", label: "Supplier", width: 120, minWidth: 7 },
    { key: "description", label: "Description", width: 120, minWidth: 7 },
    { key: "qty", label: "Qty", width: 55, minWidth: 7 },
    { key: "cost", label: "Cost", width: 60, minWidth: 7 },
    { key: "totalUc", label: "Total UC", width: 70, minWidth: 7 },
    { key: "manpower", label: "Manpower / 版费 / Printing (SGD)", width: 120, minWidth: 7 },
    { key: "manpowerRmb", label: "Manpower (RMB)", width: 120, minWidth: 7 },
    { key: "ls", label: "LS (SGD)", width: 80, minWidth: 7 },
    { key: "lsRmb", label: "LS (RMB)", width: 80, minWidth: 7 },
    { key: "totalC", label: "Total Cost", width: 90, minWidth: 7 },
    { key: "modeOfPayment", label: "Mode of Payment", width: 140, minWidth: 7 },
    { key: "orderNumber", label: "Order #", width: 120, minWidth: 7 },
    { key: "quantityProduced", label: "Qty Ordered", width: 100, minWidth: 7 },
    { key: "sample", label: "Sample", width: 80, minWidth: 7 },
    { key: "qtyFor", label: "Qty For Client", width: 110, minWidth: 7 },
    { key: "paymentAmount", label: "Payment Amt", width: 100, minWidth: 7 },
    { key: "difference", label: "Difference", width: 90, minWidth: 7 },
    { key: "paymentRemarks", label: "Remarks", width: 120, minWidth: 7 },
];

type TableMode = "subitem" | "payment" | "timeline";
type OptionEntry = { value: string; color: string };

const CUSTOM_COL_WIDTH = 120;

type SubitemProps = {
    clientId: string;
    subitems: Subitem[];
    clientColor: string;
    onUpdateSubitem: (id: string, u: Partial<Subitem>) => void;
    onAddSubitem: () => void;
    onDeleteSubitem: (id: string) => void;
    profiles: Profile[];
    subitemAssigneeMap: Record<string, string[]>;
    onChangeSubitemAssignees: (subitemId: string, ids: string[]) => void;
    paymentStatusOptions: OptionEntry[];
    modeOfPaymentOptions: OptionEntry[];
    shipperOptions: OptionEntry[];
    localOverseasOptions: OptionEntry[];
    subitemStatusOptions: OptionEntry[];
    currencyOptions: OptionEntry[];
    subitemSubprogressOptions: OptionEntry[];
    onAddSubitemSubprogress?: (name: string) => void | Promise<void>;
    onDeleteSubitemSubprogress?: (name: string) => void | Promise<void>;
    onAddCurrency?: (name: string) => void | Promise<void>;
    onDeleteCurrency?: (name: string) => void | Promise<void>;
    onAddSubitemStatus?: (name: string) => void | Promise<void>;
    onDeleteSubitemStatus?: (name: string) => void | Promise<void>;
    onAddShipper?: (name: string) => void | Promise<void>;
    onDeleteShipper?: (name: string) => void | Promise<void>;
    onAddLocalOverseas?: (name: string) => void | Promise<void>;
    onDeleteLocalOverseas?: (name: string) => void | Promise<void>;
    onAddPaymentStatus?: (name: string) => void | Promise<void>;
    onDeletePaymentStatus?: (name: string) => void | Promise<void>;
    onAddModeOfPayment?: (name: string) => void | Promise<void>;
    onDeleteModeOfPayment?: (name: string) => void | Promise<void>;
    subitemCustomCols: CustomColumn[];
    onDeleteSubitemCustomCol: (id: string) => void;
    onRequestAddSubitemCol: () => void; // triggers the add col modal in CRMBoard
};

function parseNumber(v: string | number | undefined | null) {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    if (v == null || v === "") return 0;
    const n = Number(String(v).replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
}

function formatMoney(v: number | null | undefined) {
    if (v == null || Number.isNaN(v)) return "";
    return v.toFixed(2);
}

function ExpandedRow({ colSpan, tone = "blue", children }: { colSpan: number; tone?: "blue" | "green" | "purple"; children: React.ReactNode }) {
    const cls = tone === "green" ? "bg-green-50/30" : tone === "purple" ? "bg-purple-50/30" : "bg-blue-50/30";
    return (
        <tr>
            <td colSpan={colSpan} className={`p-0 ${cls}`}>
                <div className="ml-12 mr-3 my-2 rounded-md border border-gray-200 bg-white shadow-sm">{children}</div>
            </td>
        </tr>
    );
}

export function SubitemsTable({
    clientId,
    subitems,
    clientColor,
    onUpdateSubitem,
    onAddSubitem,
    onDeleteSubitem,
    profiles,
    subitemAssigneeMap,
    onChangeSubitemAssignees,
    paymentStatusOptions,
    modeOfPaymentOptions,
    shipperOptions,
    localOverseasOptions,
    subitemStatusOptions,
    currencyOptions,
    subitemSubprogressOptions,
    onAddSubitemSubprogress,
    onDeleteSubitemSubprogress,
    onAddCurrency,
    onDeleteCurrency,
    onAddSubitemStatus,
    onDeleteSubitemStatus,
    onAddLocalOverseas,
    onDeleteLocalOverseas,
    onAddShipper,
    onDeleteShipper,
    onAddPaymentStatus,
    onDeletePaymentStatus,
    onAddModeOfPayment,
    onDeleteModeOfPayment,
    subitemCustomCols,
    onDeleteSubitemCustomCol,
    onRequestAddSubitemCol,
}: SubitemProps) {
    const [tableMode, setTableMode] = useState<TableMode | null>(null);
    const [subitemCols, setSubitemCols] = useState<ColumnDef[]>([...SUBITEM_COLS]);
    const [paymentCols, setPaymentCols] = useState<ColumnDef[]>([...PAYMENT_COLS]);
    const [selectedSubitemIds, setSelectedSubitemIds] = useState<string[]>([]);
    const [selectionBox, setSelectionBox] = useState({ x: 0, y: 0, visible: false });

    const cols = tableMode === "payment" ? paymentCols : subitemCols;

    // Total width includes fixed cols + custom cols + the + button col
    const totalTableWidth = useMemo(() => {
        const baseCols = 44 + cols.reduce((s, c) => s + c.width, 0);
        const customColsWidth = subitemCustomCols.length * CUSTOM_COL_WIDTH;
        const addBtnWidth = 32;
        return baseCols + customColsWidth + addBtnWidth;
    }, [cols, subitemCustomCols]);

    const startResize = (key: string, startX: number) => {
        const activeCols = tableMode === "payment" ? paymentCols : subitemCols;
        const startCol = activeCols.find((c) => c.key === key);
        if (!startCol) return;
        const startWidth = startCol.width;
        const onMouseMove = (e: MouseEvent) => {
            const delta = e.clientX - startX;
            const setter = tableMode === "payment" ? setPaymentCols : setSubitemCols;
            setter((prev) => prev.map((c) => c.key === key ? { ...c, width: Math.max(c.minWidth ?? 50, startWidth + delta) } : c));
        };
        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    };

    const toggleSubitemSelection = (subitemId: string, x: number, y: number) => {
        setSelectedSubitemIds((prev) => prev.includes(subitemId) ? prev.filter((id) => id !== subitemId) : [...prev, subitemId]);
        setSelectionBox({ x: x + 16, y: y + 16, visible: true });
    };

    const selectedSubitems = useMemo(() => subitems.filter((s) => selectedSubitemIds.includes(s.id)), [subitems, selectedSubitemIds]);

    const selectionTotals = useMemo(() => selectedSubitems.reduce((acc, sub) => {
        const qty = parseNumber(sub.qty);
        const tc = parseNumber(sub.cost) + parseNumber(sub.manpower) + parseNumber(sub.ls) + parseNumber(sub.os) + parseNumber(sub.tcSgd);
        const totalPrice = parseNumber(sub.up) * qty;
        acc.totalCost += tc;
        acc.totalPrice += totalPrice;
        acc.totalMarkup += totalPrice - tc;
        return acc;
    }, { totalCost: 0, totalPrice: 0, totalMarkup: 0 }), [selectedSubitems]);

    const renderNameCell = (sub: Subitem) => (
        <div className="flex items-center gap-1">
            <FileText size={11} className="text-gray-400 shrink-0" />
            <EditableCell value={sub.name} onChange={(v) => onUpdateSubitem(sub.id, { name: v })} placeholder="Subitem name" className="!text-left" />
            <div className="ml-auto flex items-center gap-1 shrink-0">
                <button
                    onClick={() => { onUpdateSubitem(sub.id, { showTimeline: !sub.showTimeline, showPayments: false, showSample: false }); setTableMode(sub.showTimeline ? null : "timeline"); }}
                    className={`flex items-center justify-center rounded-sm border p-1 transition active:scale-95 ${sub.showTimeline ? "border-[#7BCBD5] bg-[#7BCBD5] text-white" : "border-teal-200 bg-transparent text-[#6db6bf] hover:bg-teal-100"}`}
                    title="Timeline"
                >
                    <Calendar size={15} />
                </button>
                <button
                    onClick={() => setTableMode((prev) => prev === "payment" ? null : "payment")}
                    className={`flex items-center justify-center rounded-sm border p-1 transition active:scale-95 ${tableMode === "payment" ? "border-[#f291b6] bg-[#f291b6] text-white" : "border-pink-200 bg-transparent text-[#e87da6] hover:bg-pink-100"}`}
                    title="Payments"
                >
                    <CreditCard size={15} />
                </button>
                <button
                    onClick={() => { onUpdateSubitem(sub.id, { showSample: !sub.showSample, showTimeline: false, showPayments: false }); }}
                    className={`flex items-center justify-center rounded-sm border p-1 transition active:scale-95 ${sub.showSample ? "border-[#d5a5ec] bg-[#d5a5ec] text-white" : "border-purple-200 bg-transparent text-[#ac7ec2] hover:bg-purple-100"}`}
                    title="Samples"
                >
                    <Package size={15} />
                </button>
                <button onClick={() => onDeleteSubitem(sub.id)} className="p-1 text-gray-300 transition-colors hover:text-red-400" title="Delete subitem">
                    <Trash2 size={15} />
                </button>
            </div>
        </div>
    );

    const renderSubitemCell = (sub: Subitem, key: string) => {
        const qty = parseNumber(sub.qty);
        const cost = parseNumber(sub.cost);
        const manpower = parseNumber(sub.manpower);
        const ls = parseNumber(sub.ls);
        const os = parseNumber(sub.os);
        const tcSgd = parseNumber(sub.tcSgd);
        const tc = cost + manpower + ls + os + tcSgd;
        const uc = qty > 0 ? tc / qty : null;
        const price = parseNumber(sub.up) * qty;
        const cSgd = cost * (CURRENCY_RATES[sub.currency ?? "RMB"] ?? 0.2);

        switch (key) {
            case "name": return renderNameCell(sub);
            case "people": return <AssigneeMultiSelect profiles={profiles} selectedIds={subitemAssigneeMap[sub.id] ?? []} onChange={(ids) => onChangeSubitemAssignees(sub.id, ids)} />;
            case "localOverseas": return <div className="flex items-center"><StatusBadge value={sub.localOverseas ?? ""} onChange={(v) => onUpdateSubitem(sub.id, { localOverseas: v })} options={localOverseasOptions} onAddOption={onAddLocalOverseas} onDeleteOption={onDeleteLocalOverseas} manageLabel="local overseas" small /></div>;
            case "status": return <div className="flex items-center"><StatusBadge value={sub.status ?? ""} onChange={(v) => onUpdateSubitem(sub.id, { status: v })} options={subitemStatusOptions} onAddOption={onAddSubitemStatus} onDeleteOption={onDeleteSubitemStatus} manageLabel="subitem status" small /></div>;
            case "qty": return <EditableCell value={sub.qty} onChange={(v) => onUpdateSubitem(sub.id, { qty: v })} type="number" />;
            case "description": return <EditableCell className="!justify-start" value={sub.description} onChange={(v) => onUpdateSubitem(sub.id, { description: v })} multiline />;
            case "remarks": return <EditableCell value={sub.remarks} onChange={(v) => onUpdateSubitem(sub.id, { remarks: v })} multiline />;
            case "shipper": return <div className="flex items-center"><StatusBadge value={sub.shipper ?? ""} onChange={(v) => onUpdateSubitem(sub.id, { shipper: v })} options={shipperOptions} onAddOption={onAddShipper} onDeleteOption={onDeleteShipper} manageLabel="shipper" small /></div>;
            case "supplier": return <EditableCell value={sub.supplier} onChange={(v) => onUpdateSubitem(sub.id, { supplier: v })} />;
            case "cost": return <EditableCell value={sub.cost} onChange={(v) => onUpdateSubitem(sub.id, { cost: v })} type="number" />;
            case "manpower": return <EditableCell value={sub.manpower} onChange={(v) => onUpdateSubitem(sub.id, { manpower: v })} type="number" />;
            case "ls": return <EditableCell value={sub.ls} onChange={(v) => onUpdateSubitem(sub.id, { ls: v })} type="number" />;
            case "os": return <EditableCell value={sub.os} onChange={(v) => onUpdateSubitem(sub.id, { os: v })} type="number" />;
            case "currency": return <div className="flex items-center"><StatusBadge value={sub.currency ?? ""} onChange={(v) => onUpdateSubitem(sub.id, { currency: v })} options={currencyOptions} onAddOption={onAddCurrency} onDeleteOption={onDeleteCurrency} manageLabel="currency" small /></div>;
            case "cSgd": return <div className="flex justify-center text-xs text-gray-800">{formatMoney(cSgd)}</div>;
            case "tc": return <div className="flex justify-center text-xs text-gray-800">{formatMoney(tc)}</div>;
            case "uc": return <div className="flex justify-center text-xs text-gray-800">{formatMoney(uc)}</div>;
            case "tcSgd": return <EditableCell value={sub.tcSgd} onChange={(v) => onUpdateSubitem(sub.id, { tcSgd: v })} type="number" />;
            case "price": return <div className="flex justify-center text-xs text-gray-800">{formatMoney(price)}</div>;
            case "up": return <EditableCell value={sub.up} onChange={(v) => onUpdateSubitem(sub.id, { up: v })} type="number" />;
            case "cnTracking": return <EditableCell value={sub.cnTracking} onChange={(v) => onUpdateSubitem(sub.id, { cnTracking: v })} />;
            case "sgTracking": return <EditableCell value={sub.sgTracking} onChange={(v) => onUpdateSubitem(sub.id, { sgTracking: v })} />;
            case "pl": return <EditableCell value={sub.pl ?? ""} onChange={(v) => onUpdateSubitem(sub.id, { pl: v })} type="number" />;
            case "sl": return <EditableCell value={sub.sl ?? ""} onChange={(v) => onUpdateSubitem(sub.id, { sl: v })} type="number" />;
            default: return null;
        }
    };

    const renderPaymentCell = (sub: Subitem, key: string) => {
        const qty = parseNumber(sub.qty);
        const cost = parseNumber(sub.cost);
        const totalUc = cost * qty;
        const manpowerRmb = parseNumber(sub.manpower) * 5;
        const lsRmb = parseNumber(sub.ls) * 5;
        const totalC = totalUc + manpowerRmb + lsRmb;
        const difference = parseNumber(sub.paymentAmount) - totalC;

        switch (key) {
            case "name": return renderNameCell(sub);
            case "paymentTerms": return <EditableCell value={sub.owner} onChange={(v) => onUpdateSubitem(sub.id, { owner: v })} />;
            case "paymentStatus": return <div className="flex items-center"><StatusBadge value={sub.paymentStatus ?? ""} onChange={(v) => onUpdateSubitem(sub.id, { paymentStatus: v })} options={paymentStatusOptions} onAddOption={onAddPaymentStatus} onDeleteOption={onDeletePaymentStatus} manageLabel="payment status" small /></div>;
            case "shipper": return <div className="flex items-center"><StatusBadge value={sub.shipper ?? ""} onChange={(v) => onUpdateSubitem(sub.id, { shipper: v })} options={shipperOptions} onAddOption={onAddShipper} onDeleteOption={onDeleteShipper} manageLabel="shipper" small /></div>;
            case "supplier": return <EditableCell value={sub.supplier} onChange={(v) => onUpdateSubitem(sub.id, { supplier: v })} />;
            case "description": return <EditableCell className="!justify-start" value={sub.description} onChange={(v) => onUpdateSubitem(sub.id, { description: v })} multiline />;
            case "qty": return <EditableCell value={sub.qty} onChange={(v) => onUpdateSubitem(sub.id, { qty: v })} type="number" />;
            case "cost": return <EditableCell value={sub.cost} onChange={(v) => onUpdateSubitem(sub.id, { cost: v })} type="number" />;
            case "totalUc": return <div className="flex justify-center text-xs text-gray-800">{formatMoney(totalUc)}</div>;
            case "manpower": return <EditableCell value={sub.manpower} onChange={(v) => onUpdateSubitem(sub.id, { manpower: v })} type="number" />;
            case "manpowerRmb": return <div className="flex justify-center text-xs text-gray-800">{formatMoney(manpowerRmb)}</div>;
            case "ls": return <EditableCell value={sub.ls} onChange={(v) => onUpdateSubitem(sub.id, { ls: v })} type="number" />;
            case "lsRmb": return <div className="flex justify-center text-xs text-gray-800">{formatMoney(lsRmb)}</div>;
            case "totalC": return <div className="flex justify-center text-xs text-gray-800">{formatMoney(totalC)}</div>;
            case "modeOfPayment": return <div className="flex items-center"><StatusBadge value={sub.modeOfPayment ?? ""} onChange={(v) => onUpdateSubitem(sub.id, { modeOfPayment: v })} options={modeOfPaymentOptions} onAddOption={onAddModeOfPayment} onDeleteOption={onDeleteModeOfPayment} manageLabel="mode of payment" small /></div>;
            case "orderNumber": return <EditableCell value={sub.orderNumber} onChange={(v) => onUpdateSubitem(sub.id, { orderNumber: v })} />;
            case "quantityProduced": return <EditableCell value={sub.quantityProduced ?? ""} onChange={(v) => onUpdateSubitem(sub.id, { quantityProduced: v })} type="number" />;
            case "sample": return <EditableCell value={sub.sample ?? ""} onChange={(v) => onUpdateSubitem(sub.id, { sample: v })} />;
            case "qtyFor": return <EditableCell value={sub.qtyFor ?? ""} onChange={(v) => onUpdateSubitem(sub.id, { qtyFor: v })} type="number" />;
            case "paymentAmount": return <EditableCell value={sub.paymentAmount ?? ""} onChange={(v) => onUpdateSubitem(sub.id, { paymentAmount: v })} type="number" />;
            case "difference": return <div className="flex justify-center text-xs text-gray-800">{formatMoney(difference)}</div>;
            case "paymentRemarks": return <EditableCell value={sub.paymentRemarks ?? ""} onChange={(v) => onUpdateSubitem(sub.id, { paymentRemarks: v })} multiline />;
            default: return null;
        }
    };

    const renderCell = (sub: Subitem, key: string) =>
        tableMode === "payment" ? renderPaymentCell(sub, key) : renderSubitemCell(sub, key);

    // Total colSpan = checkbox col + fixed cols + custom cols + add-col btn
    const totalColSpan = 1 + cols.length + subitemCustomCols.length + 1;

    return (
        <div className="relative mb-2 ml-7 max-w-[calc(100vw-80px)]" style={{ borderLeft: `7px solid ${clientColor}` }} data-client-id={clientId}>
            {selectedSubitemIds.length > 0 && selectionBox.visible && (
                <div className="fixed z-50 rounded-xl border border-gray-200 bg-white/95 px-4 py-3 text-xs text-gray-700 shadow-xl backdrop-blur-sm" style={{ left: selectionBox.x, top: selectionBox.y }}>
                    <div className="mb-2 font-semibold text-gray-900">{selectedSubitemIds.length} subitem{selectedSubitemIds.length > 1 ? "s" : ""} selected</div>
                    <div className="space-y-1 whitespace-nowrap">
                        <div>Total price: <span className="font-medium">{selectionTotals.totalPrice.toFixed(2)}</span></div>
                        <div>Total cost: <span className="font-medium">{selectionTotals.totalCost.toFixed(2)}</span></div>
                        <div>Total markup: <span className={`font-medium ${selectionTotals.totalMarkup >= 0 ? "text-green-600" : "text-red-500"}`}>{selectionTotals.totalMarkup.toFixed(2)}</span></div>
                    </div>
                    <button onClick={() => { setSelectedSubitemIds([]); setSelectionBox((p) => ({ ...p, visible: false })); }} className="mt-2 text-[11px] text-gray-400 hover:text-gray-600">Clear selection</button>
                </div>
            )}

            <div className="w-full">
                <table className="table-fixed border-collapse" style={{ width: totalTableWidth, minWidth: totalTableWidth }}>
                    <colgroup>
                        <col style={{ width: 44 }} />
                        {cols.map((col) => <col key={col.key} style={{ width: col.width }} />)}
                        {/* Custom col colgroups */}
                        {subitemCustomCols.map((col) => <col key={col.id} style={{ width: CUSTOM_COL_WIDTH }} />)}
                        {/* + button col */}
                        <col style={{ width: 32 }} />
                    </colgroup>

                    <thead>
                        <tr className="border-b border-t border-r border-[#D0D4E4] bg-gray-50">
                            <th className="w-11 px-2 py-1 text-center" />

                            {/* Fixed cols */}
                            {cols.map((col) => (
                                <th key={col.key} className="overflow-hidden relative border-r border-[#D0D4E4] py-1 text-center text-[11px] font-semibold whitespace-nowrap text-gray-500">
                                    <div className="overflow-hidden text-ellipsis whitespace-nowrap px-2">{col.label}</div>
                                    <div onMouseDown={(e) => { e.preventDefault(); startResize(col.key, e.clientX); }} className="absolute top-0 right-0 h-full w-2 cursor-col-resize hover:bg-[#7BCBD5]/20" />
                                </th>
                            ))}

                            {/* Custom col headers */}
                            {subitemCustomCols.map((col) => (
                                <th key={col.id} className="relative border-r border-[#D0D4E4] py-1 text-center text-[11px] font-semibold whitespace-nowrap text-gray-500 bg-teal-50/40" style={{ minWidth: CUSTOM_COL_WIDTH, width: CUSTOM_COL_WIDTH }}>
                                    <div className="flex items-center justify-center gap-1 px-2">
                                        <span className="truncate">{col.name}</span>
                                        <button
                                            onClick={() => onDeleteSubitemCustomCol(col.id)}
                                            className="text-gray-300 hover:text-red-400 text-base leading-none flex-shrink-0"
                                            title="Remove column"
                                        >×</button>
                                    </div>
                                </th>
                            ))}

                            {/* + Add column button */}
                            <th className="border-r border-[#D0D4E4] px-1 text-center" style={{ width: 32 }}>
                                <button
                                    onClick={onRequestAddSubitemCol}
                                    className="text-gray-300 hover:text-[#7BCBD5] text-lg leading-none"
                                    title="Add subitem column"
                                >+</button>
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        {subitems.map((sub) => (
                            <React.Fragment key={sub.id}>
                                <tr className="group border-b border-r border-[#D0D4E4] hover:bg-blue-50/30">
                                    <td className="border-r border-[#D0D4E4] px-2 py-1 text-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedSubitemIds.includes(sub.id)}
                                            onClick={(e) => { e.stopPropagation(); toggleSubitemSelection(sub.id, e.clientX, e.clientY); }}
                                            onChange={() => { }}
                                            className="h-3 w-3 cursor-pointer rounded accent-[#7BCBD5]"
                                        />
                                    </td>

                                    {/* Fixed cells */}
                                    {cols.map((col) => (
                                        <td key={col.key} className="overflow-hidden align-middle border-r border-[#D0D4E4] px-2 py-1 last:border-r-0" style={{ minWidth: col.minWidth }}>
                                            {renderCell(sub, col.key)}
                                        </td>
                                    ))}

                                    {/* Custom field cells */}
                                    {subitemCustomCols.map((col) => (
                                        <td key={col.id} className="overflow-hidden align-middle border-r border-[#D0D4E4] px-1 py-1 bg-teal-50/20" style={{ minWidth: CUSTOM_COL_WIDTH, width: CUSTOM_COL_WIDTH }}>
                                            {col.field_type === "date" ? (
                                                <input
                                                    type="date"
                                                    value={sub.customFields?.[col.id] ?? ""}
                                                    onChange={(e) => onUpdateSubitem(sub.id, { customFields: { ...(sub.customFields ?? {}), [col.id]: e.target.value } })}
                                                    className="text-xs border-none outline-none bg-transparent cursor-pointer w-full px-1"
                                                />
                                            ) : (
                                                <EditableCell
                                                    value={sub.customFields?.[col.id] ?? ""}
                                                    onChange={(v) => onUpdateSubitem(sub.id, { customFields: { ...(sub.customFields ?? {}), [col.id]: v } })}
                                                    type={col.field_type}
                                                    placeholder="—"
                                                />
                                            )}
                                        </td>
                                    ))}

                                    {/* Empty cell under + button */}
                                    <td className="border-r border-[#D0D4E4]" style={{ width: 32 }} />
                                </tr>

                                {sub.showTimeline && (
                                    <ExpandedRow colSpan={totalColSpan} tone="blue">
                                        <TimelineSection
                                            rows={sub.timelineRows?.length ? sub.timelineRows : DEFAULT_TIMELINE_ROWS}
                                            onUpdate={(rows) => onUpdateSubitem(sub.id, { timelineRows: rows })}
                                            timelineProgressOptions={subitemSubprogressOptions}
                                            onAddTimelineProgress={onAddSubitemSubprogress}
                                            onDeleteTimelineProgress={onDeleteSubitemSubprogress}
                                        />
                                    </ExpandedRow>
                                )}

                                {sub.showSample && (
                                    <ExpandedRow colSpan={totalColSpan} tone="purple">
                                        <SamplesSection subitem={sub} onUpdate={(u) => onUpdateSubitem(sub.id, u)} />
                                    </ExpandedRow>
                                )}
                            </React.Fragment>
                        ))}

                        <tr>
                            <td colSpan={totalColSpan} className="px-3 py-2">
                                <button onClick={onAddSubitem} className="flex items-center gap-1.5 text-xs text-gray-400 transition duration-150 hover:text-[#7BCBD5] active:scale-95">
                                    <Plus size={12} /> Add subitem
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}