"use client";
import { Package } from "lucide-react";
import { useState } from "react";
import { Subitem } from "../../app/types";
import { StatusBadge } from "./statusbadge";
const SAMPLE_ORDER_STATUS_COLORS: Record<string, string> = {
    'Pending': '#d7c8ff',
    'To order': '#b3a8ff',
    'Ordered': '#8f8aff',
    'Delivered': '#696cff',
    'Paid': '#00C875',
    'Shipped': '#3f50e7',
    'Failed': '#ac2865',
};

const SAMPLE_STATUS_COLORS: Record<string, string> = {
    'Ready to collect': '#ffba90',
    'Return arranged': '#ffa7b6',
    'Extended': '#ffa2d8',
    'Chased': '#f8a181',
    'Must return': '#ff5975',
    'Request to not return': '#d55694',
    'No return needed': '#638aff',
    'Failed': '#ac2865',
    'Returned': '#00C875',
};

const SAMPLE_TYPE_COLORS: Record<string, string> = {
    'Product sample': '#99aebb',
    'Pre-production sample': '#b7a6b4',
};
export function SamplesSection({ subitem, onUpdate, readOnly = false }: { subitem: Subitem; onUpdate: (u: Partial<Subitem>) => void; readOnly?: boolean }) {
    const [permissionNotice, setPermissionNotice] = useState<{ left: number; top: number } | null>(null);
    const sampleOrderStatusOpts = ['Pending', 'To order', 'Ordered', 'Delivered', 'Paid', 'Shipped', 'Failed']
    const sampleStatusOpts = ['Ready to collect', 'Return arranged', 'Extended', 'Chased', 'Must return', 'Request to not return', 'No return needed', 'Failed', 'Returned'];
    const sampleTypeOpts = ['Product sample', 'Pre-production sample'];

    const cols = [
        'Order Status', 'Return Status', 'Type', 'Return By Date', 'Sent Date', 'Returned Date',
    ];

    return (
        <div onClickCapture={(event) => { if (!readOnly) return; event.preventDefault(); event.stopPropagation(); const rect = (event.target as HTMLElement).getBoundingClientRect(); setPermissionNotice({ left: Math.min(rect.left, window.innerWidth - 300), top: Math.min(rect.bottom + 8, window.innerHeight - 48) }); window.setTimeout(() => setPermissionNotice(null), 2600); }} title={readOnly ? 'You can only edit items that are assigned to you' : undefined} className="ml-8 mr-2 mb-2 border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
            {permissionNotice && <div role="alert" className="fixed z-[10000] rounded-md bg-slate-800 px-3 py-2 text-xs font-medium text-white shadow-xl" style={permissionNotice}>You can only edit items that are assigned to you</div>}
            <div className="bg-gradient-to-r from-[#d5a5ec] to-[#ac7ec2] px-3 py-1.5 flex items-center gap-2">
                <Package size={12} className="text-white" />
                <span className="text-white text-xs font-semibold">Sample Details — {subitem.name}</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: 60 }}>
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            {cols.map(col => (
                                <th key={col} style={{ minWidth: ['Status', 'Type'].includes(col) ? 60 : 50 }}
                                    className="text-left px-2 py-1 text-xs font-semibold text-gray-500 whitespace-nowrap border-r border-gray-100 last:border-r-0">
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-2 py-1 border-r border-gray-100">
                                <StatusBadge value={subitem.sampleOrderStatus} onChange={v => onUpdate({ sampleOrderStatus: v })} options={sampleOrderStatusOpts} small />
                            </td>
                            <td className="px-2 py-1 border-r border-gray-100">
                                <StatusBadge value={subitem.sampleStatus} onChange={v => onUpdate({ sampleStatus: v })} options={sampleStatusOpts} small />
                            </td>
                            <td className="px-2 py-1 border-r border-gray-100">
                                <StatusBadge value={subitem.sampleType} onChange={v => onUpdate({ sampleType: v })} options={sampleTypeOpts} small />
                            </td>
                            <td className="px-2 py-1 border-r border-gray-100">
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
