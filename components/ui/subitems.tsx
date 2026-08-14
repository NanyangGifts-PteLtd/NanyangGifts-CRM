"use client";

import React, { useMemo, useState } from "react";
import type { Profile, Subitem } from "../../app/types";
import { Calendar, CreditCard, FileText, Package, Plus, Trash2, MoreHorizontal, EyeOff, Filter } from "lucide-react";
import { StatusBadge } from "./statusbadge";
import { EditableCell } from "./editablecell";
import { SamplesSection } from "./sample";
import { AssigneeMultiSelect } from "./assignee-multiselect";
import { TimelineSection, DEFAULT_TIMELINE_ROWS } from "./timeline";
import { CustomColumn } from "@/lib/custom-columns";

export const dynamic = "force-dynamic";

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

export const SUBITEM_COLS: ColumnDef[] = [
    { key: "name", label: "Subitem", width: 290, minWidth: 170 },
    { key: "people", label: "People", width: 82, minWidth: 7 },
    { key: "localOverseas", label: "Local/Overseas", width: 100, minWidth: 7 },
    { key: "status", label: "Status", width: 80, minWidth: 7 },
    { key: "qty", label: "Qty", width: 80, minWidth: 7 },
    { key: "description", label: "Description", width: 80, minWidth: 7 },
    { key: "remarks", label: "Remarks", width: 80, minWidth: 7 },
    { key: "shipper", label: "Shipper", width: 90, minWidth: 7 },
    { key: "supplier", label: "Supplier", width: 80, minWidth: 7 },
    { key: "cost", label: "Cost", width: 90, minWidth: 7 },
    { key: "currency", label: "Currency", width: 100, minWidth: 7 },
    { key: "manpower", label: "Manpower", width: 80, minWidth: 7 },
    { key: "ls", label: "LS", width: 57, minWidth: 7 },
    { key: "os", label: "OS", width: 56, minWidth: 7 },
    { key: "cSgd", label: "C-SGD", width: 57, minWidth: 7 },
    { key: "tc", label: "T.C", width: 58, minWidth: 7 },
    { key: "uc", label: "U.C", width: 90, minWidth: 7 },
    { key: "pl", label: "PL", width: 44, minWidth: 7 },
    { key: "sl", label: "SL", width: 44, minWidth: 7 },
    { key: "tcSgd", label: "TC-SGD", width: 70, minWidth: 7 },
    { key: "price", label: "Price", width: 80, minWidth: 7 },
    { key: "up", label: "U.P", width: 60, minWidth: 7 },
    { key: "cnTracking", label: "CN Tracking #", width: 130, minWidth: 7 },
    { key: "sgTracking", label: "SG Tracking #", width: 130, minWidth: 7 },
    
];

