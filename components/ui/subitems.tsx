"use client";

import React, { useMemo, useState } from "react";
import type { Profile, Subitem } from "../../app/types";
import { Calendar, CreditCard, FileText, Package, Plus, Trash2 } from "lucide-react";
import { StatusBadge } from "./statusbadge";
import { EditableCell } from "./editablecell";
import { PaymentsSection } from "./payments";
import { SamplesSection } from "./sample";
import { AssigneeMultiSelect } from "./assignee-multiselect";
import { TimelineSection, DEFAULT_TIMELINE_ROWS } from "./timeline";

const SUBITEM_STATUS_COLORS: Record<string, string> = {
    "To Quote": "#5cc9d5",
    Verified: "#00C2C7",
    Awarded: "#00C875",
    "Initial Quote": "#8b81da",
    Quoted: "#5fe0cf",
    Shortlisted: "#ad7de7",
    Failed: "#ac2865",
    "Set": "#eeeded",
};

const LOCALOVERSEAS_COLORS: Record<string, string> = {
    Local: "#a856a6",
    Overseas: "#8b81da",
};

const SHIPPER_COLORS: Record<string, string> = {
    "Set": "#eeeded",
    "小李 - AIR": "#f88fc1",
    "小李 - SEA": "#ff97ab",
    "Tiger - Sea": "#ffa791",
    "Tiger - AIR": "#ffbf7a",
    "东莞 - SEA": "#c28adc",
    "WORLD ASIA": "#628ce8",
    "A5 汇荣": "#008bd8",
    "Kalinda - AIR": "#0083aa",
    "Kalinda - SEA": "#007467",
    "David - DPS": "#a58eae",
    "Local Singapore": "#775785",
    "Local China": "#3b313e",
    "霸王车": "#801f55",
    "义乌": "#99005c",
    SF: "#84429b",
    DHL: "#426bc6",
    恒瀚: "#008bd3",
    "Easy Parcel": "#00a4c7",
    "Local Destination": "#00b8ad",
    UPS: "#a8a3ff",
    FedEx: "#95e8ff",
    "宇涵 - Air": "#43adcb",
    "宇涵 - Sea": "#2f9179",
};

const CURRENCY_COLORS: Record<string, string> = {
    MYR: "#b37ed2",
    SGD: "#5fc1cc",
    RMB: "#e375a1",
};

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
]

const PAYMENT_COLS: ColumnDef[] = [
    { key: "name", label: "Subitem", width: 320, minWidth: 170 },
    { key: "paymentTerms", label: "Payment Terms", width: 120, minWidth: 7 },
    { key: "paymentStatus", label: "Status", width: 90, minWidth: 7 },
    { key: "shipper", label: "Shipper", width: 115, minWidth: 7 },
    { key: "supplier", label: "Supplier", width: 120, minWidth: 7 },
    { key: "description", label: "Description", width: 120, minWidth: 7 },
    { key: "qty", label: "Qty", width: 55, minWidth: 7 },
    { key: "cost", label: "Cost", width: 60, minWidth: 7 },
    { key: "total", label: "Total", width: 70, minWidth: 7 },
    { key: "manpower", label: "Manpower", width: 70, minWidth: 7 },
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
]

const PAYMENT_STATUS_COLORS: Record<string, string> = {
    Paid: "#2fd48f",
    "To Pay": "#60d4e6",
    Partial: "#8b81da",
    Overdue: "#ac2865",
    "Set": "#eeeded",
};

const statusOpts = ["", "To Quote", "Verified", "Awarded", "Initial Quote", "Quoted", "Shortlisted", "Failed"];
const localOverseasOpts = ["Local", "Overseas"];
const shipperOpts = [
    "",
    "小李 - AIR",
    "小李 - SEA",
    "Tiger - Sea",
    "Tiger - AIR",
    "东莞 - SEA",
    "WORLD ASIA",
    "A5 汇荣",
    "Kalinda - AIR",
    "Kalinda - SEA",
    "David - DPS",
    "Local Singapore",
    "Local China",
    "霸王车",
    "义乌",
    "SF",
    "DHL",
    "恒瀚",
    "Easy Parcel",
    "Local Destination",
    "UPS",
    "FedEx",
    "宇涵 - Air",
    "宇涵 - Sea",
];
const currencyOpts = ["MYR", "SGD", "RMB"];
const paymentOpts = ["Set", "Paid", "To Pay", "Partial", "Overdue"];
const modeOpts = ["Set", "AliPay", "1688", "Bank Transfer", "PayPal", "Stripe", "Cash", "Cheque", "Wise"];

