"use client";
import React from 'react';
import { Subitem } from "../../app/types";
import { useState, useMemo } from 'react';
import { StatusBadge } from "./statusbadge";
import { EditableCell } from "./editablecell";
import { Calendar, CreditCard, Trash2, Package, FileText, Plus } from "lucide-react";
import { PaymentsSection } from './payments';
import { SamplesSection } from './sample';
import type { Profile } from "../../app/types";
import { AssigneeMultiSelect } from "./assignee-multiselect";
import { TimelineSection, DEFAULT_TIMELINE_ROWS } from './timeline';


const SUBITEM_STATUS_COLORS: Record<string, string> = {
    'To Quote': '#5cc9d5',
    'Verified': '#00C2C7',
    'Awarded': '#00C875',
    'Initial Quote': '#8b81da',
    'Quoted': '#5fe0cf',
    'Shortlisted': '#ad7de7',
    'Failed': '#ac2865',
    '': 'transparent',
};

const LOCALOVERSEAS_COLORS: Record<string, string> = {
    'Local': '#a856a6',
    'Overseas': '#8b81da',
};

const SHIPPER_COLORS: Record<string, string> = {
    '': '#eeeded',
    '小李 - AIR': '#f88fc1',
    '小李 - SEA': '#ff97ab',
    'Tiger - Sea': '#ffa791',
    'Tiger - AIR': '#ffbf7a',
    '东莞 - SEA': '#c28adc',
    'WORLD ASIA': '#628ce8',
    'A5 汇荣': '#008bd8',
    'Kalinda - AIR': '#0083aa',
    'Kalinda - SEA': '#007467',
    'David - DPS': '#a58eae',
    'Local Singapore': '#775785',
    'Local China': '#3b313e',
    '霸王车': '#801f55',
    '义乌': '#99005c',
    'SF': '#84429b',
    'DHL': '#426bc6',
    '恒瀚': '#008bd3',
    'Easy Parcel': '#00a4c7',
    'Local Destination': '#00b8ad',
    'UPS': '#a8a3ff',
    'FedEx': '#95e8ff',
    '宇涵 - Air': '#43adcb',
    '宇涵 - Sea': '#2f9179',
};

const CURRENCY_COLORS: Record<string, string> = {
    'MYR': '#b37ed2',
    'SGD': '#5fc1cc',
    'RMB': '#e375a1'

};