export const PAYMENT_COLS: ColumnDef[] = [
    { key: "name", label: "Subitem", width: 290, minWidth: 170 },
    { key: "payment", label: "Payment", width: 82, minWidth: 7 },
    { key: "paymentStatus", label: "Status", width: 100, minWidth: 7 },
    { key: "shipper", label: "Shipper", width: 80, minWidth: 7 },
    { key: "supplier", label: "Supplier", width: 80, minWidth: 7 },
    { key: "description", label: "Description", width: 80, minWidth: 7 },
    { key: "qty", label: "Qty", width: 40, minWidth: 7 },
    { key: "cost", label: "Cost", width: 40, minWidth: 7 },
    { key: "totalUc", label: "Total UC", width: 90, minWidth: 7 },
    { key: "manpower", label: "Manpower / 版费 / Printing (SGD)", width: 80, minWidth: 7 },
    { key: "manpowerRmb", label: "Manpower (RMB)", width: 90, minWidth: 7 },
    { key: "ls", label: "LS (SGD)", width: 50, minWidth: 7 },
    { key: "lsRmb", label: "LS (RMB)", width: 50, minWidth: 7 },
    { key: "totalC", label: "Total Cost", width: 80, minWidth: 7 },
    { key: "modeOfPayment", label: "Mode of Payment", width: 115, minWidth: 7 },
    { key: "orderNumber", label: "Order #", width: 115, minWidth: 7 },
    { key: "quantityProduced", label: "Qty Ordered", width: 90, minWidth: 7 },
    { key: "sample", label: "Sample", width: 44, minWidth: 7 },
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
    paymentOptions: OptionEntry[];
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
    onAddPayment?: (name: string) => void | Promise<void>;
    onDeletePayment?: (name: string) => void | Promise<void>;
    onAddPaymentStatus?: (name: string) => void | Promise<void>;
    onDeletePaymentStatus?: (name: string) => void | Promise<void>;
    onAddModeOfPayment?: (name: string) => void | Promise<void>;
    onDeleteModeOfPayment?: (name: string) => void | Promise<void>;
    onUpdateOptionColor?: (code: string, name: string, color: string) => void | Promise<void>;
    onFilterColumn?: (column: string) => void;
    subitemCustomCols: CustomColumn[];
    onDeleteSubitemCustomCol: (id: string) => void;
    onRequestAddSubitemCol: () => void;
    currentUserRole?: string | null;
    currentUserId?: string | null;
    hiddenColumnKeys: Set<string>;
    onHideColumn: (key: string) => void;
    onSetColumnVisibility: (key: string, visible: boolean) => void;
    onPushToShipperView?: (subitemId: string) => Promise<void> | void;
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

function ExpandedRow({
    colSpan,
    tone = "blue",
    children,
}: {
    colSpan: number;
    tone?: "blue" | "green" | "purple";
    children: React.ReactNode;
}) {
    const cls =
        tone === "green"
            ? "bg-green-50/30"
            : tone === "purple"
                ? "bg-purple-50/30"
                : "bg-blue-50/30";

    return (
        <tr>
            <td colSpan={colSpan} className={`p-0 ${cls}`}>
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
    paymentOptions,
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
    onAddPayment,
    onDeletePayment,
    onAddPaymentStatus,
    onDeletePaymentStatus,
    onAddModeOfPayment,
    onDeleteModeOfPayment,
    onUpdateOptionColor,
    onFilterColumn,
    subitemCustomCols,
    onDeleteSubitemCustomCol,
    onRequestAddSubitemCol,
    currentUserRole,
    currentUserId,
    hiddenColumnKeys,
    onHideColumn,
    onSetColumnVisibility,
    onPushToShipperView,
}: SubitemProps) {
    const [tableMode, setTableMode] = useState<TableMode | null>(null);
    const [subitemCols, setSubitemCols] = useState<ColumnDef[]>([...SUBITEM_COLS]);
    const [paymentCols, setPaymentCols] = useState<ColumnDef[]>([...PAYMENT_COLS]);
    const [selectedSubitemIds, setSelectedSubitemIds] = useState<string[]>([]);
    const [selectionBox, setSelectionBox] = useState({ x: 0, y: 0, visible: false });
    const [draggedColumnKey, setDraggedColumnKey] = useState<string | null>(null);
    const [dragOverColumnKey, setDragOverColumnKey] = useState<string | null>(null);
    const [dragOverColumnEdge, setDragOverColumnEdge] = useState<'left' | 'right' | null>(null);
    const [openColumnMenu, setOpenColumnMenu] = useState<string | null>(null);

    const [pushingSubitemId, setPushingSubitemId] = useState<string | null>(null);

    const setDragPreview = (event: React.DragEvent, source: HTMLElement) => {
        if (!event.dataTransfer) return;
        const bounds = source.getBoundingClientRect();
        const preview = document.createElement('div');
        preview.style.position = 'fixed';
        preview.style.left = '-10000px';
        preview.style.top = '-10000px';
        preview.style.width = `${bounds.width}px`;
        preview.style.maxWidth = `${bounds.width}px`;
        preview.style.height = `${bounds.height + 56}px`;
        preview.style.overflow = 'hidden';
        preview.style.opacity = '1';
        preview.style.pointerEvents = 'none';
        preview.style.background = '#ffffff';
        preview.style.border = '1px solid #8edbe7';
        preview.style.borderRadius = '3px';
        preview.style.boxShadow = '0 8px 20px rgba(15, 23, 42, 0.22)';
        preview.innerHTML = `<div style="height:${bounds.height}px;display:flex;align-items:center;justify-content:center;padding:0 8px;box-sizing:border-box;background:#f8fafc;color:#475569;font-weight:600;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-bottom:1px solid #d0d4e4">${source.textContent?.trim() ?? ''}</div>`;
        const table = source.closest('table');
        const columnIndex = Array.from(source.parentElement?.children ?? []).indexOf(source);
        Array.from(table?.tBodies[0]?.rows ?? []).slice(0, 2).forEach((row, index) => {
            const cell = row.cells[columnIndex];
            if (!cell) return;
            const cellPreview = document.createElement('div');
            cellPreview.style.width = `${bounds.width}px`;
            cellPreview.style.minWidth = `${bounds.width}px`;
            cellPreview.style.height = '28px';
            cellPreview.style.boxSizing = 'border-box';
            cellPreview.style.overflow = 'hidden';
            cellPreview.style.border = '0';
            cellPreview.style.borderBottom = '1px solid #d0d4e4';
            cellPreview.style.display = 'flex';
            cellPreview.style.alignItems = 'center';
            cellPreview.style.justifyContent = 'center';
            cellPreview.style.padding = '0';
            cellPreview.style.background = index % 2 === 0 ? '#ffffff' : '#f8fafc';
            cellPreview.style.fontSize = '12px';
            cellPreview.style.whiteSpace = 'nowrap';
            cellPreview.style.textOverflow = 'ellipsis';
            const cellContent = cell.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
            if (cellContent) {
                cellContent.style.width = '100%';
                cellContent.style.height = '100%';
                cellContent.style.minWidth = '0';
                cellContent.style.opacity = '1';
                cellContent.querySelectorAll<HTMLElement>('*').forEach((element) => {
                    element.style.opacity = '1';
                });
                cellPreview.appendChild(cellContent);
            } else {
                cellPreview.style.padding = '0 8px';
                cellPreview.style.color = '#334155';
                cellPreview.textContent = cell.textContent?.trim() ?? '';
            }
            preview.appendChild(cellPreview);
        });
        document.body.appendChild(preview);
        event.dataTransfer.setDragImage(preview, Math.min(bounds.width / 2, 90), Math.min(bounds.height / 2, 16));
        window.setTimeout(() => preview.remove(), 0);
    };

    const reorderTableCols = (
        cols: ColumnDef[],
        draggedKey: string,
        targetKey: string,
        storageKey: string,
        eventName: string,
        setCols: React.Dispatch<React.SetStateAction<ColumnDef[]>>
    ) => {
        const reorderable = cols.filter((col) => col.key !== 'name');
        const from = reorderable.findIndex((col) => col.key === draggedKey);
        const to = reorderable.findIndex((col) => col.key === targetKey);
        if (from === -1 || to === -1) return;

        const reordered = [...reorderable];
        const [moved] = reordered.splice(from, 1);
        reordered.splice(to, 0, moved);

        const next = [cols.find((col) => col.key === 'name') ?? cols[0], ...reordered];
        setCols(next);

        try {
            const order = next.map((col) => col.key);
            localStorage.setItem(`${storageKey}:local`, JSON.stringify(order));
            localStorage.setItem(`${storageKey}:local_owner`, String(currentUserId ?? 'anon'));
            if (currentUserId) localStorage.setItem(`${storageKey}:${currentUserId}`, JSON.stringify(order));
            window.dispatchEvent(new CustomEvent(eventName, { detail: order }));
            window.dispatchEvent(new CustomEvent(eventName.replace('Reordered', 'Changed'), { detail: Object.fromEntries(next.map((col) => [col.key, col.width])) }));
        } catch {}

        if (currentUserId) {
            void import('@/lib/user-settings')
                .then(({ saveUserSetting }) => saveUserSetting(storageKey, next.map((col) => col.key)))
                .catch((error) => console.warn('Failed to save column arrangement', error));
        }
    };

    const isPm = currentUserRole === "pm" || currentUserRole === "dev" || currentUserRole === "director";

    const cols = tableMode === "payment" ? paymentCols : subitemCols;
    const tablePrefix = tableMode === "payment" ? "payment" : "subitem";
    const visibleCols = cols.filter((col) => col.key === "name" || !hiddenColumnKeys.has(`${tablePrefix}:${col.key}`));
    const visibleCustomCols = subitemCustomCols.filter((col) => !hiddenColumnKeys.has(`subitem:custom:${col.id}`));

    React.useEffect(() => {
        try {
            const raw = localStorage.getItem('colOrder:subitems:local');
            if (raw) {
                const owner = localStorage.getItem('colOrder:subitems:local_owner');
                if (!currentUserId || !owner || owner === currentUserId) {
                    const order = JSON.parse(raw) as string[];
                    if (Array.isArray(order) && order.length > 0) {
                        setSubitemCols((prev) => {
                            const middle = prev.filter((c) => c.key !== 'name');
                            const ordered = order
                                .map((key) => middle.find((c) => c.key === key))
                                .filter(Boolean) as typeof prev;
                            const remaining = middle.filter((c) => !order.includes(c.key));
                            const nameColumn = prev.find((c) => c.key === 'name') ?? prev[0];
                            return nameColumn ? [nameColumn, ...ordered, ...remaining] : [...ordered, ...remaining];
                        });
                    }
                }
            }
        } catch {}

        try {
            const raw = localStorage.getItem('colOrder:payments:local');
            if (raw) {
                const owner = localStorage.getItem('colOrder:payments:local_owner');
                if (!currentUserId || !owner || owner === currentUserId) {
                    const order = JSON.parse(raw) as string[];
                    if (Array.isArray(order) && order.length > 0) {
                        setPaymentCols((prev) => {
                            const middle = prev.filter((c) => c.key !== 'name');
                            const ordered = order
                                .map((key) => middle.find((c) => c.key === key))
                                .filter(Boolean) as typeof prev;
                            const remaining = middle.filter((c) => !order.includes(c.key));
                            const nameColumn = prev.find((c) => c.key === 'name') ?? prev[0];
                            return nameColumn ? [nameColumn, ...ordered, ...remaining] : [...ordered, ...remaining];
                        });
                    }
                }
            }
        } catch {}
    }, [currentUserId]);

    React.useEffect(() => {
        if (!currentUserId) return;
        let mounted = true;

        const applyOrder = (setCols: React.Dispatch<React.SetStateAction<ColumnDef[]>>, order: unknown) => {
            if (!Array.isArray(order) || order.length === 0) return;
            setCols((prev) => {
                const middle = prev.filter((col) => col.key !== 'name');
                const ordered = order
                    .map((key) => middle.find((col) => col.key === key))
                    .filter(Boolean) as ColumnDef[];
                const remaining = middle.filter((col) => !order.includes(col.key));
                const nameColumn = prev.find((col) => col.key === 'name') ?? prev[0];
                return nameColumn ? [nameColumn, ...ordered, ...remaining] : [...ordered, ...remaining];
            });
        };

        (async () => {
            try {
                const { loadUserSetting } = await import('@/lib/user-settings');
                const [subitemOrder, paymentOrder] = await Promise.all([
                    loadUserSetting('colOrder:subitems'),
                    loadUserSetting('colOrder:payments'),
                ]);
                if (!mounted) return;
                applyOrder(setSubitemCols, subitemOrder);
                applyOrder(setPaymentCols, paymentOrder);
            } catch (error) {
                console.warn('Failed to load saved column arrangements', error);
            }
        })();

        return () => { mounted = false; };
    }, [currentUserId]);

    const totalTableWidth = useMemo(() => {
        const baseCols = 44 + visibleCols.reduce((s, c) => s + c.width, 0);
        const customColsWidth = visibleCustomCols.length * CUSTOM_COL_WIDTH;
        const addBtnWidth = 32;
        return baseCols + customColsWidth + addBtnWidth;
    }, [visibleCols, visibleCustomCols]);

    const startResize = (key: string, startX: number) => {
        const activeCols = tableMode === "payment" ? paymentCols : subitemCols;
        const startCol = activeCols.find((c) => c.key === key);
        if (!startCol) return;
        const startWidth = startCol.width;

        const onMouseMove = (e: MouseEvent) => {
            const delta = e.clientX - startX;
            if (tableMode === "payment") {
                const newCols = paymentCols.map((c) => (c.key === key ? { ...c, width: Math.max(c.minWidth ?? 50, startWidth + delta) } : c));
                setPaymentCols(newCols);
                try { window.localStorage.setItem(`colWidths:payments:${currentUserId}`, JSON.stringify(Object.fromEntries(newCols.map(c=>[c.key,c.width])))); } catch {}
                window.dispatchEvent(new CustomEvent('paymentColsChanged', { detail: Object.fromEntries(newCols.map(c=>[c.key,c.width])) }));
            } else {
                const newCols = subitemCols.map((c) => (c.key === key ? { ...c, width: Math.max(c.minWidth ?? 50, startWidth + delta) } : c));
                setSubitemCols(newCols);
                try { window.localStorage.setItem(`colWidths:subitems:${currentUserId}`, JSON.stringify(Object.fromEntries(newCols.map(c=>[c.key,c.width])))); } catch {}
                window.dispatchEvent(new CustomEvent('subitemColsChanged', { detail: Object.fromEntries(newCols.map(c=>[c.key,c.width])) }));
            }
        };

        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    };

    // Persist column widths per-user in localStorage
    React.useEffect(() => {
        // try local generic cache immediately for fast SPA nav
        try {
            const raw = localStorage.getItem('colWidths:subitems:local');
            if (raw) {
                const owner = localStorage.getItem('colWidths:subitems:local_owner');
                if (!currentUserId) {
                    const map = JSON.parse(raw) as Record<string, number>;
                    setSubitemCols((prev) => prev.map((c) => ({ ...c, width: map[c.key] ?? c.width })));
                } else if (owner && owner === currentUserId) {
                    const map = JSON.parse(raw) as Record<string, number>;
                    setSubitemCols((prev) => prev.map((c) => ({ ...c, width: map[c.key] ?? c.width })));
                } else if (currentUserId && owner && owner !== currentUserId) {
                    // reset to defaults to avoid leaking other user's settings
                    setSubitemCols(SUBITEM_COLS.map((c) => ({ ...c })));
                }
            }
        } catch {}

        if (!currentUserId) return;
        let mounted = true;
        (async () => {
            try {
                const { loadUserSetting } = await import('@/lib/user-settings');
                const value = await loadUserSetting('colWidths:subitems');
                if (!mounted) return;
                if (value && typeof value === 'object') {
                    setSubitemCols((prev) => prev.map((c) => ({ ...c, width: value[c.key] ?? c.width })));
                } else {
                    try {
                        const raw = localStorage.getItem(`colWidths:subitems:${currentUserId}`);
                        if (raw) {
                            const map = JSON.parse(raw) as Record<string, number>;
                            setSubitemCols((prev) => prev.map((c) => ({ ...c, width: map[c.key] ?? c.width })));
                        }
                    } catch {}
                }
            } catch (e) {
                console.error('Failed to load subitem column widths', e);
            }
        })();
        return () => { mounted = false; };
    }, [currentUserId]);

    React.useEffect(() => {
        // try generic local cache for payments on mount
        try {
            const raw = localStorage.getItem('colWidths:payments:local');
            if (raw) {
                const owner = localStorage.getItem('colWidths:payments:local_owner');
                if (!currentUserId) {
                    const map = JSON.parse(raw) as Record<string, number>;
                    setPaymentCols((prev) => prev.map((c) => ({ ...c, width: map[c.key] ?? c.width })));
                } else if (owner && owner === currentUserId) {
                    const map = JSON.parse(raw) as Record<string, number>;
                    setPaymentCols((prev) => prev.map((c) => ({ ...c, width: map[c.key] ?? c.width })));
                } else if (currentUserId && owner && owner !== currentUserId) {
                    setPaymentCols(PAYMENT_COLS.map((c) => ({ ...c })));
                }
            }
        } catch {}

        if (!currentUserId) return;
        // debounce server saves
        const t = window.setTimeout(() => {
            (async () => {
                try {
                    const { saveUserSetting } = await import('@/lib/user-settings');
                    const map = Object.fromEntries(subitemCols.map((c) => [c.key, c.width]));
                    try { localStorage.setItem(`colWidths:subitems:${currentUserId}`, JSON.stringify(map)); } catch {}
                    try { localStorage.setItem('colWidths:subitems:local', JSON.stringify(map)); } catch {}
                    try { localStorage.setItem('colWidths:subitems:local_owner', String(currentUserId ?? 'anon')); } catch {}
                    await saveUserSetting('colWidths:subitems', map);
                } catch (e) {
                    console.warn('Failed to save subitem column widths', e);
                }
            })();
        }, 800);

        return () => window.clearTimeout(t);
    }, [subitemCols, currentUserId]);

    React.useEffect(() => {
        if (!currentUserId) return;
        let mounted = true;
        (async () => {
            try {
                const { loadUserSetting } = await import('@/lib/user-settings');
                const value = await loadUserSetting('colWidths:payments');
                if (!mounted) return;
                if (value && typeof value === 'object') {
                    setPaymentCols((prev) => prev.map((c) => ({ ...c, width: value[c.key] ?? c.width })));
                } else {
                    try {
                        const raw = localStorage.getItem(`colWidths:payments:${currentUserId}`);
                        if (raw) {
                            const map = JSON.parse(raw) as Record<string, number>;
                            setPaymentCols((prev) => prev.map((c) => ({ ...c, width: map[c.key] ?? c.width })));
                        }
                    } catch {}
                }
            } catch (e) {
                console.error('Failed to load payment column widths', e);
            }
        })();
        return () => { mounted = false; };
    }, [currentUserId]);

    React.useEffect(() => {
        if (!currentUserId) return;
        // debounce server saves
        const t2 = window.setTimeout(() => {
            (async () => {
                try {
                    const { saveUserSetting } = await import('@/lib/user-settings');
                    const map = Object.fromEntries(paymentCols.map((c) => [c.key, c.width]));
                    try { localStorage.setItem(`colWidths:payments:${currentUserId}`, JSON.stringify(map)); } catch {}
                    try { localStorage.setItem('colWidths:payments:local', JSON.stringify(map)); } catch {}
                    try { localStorage.setItem('colWidths:payments:local_owner', String(currentUserId ?? 'anon')); } catch {}
                    await saveUserSetting('colWidths:payments', map);
                } catch (e) {
                    console.warn('Failed to save payment column widths', e);
                }
            })();
        }, 800);

        return () => window.clearTimeout(t2);
    }, [paymentCols, currentUserId]);

    // Listen for auth changes (SPA sign-in/out) and reload/reset widths accordingly
    React.useEffect(() => {
        const handler = (e: any) => {
            const newUserId = e?.detail ?? null;
            try {
                const rawSub = localStorage.getItem('colWidths:subitems:local');
                if (rawSub) {
                    const owner = localStorage.getItem('colWidths:subitems:local_owner');
                    if (!newUserId) {
                        const map = JSON.parse(rawSub) as Record<string, number>;
                        setSubitemCols((prev) => prev.map((c) => ({ ...c, width: map[c.key] ?? c.width })));
                    } else if (owner && owner === newUserId) {
                        const map = JSON.parse(rawSub) as Record<string, number>;
                        setSubitemCols((prev) => prev.map((c) => ({ ...c, width: map[c.key] ?? c.width })));
                    } else if (newUserId && owner && owner !== newUserId) {
                        setSubitemCols(SUBITEM_COLS.map((c) => ({ ...c })));
                    }
                }
            } catch {}

            try {
                const rawPay = localStorage.getItem('colWidths:payments:local');
                if (rawPay) {
                    const owner = localStorage.getItem('colWidths:payments:local_owner');
                    if (!newUserId) {
                        const map = JSON.parse(rawPay) as Record<string, number>;
                        setPaymentCols((prev) => prev.map((c) => ({ ...c, width: map[c.key] ?? c.width })));
                    } else if (owner && owner === newUserId) {
                        const map = JSON.parse(rawPay) as Record<string, number>;
                        setPaymentCols((prev) => prev.map((c) => ({ ...c, width: map[c.key] ?? c.width })));
                    } else if (newUserId && owner && owner !== newUserId) {
                        setPaymentCols(PAYMENT_COLS.map((c) => ({ ...c })));
                    }
                }
            } catch {}

            // If a new user signed in, attempt to load their per-user saved widths from server/localStorage
            if (newUserId) {
                (async () => {
                    try {
                        const { loadUserSetting } = await import('@/lib/user-settings');
                        const val = await loadUserSetting('colWidths:subitems');
                        if (val && typeof val === 'object') {
                            setSubitemCols((prev) => prev.map((c) => ({ ...c, width: val[c.key] ?? c.width })));
                        } else {
                            try {
                                const raw = localStorage.getItem(`colWidths:subitems:${newUserId}`);
                                if (raw) {
                                    const map = JSON.parse(raw) as Record<string, number>;
                                    setSubitemCols((prev) => prev.map((c) => ({ ...c, width: map[c.key] ?? c.width })));
                                }
                            } catch {}
                        }

                        const val2 = await loadUserSetting('colWidths:payments');
                        if (val2 && typeof val2 === 'object') {
                            setPaymentCols((prev) => prev.map((c) => ({ ...c, width: val2[c.key] ?? c.width })));
                        } else {
                            try {
                                const raw2 = localStorage.getItem(`colWidths:payments:${newUserId}`);
                                if (raw2) {
                                    const map2 = JSON.parse(raw2) as Record<string, number>;
                                    setPaymentCols((prev) => prev.map((c) => ({ ...c, width: map2[c.key] ?? c.width })));
                                }
                            } catch {}
                        }
                    } catch (e) {
                        // ignore
                    }
                })();
            }
        };

        window.addEventListener('authChanged', handler as EventListener);
        return () => window.removeEventListener('authChanged', handler as EventListener);
    }, []);

    // Listen for column changes from other SubitemsTable instances and update
    React.useEffect(() => {
        function onSubitemCols(e: any) {
            try {
                const detail = e?.detail ?? {};
                setSubitemCols((prev) => prev.map((c) => ({ ...c, width: detail[c.key] ?? c.width })));
            } catch {}
        }

        function onPaymentCols(e: any) {
            try {
                const detail = e?.detail ?? {};
                setPaymentCols((prev) => prev.map((c) => ({ ...c, width: detail[c.key] ?? c.width })));
            } catch {}
        }

        function onSubitemOrder(e: any) {
            try {
                const order = e?.detail ?? [];
                if (!Array.isArray(order) || order.length === 0) return;
                setSubitemCols((prev) => {
                    const middle = prev.filter((c) => c.key !== 'name');
                    const ordered = order
                        .map((key) => middle.find((c) => c.key === key))
                        .filter(Boolean) as typeof prev;
                    const remaining = middle.filter((c) => !order.includes(c.key));
                    const nameColumn = prev.find((c) => c.key === 'name') ?? prev[0];
                    return nameColumn ? [nameColumn, ...ordered, ...remaining] : [...ordered, ...remaining];
                });
            } catch {}
        }

        function onPaymentOrder(e: any) {
            try {
                const order = e?.detail ?? [];
                if (!Array.isArray(order) || order.length === 0) return;
                setPaymentCols((prev) => {
                    const middle = prev.filter((c) => c.key !== 'name');
                    const ordered = order
                        .map((key) => middle.find((c) => c.key === key))
                        .filter(Boolean) as typeof prev;
                    const remaining = middle.filter((c) => !order.includes(c.key));
                    const nameColumn = prev.find((c) => c.key === 'name') ?? prev[0];
                    return nameColumn ? [nameColumn, ...ordered, ...remaining] : [...ordered, ...remaining];
                });
            } catch {}
        }

        window.addEventListener('subitemColsChanged', onSubitemCols as EventListener);
        window.addEventListener('paymentColsChanged', onPaymentCols as EventListener);
        window.addEventListener('subitemColsReordered', onSubitemOrder as EventListener);
        window.addEventListener('paymentColsReordered', onPaymentOrder as EventListener);
        return () => {
            window.removeEventListener('subitemColsChanged', onSubitemCols as EventListener);
            window.removeEventListener('paymentColsChanged', onPaymentCols as EventListener);
            window.removeEventListener('subitemColsReordered', onSubitemOrder as EventListener);
            window.removeEventListener('paymentColsReordered', onPaymentOrder as EventListener);
        };
    }, []);

    const toggleSubitemSelection = (subitemId: string, x: number, y: number) => {
        setSelectedSubitemIds((prev) =>
            prev.includes(subitemId) ? prev.filter((id) => id !== subitemId) : [...prev, subitemId]
        );
        setSelectionBox({ x: x + 16, y: y + 16, visible: true });
    };

    const selectedSubitems = useMemo(
        () => subitems.filter((s) => selectedSubitemIds.includes(s.id)),
        [subitems, selectedSubitemIds]
    );

    const selectionTotals = useMemo(
        () =>
            selectedSubitems.reduce(
                (acc, sub) => {
                    const qty = parseNumber(sub.qty);
                    const tc =
                        parseNumber(sub.cost) +
                        parseNumber(sub.manpower) +
                        parseNumber(sub.ls) +
                        parseNumber(sub.os) +
                        parseNumber(sub.tcSgd);
                    const totalPrice = parseNumber(sub.up) * qty;
                    acc.totalCost += tc;
                    acc.totalPrice += totalPrice;
                    acc.totalMarkup += totalPrice - tc;
                    return acc;
                },
                { totalCost: 0, totalPrice: 0, totalMarkup: 0 }
            ),
        [selectedSubitems]
    );

    async function handlePushToShipperView(subitemId: string) {
        try {
            setPushingSubitemId(subitemId);

            if (onPushToShipperView) {
                await onPushToShipperView(subitemId);
            } else {
                const response = await fetch("/api/shipper/push", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        subitemIds: [subitemId],
                    }),
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result?.error || "Failed to push to shipper view.");
                }
            }

        } catch (error: any) {
            alert(error?.message || "Failed to push to shipper view.");
        } finally {
            setPushingSubitemId(null);
        }
    }

    const renderNameCell = (sub: Subitem) => (
        <div className="flex items-center gap-1 h-[30px]">
            <FileText size={11} className="text-gray-400 shrink-0" />
            <EditableCell
                value={sub.name}
                onChange={(v) => onUpdateSubitem(sub.id, { name: v })}
                placeholder="Subitem name"
                className="!justify-start"
            />

            <div className="ml-auto flex items-center gap-1 shrink-0">
                <button
                    onClick={() => {
                        onUpdateSubitem(sub.id, {
                            showTimeline: !sub.showTimeline,
                            showPayments: false,
                            showSample: false,
                        });
                        setTableMode(sub.showTimeline ? null : "timeline");
                    }}
                    className={`flex items-center justify-center rounded-sm border p-1 transition active:scale-95 ${sub.showTimeline
                            ? "border-[#7BCBD5] bg-[#7BCBD5] text-white"
                            : "border-teal-200 bg-transparent text-[#6db6bf] hover:bg-teal-100"
                        }`}
                    title="Timeline"
                >
                    <Calendar size={15} />
                </button>

                <button
                    onClick={() => setTableMode((prev) => (prev === "payment" ? null : "payment"))}
                    className={`flex items-center justify-center rounded-sm border p-1 transition active:scale-95 ${tableMode === "payment"
                            ? "border-[#f291b6] bg-[#f291b6] text-white"
                            : "border-pink-200 bg-transparent text-[#e87da6] hover:bg-pink-100"
                        }`}
                    title="Payments"
                >
                    <CreditCard size={15} />
                </button>

                <button
                    onClick={() => {
                        onUpdateSubitem(sub.id, {
                            showSample: !sub.showSample,
                            showTimeline: false,
                            showPayments: false,
                        });
                    }}
                    className={`flex items-center justify-center rounded-sm border p-1 transition active:scale-95 ${sub.showSample
                            ? "border-[#d5a5ec] bg-[#d5a5ec] text-white"
                            : "border-purple-200 bg-transparent text-[#ac7ec2] hover:bg-purple-100"
                        }`}
                    title="Samples"
                >
                    <Package size={15} />
                </button>

                {isPm ? (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            void handlePushToShipperView(sub.id);
                        }}
                        disabled={pushingSubitemId === sub.id}
                        className="rounded-sm border border-teal-200 px-2 py-1 text-[11px] font-medium text-teal-500 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                        title="Push to shipper view"
                    >
                        {pushingSubitemId === sub.id ? "Pushing..." : "Push"}
                    </button>
                ) : null}

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
        const cSgd = cost * (CURRENCY_RATES[sub.currency ?? "RMB"] ?? 0.2);
        const tcSgd = cSgd * qty;
        const tc = cost + manpower + ls + os + tcSgd;
        const uc = qty > 0 ? tc / qty : null;
        const price = parseNumber(sub.up) * qty;
    
        
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
                    <div className="overflow-hidden whitespace-nowrap text-ellipsis !text-center border-r border-[#D0D4E4] p-0 h-[33.1px] flex-shrink-0 transition transform active:scale-95 duration-150">
                        <StatusBadge
                            value={sub.localOverseas ?? ""}
                            onChange={(v) => onUpdateSubitem(sub.id, { localOverseas: v })}
                            options={localOverseasOptions}
                            onAddOption={onAddLocalOverseas}
                            onDeleteOption={onDeleteLocalOverseas}
                            manageLabel="local overseas"
                            onUpdateOptionColor={(name, color) => onUpdateOptionColor?.('local_overseas', name, color)}
                            small
                        />
                    </div>
                );
            case "status":
                return (
                    <div className="overflow-hidden whitespace-nowrap text-ellipsis !text-center border-r border-[#D0D4E4] p-0 h-[33.1px] flex-shrink-0 transition transform active:scale-95 duration-150">
                        <StatusBadge
                            value={sub.status ?? ""}
                            onChange={(v) => onUpdateSubitem(sub.id, { status: v })}
                            options={subitemStatusOptions}
                            onAddOption={onAddSubitemStatus}
                            onDeleteOption={onDeleteSubitemStatus}
                            manageLabel="subitem status"
                            onUpdateOptionColor={(name, color) => onUpdateOptionColor?.('subitem_status', name, color)}
                            small
                        />
                    </div>
                );
            case "qty":
                return <EditableCell value={sub.qty} onChange={(v) => onUpdateSubitem(sub.id, { qty: v })} type="number" />;
            case "description":
                return <EditableCell className="!justify-start" value={sub.description} onChange={(v) => onUpdateSubitem(sub.id, { description: v })} multiline />;
            case "remarks":
                return <EditableCell value={sub.remarks} onChange={(v) => onUpdateSubitem(sub.id, { remarks: v })} multiline />;
            case "shipper":
                return (
                    <div className="overflow-hidden whitespace-nowrap text-ellipsis !text-center border-r border-[#D0D4E4] p-0 h-[33.1px] flex-shrink-0 transition transform active:scale-95 duration-150">
                        <StatusBadge
                            value={sub.shipper ?? ""}
                            onChange={(v) => onUpdateSubitem(sub.id, { shipper: v })}
                            options={shipperOptions}
                            onAddOption={onAddShipper}
                            onDeleteOption={onDeleteShipper}
                            manageLabel="shipper"
                            onUpdateOptionColor={(name, color) => onUpdateOptionColor?.('shipper', name, color)}
                            small
                        />
                    </div>
                );
            case "supplier":
                return <EditableCell value={sub.supplier} onChange={(v) => onUpdateSubitem(sub.id, { supplier: v })} />;
            case "cost":
                return <EditableCell value={sub.cost} onChange={(v) => onUpdateSubitem(sub.id, { cost: v })} type="number" />;
            case "currency":
                return (
                    <div className="overflow-hidden whitespace-nowrap text-ellipsis !text-center border-r border-[#D0D4E4] p-0 h-[33.1px] flex-shrink-0 transition transform active:scale-95 duration-150">
                        <StatusBadge
                            value={sub.currency ?? ""}
                            onChange={(v) => onUpdateSubitem(sub.id, { currency: v })}
                            options={currencyOptions}
                            onAddOption={onAddCurrency}
                            onDeleteOption={onDeleteCurrency}
                            manageLabel="currency"
                            onUpdateOptionColor={(name, color) => onUpdateOptionColor?.('currency', name, color)}
                            small
                        />
                    </div>
                );
            case "manpower":
                return <EditableCell value={sub.manpower} onChange={(v) => onUpdateSubitem(sub.id, { manpower: v })} type="number" />;
            case "ls":
                return <EditableCell value={sub.ls} onChange={(v) => onUpdateSubitem(sub.id, { ls: v })} type="number" />;
            case "os":
                return <EditableCell value={sub.os} onChange={(v) => onUpdateSubitem(sub.id, { os: v })} type="number" />;
            
            case "cSgd":
                return <div className="flex justify-center text-xs text-gray-800">{formatMoney(cSgd)}</div>;
            case "tc":
                return <div className="flex justify-center text-xs text-gray-800">{formatMoney(tc)}</div>;
            case "uc":
                return <div className="flex justify-center text-xs text-gray-800">{formatMoney(uc)}</div>;
            case "pl":
                return <EditableCell value={sub.pl ?? ""} onChange={(v) => onUpdateSubitem(sub.id, { pl: v })} type="number" />;
            case "sl":
                return <EditableCell value={sub.sl ?? ""} onChange={(v) => onUpdateSubitem(sub.id, { sl: v })} type="number" />;
                case "tcSgd":
                return <div className="flex justify-center text-xs text-gray-800">{formatMoney(tcSgd)}</div>;
            case "price":
                return <div className="flex justify-center text-xs text-gray-800">{formatMoney(price)} </div>;
            case "up":
                return <EditableCell value={sub.up} onChange={(v) => onUpdateSubitem(sub.id, { up: v })} type="number" />;
            case "cnTracking":
                return <EditableCell value={sub.cnTracking} onChange={(v) => onUpdateSubitem(sub.id, { cnTracking: v })} />;
            case "sgTracking":
                return <EditableCell value={sub.sgTracking} onChange={(v) => onUpdateSubitem(sub.id, { sgTracking: v })} />;
            default:
                return null;
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
            case "name":
                return renderNameCell(sub);
            case "payment":
                return (
                    <div className="overflow-hidden whitespace-nowrap text-ellipsis !text-center border-r border-[#D0D4E4] p-0 h-[33.1px] flex-shrink-0 transition transform active:scale-95 duration-150">
                        <StatusBadge
                            value={sub.payment ?? ""}
                            onChange={(v) => onUpdateSubitem(sub.id, { payment: v })}
                            options={paymentOptions}
                            onAddOption={onAddPayment}
                            onDeleteOption={onDeletePayment}
                            manageLabel="payment"
                            onUpdateOptionColor={(name, color) => onUpdateOptionColor?.('payment', name, color)}
                            small
                        />
                    </div>
                );
            case "paymentStatus":
                return (
                    <div className="overflow-hidden whitespace-nowrap text-ellipsis !text-center border-r border-[#D0D4E4] p-0 h-[33.1px] flex-shrink-0 transition transform active:scale-95 duration-150">
                        <StatusBadge
                            value={sub.paymentStatus ?? ""}
                            onChange={(v) => onUpdateSubitem(sub.id, { paymentStatus: v })}
                            options={paymentStatusOptions}
                            onAddOption={onAddPaymentStatus}
                            onDeleteOption={onDeletePaymentStatus}
                            manageLabel="payment status"
                            onUpdateOptionColor={(name, color) => onUpdateOptionColor?.('payment_status', name, color)}
                            small
                        />
                    </div>
                );
            case "shipper":
                return (
                    <div className="overflow-hidden whitespace-nowrap text-ellipsis !text-center border-r border-[#D0D4E4] p-0 h-[33.1px] flex-shrink-0 transition transform active:scale-95 duration-150">
                        <StatusBadge
                            value={sub.shipper ?? ""}
                            onChange={(v) => onUpdateSubitem(sub.id, { shipper: v })}
                            options={shipperOptions}
                            onAddOption={onAddShipper}
                            onDeleteOption={onDeleteShipper}
                            manageLabel="shipper"
                            onUpdateOptionColor={(name, color) => onUpdateOptionColor?.('shipper', name, color)}
                            small
                        />
                    </div>
                );
            case "supplier":
                return <EditableCell value={sub.supplier} onChange={(v) => onUpdateSubitem(sub.id, { supplier: v })} />;
            case "description":
                return <EditableCell className="!justify-start" value={sub.description} onChange={(v) => onUpdateSubitem(sub.id, { description: v })} multiline />;
            case "qty":
                return <EditableCell value={sub.qty} onChange={(v) => onUpdateSubitem(sub.id, { qty: v })} type="number" />;
            case "cost":
                return <EditableCell value={sub.cost} onChange={(v) => onUpdateSubitem(sub.id, { cost: v })} type="number" />;
            case "totalUc":
                return <div className="flex justify-center text-xs text-gray-800">{formatMoney(totalUc)}</div>;
            case "manpower":
                return <EditableCell value={sub.manpower} onChange={(v) => onUpdateSubitem(sub.id, { manpower: v })} type="number" />;
            case "manpowerRmb":
                return <div className="flex justify-center text-xs text-gray-800">{formatMoney(manpowerRmb)}</div>;
            case "ls":
                return <EditableCell value={sub.ls} onChange={(v) => onUpdateSubitem(sub.id, { ls: v })} type="number" />;
            case "lsRmb":
                return <div className="flex justify-center text-xs text-gray-800">{formatMoney(lsRmb)}</div>;
            case "totalC":
                return <div className="flex justify-center text-xs text-gray-800">{formatMoney(totalC)}</div>;
            case "modeOfPayment":
                return (
                    <div className="overflow-hidden whitespace-nowrap text-ellipsis !text-center border-r border-[#D0D4E4] p-0 h-[33.1px] flex-shrink-0 transition transform active:scale-95 duration-150">
                        <StatusBadge
                            value={sub.modeOfPayment ?? ""}
                            onChange={(v) => onUpdateSubitem(sub.id, { modeOfPayment: v })}
                            options={modeOfPaymentOptions}
                            onAddOption={onAddModeOfPayment}
                            onDeleteOption={onDeleteModeOfPayment}
                            manageLabel="mode of payment"
                            onUpdateOptionColor={(name, color) => onUpdateOptionColor?.('mode_of_payment', name, color)}
                            small
                        />
                    </div>
                );
            case "orderNumber":
                return <EditableCell value={sub.orderNumber} onChange={(v) => onUpdateSubitem(sub.id, { orderNumber: v })} />;
            case "quantityProduced":
                return <EditableCell value={sub.quantityProduced ?? ""} onChange={(v) => onUpdateSubitem(sub.id, { quantityProduced: v })} type="number" />;
            case "sample":
                return <EditableCell value={sub.sample ?? ""} onChange={(v) => onUpdateSubitem(sub.id, { sample: v })} />;
            case "qtyFor":
                return <EditableCell value={sub.qtyFor ?? ""} onChange={(v) => onUpdateSubitem(sub.id, { qtyFor: v })} type="number" />;
            case "paymentAmount":
                return <EditableCell value={sub.paymentAmount ?? ""} onChange={(v) => onUpdateSubitem(sub.id, { paymentAmount: v })} type="number" />;
            case "difference":
                return <div className="flex justify-center text-xs text-gray-800">{formatMoney(difference)}</div>;
            case "paymentRemarks":
                return <EditableCell value={sub.paymentRemarks ?? ""} onChange={(v) => onUpdateSubitem(sub.id, { paymentRemarks: v })} multiline />;
            default:
                return null;
        }
    };

    const renderCell = (sub: Subitem, key: string) =>
        tableMode === "payment" ? renderPaymentCell(sub, key) : renderSubitemCell(sub, key);

    const totalColSpan = 1 + cols.length + subitemCustomCols.length + 1;

    return (
        <div
            className="relative mb-2 ml-7 max-w-[calc(100vw-80px)] overflow-visible"
            style={{ borderLeft: `7px solid ${clientColor}` }}
            data-client-id={clientId}
        >
            {selectedSubitemIds.length > 0 && selectionBox.visible && (
                <div
                    className="fixed z-50 rounded-xl border border-gray-200 bg-white/95 px-4 py-3 text-xs text-gray-700 shadow-xl backdrop-blur-sm"
                    style={{ left: selectionBox.x, top: selectionBox.y }}
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
                            setSelectionBox((p) => ({ ...p, visible: false }));
                        }}
                        className="mt-2 text-[11px] text-gray-400 hover:text-gray-600"
                    >
                        Clear selection
                    </button>
                </div>
            )}

            <div className="w-full overflow-visible">
                <table
                    className="table-fixed border-collapse border-b border-[#D0D4E4]"
                    style={{ width: totalTableWidth, minWidth: totalTableWidth }}
                >
                    <colgroup>
                        <col style={{ width: 44 }} />
                        {visibleCols.map((col) => (
                            <col key={col.key} style={{ width: col.width }} />
                        ))}
                        {visibleCustomCols.map((col) => (
                            <col key={col.id} style={{ width: CUSTOM_COL_WIDTH }} />
                        ))}
                        <col style={{ width: 32 }} />
                    </colgroup>

                    <thead>
                        <tr className="border-b border-t border-r border-[#D0D4E4] bg-gray-50">
                            <th className="w-11 px-2 py-1 text-center" />

                            {visibleCols.map((col) => {
                                const isDragTarget = col.key !== 'name';
                                const isDragging = draggedColumnKey === col.key;

                                return (
                                    <th
                                        key={col.key}
                                        onContextMenu={(e) => {
                                            if (col.key === 'name') return;
                                            e.preventDefault();
                                            setOpenColumnMenu(`${tablePrefix}:${col.key}`);
                                        }}
                                        draggable={isDragTarget}
                                        onDragStart={(e) => {
                                            if (!isDragTarget) return;
                                            e.dataTransfer?.setData('text/plain', col.key);
                                            e.dataTransfer?.setData('application/x-crm-table-column', col.key);
                                            e.dataTransfer!.effectAllowed = 'move';
                                            setDragPreview(e, e.currentTarget);
                                            setDraggedColumnKey(col.key);
                                        }}
                                        onDragOver={(e) => {
                                            if (!isDragTarget) return;
                                            if (!Array.from(e.dataTransfer.types).includes('application/x-crm-table-column')) return;
                                            e.preventDefault();
                                            setDragOverColumnKey(col.key);
                                            const bounds = e.currentTarget.getBoundingClientRect();
                                            setDragOverColumnEdge(e.clientX < bounds.left + bounds.width / 2 ? 'left' : 'right');
                                        }}
                                        onDragLeave={() => {
                                            if (dragOverColumnKey === col.key) {
                                                setDragOverColumnKey(null);
                                                setDragOverColumnEdge(null);
                                            }
                                        }}
                                        onDrop={(e) => {
                                            if (!Array.from(e.dataTransfer.types).includes('application/x-crm-table-column')) return;
                                            e.preventDefault();
                                            const draggedKey = e.dataTransfer?.getData('text/plain') || draggedColumnKey;
                                            if (!draggedKey || draggedKey === col.key || !isDragTarget) {
                                                setDraggedColumnKey(null);
                                                setDragOverColumnKey(null);
                                                setDragOverColumnEdge(null);
                                                return;
                                            }

                                            if (tableMode === 'payment') {
                                                reorderTableCols(paymentCols, draggedKey, col.key, 'colOrder:payments', 'paymentColsReordered', setPaymentCols);
                                            } else {
                                                reorderTableCols(subitemCols, draggedKey, col.key, 'colOrder:subitems', 'subitemColsReordered', setSubitemCols);
                                            }

                                            setDraggedColumnKey(null);
                                            setDragOverColumnKey(null);
                                            setDragOverColumnEdge(null);
                                        }}
                                        className={`group overflow-visible relative border-r border-[#D0D4E4] text-center text-[12.6px] font-semibold whitespace-nowrap text-gray-500 ${isDragging ? 'opacity-60' : ''} ${isDragTarget ? (draggedColumnKey ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
                                    >
                                        <div className="overflow-hidden text-ellipsis whitespace-nowrap px-2">{col.label}</div>
                                        {isDragTarget && (
                                            <button type="button" onClick={(e) => { e.stopPropagation(); setOpenColumnMenu(openColumnMenu === `${tablePrefix}:${col.key}` ? null : `${tablePrefix}:${col.key}`); }} onMouseDown={(e) => e.stopPropagation()} className="absolute right-0.5 top-0.5 z-30 hidden rounded bg-white/90 p-0.5 text-gray-400 shadow-sm hover:text-gray-700 group-hover:block" title={`Column options for ${col.label}`}>
                                                <MoreHorizontal size={12} />
                                            </button>
                                        )}
                                        {openColumnMenu === `${tablePrefix}:${col.key}` && (
                                            <div className="absolute left-0 top-full z-[80] mt-1 w-36 rounded-md border border-gray-200 bg-white p-1 text-left shadow-xl">
                                                {((tablePrefix === 'subitem' && ['people', 'status'].includes(col.key)) || (tablePrefix === 'payment' && ['payment', 'paymentStatus'].includes(col.key))) && <button type="button" onClick={() => { onFilterColumn?.(col.key === 'people' ? 'people' : `${tablePrefix}:${col.key}`); setOpenColumnMenu(null); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[10px] font-medium text-gray-700 hover:bg-gray-50"><Filter size={12} /> Filter</button>}
                                                <button type="button" onClick={() => onHideColumn(`${tablePrefix}:${col.key}`)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[10px] font-medium text-gray-700 hover:bg-gray-50">
                                                    <EyeOff size={12} /> Hide column
                                                </button>
                                            </div>
                                        )}
                                        {dragOverColumnKey === col.key && isDragTarget && (
                                            <div className={`pointer-events-none absolute inset-y-0 z-20 w-1 bg-[#0f8da8] shadow-[0_0_5px_rgba(15,141,168,0.6)] ${dragOverColumnEdge === 'left' ? 'left-0' : 'right-0'}`} />
                                        )}
                                        <div
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                startResize(col.key, e.clientX);
                                            }}
                                            className="absolute top-0 right-0 h-full w-2 cursor-col-resize hover:bg-[#7BCBD5]/20"
                                        />
                                    </th>
                                );
                            })}

                            {visibleCustomCols.map((col) => (
                                <th
                                    key={col.id}
                                    onContextMenu={(e) => { e.preventDefault(); setOpenColumnMenu(`${tablePrefix}:custom:${col.id}`); }}
                                    className="group relative overflow-visible border-r border-[#D0D4E4] text-center text-[11px] font-semibold whitespace-nowrap text-gray-500 bg-teal-50/40"
                                    style={{ minWidth: CUSTOM_COL_WIDTH, width: CUSTOM_COL_WIDTH }}
                                >
                                    <div className="flex items-center justify-center gap-1 px-2">
                                        <span className="truncate">{col.name}</span>
                                        <button
                                            onClick={() => onDeleteSubitemCustomCol(col.id)}
                                            className="text-gray-300 hover:text-red-400 text-base leading-none flex-shrink-0"
                                            title="Remove column"
                                        >
                                            ×
                                        </button>
                                    </div>
                                    <button type="button" onClick={() => setOpenColumnMenu(`${tablePrefix}:custom:${col.id}`)} className="absolute right-0.5 top-0.5 z-30 hidden rounded bg-white/90 p-0.5 text-gray-400 shadow-sm hover:text-gray-700 group-hover:block" title={`Column options for ${col.name}`}><MoreHorizontal size={12} /></button>
                                    {openColumnMenu === `${tablePrefix}:custom:${col.id}` && <div className="absolute left-0 top-full z-[80] mt-1 w-36 rounded-md border border-gray-200 bg-white p-1 text-left shadow-xl"><button type="button" onClick={() => onHideColumn(`${tablePrefix}:custom:${col.id}`)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[10px] font-medium text-gray-700 hover:bg-gray-50"><EyeOff size={12} /> Hide column</button></div>}
                                </th>
                            ))}

                            <th className="border-r border-[#D0D4E4] px-1 text-center" style={{ width: 32 }}>
                                <button
                                    onClick={onRequestAddSubitemCol}
                                    className="text-gray-300 hover:text-[#7BCBD5] text-lg leading-none"
                                    title="Add subitem column"
                                >
                                    +
                                </button>
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        {subitems.map((sub) => (
                            <React.Fragment key={sub.id}>
                                <tr className="relative group border-b border-r border-[#D0D4E4] hover:bg-blue-50/30">
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

                                    {visibleCols.map((col) => (
                                        <td
                                            key={col.key}
                                            className={`align-middle border-r border-[#D0D4E4] p-0 ${col.key === "name" ? "overflow-visible relative z-20" : "overflow-hidden"
                                            }`}

                                            style={{ minWidth: col.minWidth }}
                                        >
                                            {renderCell(sub, col.key)}
                                        </td>
                                    ))}

                                    {visibleCustomCols.map((col) => (
                                        <td
                                            key={col.id}
                                            className="overflow-hidden align-middle border-r border-[#D0D4E4] px-1 py-1 bg-teal-50/20"
                                            style={{ minWidth: CUSTOM_COL_WIDTH, width: CUSTOM_COL_WIDTH }}
                                        >
                                            {col.field_type === "date" ? (
                                                <input
                                                    type="date"
                                                    value={sub.customFields?.[col.id] ?? ""}
                                                    onChange={(e) =>
                                                        onUpdateSubitem(sub.id, {
                                                            customFields: {
                                                                ...(sub.customFields ?? {}),
                                                                [col.id]: e.target.value,
                                                            },
                                                        })
                                                    }
                                                    className="text-xs border-none outline-none bg-transparent cursor-pointer w-full px-1"
                                                />
                                            ) : (
                                                <EditableCell
                                                    value={sub.customFields?.[col.id] ?? ""}
                                                    onChange={(v) =>
                                                        onUpdateSubitem(sub.id, {
                                                            customFields: {
                                                                ...(sub.customFields ?? {}),
                                                                [col.id]: v,
                                                            },
                                                        })
                                                    }
                                                    type={col.field_type}
                                                    placeholder="—"
                                                />
                                            )}
                                        </td>
                                    ))}

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
                                            onUpdateOptionColor={(name, color) => onUpdateOptionColor?.('subitem_subprogress', name, color)}
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
                                <button
                                    onClick={onAddSubitem}
                                    className="flex items-center gap-1.5 text-xs text-gray-400 transition duration-150 hover:text-[#7BCBD5] active:scale-95"
                                >
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