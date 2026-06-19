"use client";
import React from 'react';
import { Subitem } from "../../app/types";
import { StatusBadge } from "./statusbadge";
import { EditableCell } from "./editablecell";
import { Calendar, CreditCard, Trash2, Package, FileText, Plus } from "lucide-react";
import { TimelineSection } from './timeline';
import { PaymentsSection } from './payments';
import { SamplesSection } from './sample';

const SUBITEM_STATUS_COLORS: Record<string, string> = {
    'To Quote': '#43ebff',
    'Verified': '#00C2C7',
    'Awarded': '#00C875',
    'Initial Quote': '#8b81da',
    'Quoted': '#037F4C',
    'Shortlisted': '#a856a6',
    'Failed': '#ac2865',
    '': 'transparent',
};
const LOCALOVERSEAS_COLORS: Record<string, string> = {
    'Local': '#a856a6',
    'Overseas': '#8b81da',
}

export function SubitemsTable({ clientId, subitems, clientColor, onUpdateSubitem, onAddSubitem, onDeleteSubitem }: {
    clientId: string; subitems: Subitem[]; clientColor: string;
    onUpdateSubitem: (id: string, u: Partial<Subitem>) => void;
    onAddSubitem: () => void;
    onDeleteSubitem: (id: string) => void;
}) {
    const statusOpts = ['', 'To Quote', 'Verified', 'Awarded', 'Initial Quote', 'Quoted', 'Shortlisted', 'Failed'];
    const localOverseasOpts = ['Local', 'Overseas'];



    const cols = [
        { key: 'name', label: 'Subitem', w: 200 },
        { key: 'people', label: 'People', w: 70 },
        { key: 'localOverseas', label: 'Local/Overseas', w: 90 },
        { key: 'status', label: 'Status', w: 60 },
        { key: 'qty', label: 'Qty', w: 55 },
        { key: 'description', label: 'Description', w: 180 },
        { key: 'remarks', label: 'Remarks', w: 140 },
        { key: 'shipper', label: 'Shipper', w: 120 },
        { key: 'supplier', label: 'Supplier', w: 120 },
        { key: 'cost', label: 'Cost', w: 60 },
        { key: 'manpower', label: 'Manpower', w: 50 },
        { key: 'ls', label: 'LS', w: 50 },
        { key: 'os', label: 'OS', w: 50 },
        { key: 'tc', label: 'T.C', w: 50 },
        { key: 'uc', label: 'U.C', w: 50 },
        { key: 'tcSgd', label: 'TC-SGD', w: 50 },
        { key: 'price', label: 'Price', w: 50 },
        { key: 'up', label: 'U.P', w: 50 },
        { key: 'numOfCartons', label: 'No. of Cartons', w: 50 },
        { key: 'cnTracking', label: 'CN Tracking #', w: 120 },
        { key: 'sgTracking', label: 'SG Tracking #', w: 120 },
        { key: 'actions', label: '', w: 190 }, // delete button
    ];

    return (
        <div className="mb-1" style={{ borderLeft: `3px solid ${clientColor}` }}>
            <div className="overflow-x-auto">
                <table className="border-collapse" style={{ minWidth: 1250 }}>
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="w-8 px-2 py-1 border-r border-gray-200" />
                            {cols.map(col => (
                                <th key={col.key}
                                    style={{ minWidth: col.w, width: col.w }}
                                    className="text-left px-2 py-1 text-xs font-semibold text-gray-500 border-r border-gray-200 last:border-r-0 whitespace-nowrap">
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {subitems.map(sub => (
                            <React.Fragment key={sub.id}>
                                <tr className="border-b border-gray-100 hover:bg-blue-50/30 group">
                                    <td className="px-2 py-1 border-r border-gray-200 text-center">
                                        <input type="checkbox" className="w-3 h-3 rounded cursor-pointer accent-[#7BCBD5]" />
                                    </td>
                                    {/* Name + timeline, payment, sample buttons */}
                                    <td className="px-2 py-1 border-r border-gray-200" style={{ minWidth: 300 }}>
                                        <div className="flex items-center gap-1 transition transform active:scale-95 duration-150">
                                            <FileText size={11} className="text-gray-400 flex-shrink-0" />
                                            <EditableCell value={sub.name} onChange={v => onUpdateSubitem(sub.id, { name: v })} placeholder="Subitem name" />
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
                                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${sub.showTimeline ? 'bg-[#7BCBD5] text-white' : 'bg-transparent text-[#6db6bf] hover:bg-teal-100 border border-teal-200'
                                                    }`}
                                            >
                                                <Calendar size={9} />Timeline
                                            </button>
                                            <button
                                                onClick={() => onUpdateSubitem(sub.id, { showPayments: !sub.showPayments, showTimeline: false, showSample: false })}
                                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0  ${sub.showPayments ? 'bg-[#f291b6] text-white' : 'bg-transparent text-[#e87da6] hover:bg-pink-100 border border-pink-200'
                                                    }`}
                                            >
                                                <CreditCard size={9} />Payments
                                            </button>
                                            <button
                                                onClick={() => onUpdateSubitem(sub.id, { showPayments: false, showTimeline: false, showSample: !sub.showSample })}
                                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${sub.showSample ? 'bg-[#d5a5ec] text-white' : 'bg-transparent text-[#ac7ec2] hover:bg-purple-100 border border-purple-200'
                                                    }`}
                                            >
                                                <Package size={9} />Sample
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-2 py-1 border-r border-gray-200" style={{ minWidth: 70 }}>
                                        <EditableCell value={sub.people} onChange={v => onUpdateSubitem(sub.id, { people: v })} />
                                    </td>
                                    <td className="px-2 py-1 border-r border-gray-200" style={{ minWidth: 90 }}>
                                        <StatusBadge value={sub.localOverseas || 'Local'} onChange={v => onUpdateSubitem(sub.id, { localOverseas: v })} options={localOverseasOpts} colorMap={LOCALOVERSEAS_COLORS} small />
                                    </td>
                                    <td className="px-2 py-1 border-r border-gray-200" style={{ minWidth: 90 }}>
                                        <StatusBadge value={sub.status} onChange={v => onUpdateSubitem(sub.id, { status: v })} options={statusOpts} colorMap={SUBITEM_STATUS_COLORS} small />
                                    </td>
                                    <td className="px-2 py-1 border-r border-gray-200" style={{ minWidth: 55 }}>
                                        <EditableCell value={sub.qty} onChange={v => onUpdateSubitem(sub.id, { qty: v })} type="number" />
                                    </td>
                                    <td className="px-2 py-1 border-r border-gray-200" style={{ minWidth: 180 }}>
                                        <EditableCell value={sub.description} onChange={v => onUpdateSubitem(sub.id, { description: v })} />
                                    </td>
                                    <td className="px-2 py-1 border-r border-gray-200" style={{ minWidth: 120 }}>
                                        <EditableCell value={sub.remarks} onChange={v => onUpdateSubitem(sub.id, { remarks: v })} />
                                    </td>
                                    <td className="px-2 py-1 border-r border-gray-200" style={{ minWidth: 120 }}>
                                        <EditableCell value={sub.shipper} onChange={v => onUpdateSubitem(sub.id, { shipper: v })} />
                                    </td>
                                    <td className="px-2 py-1 border-r border-gray-200" style={{ minWidth: 120 }}>
                                        <EditableCell value={sub.supplier} onChange={v => onUpdateSubitem(sub.id, { supplier: v })} />
                                    </td>
                                    <td className="px-2 py-1 border-r border-gray-200" style={{ minWidth: 60 }}>
                                        <EditableCell value={sub.cost} onChange={v => onUpdateSubitem(sub.id, { cost: v })} type="number" />
                                    </td>
                                    <td className="px-2 py-1 border-r border-gray-200" style={{ minWidth: 50 }}>
                                        <EditableCell value={sub.manpower} onChange={v => onUpdateSubitem(sub.id, { manpower: v })} type="number" />
                                    </td>
                                    <td className="px-2 py-1 border-r border-gray-200" style={{ minWidth: 50 }}>
                                        <EditableCell value={sub.ls} onChange={v => onUpdateSubitem(sub.id, { ls: v })} type="number" />
                                    </td>
                                    <td className="px-2 py-1 border-r border-gray-200" style={{ minWidth: 50 }}>
                                        <EditableCell value={sub.os} onChange={v => onUpdateSubitem(sub.id, { os: v })} type="number" />
                                    </td>
                                    <td className="px-2 py-1 border-r border-gray-200" style={{ minWidth: 70 }}>
                                        <div className="px-2 py-1 text-xs text-gray-800"> {Number(sub.cost || 0) + Number(sub.manpower || 0) + Number(sub.ls || 0) + Number(sub.os || 0) + Number(sub.tcSgd || 0)}
                                        </div>
                                    </td>
                                    <td className="px-2 py-1 border-r border-gray-200" style={{ minWidth: 60 }}>
                                        <EditableCell value={sub.uc} onChange={v => onUpdateSubitem(sub.id, { uc: v })} type="number" />
                                    </td>
                                    <td className="px-2 py-1 border-r border-gray-200" style={{ minWidth: 70 }}>
                                        <EditableCell value={sub.tcSgd} onChange={v => onUpdateSubitem(sub.id, { tcSgd: v })} type="number" />
                                    </td>
                                    <td className="px-2 py-1 border-r border-gray-200" style={{ minWidth: 70 }}>
                                        <div className="px-2 py-1 text-xs text-gray-800"> {Number(sub.up || 0) * Number(sub.qty || 0)}
                                        </div>
                                    </td>
                                    <td className="px-2 py-1 border-r border-gray-200" style={{ minWidth: 55 }}>
                                        <EditableCell value={sub.up} onChange={v => onUpdateSubitem(sub.id, { up: v })} type="number" />
                                    </td>
                                    <td className="px-2 py-1 border-r border-gray-200" style={{ minWidth: 55 }}>
                                        <EditableCell value={sub.numOfCartons} onChange={v => onUpdateSubitem(sub.id, { numOfCartons: v })} type="number" />
                                    </td>
                                    <td className="px-2 py-1 border-r border-gray-200" style={{ minWidth: 55 }}>
                                        <EditableCell value={sub.cnTracking} onChange={v => onUpdateSubitem(sub.id, { cnTracking: v })} />
                                    </td>
                                    <td className="px-2 py-1 border-r border-gray-200" style={{ minWidth: 55 }}>
                                        <EditableCell value={sub.sgTracking} onChange={v => onUpdateSubitem(sub.id, { sgTracking: v })} />
                                    </td>

                                </tr>

                                {sub.showTimeline && (
                                    <tr>
                                        <td colSpan={18} className="p-0 bg-blue-50/20">
                                            <TimelineSection
                                                rows={sub.timelineRows}
                                                onUpdate={rows => onUpdateSubitem(sub.id, { timelineRows: rows })}
                                            />
                                        </td>
                                    </tr>
                                )}

                                {sub.showPayments && (
                                    <tr>
                                        <td colSpan={18} className="p-0 bg-green-50/20">
                                            <PaymentsSection subitem={sub} onUpdate={u => onUpdateSubitem(sub.id, u)} onUpdateClientStatus={() => { }} />
                                        </td>
                                    </tr>
                                )}
                                {sub.showSample && (
                                    <tr>
                                        <td colSpan={18} className="p-0 bg-blue-50/20">
                                            <SamplesSection subitem={sub} onUpdate={u => onUpdateSubitem(sub.id, u)} />
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                        <tr>
                            <td colSpan={18} className="px-3 py-1.5">
                                <button
                                    onClick={onAddSubitem}
                                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-500 transition-colors"
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