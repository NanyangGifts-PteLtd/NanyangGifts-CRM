"use client";
import { CreditCard } from "lucide-react";
import { EditableCell } from "./editablecell";
import { ClientStatus, Subitem } from "../../app/types";
import { StatusBadge } from "./statusbadge";
const PAYMENT_STATUS_COLORS: Record<string, string> = {
    'Paid': '#037F4C',
    'To Pay': '#b3a8ff',
    'Partial': '#8b81da',
    'Overdue': '#ac2865',
    '': 'transparent',
};


export function PaymentsSection({ subitem, onUpdate, onUpdateClientStatus }: { subitem: Subitem; onUpdate: (u: Partial<Subitem>) => void; onUpdateClientStatus: (status: ClientStatus) => void }) {
    const paymentOpts = ['', 'Paid', 'To Pay', 'Partial', 'Overdue'];
    const modeOpts = ['', 'AliPay', '1688', 'Bank Transfer', 'PayPal', 'Stripe', 'Cash', 'Cheque', 'Wise'];

    const cols = [
        'Payment Terms', 'Status', 'Shipper', 'Supplier', 'Description',
        'Qty', 'Cost', 'Total', 'Manpower', 'LS (RMB)', 'Total Cost',
        'Mode of Payment', 'Order #', 'Qty Ordered', 'Sample', 'Qty For Client',
        'Payment Amt', 'Difference', 'Remarks',
    ];

    return (
        <div className="ml-8 mr-2 mb-2 border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="bg-gradient-to-r from-[#f291b6] to-[#e87da6] px-3 py-1.5 flex items-center gap-2">
                <CreditCard size={12} className="text-white" />
                <span className="text-white text-xs font-semibold">Payment Details — {subitem.name}</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: 1100 }}>
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            {cols.map(col => (
                                <th key={col} style={{ minWidth: ['Mode of Payment', 'Supplier', 'Order #'].includes(col) ? 140 : 70 }}
                                    className="text-left px-2 py-1 text-xs font-semibold text-gray-500 whitespace-nowrap border-r border-gray-100 last:border-r-0">
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-2 py-1 border-r border-gray-100"><EditableCell value={subitem.owner} onChange={v => onUpdate({ owner: v })} /></td>
                            <td className="px-2 py-1 border-r border-gray-100">
                                <StatusBadge value={subitem.paymentStatus} onChange={v => onUpdate({ paymentStatus: v })}
                                    options={paymentOpts} colorMap={PAYMENT_STATUS_COLORS} small />
                            </td>
                            <td className="px-2 py-1 border-r border-gray-100"><EditableCell value={subitem.shipper} onChange={v => onUpdate({ shipper: v })} /></td>
                            <td className="px-2 py-1 border-r border-gray-100"><EditableCell value={subitem.supplier} onChange={v => onUpdate({ supplier: v })} /></td>
                            <td className="px-2 py-1 border-r border-gray-100"><EditableCell value={subitem.description} onChange={v => onUpdate({ description: v })} /></td>
                            <td className="px-2 py-1 border-r border-gray-100"><EditableCell value={subitem.qty} onChange={v => onUpdate({ qty: v })} type="number" /></td>
                            <td className="px-2 py-1 border-r border-gray-100"><EditableCell value={subitem.cost} onChange={v => onUpdate({ cost: v })} type="number" /></td>
                            <td className="px-2 py-1 border-r border-gray-100"><EditableCell value={subitem.total} onChange={v => onUpdate({ total: v })} /></td>
                            <td className="px-2 py-1 border-r border-gray-100"><EditableCell value={subitem.manpower} onChange={v => onUpdate({ manpower: v })} type="number" /></td>
                            <td className="px-2 py-1 border-r border-gray-100"><EditableCell value={subitem.lsRmb} onChange={v => onUpdate({ lsRmb: v })} /></td>
                            <td className="px-2 py-1 border-r border-gray-100"><EditableCell value={subitem.totalC} onChange={v => onUpdate({ totalC: v })} /></td>
                            <td className="px-2 py-1 border-r border-gray-100">
                                <select value={subitem.modeOfPayment} onChange={e => onUpdate({ modeOfPayment: e.target.value })}
                                    className="text-xs border-none outline-none bg-transparent w-full cursor-pointer">
                                    {modeOpts.map(o => <option key={o} value={o}>{o || '–'}</option>)}
                                </select>
                            </td>
                            <td className="px-2 py-1 border-r border-gray-100"><EditableCell value={subitem.orderNumber} onChange={v => onUpdate({ orderNumber: v })} /></td>
                            <td className="px-2 py-1 border-r border-gray-100"><EditableCell value={subitem.quantityProduced} onChange={v => onUpdate({ quantityProduced: v })} type="number" /></td>
                            <td className="px-2 py-1 border-r border-gray-100"><EditableCell value={subitem.sample} onChange={v => onUpdate({ sample: v })} type="number" /></td>
                            <td className="px-2 py-1 border-r border-gray-100"><EditableCell value={subitem.qtyFor} onChange={v => onUpdate({ qtyFor: v })} type="number" /></td>
                            <td className="px-2 py-1 border-r border-gray-100"><EditableCell value={subitem.paymentAmount} onChange={v => onUpdate({ paymentAmount: v })} /></td>
                            <td className="px-2 py-1 border-r border-gray-100"><EditableCell value={subitem.difference} onChange={v => onUpdate({ difference: v })} /></td>
                            <td className="px-2 py-1"><EditableCell value={subitem.paymentRemarks} onChange={v => onUpdate({ paymentRemarks: v })} /></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}