type TableMode = "subitem" | "payment" | "timeline";

type Props = {
    clientId: string;
    subitems: Subitem[];
    clientColor: string;
    onUpdateSubitem: (id: string, u: Partial<Subitem>) => void;
    onAddSubitem: () => void;
    onDeleteSubitem: (id: string) => void;
    profiles: Profile[];
    subitemAssigneeMap: Record<string, string[]>;
    onChangeSubitemAssignees: (subitemId: string, ids: string[]) => void;
};

function parseNumber(value: string | number | undefined | null) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (value == null || value === "") return 0;
    const cleaned = String(value).replace(/,/g, "").trim();
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
}

function formatMoney(value: number | null | undefined) {
    if (value == null || Number.isNaN(value)) return "";
    return value.toFixed(2);
}

function ExpandedRow({
    colSpan,
    tone = "blue",
    children,
}: {
    colSpan: number;
    tone?: "blue" | "green" | "purple";
    children: React.ReactNode;
}) {
    const toneClass =
        tone === "green"
            ? "bg-green-50/30"
            : tone === "purple"
                ? "bg-purple-50/30"
                : "bg-blue-50/30";

    return (
        <tr>
            <td colSpan={colSpan} className={`p-0 ${toneClass}`}>
                <div className="ml-12 mr-3 my-2 rounded-md border border-gray-200 bg-white shadow-sm">
                    {children}
                </div>
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
}: Props) {
    const [tableMode, setTableMode] = useState<TableMode | null>(null);
    const [subitemCols, setSubitemCols] = useState<ColumnDef[]>([...SUBITEM_COLS]);
    const [paymentCols, setPaymentCols] = useState<ColumnDef[]>([...PAYMENT_COLS]);
    const [selectedSubitemIds, setSelectedSubitemIds] = useState<string[]>([]);
    const [selectionBox, setSelectionBox] = useState({ x: 0, y: 0, visible: false });

    const cols = tableMode === "payment" ? paymentCols : subitemCols;

    const totalTableWidth = useMemo(() => {
        return 44 + cols.reduce((sum, col) => sum + col.width, 0);
    }, [cols]);

    const startResize = (key: string, startX: number) => {
        const activeCols = tableMode === "payment" ? paymentCols : subitemCols;
        const startCol = activeCols.find((col) => col.key === key);
        if (!startCol) return;

        const startWidth = startCol.width;

        const onMouseMove = (e: MouseEvent) => {
            const delta = e.clientX - startX;

            if (tableMode === "payment") {
                setPaymentCols((prev) =>
                    prev.map((col) =>
                        col.key === key
                            ? { ...col, width: Math.max(col.minWidth ?? 50, startWidth + delta) }
                            : col
                    )
                );
            } else {
                setSubitemCols((prev) =>
                    prev.map((col) =>
                        col.key === key
                            ? { ...col, width: Math.max(col.minWidth ?? 50, startWidth + delta) }
                            : col
                    )
                );
            }
        };

        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    };

    const toggleSubitemSelection = (subitemId: string, x: number, y: number) => {
        setSelectedSubitemIds((prev) =>
            prev.includes(subitemId)
                ? prev.filter((id) => id !== subitemId)
                : [...prev, subitemId]
        );

        setSelectionBox({
            x: x + 16,
            y: y + 16,
            visible: true,
        });
    };

    const selectedSubitems = useMemo(
        () => subitems.filter((sub) => selectedSubitemIds.includes(sub.id)),
        [subitems, selectedSubitemIds]
    );

    const selectionTotals = useMemo(() => {
        return selectedSubitems.reduce(
            (acc, sub) => {
                const qty = parseNumber(sub.qty);
                const tc =
                    parseNumber(sub.cost) +
                    parseNumber(sub.manpower) +
                    parseNumber(sub.ls) +
                    parseNumber(sub.os) +
                    parseNumber(sub.tcSgd);

                const totalPrice = parseNumber(sub.up) * qty;
                const markup = totalPrice - tc;

                acc.totalCost += tc;
                acc.totalPrice += totalPrice;
                acc.totalMarkup += markup;
                return acc;
            },
            { totalCost: 0, totalPrice: 0, totalMarkup: 0 }
        );
    }, [selectedSubitems]);

const renderNameCell = (sub: Subitem) => (
    <div className="flex items-center gap-1">
        <FileText size={11} className="text-gray-400 shrink-0" />
        <EditableCell
            value={sub.name}
            onChange={(v) => onUpdateSubitem(sub.id, { name: v })}
            placeholder="Subitem name"
            className="!text-left"
        />
        <div className="ml-auto flex items-center gap-1 shrink-0">
            {/* Timeline button — toggles showTimeline expanded row */}
            <button
                onClick={() => {
                    const isOpen = sub.showTimeline;
                    onUpdateSubitem(sub.id, {
                        showTimeline: !isOpen,
                        showPayments: false,
                        showSample: false,
                    });
                    setTableMode(sub.showTimeline ? null : "timeline");
                }}
                className={`flex items-center justify-center rounded-sm border p-1 transition active:scale-95 ${
                    sub.showTimeline
                        ? "border-[#7BCBD5] bg-[#7BCBD5] text-white"
                        : "border-teal-200 bg-transparent text-[#6db6bf] hover:bg-teal-100"
                }`}
                title="Timeline"
            >
                <Calendar size={15} />
            </button>

            {/* Payment button — switches column view */}
            <button
                onClick={() => setTableMode((prev) => prev === "payment" ? null : "payment")}
                className={`flex items-center justify-center rounded-sm border p-1 transition active:scale-95 ${
                    tableMode === "payment"
                        ? "border-[#f291b6] bg-[#f291b6] text-white"
                        : "border-pink-200 bg-transparent text-[#e87da6] hover:bg-pink-100"
                }`}
                title="Payments"
            >
                <CreditCard size={15} />
            </button>

            {/* Sample button — toggles showSample expanded row */}
            <button
                onClick={() => {
                    onUpdateSubitem(sub.id, {
                        showSample: !sub.showSample,
                        showTimeline: false,
                        showPayments: false,
                    });
                    setTableMode(sub.showSample ? null : null); // stays in current col view
                }}
                className={`flex items-center justify-center rounded-sm border p-1 transition active:scale-95 ${
                    sub.showSample
                        ? "border-[#d5a5ec] bg-[#d5a5ec] text-white"
                        : "border-purple-200 bg-transparent text-[#ac7ec2] hover:bg-purple-100"
                }`}
                title="Samples"
            >
                <Package size={15} />
            </button>

            {/* Delete button */}
            <button
                onClick={() => onDeleteSubitem(sub.id)}
                className="p-1 text-gray-300 transition-colors hover:text-red-400"
                title="Delete subitem"
            >
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
        const currencyRate = CURRENCY_RATES[sub.currency ?? "RMB"] ?? 0.2;
        const cSgd = cost * currencyRate;

        switch (key) {
            case "name":
                return renderNameCell(sub);

            case "people":
                return (
                    <AssigneeMultiSelect
                        profiles={profiles}
                        selectedIds={subitemAssigneeMap[sub.id] ?? []}
                        onChange={(ids) => onChangeSubitemAssignees(sub.id, ids)}
                    />
                );

            case "localOverseas":
                return (
                    <div className="flex items-center">
                    <StatusBadge
                        value={sub.localOverseas || "Local"}
                        onChange={(v) => onUpdateSubitem(sub.id, { localOverseas: v })}
                        options={localOverseasOpts}
                        colorMap={LOCALOVERSEAS_COLORS}
                        
                    /></div>
                );

            case "status":
                return (
                    <div className="flex items-center">
                    <StatusBadge
                        value={sub.status ?? ""}
                        onChange={(v) => onUpdateSubitem(sub.id, { status: v })}
                        options={statusOpts}
                        colorMap={SUBITEM_STATUS_COLORS}
                        
                    />
                    </div>
                );

            case "qty":
                return <EditableCell value={sub.qty} onChange={(v) => onUpdateSubitem(sub.id, { qty: v })} type="number" />;

            case "description":
                return (
                    <EditableCell
                        value={sub.description}
                        onChange={(v) => onUpdateSubitem(sub.id, { description: v })}
                        multiline
                    />
                );

            case "remarks":
                return (
                    <EditableCell
                        value={sub.remarks}
                        onChange={(v) => onUpdateSubitem(sub.id, { remarks: v })}
                        multiline
                    />
                );

            case "shipper":
                return (
                    <div className="flex items-center">
                    <StatusBadge
                        value={sub.shipper ?? ""}
                        onChange={(v) => onUpdateSubitem(sub.id, { shipper: v })}
                        options={shipperOpts}
                        colorMap={SHIPPER_COLORS}
                        small
                    />
                    </div>
                );

            case "supplier":
                return <EditableCell value={sub.supplier} onChange={(v) => onUpdateSubitem(sub.id, { supplier: v })} />;

            case "cost":
                return <EditableCell value={sub.cost} onChange={(v) => onUpdateSubitem(sub.id, { cost: v })} type="number" />;

            case "manpower":
                return (
                    <EditableCell
                        value={sub.manpower}
                        onChange={(v) => onUpdateSubitem(sub.id, { manpower: v })}
                        type="number"
                    />
                );

            case "ls":
                return <EditableCell value={sub.ls} onChange={(v) => onUpdateSubitem(sub.id, { ls: v })} type="number" />;

            case "os":
                return <EditableCell value={sub.os} onChange={(v) => onUpdateSubitem(sub.id, { os: v })} type="number" />;

            case "currency":
                return (
                    <div className="flex items-center">
                    <StatusBadge
                        value={sub.currency ?? "RMB"}
                        onChange={(v) => onUpdateSubitem(sub.id, { currency: v })}
                        options={currencyOpts}
                        colorMap={CURRENCY_COLORS}
                        
                    />
                    </div>
                );

            case "cSgd":
                return <div className="px-2 py-1 text-xs text-gray-800">{formatMoney(cSgd)}</div>;

            case "tc":
                return <div className="px-2 py-1 text-xs text-gray-800">{formatMoney(tc)}</div>;

            case "uc":
                return <div className="px-2 py-1 text-xs text-gray-800">{formatMoney(uc)}</div>;

            case "tcSgd":
                return <EditableCell value={sub.tcSgd} onChange={(v) => onUpdateSubitem(sub.id, { tcSgd: v })} type="number" />;

            case "price":
                return <div className="px-2 py-1 text-xs text-gray-800">{formatMoney(price)}</div>;

            case "up":
                return <EditableCell value={sub.up} onChange={(v) => onUpdateSubitem(sub.id, { up: v })} type="number" />;

            case "cnTracking":
                return <EditableCell value={sub.cnTracking} onChange={(v) => onUpdateSubitem(sub.id, { cnTracking: v })} />;

            case "sgTracking":
                return <EditableCell value={sub.sgTracking} onChange={(v) => onUpdateSubitem(sub.id, { sgTracking: v })} />;

            case "pl":
                return <EditableCell value={sub.pl ?? ""} onChange={(v) => onUpdateSubitem(sub.id, { pl: v })} type="number" />;

            case "sl":
                return <EditableCell value={sub.sl ?? ""} onChange={(v) => onUpdateSubitem(sub.id, { sl: v })} type="number" />;

            default:
                return null;
        }
    };

    const renderPaymentCell = (sub: Subitem, key: string) => {
        const qty = parseNumber(sub.qty);
        const cost = parseNumber(sub.cost);
        const total = cost * qty;
        const manpower = parseNumber(sub.manpower);
        const lsRmb = parseNumber(sub.ls);
        const totalC = total + manpower + lsRmb;
        const paymentAmount = parseNumber(sub.paymentAmount);
        const difference = paymentAmount - totalC;

        switch (key) {
            case "name":
                return renderNameCell(sub);
        
            case "paymentTerms":
                return <EditableCell value={sub.owner} onChange={(v) => onUpdateSubitem(sub.id, { owner: v })} />;

            case "paymentStatus":
                return (
                    <div className="flex items-center">
                    <StatusBadge
                        value={sub.paymentStatus ?? ""}
                        onChange={(v) => onUpdateSubitem(sub.id, { paymentStatus: v })}
                        options={paymentOpts}
                        colorMap={PAYMENT_STATUS_COLORS}
                        small
                    />
                    </div>
                );

            case "shipper":
                return (
                    <div className="flex items-center">
                    <StatusBadge
                        value={sub.shipper ?? ""}
                        onChange={(v) => onUpdateSubitem(sub.id, { shipper: v })}
                        options={shipperOpts}
                        colorMap={SHIPPER_COLORS}
                        small
                    />
                    </div>
                );

            case "supplier":
                return <EditableCell value={sub.supplier} onChange={(v) => onUpdateSubitem(sub.id, { supplier: v })} />;

            case "description":
                return <EditableCell value={sub.description} onChange={(v) => onUpdateSubitem(sub.id, { description: v })} multiline />;

            case "qty":
                return <EditableCell value={sub.qty} onChange={(v) => onUpdateSubitem(sub.id, { qty: v })} type="number" />;

            case "cost":
                return <EditableCell value={sub.cost} onChange={(v) => onUpdateSubitem(sub.id, { cost: v })} type="number" />;

            case "total":
                return <div className="px-2 py-1 text-xs text-gray-800">{formatMoney(total)}</div>;

            case "manpower":
                return <EditableCell value={sub.manpower} onChange={(v) => onUpdateSubitem(sub.id, { manpower: v })} type="number" />;

            case "lsRmb":
                return <EditableCell value={sub.ls} onChange={(v) => onUpdateSubitem(sub.id, { ls: v })} type="number" />;

            case "totalC":
                return <div className="px-2 py-1 text-xs text-gray-800">{formatMoney(totalC)}</div>;

            case "modeOfPayment":
                return (
                    <select
                        value={sub.modeOfPayment ?? ""}
                        onChange={(e) => onUpdateSubitem(sub.id, { modeOfPayment: e.target.value })}
                        className="w-full cursor-pointer bg-transparent text-xs outline-none"
                    >
                        {modeOpts.map((o) => (
                            <option key={o} value={o}>
                                {o || "–"}
                            </option>
                        ))}
                    </select>
                );

            case "orderNumber":
                return <EditableCell value={sub.orderNumber} onChange={(v) => onUpdateSubitem(sub.id, { orderNumber: v })} />;

            case "quantityProduced":
                return (
                    <EditableCell
                        value={sub.quantityProduced ?? ""}
                        onChange={(v) => onUpdateSubitem(sub.id, { quantityProduced: v })}
                        type="number"
                    />
                );

            case "sample":
                return <EditableCell value={sub.sample ?? ""} onChange={(v) => onUpdateSubitem(sub.id, { sample: v })} />;

            case "qtyFor":
                return <EditableCell value={sub.qtyFor ?? ""} onChange={(v) => onUpdateSubitem(sub.id, { qtyFor: v })} type="number" />;

            case "paymentAmount":
                return (
                    <EditableCell
                        value={sub.paymentAmount ?? ""}
                        onChange={(v) => onUpdateSubitem(sub.id, { paymentAmount: v })}
                        type="number"
                    />
                );

            case "difference":
                return <div className="px-2 py-1 text-xs text-gray-800">{formatMoney(difference)}</div>;

            case "paymentRemarks":
                return (
                    <EditableCell
                        value={sub.paymentRemarks ?? ""}
                        onChange={(v) => onUpdateSubitem(sub.id, { paymentRemarks: v })}
                        multiline
                    />
                );

            default:
                return null;
        }
    };

    const renderCell = (sub: Subitem, key: string) => {
        return tableMode === "payment" ? renderPaymentCell(sub, key) : renderSubitemCell(sub, key);
    };

    return (
        <div
            className="relative mb-2 ml-7 max-w-[calc(100vw-80px)]"
            style={{ borderLeft: `7px solid ${clientColor}` }}
            data-client-id={clientId}
        >
            {selectedSubitemIds.length > 0 && selectionBox.visible && (
                <div
                    className="fixed z-50 rounded-xl border border-gray-200 bg-white/95 px-4 py-3 text-xs text-gray-700 shadow-xl backdrop-blur-sm"
                    style={{
                        left: selectionBox.x,
                        top: selectionBox.y,
                    }}
                >
                    <div className="mb-2 font-semibold text-gray-900">
                        {selectedSubitemIds.length} subitem{selectedSubitemIds.length > 1 ? "s" : ""} selected
                    </div>

                    <div className="space-y-1 whitespace-nowrap">
                        <div>
                            Total price: <span className="font-medium">{selectionTotals.totalPrice.toFixed(2)}</span>
                        </div>
                        <div>
                            Total cost: <span className="font-medium">{selectionTotals.totalCost.toFixed(2)}</span>
                        </div>
                        <div>
                            Total markup:{" "}
                            <span className={`font-medium ${selectionTotals.totalMarkup >= 0 ? "text-green-600" : "text-red-500"}`}>
                                {selectionTotals.totalMarkup.toFixed(2)}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            setSelectedSubitemIds([]);
                            setSelectionBox((prev) => ({ ...prev, visible: false }));
                        }}
                        className="mt-2 text-[11px] text-gray-400 hover:text-gray-600"
                    >
                        Clear selection
                    </button>
                </div>
            )}

            <div className="">
                <table
                    className="table-fixed border-collapse"
                    style={{ width: totalTableWidth, minWidth: totalTableWidth }}
                >
                    <colgroup>
                        <col style={{ width: 44 }} />
                        {cols.map((col) => (
                            <col key={col.key} style={{ width: col.width }} />
                        ))}
                    </colgroup>

                    <thead>
                        <tr className="border-b border-r border-[#D0D4E4] bg-gray-50">
                            <th className="w-11 px-2 py-1 text-center">
                                
                            </th>

                            {cols.map((col) => (
                                <th
                                    key={col.key}
                                    className="overflow-hidden relative border-r border-[#D0D4E4] py-1 text-center text-[11px] font-semibold whitespace-nowrap text-gray-500 last:border-r-0"
                                >
                                    <div className="overflow-hidden text-ellipsis whitespace-nowrap px-2">{col.label}</div>

                                    <div
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            startResize(col.key, e.clientX);
                                        }}
                                        className="absolute top-0 right-0 h-full w-2 cursor-col-resize hover:bg-[#7BCBD5]/20"
                                    />
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {subitems.map((sub) => (
                            <React.Fragment key={sub.id}>
                                <tr className="group border-b border-[#D0D4E4] hover:bg-blue-50/30">
                                    <td className="border-r border-[#D0D4E4] px-2 py-1 text-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedSubitemIds.includes(sub.id)}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleSubitemSelection(sub.id, e.clientX, e.clientY);
                                            }}
                                            onChange={() => { }}
                                            className="h-3 w-3 cursor-pointer rounded accent-[#7BCBD5]"
                                        />
                                    </td>

                                    {cols.map((col) => (
                                        <td
                                            key={col.key}
                                            className="overflow-hidden align-middle border-r border-[#D0D4E4] px-2 py-1 last:border-r-0"
                                            style={{ minWidth: col.minWidth }}
                                        >
                                            {renderCell(sub, col.key)}
                                        </td>
                                    ))}
                                </tr>

                                {sub.showTimeline && (
                                    <ExpandedRow colSpan={cols.length + 1} tone="blue">
                                        <TimelineSection
                                            rows={sub.timelineRows?.length ? sub.timelineRows : DEFAULT_TIMELINE_ROWS}
                                            onUpdate={(rows) => onUpdateSubitem(sub.id, { timelineRows: rows })}
                                        />
                                    </ExpandedRow>
                                )}

                                {sub.showPayments && (
                                    <ExpandedRow colSpan={cols.length + 1} tone="green">
                                        <PaymentsSection
                                            subitem={sub}
                                            onUpdate={(u) => onUpdateSubitem(sub.id, u)}
                                            onUpdateClientStatus={() => { }}
                                        />
                                    </ExpandedRow>
                                )}

                                {sub.showSample && (
                                    <ExpandedRow colSpan={cols.length + 1} tone="purple">
                                        <SamplesSection subitem={sub} onUpdate={(u) => onUpdateSubitem(sub.id, u)} />
                                    </ExpandedRow>
                                )}
                            </React.Fragment>
                        ))}

                        <tr>
                            <td colSpan={cols.length + 1} className="px-3 py-2">
                                <button
                                    onClick={onAddSubitem}
                                    className="flex items-center gap-1.5 text-xs text-gray-400 transition duration-150 hover:text-[#7BCBD5] active:scale-95"
                                >
                                    <Plus size={12} />
                                    Add subitem
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}