const CURRENCY_RATES: Record<string, number> = {
    RMB: 0.2,
    SGD: 1,
    MYR: 0.333
};

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
}: {
    clientId: string;
    subitems: Subitem[];
    clientColor: string;
    onUpdateSubitem: (id: string, u: Partial<Subitem>) => void;
    onAddSubitem: () => void;
    onDeleteSubitem: (id: string) => void;
    profiles: Profile[];
    subitemAssigneeMap: Record<string, string[]>;
    onChangeSubitemAssignees: (subitemId: string, ids: string[]) => void;
}) {
    const statusOpts = ['', 'To Quote', 'Verified', 'Awarded', 'Initial Quote', 'Quoted', 'Shortlisted', 'Failed'];
    const localOverseasOpts = ['Local', 'Overseas'];
    const shipperOpts = ['', '小李 - AIR', '小李 - SEA', 'Tiger - Sea', 'Tiger - AIR', '东莞 - SEA', 'WORLD ASIA', 'A5 汇荣', 'Kalinda - AIR', 'Kalinda - SEA', 'David - DPS', 'Local Singapore', 'Local China', '霸王车', '义乌', 'SF', 'DHL', '恒瀚', 'Easy Parcel', 'Local Destination', 'UPS', 'FedEx', '宇涵 - Air', '宇涵 - Sea'];
    const currencyOpts = ['MYR', 'SGD', 'RMB'];
    const newSubitem = {
        id: crypto.randomUUID(),
        name: '',
        timelineRows: [
            {
                id: crypto.randomUUID(),
                name: 'Sample',
                person: '',
                remarks: '',
                subProgress: 'Not Started',
                timelineStart: '',
                timelineEnd: '',
                duration: '',
                dependency: ''

            }
        ]
    }

    const INITIAL_SUBITEM_COLS = [
        { key: 'name', label: 'Subitem', width: 320, minWidth: 170 },
        { key: 'people', label: 'People', width: 60, minWidth: 7  },
        { key: 'localOverseas', label: 'Local/Overseas', width: 90, minWidth: 7  },
        { key: 'status', label: 'Status', width: 70, minWidth: 7  },
        { key: 'qty', label: 'Qty', width: 55, minWidth: 7  },
        { key: 'description', label: 'Description', width: 120, minWidth: 7  },
        { key: 'remarks', label: 'Remarks', width: 110, minWidth: 7  },
        { key: 'shipper', label: 'Shipper', width: 115, minWidth: 7  },
        { key: 'supplier', label: 'Supplier', width: 120, minWidth: 7  },
        { key: 'cost', label: 'Cost', width: 60, minWidth: 7  },
        { key: 'manpower', label: 'Manpower', width: 70, minWidth: 7  },
        { key: 'ls', label: 'LS', width: 50, minWidth: 7  },
        { key: 'os', label: 'OS', width: 50, minWidth: 7  },
        { key: 'currency', label: 'Currency', width: 70, minWidth: 7  },
        { key: 'cSgd', label: 'C-SGD', width: 70, minWidth: 7 },
        { key: 'tc', label: 'T.C', width: 70, minWidth: 7 },
        { key: 'uc', label: 'U.C', width: 60, minWidth: 7  },
        { key: 'tcSgd', label: 'TC-SGD', width: 54, minWidth: 7  },
        { key: 'price', label: 'Price', width: 60, minWidth: 7  },
        { key: 'up', label: 'U.P', width: 50, minWidth: 7  },
        { key: 'cnTracking', label: 'CN Tracking #', width: 120, minWidth: 7  },
        { key: 'sgTracking', label: 'SG Tracking #', width: 120, minWidth: 7  },
        { key: 'pl', label: 'PL', width: 50, minWidth: 7  },
        { key: 'sl', label: 'SL', width: 50, minWidth: 7  }
    ];

    const [cols, setCols] = useState(INITIAL_SUBITEM_COLS);

    const colWidth = useMemo(
        () => Object.fromEntries(cols.map((c) => [c.key, c.width])),
        [cols]
    );

    const totalTableWidth = useMemo(
        () => 24 + cols.reduce((sum, col) => sum + col.width, 0),
        [cols]
    );
    const startResize = (key: string, startX: number) => {
        const startCol = cols.find((col) => col.key === key);
        if (!startCol) return;

        const startWidth = startCol.width;

        const onMouseMove = (e: MouseEvent) => {
            const delta = e.clientX - startX;

            setCols((prev) =>
                prev.map((col) =>
                    col.key === key
                        ? { ...col, width: Math.max(col.minWidth ?? 40, startWidth + delta) }
                        : col
                )
            );
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const [selectedSubitemIds, setSelectedSubitemIds] = useState<string[]>([]);

    const [selectionBox, setSelectionBox] = useState({ x: 0, y: 0, visible: false });

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

    const parseNumber = (value: string | number | undefined) => {
        if (typeof value === "number") return value;
        if (!value) return 0;

        const cleaned = String(value).replace(/,/g, "").trim();
        const num = Number(cleaned);
        return Number.isFinite(num) ? num : 0;
    };

    const selectedSubitems = useMemo(
        () => subitems.filter((sub) => selectedSubitemIds.includes(sub.id)),
        [subitems, selectedSubitemIds]
    );

    const selectionTotals = useMemo(() => {
        return selectedSubitems.reduce(
            (acc, sub) => {
                const qty = parseNumber(sub.qty);

                const totalCost =
                    parseNumber(sub.cost) +
                    parseNumber(sub.manpower) +
                    parseNumber(sub.ls) +
                    parseNumber(sub.os) +
                    parseNumber(sub.tcSgd);

                const totalPrice = parseNumber(sub.up) * qty;
                const markup = totalPrice - totalCost;

                acc.totalCost += totalCost;
                acc.totalPrice += totalPrice;
                acc.totalMarkup += markup;

                return acc;
            },
            { totalCost: 0, totalPrice: 0, totalMarkup: 0 }
        );
    }, [selectedSubitems]);



    return (
        <div className="mb-2 ml-7 max-w-[calc(100vw-80px)]" style={{ borderLeft: `7px solid ${clientColor}` }}>
            <div className="max-h-[500px]">
                <table className="border-collapse table-fixed" style={{ width: totalTableWidth, minWidth: totalTableWidth }}>
                    <colgroup>
                        <col style={{ width: 24 }} />
                        {cols.map((col) => (
                            <col key={col.key} style={{ width: col.width }} />
                        ))}
                        </colgroup>
                        <thead>
                            <tr className="bg-gray-50 border-b border-r border-[#D0D4E4]">
                                <th className="w-6" />
                            {cols.map((col) => (
                                <th
                                    key={col.key}
                                    className="relative text-center py-1 text-[11px] font-semibold text-gray-500 border-r border-[#D0D4E4] last:border-r-0 whitespace-nowrap"
                                >
                                    <div className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                                        {col.label}
                                    </div>
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
                        {selectedSubitemIds.length > 0 && selectionBox.visible && (
                            <div
                                className="fixed z-50 rounded-xl border border-gray-200 bg-white/95 backdrop-blur-sm shadow-xl px-4 py-3 text-xs text-gray-700"
                                style={{
                                    left: selectionBox.x,
                                    top: selectionBox.y,
                                }}
                            >
                                <div className="font-semibold text-gray-900 mb-2">
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
                                        Total markup: <span className={`font-medium ${selectionTotals.totalMarkup >= 0 ? "text-green-600" : "text-red-500"}`}>
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
                        {subitems.map(sub => {
                            const tc =
                                parseNumber(sub.cost) +
                                parseNumber(sub.manpower) +
                                parseNumber(sub.ls) +
                                parseNumber(sub.os) +
                                parseNumber(sub.tcSgd);

                            const qty = parseNumber(sub.qty);
                            const uc = qty > 0 ? tc / qty : null;

                            const price = parseNumber(sub.up) * qty;

                            const cost = parseNumber(sub.cost);
                            const currencyRate = CURRENCY_RATES[sub.currency ?? 'RMB'] ?? 0.2;
                            const cSgd = cost * currencyRate;

                            return (
                                <React.Fragment key={sub.id}>
                                    <tr className="border-b border-[#D0D4E4] hover:bg-blue-50/30 group">
                                        <td className="px-1 py-1 border-gray-200 text-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedSubitemIds.includes(sub.id)}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleSubitemSelection(sub.id, e.clientX, e.clientY);
                                                }}
                                                onChange={() => { }}
                                                className="w-3 h-3 rounded cursor-pointer accent-[#7BCBD5]"
                                            />
                                        </td>
                                        {/* Name + timeline, payment, sample buttons */}
                                        <td className="px-2 py-1 border-r border-[#D0D4E4]" style={{ minWidth: colWidth.name }}>
                                            <div className="flex items-center gap-1">
                                                <FileText size={11} className="text-gray-400 flex-shrink-0" />
                                                <EditableCell value={sub.name} onChange={v => onUpdateSubitem(sub.id, { name: v })} placeholder="Subitem name" className="!text-left" />
                                                {/* Delete subitem */}
                                                <div className="px-2 py-1" style={{ minWidth: 40 }}>
                                                    <button
                                                        onClick={() => onDeleteSubitem(sub.id)}
                                                        className="p-1 text-gray-300 hover:text-red-400 transition-colors opacity-100 group-hover:opacity-100"
                                                        title="Delete subitem"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={() => onUpdateSubitem(sub.id, { showTimeline: !sub.showTimeline, showPayments: false, showSample: false })}
                                                    className={`flex items-center gap-1 px-1 py-1 rounded-sm transition-colors whitespace-nowrap flex-shrink-0 transition transform active:scale-95 duration-2 ${sub.showTimeline ? 'bg-[#7BCBD5] text-white' : 'bg-transparent text-[#6db6bf] hover:bg-teal-100 border border-teal-200'
                                                        }`}
                                                >
                                                    <Calendar size={15} />
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        onUpdateSubitem(sub.id, {
                                                            timelineRows: sub.timelineRows?.length ? sub.timelineRows : DEFAULT_TIMELINE_ROWS,
                                                            showTimeline: false,
                                                            showPayments: !sub.showPayments,
                                                            showSample: false,
                                                        })
                                                    }
                                                    className={`flex items-center gap-1 px-1 py-1 rounded-sm transition-colors whitespace-nowrap flex-shrink-0 transition transform active:scale-95 duration-2  ${sub.showPayments ? 'bg-[#f291b6] text-white' : 'bg-transparent text-[#e87da6] hover:bg-pink-100 border border-pink-200'
                                                        }`}
                                                >
                                                    <CreditCard size={15} />
                                                </button>
                                                <button
                                                    onClick={() => onUpdateSubitem(sub.id, { showPayments: false, showTimeline: false, showSample: !sub.showSample })}
                                                    className={`flex items-center gap-1 px-1 py-1 rounded-sm transition-colors whitespace-nowrap flex-shrink-0 transition transform active:scale-95 duration-2 ${sub.showSample ? 'bg-[#d5a5ec] text-white' : 'bg-transparent text-[#ac7ec2] hover:bg-purple-100 border border-purple-200'
                                                        }`}
                                                >
                                                    <Package size={15} />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-2 py-1 min-w-0 border-r overflow-hidden border-[#D0D4E4]" style={{ minWidth: colWidth.people }}>
                                            <AssigneeMultiSelect
                                                profiles={profiles}
                                                selectedIds={subitemAssigneeMap[sub.id] ?? []}
                                                onChange={(ids) => onChangeSubitemAssignees(sub.id, ids)}
                                            />
                                        </td>
                                        <td className="px-2 py-1 overflow-hidden border-r border-[#D0D4E4] !text-center " style={{ minWidth: colWidth.localOverseas }}>
                                            <StatusBadge value={sub.localOverseas || 'Local'} onChange={v => onUpdateSubitem(sub.id, { localOverseas: v })} options={localOverseasOpts} colorMap={LOCALOVERSEAS_COLORS} small />
                                        </td>
                                        <td className="px-2 py-1 border-r overflow-hidden border-[#D0D4E4] !text-center" style={{ minWidth: colWidth.status }}>
                                            <StatusBadge value={sub.status} onChange={v => onUpdateSubitem(sub.id, { status: v })} options={statusOpts} colorMap={SUBITEM_STATUS_COLORS} small />
                                        </td>
                                        <td className="px-2 py-1 border-r overflow-hidden border-[#D0D4E4]" style={{ minWidth: colWidth.qty }}>
                                            <EditableCell value={sub.qty} onChange={v => onUpdateSubitem(sub.id, { qty: v })} type="number" />
                                        </td>
                                        <td className="px-2 py-1 border-r overflow-hidden border-[#D0D4E4]" style={{ minWidth: colWidth.description }}>
                                            <EditableCell
                                                value={sub.description}
                                                onChange={v => onUpdateSubitem(sub.id, { description: v })}
                                                multiline
                                            />
                                        </td>
                                        <td className="px-2 py-1 border-r border-[#D0D4E4]" style={{ minWidth: colWidth.remarks }}>
                                            <EditableCell
                                                value={sub.remarks}
                                                onChange={v => onUpdateSubitem(sub.id, { remarks: v })}
                                                multiline
                                            />
                                        </td>
                                        <td className="px-2 py-1 overflow-hidden border-r border-[#D0D4E4] text-center" style={{ minWidth: colWidth.shipper }}>
                                            <StatusBadge value={sub.shipper} onChange={v => onUpdateSubitem(sub.id, { shipper: v })} options={shipperOpts} colorMap={SHIPPER_COLORS} small />
                                        </td>
                                        <td className="px-2 py-1 overflow-hidden border-r border-[#D0D4E4] text-center" style={{ minWidth: colWidth.supplier }}>
                                            <EditableCell value={sub.supplier} onChange={v => onUpdateSubitem(sub.id, { supplier: v })} />
                                        </td>
                                        <td className="px-2 py-1 overflow-hidden border-r border-[#D0D4E4] text-center" style={{ minWidth: colWidth.cost }}>
                                            <EditableCell value={sub.cost} onChange={v => onUpdateSubitem(sub.id, { cost: v })} type="number" />
                                        </td>
                                        <td className=" border-r overflow-hidden border-[#D0D4E4] text-center" style={{ minWidth: colWidth.manpower }}>
                                            <EditableCell value={sub.manpower} onChange={v => onUpdateSubitem(sub.id, { manpower: v })} type="number" className="text-center" />
                                        </td>
                                        <td className="px-2 py-1 overflow-hidden border-r border-[#D0D4E4]" style={{ minWidth: colWidth.ls }}>
                                            <EditableCell value={sub.ls} onChange={v => onUpdateSubitem(sub.id, { ls: v })} type="number" />
                                        </td>
                                        <td className="px-2 py-1 overflow-hidden border-r border-[#D0D4E4] text-center" style={{ minWidth: colWidth.os }}>
                                            <EditableCell value={sub.os} onChange={v => onUpdateSubitem(sub.id, { os: v })} type="number" />
                                        </td>
                                        <td className="px-2 py-1 overflow-hidden border-r border-[#D0D4E4] text-center" style={{ minWidth: colWidth.currency }}>
                                            <StatusBadge value={sub.currency ?? 'RMB'} onChange={v => onUpdateSubitem(sub.id, { currency: v })} options={currencyOpts} colorMap={CURRENCY_COLORS} small />
                                        </td>
                                        <td className="px-2 py-1 overflow-hidden border-r border-[#D0D4E4] text-center" style={{ minWidth: colWidth.cSgd }}>
                                            <div className="px-2 py-1 text-xs text-gray-800"> {cSgd.toFixed(2)}
                                            </div>
                                        </td>
                                        <td className="px-2 py-1 overflow-hidden border-r border-[#D0D4E4] text-center" style={{ minWidth: colWidth.tc }}>
                                            <div className="px-2 py-1 text-xs text-gray-800"> {tc.toFixed(2)}
                                            </div>
                                        </td>
                                        <td className="px-2 py-1 overflow-hidden border-r border-[#D0D4E4] text-center" style={{ minWidth: colWidth.uc }}>
                                            <div className="px-2 py-1 text-xs text-gray-800"> {uc == null ? '' : uc.toFixed(2)}
                                            </div>
                                        </td>
                                        <td className="px-2 py-1 overflow-hidden border-r border-[#D0D4E4] text-center" style={{ minWidth: colWidth.tcSgd }}>
                                            <EditableCell value={sub.tcSgd} onChange={v => onUpdateSubitem(sub.id, { tcSgd: v })} type="number" />
                                        </td>
                                        <td className="px-2 py-1 overflow-hidden border-r border-[#D0D4E4] text-center" style={{ minWidth: colWidth.price }}>
                                            <div className="px-2 py-1 text-xs text-gray-800"> {price.toFixed(2)}
                                            </div>
                                        </td>
                                        <td className="px-2 py-1 overflow-hidden border-r border-[#D0D4E4] text-center" style={{ minWidth: colWidth.up }}>
                                            <EditableCell value={sub.up} onChange={v => onUpdateSubitem(sub.id, { up: v })} type="number" />
                                        </td>
                                        <td className="px-2 py-1 overflow-hidden border-r border-[#D0D4E4] text-center" style={{ minWidth: colWidth.cnTracking }}>
                                            <EditableCell value={sub.cnTracking} onChange={v => onUpdateSubitem(sub.id, { cnTracking: v })} />
                                        </td>
                                        <td className="px-2 py-1 overflow-hidden border-r border-[#D0D4E4] text-center" style={{ minWidth: colWidth.sgTracking }}>
                                            <EditableCell value={sub.sgTracking} onChange={v => onUpdateSubitem(sub.id, { sgTracking: v })} />
                                        </td>
                                        <td className="px-2 py-1 overflow-hidden border-r border-[#D0D4E4] text-center" style={{ minWidth: colWidth.pl }}>
                                            <EditableCell value={sub.pl ?? ''} onChange={v => onUpdateSubitem(sub.id, { pl: v })} type="number" />
                                        </td>
                                        <td className="px-2 py-1 overflow-hidden border-r border-[#D0D4E4] text-center" style={{ minWidth: colWidth.sl }}>
                                            <EditableCell value={sub.sl ?? ''} onChange={v => onUpdateSubitem(sub.id, { sl: v })} type="number" />
                                        </td>

                                    </tr>

                                    {sub.showTimeline && (
                                        <tr>
                                            <td colSpan={cols.length + 1} className="p-0 bg-blue-50/20">
                                                <TimelineSection
                                                    rows={sub.timelineRows?.length ? sub.timelineRows : DEFAULT_TIMELINE_ROWS}
                                                    onUpdate={(rows) => onUpdateSubitem(sub.id, { timelineRows: rows })}
                                                />
                                            </td>
                                        </tr>
                                    )}

                                    {sub.showPayments && (
                                        <tr>
                                            <td colSpan={cols.length + 1} className="p-0 bg-green-50/20">
                                                <PaymentsSection subitem={sub} onUpdate={u => onUpdateSubitem(sub.id, u)} onUpdateClientStatus={() => { }} />
                                            </td>
                                        </tr>
                                    )}
                                    {sub.showSample && (
                                        <tr>
                                            <td colSpan={cols.length + 1} className="p-0 bg-blue-50/20">
                                                <SamplesSection subitem={sub} onUpdate={u => onUpdateSubitem(sub.id, u)} />
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                        <tr>
                            <td colSpan={cols.length + 1} className="px-3 py-1.5">
                                <button
                                    onClick={onAddSubitem}
                                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#7BCBD5] transition-colors transition transform active:scale-95 duration-150"
                                >
                                    <Plus size={12} />Add subitem
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}