'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown, ChevronRight, Plus, Calendar, CreditCard, Trash2,
  Filter, ChevronsDown, ChevronsUp, FileText, X, Package
} from 'lucide-react';
  import { Client, Subitem, TimelineRow, ClientStatus, ReplyStatus, SampleRow, SubitemStatus } from '../app/types';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogPortal, AlertDialogOverlay, AlertDialogTrigger } from './ui/alert-dialog';
import { Button } from './ui/button';




// ─── Constants ────────────────────────────────────────────────────────────────

export const EditableDate: React.FC = () => {
  const [date, setDate]= useState<Date>(new Date());
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(()=>{
    if (isEditing && inputRef.current){
      inputRef.current.focus();
    }
  }, [isEditing]);

  return (
    <div>
      {date.toDateString()}
    </div>
  );
};

export const CLIENT_STATUSES: ClientStatus[] = [
  'New Lead', 'Contacted', 'Quoted', 'Failed', 'Overdue',
  'Follow Up', 'Shortlisted', 'Project Started', 'Project Done', 'Closed', 'Unqualified',
];

export const REPLY_STATUSES: ReplyStatus[] = [
  'Waiting...', 'Replied'
];

const REPLY_STATUS_COLORS: Record<string, string> = {
  'Waiting...': '#c5b1ff',
  'Replied': '#00cdb6'
};

const STATUS_COLORS: Record<string, string> = {
  'New Lead': '#abd2fa',
  'Contacted': '#7692ff',
  'Quoted': '#3d518c',
  'Failed': '#d4102d',
  'Overdue': '#1b2cc1',
  'Follow Up': '#9D4393',
  'Shortlisted': '#a159cf',
  'Project Started': '#CF6E93',
  'Project Done': '#dcb0ff',
  'Closed': '#0D1821',
  'Unqualified': '#561769',
};

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
  'Local': '#a856a6' ,
  'Overseas': '#8b81da',
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  'Paid': '#037F4C',
  'To Pay': '#b3a8ff',
  'Partial': '#8b81da',
  'Overdue': '#ac2865',
  '': 'transparent',
};

const TIMELINE_PROGRESS_COLORS: Record<string, string> = {
  'Done': '#00C875',
  'Started': '#00C2C7',
  'Not Started': '#8b81da',
  '': '#e5e7eb',
};
const SAMPLE_ORDER_STATUS_COLORS: Record<string, string> = {
  'Pending': '#d7c8ff',
  'To order': '#b3a8ff',
  'Ordered':'#8f8aff',
  'Delivered':'#696cff',
  'Paid':'#00C875',
  'Shipped':'#3f50e7',
  'Failed': '#ac2865',
};

const SAMPLE_STATUS_COLORS: Record<string, string> = {
  'Ready to collect':'#ffba90',
  'Return arranged':'#ffa7b6',
  'Extended':'#ffa2d8',
  'Chased':'#f8a181',
  'Must return':'#ff5975',
  'Request to not return':'#d55694',
  'No return needed':'#638aff',
  'Failed':'#ac2865',
  'Returned':'#00C875',
};

const SAMPLE_TYPE_COLORS: Record<string, string> = {
  'Product sample': '#99aebb',
  'Pre-production sample':'#b7a6b4',
};

const IMPORTANCE_COLORS: Record<string, string> = {
  'High': '#e03131',
  'Medium': '#ff85a8',
  'Low': '#ffccd5'
};

const CHANNEL_COLORS: Record<string, string> = {
  'Forms': '#82E1C2',
  'Email': '#0085FF',
  'Referral': '#00C875',
  'Direct': '#0077B5',
  'Whatsapp': '#07C160',
  'E-comm': '#008b74'
};



// ─── EditableCell ─────────────────────────────────────────────────────────────

function EditableCell({
  value, onChange, type = 'text', placeholder = '–', className = '',
}: {
  value: string; onChange: (v: string) => void; type?: string;
  placeholder?: string; className?: string;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocal(value); }, [value]);
  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);

  const save = () => { onChange(local); setEditing(false); };

  if (editing) {
    return (
      <input
        ref={ref}
        type={type}
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={save}
        onKeyDown={e => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') { setLocal(value); setEditing(false); }
        }}
        className={`w-full px-1 py-0.5 text-xs border border-blue-400 rounded outline-none bg-white ${className}`}
        style={{ minWidth: 40 }}
      />
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      title={value}
      className={`w-full px-1 py-0.5 text-xs cursor-text hover:bg-blue-50 rounded truncate min-h-[22px] flex items-center ${className}`}
    >
      {value || <span className="text-gray-300 select-none">{placeholder}</span>}
    </div>
  );
}



// ─── StatusBadge — portal dropdown that opens to the side ────────────────────

const MENU_WIDTH = 168;

function StatusBadge({
  value, onChange, options, colorMap, small = false,
}: {
  value: string; onChange: (v: string) => void;
  options: string[]; colorMap: Record<string, string>; small?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on any outside click
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current && btnRef.current.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const handleOpen = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const spaceRight = window.innerWidth - rect.right;
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuHeight = Math.min(options.length * 30 + 8, 280);

    // Prefer right of button; fall back to left
    const left = spaceRight >= MENU_WIDTH + 8
      ? rect.right + 4
      : rect.left - MENU_WIDTH - 4;

    // Prefer below; fall back to above
    const top = spaceBelow >= menuHeight
      ? rect.top
      : Math.max(4, rect.bottom - menuHeight);

    setMenuStyle({ position: 'fixed', top, left, width: MENU_WIDTH, zIndex: 9999 });
    setOpen(v => !v);
  };

  const bg = colorMap[value] || '#e5e7eb';
  const textColor = bg === '#FFCB00' || bg === '#ffffff';


  const menu = open && createPortal(
    <div
      ref={menuRef}
      style={menuStyle}
      className="bg-white border font-semibold border-gray-200 rounded-lg shadow-2xl py-1 max-h-90 transition transform active:scale-95 duration-150"
    >
      {options.map(opt => (
        <button
          key={opt || '__empty__'}
          onMouseDown={e => e.preventDefault()}
          onClick={() => { console.log('clicked option', opt); onChange(opt); setOpen(false); }}
          className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors"
        >
          <span
            className="w-2.5 h-2.5 rounded-sm flex-shrink-0 border border-gray-200"
            style={{ background: colorMap[opt] || '#e5e7eb' }}
          />
          <span className="text-gray-700 flex-1">{opt || '–'}</span>
          {opt === value && <span className="text-blue-500 text-xs">✓</span>}
        </button>
      ))}
    </div>,
    document.body,
  );
  
  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`rounded font-medium whitespace-nowrap leading-none ${small ? 'px-2 py-1 text-xs' : 'px-2 py-1 text-xs'} transition transform active:scale-95 duration-150`}
        style={{ background: bg, color: '#ffffff', minWidth: 60 }}
      >
        {value || <span style={{ opacity: 0.5 }}>Set</span>}
      </button>
      {menu}
    </>
  );
}

// ─── Timeline Section ──────────────────────────────────────────────────────────

function TimelineSection({ rows, onUpdate }: {
  rows: TimelineRow[]; onUpdate: (rows: TimelineRow[]) => void;
}) {
  const updateRow = (id: string, field: keyof TimelineRow, val: string) =>
    onUpdate(rows.map(r => r.id === id ? { ...r, [field]: val } : r));

  const progressOpts = ['Not Started', 'Started', 'Done'];

  return (
    <div className="ml-8 mr-2 mb-2 border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
      <div className="bg-gradient-to-r from-[#9bd9e0] to-[#7BCBD5] px-3 py-1.5 flex items-center gap-2">
        <Calendar size={12} className="text-white" />
        <span className="text-white text-xs font-semibold">Project Timeline</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 500 }}>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {[
                { label: 'Subitem', w: 60 }, { label: 'Person', w: 30 },
                { label: 'Remarks', w: 160 }, { label: 'Sub-Progress', w: 100 },
                { label: 'Timeline', w: 160 }, { label: 'Duration', w: 70 },
                { label: 'Dependency', w: 120 }
              ].map(col => (
                <th key={col.label} style={{ minWidth: col.w }}
                  className="text-left px-2 py-1 text-xs font-semibold text-gray-500 whitespace-nowrap border-r border-gray-100 last:border-r-0">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const progColor = TIMELINE_PROGRESS_COLORS[row.subProgress] || '#e5e7eb';
              const textColor = row.subProgress === 'Done' || row.subProgress === 'Started' ? '#fff' : '#333';
              return (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-2 py-1 border-r border-gray-100">
                    <span className="text-xs text-gray-700">{row.name}</span>
                  </td>
                  <td className="px-2 py-1 border-r border-gray-100">
                    <EditableCell value={row.person} onChange={v => updateRow(row.id, 'person', v)} />
                  </td>
                  <td className="px-2 py-1 border-r border-gray-100">
                    <EditableCell value={row.remarks} onChange={v => updateRow(row.id, 'remarks', v)} />
                  </td>
                  <td className="px-2 py-1 border-r border-gray-100">
                    <StatusBadge
                      value={row.subProgress}
                      onChange={v => updateRow(row.id, 'subProgress', v)}
                      options={progressOpts}
                      colorMap={TIMELINE_PROGRESS_COLORS}
                      small
                    />
                  </td>
                  <td className="px-2 py-1 border-r border-gray-100">
                    {row.timelineStart && row.timelineEnd ? (
                      <span className="text-xs text-gray-600 whitespace-nowrap">
                        {new Date(row.timelineStart).toLocaleDateString('en-SG', { month: 'short', day: 'numeric' })}
                        {' – '}
                        {new Date(row.timelineEnd).toLocaleDateString('en-SG', { month: 'short', day: 'numeric' })}
                      </span>
                    ) : (
                      <div className="flex gap-1">
                        <input type="date" value={row.timelineStart}
                          onChange={e => updateRow(row.id, 'timelineStart', e.target.value)}
                          className="text-xs border-none outline-none bg-transparent w-20 cursor-pointer" />
                        <input type="date" value={row.timelineEnd}
                          onChange={e => updateRow(row.id, 'timelineEnd', e.target.value)}
                          className="text-xs border-none outline-none bg-transparent w-20 cursor-pointer" />
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1 border-r border-gray-100">
                    <EditableCell value={row.duration} onChange={v => updateRow(row.id, 'duration', v)} />
                  </td>
                  <td className="px-2 py-1 border-r border-gray-100">
                    <EditableCell value={row.dependency} onChange={v => updateRow(row.id, 'dependency', v)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Payments Section ──────────────────────────────────────────────────────────

function PaymentsSection({ subitem, onUpdate, onUpdateClientStatus }: { subitem: Subitem; onUpdate: (u: Partial<Subitem>) => void; onUpdateClientStatus: (status: ClientStatus) => void}) {
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

// Sample section
function SamplesSection({ subitem, onUpdate }: { subitem: Subitem; onUpdate: (u: Partial<Subitem>) => void }) {
  const sampleOrderStatusOpts = ['Pending', 'To order', 'Ordered', 'Delivered', 'Paid', 'Shipped', 'Failed']
  const sampleStatusOpts = ['Ready to collect', 'Return arranged', 'Extended', 'Chased', 'Must return', 'Request to not return', 'No return needed', 'Failed', 'Returned'];
  const sampleTypeOpts = ['Product sample', 'Pre-production sample'];

  const cols = [
    'Order Status', 'Return Status', 'Type', 'Return By Date', 'Sent Date', 'Returned Date',
  ];

  return (
    <div className="ml-8 mr-2 mb-2 border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
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
                <StatusBadge value={subitem.sampleOrderStatus} onChange={v => onUpdate({ sampleOrderStatus: v })} options={sampleOrderStatusOpts} colorMap={SAMPLE_ORDER_STATUS_COLORS} small />
              </td>
              <td className="px-2 py-1 border-r border-gray-100">
                <StatusBadge value={subitem.sampleStatus} onChange={v => onUpdate({ sampleStatus: v })} options={sampleStatusOpts} colorMap={SAMPLE_STATUS_COLORS} small />
              </td>
              <td className="px-2 py-1 border-r border-gray-100">
                <StatusBadge value={subitem.sampleType} onChange={v => onUpdate({ sampleType: v })} options={sampleTypeOpts} colorMap={SAMPLE_TYPE_COLORS} small />
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

// ─── Subitem Rows ────────────────────────────────────────────────────────────

function SubitemsTable({ clientId, subitems, clientColor, onUpdateSubitem, onAddSubitem, onDeleteSubitem }: {
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
                      <td className="px-2 py-1" style={{ minWidth: 40 }}>
                        <button
                          onClick={() => onDeleteSubitem(sub.id)}
                        className="p-1 text-gray-300 hover:text-red-400 transition-colors opacity-100 group-hover:opacity-100"
                          title="Delete subitem"
                      >
                      <Trash2 size={15} />
                    </button>
                  </td>
                      <button
                        onClick={() => onUpdateSubitem(sub.id, { showTimeline: !sub.showTimeline, showPayments: false, showSample: false })}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                          sub.showTimeline ? 'bg-[#7BCBD5] text-white' : 'bg-transparent text-[#6db6bf] hover:bg-teal-100 border border-teal-200'
                        }`}
                      >
                        <Calendar size={9} />Timeline
                      </button>
                      <button
                        onClick={() => onUpdateSubitem(sub.id, { showPayments: !sub.showPayments, showTimeline: false, showSample: false })}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0  ${
                          sub.showPayments ? 'bg-[#f291b6] text-white' : 'bg-transparent text-[#e87da6] hover:bg-pink-100 border border-pink-200'
                        }`}
                      >
                        <CreditCard size={9} />Payments
                      </button>
                      <button
                        onClick={() => onUpdateSubitem(sub.id, { showPayments: false, showTimeline: false, showSample: !sub.showSample })}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                          sub.showSample ? 'bg-[#d5a5ec] text-white' : 'bg-transparent text-[#ac7ec2] hover:bg-purple-100 border border-purple-200'
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
                      <PaymentsSection subitem={sub} onUpdate={u => onUpdateSubitem(sub.id, u)} onUpdateClientStatus={()=>{}} />
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

// ─── Client Rows ────────────────────────────────────────────────────────────────

function ClientRow({
  client, isSelected, onToggleSelect, onUpdate, onUpdateSubitem,
  onAddSubitem, onDeleteSubitem, onDelete,
}: {
  client: Client;
  isSelected: boolean;
  onToggleSelect: () => void;
  onUpdate: (u: Partial<Client>) => void;
  onUpdateSubitem: (subitemId: string, u: Partial<Subitem>) => void;
  onAddSubitem: () => void;
  onDeleteSubitem: (id: string) => void;
  onDelete: () => void;
}) {
  const importanceOpts = ['High', 'Medium', 'Low'];
  const channelOpts = ['Forms', 'Email', 'Referral', 'Whatsapp', 'E-comm', 'Direct'];
  const subitemCount = client.subitems.length;
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<ClientStatus | null>(null);
  const [closeFiles, setCloseFiles] = useState<File[]>([]);
  const [closeConfirmed, setCloseConfirmed] = useState(false);

  return (
    <div className="mbs-3">
      <div className={`flex items-stretch border-b border-gray-100 hover:bg-gray-50 group transition-colors ${isSelected ? 'bg-blue-50' : ''}`}>

        {/* Checkbox + expand */}
        <div className="flex items-center px-2 gap-1.5 flex-shrink-0 border-r border-gray-200" style={{ minWidth: 60, width: 60 }}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="w-3 h-3 rounded cursor-pointer accent-[#7BCBD5]"
          />
          <button
            onClick={() => onUpdate({ expanded: !client.expanded })}
            className="text-gray-400 hover:text-gray-700 transition-colors"
          >
            {client.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>

        {/* Client name */}
        <div className="flex items-center gap-1.5 px-1 py-2 border-r border-gray-200 flex-shrink-0" style={{height:30, minWidth: 180, width: 100 }}>
          
          <EditableCell
            value={client.name}
            onChange={v => onUpdate({ name: v })}
            placeholder="Client name"
            className="font-semibold text-gray-800"
          />
          {subitemCount > 0 && (
            <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5 flex-shrink-0">{subitemCount}</span>
          )}
        </div>

        {/* People */}
        <div className="flex items-center px-2 border-r border-gray-200 flex-shrink-0" style={{ minWidth: 70, width: 70 }}>
          {client.people ? (
            <div className="flex gap-0.5 flex-wrap">
              {client.people.split(' ').map((p, i) => (
                <div key={i} className="w-6 h-6 rounded-sm flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: ['#845ec2', '#2c73d2', '#0081cf', '#0089ba'][i % 4] }}>
                  {p[0]}
                </div>
              ))}
            </div>
          ) : (
            <div className="w-6 h-6 rounded-sm border-2 border-dashed border-gray-300 flex items-center justify-center hover:border-blue-400">
              <Plus size={9} className="text-gray-400" />
            </div>
          )}
        </div>

        {/* Reply Status */}
        <div className="flex items-center px-2 border-r border-gray-200" style={{ minWidth: 90, width: 90 }}>
          <StatusBadge
            value={client.replyStatus}
            onChange={v => onUpdate({ replyStatus: v as ReplyStatus })}
            options={REPLY_STATUSES}
            colorMap={REPLY_STATUS_COLORS}
          />
        </div>

        {/* Follow Up */}
        <div className="flex items-center px-2 border-r border-gray-200" style={{ minWidth: 100, width: 100 }}>
          <input type="date" value={client.followUp} onChange={e => onUpdate({ followUp: e.target.value })}
            className="text-xs border-none outline-none bg-transparent cursor-pointer w-full" />
        </div>

        {/* Status */}
        <div className="flex items-center px-2 border-r border-gray-200 flex-shrink-0" style={{ minWidth: 115, width: 115 }}>
          <StatusBadge
            value={client.status}
            onChange={(v) => {
              const nextStatus = v as ClientStatus;

              if (nextStatus=="Closed"){
                setPendingStatus(nextStatus);
                setCloseFiles([]);
                setCloseConfirmed(false);
                setShowCloseDialog(true);
                return;
              }
              onUpdate({ status: nextStatus });
            }
            }
            options={CLIENT_STATUSES}
            colorMap={STATUS_COLORS}
          />
          <AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Close this client?</AlertDialogTitle>
      <AlertDialogDescription>
        Please upload the required files and confirm before marking this client as Closed.
      </AlertDialogDescription>
    </AlertDialogHeader>

    <div className="space-y-4 py-2">
      <div>
        <label className="text-sm font-medium">Upload purchase order</label>
        <input
          type="file"
          multiple
          className="file:rounded-md file:border-0 file:font-semibold file:bg-[#7BCBD5] file:text-[#ffffff] hover:file:bg-[#6db6bf] file:mr-4 mt-2 block text-sm transition transform active:scale-95 duration-150"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            setCloseFiles(files);
          }}
        />
        <br />
        <label className="text-sm font-medium">Upload signed quotation</label>
        <input
          type="file"
          multiple
          className="file:rounded-md file:border-0 file:font-semibold file:bg-[#7BCBD5] file:text-[#ffffff] hover:file:bg-[#6db6bf] file:mr-4 mt-2 block text-sm transition transform active:scale-95 duration-150"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            setCloseFiles(files);
          }}
        />
        <br />
        <label className="text-sm font-medium">Upload proof of payment</label>
        <input
          type="file"
          multiple
          className="file:rounded-md file:border-0 file:font-semibold file:bg-[#7BCBD5] file:text-[#ffffff] hover:file:bg-[#6db6bf] file:mr-4 mt-2 block text-sm transition transform active:scale-95 duration-150"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            setCloseFiles(files);
          }}
        />
        {closeFiles.length > 0 && (
          <div className="mt-2 text-xs text-gray-500 font-semibold">
            {closeFiles.length} file(s) selected
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={closeConfirmed}
          onChange={(e) => setCloseConfirmed(e.target.checked)}
        />
        OCF signed?
      </label>
    </div>

    <AlertDialogFooter>
      <AlertDialogCancel
        onClick={() => {
          setPendingStatus(null);
          setCloseFiles([]);
          setCloseConfirmed(false);
        }}
      >
        Cancel
      </AlertDialogCancel>

      <AlertDialogAction
        onClick={(e) => {
          if (!closeFiles.length || !closeConfirmed || pendingStatus !== "Closed") {
            e.preventDefault();
            return;
          }

          onUpdate({
            status: "Closed",
            // future: store metadata too
            // closedFiles: closeFiles,
            // closedAt: new Date().toISOString(),
          });

          setShowCloseDialog(false);
          setPendingStatus(null);
          setCloseFiles([]);
          setCloseConfirmed(false);
        }}
      >
        Confirm Close
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
        </div>

        {/* Channel */}
        <div className="flex items-center px-2 border-r border-gray-200 flex-shrink-0" style={{ minWidth: 90, width: 90 }}>
          <StatusBadge value={client.channel} onChange={v => onUpdate({ channel: v })} options={channelOpts} colorMap={CHANNEL_COLORS} small />
        </div>

        {/* Importance */}
        <div className="flex items-center px-2 border-r border-gray-200 flex-shrink-0" style={{ minWidth: 80, width: 80 }}>
          <StatusBadge value={client.importance} onChange={v => onUpdate({ importance: v })} options={importanceOpts} colorMap={IMPORTANCE_COLORS} small />
        </div>

        {/* Company */}
        <div className="flex items-center px-2 border-r border-gray-200" style={{ minWidth: 170, width: 170 }}>
          <EditableCell value={client.company} onChange={v => onUpdate({ company: v })} placeholder="Company" />
        </div>

        {/* Email */}
        <div className="flex items-center px-2 border-r border-gray-200" style={{ minWidth: 180, width: 180 }}>
          <EditableCell value={client.email} onChange={v => onUpdate({ email: v })} placeholder="Email" />
        </div>

        {/* Phone */}
        <div className="flex items-center px-2 border-r border-gray-200" style={{ minWidth: 120, width: 120 }}>
          <EditableCell value={client.phone} onChange={v => onUpdate({ phone: v })} placeholder="Phone" />
        </div>

        {/* Requirements */}
        <div className="flex items-center px-2 border-r border-gray-200" style={{ minWidth: 160, width: 160 }}>
          <EditableCell value={client.requirements} onChange={v => onUpdate({ requirements: v })} placeholder="Requirements" />
        </div>

        {/* Qty */}
        <div className="flex items-center px-2 border-r border-gray-200" style={{ minWidth: 60, width: 60 }}>
          <EditableCell value={client.qty} onChange={v => onUpdate({ qty: v })} type="number" />
        </div>

        {/* NBD */}
        <div className="flex items-center px-2 border-r border-gray-200" style={{ minWidth: 100, width: 100 }}>
            <input type="date" value={client.followUp} onChange={e => onUpdate({ followUp: e.target.value })}
            className="text-xs border-none outline-none bg-transparent cursor-pointer w-full" />
        </div>

        {/* Total Price */}
        <div className="flex items-center px-2 border-r border-gray-200" style={{ minWidth: 90, width: 90 }}>
          <EditableCell value={client.totalPrice} onChange={v => onUpdate({ totalPrice: v })} />
        </div>

        {/* Company Address */}
        <div className="flex items-center px-2 border-r border-gray-200" style={{ minWidth: 115, width: 115 }}>
          <EditableCell value={client.companyAddress} onChange={v => onUpdate({ companyAddress: v })} />
        </div>
        
        {/* Billing Address */}
        <div className="flex items-center px-2 border-r border-gray-200" style={{ minWidth: 115, width: 115 }}>
          <EditableCell value={client.billingAddress} onChange={v => onUpdate({ billingAddress: v })} />
        </div>

        {/* Date Created */}
        <div className="flex items-center px-2 border-r border-gray-200" style={{ minWidth: 120, width: 120 }}>
          <EditableCell value={client.dateCreated} onChange={v => onUpdate({ dateCreated: v })} />
        </div>


        {/* Delete — always visible */}
        <div className="flex items-center px-2 flex-shrink-0" style={{ minWidth: 36, width: 36 }}>
          <button
            onClick={onDelete}
            title="Delete client"
            className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {client.expanded && (
        <SubitemsTable
          clientId={client.id}
          subitems={client.subitems}
          clientColor={'#7BCBD5'}
          onUpdateSubitem={onUpdateSubitem}
          onAddSubitem={onAddSubitem}
          onDeleteSubitem={onDeleteSubitem}
        />
      )}
    </div>
  );
}

// ─── CRMBoard ─────────────────────────────────────────────────────────────────

const CLIENT_HEADER_COLS = [
  { label: '', width: 60 },            // checkbox + expand
  { label: 'Client', width: 180 },
  { label: 'People', width: 70 },
  { label: 'Reply Status', width: 90 },
  { label: 'Follow Up', width: 100 },
  { label: 'Status', width: 115 },
  { label: 'Channel', width: 90 },
  { label: 'Importance', width: 80 },
  { label: 'Company', width: 170 },
  { label: 'Email', width: 180 },
  { label: 'Phone', width: 120 },
  { label: 'Requirements', width: 160 },
  { label: 'Qty', width: 60 },
  { label: 'NBD', width: 100 },
  { label: 'Total Price', width: 90 },
  { label: 'Company Address', width: 115 },
  { label: 'Billing Address', width: 120 },
  { label: 'Date Created', width: 90 },
  { label: '', width: 60 },            // delete button column
];

const TOTAL_MIN_WIDTH = CLIENT_HEADER_COLS.reduce((s, c) => s + c.width, 0);

interface CRMBoardProps {
  clients: Client[];
  onUpdateClients: (clients: Client[]) => void;
  search?: string;
}

export function CRMBoard({ clients, onUpdateClients, search='' }: CRMBoardProps) {
  const [filterStatus, setFilterStatus] = useState<ClientStatus | 'All'>('All');
  const [showFilter, setShowFilter] = useState(false);
  const [allExpanded, setAllExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const filterRef = useRef<HTMLDivElement>(null);

  const displayedClients = clients.filter((client) => {
    const matchesStatus =
      filterStatus === 'All' || client.status === filterStatus;

    const q = (search ?? '').trim().toLowerCase();
    const matchesSearch =
      !q ||
      client.name.toLowerCase().includes(q) ||
      client.people.toLowerCase().includes(q) ||
      client.company.toLowerCase().includes(q) ||
      client.subitems.some((subitem) =>
        (subitem.name ?? '').toLowerCase().includes(q)
      );

    return matchesStatus && matchesSearch;
  });
  const GROUP_ORDER = [
    "New Lead", 
    "Contacted",
    "Quoted",
    "Failed",
    "Overdue",
    "Follow Up",
    "Shortlisted",
    "Project Started",
    "Project Done",
    "Closed",
    "Unqualified"
  ];
  const groupedClients = GROUP_ORDER.map((status) => ({
    status,
    clients: displayedClients.filter((client) => client.status === status),
    })).filter((group) => group.clients.length > 0);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupStatus: string) => {
    setCollapsedGroups((prev) => ({
    ...prev,
    [groupStatus]: !prev[groupStatus],
  }));
};

  useEffect(() => {
    if (!showFilter) return;
    const h = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilter(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showFilter]);

  const filteredClients = filterStatus === 'All'
    ? clients
    : clients.filter(c => c.status === filterStatus);

  // ── selection helpers ──
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const allFilteredSelected = filteredClients.length > 0 && filteredClients.every(c => selectedIds.has(c.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredClients.forEach(c => next.delete(c.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredClients.forEach(c => next.add(c.id));
        return next;
      });
    }
  };

  const deleteSelected = () => {
    onUpdateClients(clients.filter(c => !selectedIds.has(c.id)));
    setSelectedIds(new Set());
  };

  // ── client/subitem updates ──
  const updateClient = useCallback((clientId: string, updates: Partial<Client>) => {
    onUpdateClients(clients.map(c => c.id === clientId ? { ...c, ...updates } : c));
  }, [clients, onUpdateClients]);

  const updateSubitem = useCallback((clientId: string, subitemId: string, updates: Partial<Subitem>) => {
    onUpdateClients(clients.map(c =>
      c.id !== clientId ? c
        : { ...c, subitems: c.subitems.map(s => s.id === subitemId ? { ...s, ...updates } : s) }
    ));
  }, [clients, onUpdateClients]);

  const addSubitem = useCallback((clientId: string) => {
    const now = Date.now();
    const timelineRows: TimelineRow[] = [
      { id: `tl-${now}-1`, name: 'Sample', person: '',  remarks: '', subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: '',   status: '' },
      { id: `tl-${now}-2`, name: 'Production', person: '',  remarks: '', subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: 'Sample',  status: '' },
      { id: `tl-${now}-3`, name: 'Check Production Status (+3 from production start)', person: '',   subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: '',   status: '', remarks:'' },
      { id: `tl-${now}-4`, name: 'Local Shipping', person: '',  remarks: '', subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: 'Production FS-1',   status: '' },
      { id: `tl-${now}-5`, name: 'Sea/Air Freight', person: '',  remarks: '', subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: 'Local Shipping',   status: '' },
      { id: `tl-${now}-6`, name: 'Check Shipment Status (+3 from shipment start)', person: '',   subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: '', remarks: '',  status: '' },
      { id: `tl-${now}-7`, name: 'NBD', person: '', remarks: '', subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: '',  status: '' },
    ];
    const sampleRows: SampleRow[] = [
      
    ];
    const newSubitem: Subitem = {
      id: `s-${now}`, name: 'New Item', people: '', status: '', qty: '', description: '',
      supplier: '', cost: '', manpower: '', ls: '', os: '', tc: '', uc: '', tcSgd: '', price: '', up: '',
      owner: '', shipper: '', paymentStatus: '', total: '', lsRmb: '', totalC: '',
      modeOfPayment: '', orderNumber: '', quantityProduced: '', sample: '', qtyFor: '',
      paymentAmount: '', difference: '', paymentRemarks: '', numOfCartons:'', cnTracking:'', sgTracking:'', localOverseas:'Local', remarks:'', sampleOrderStatus:'',
      timelineRows, showTimeline: false, showPayments: false, sampleRows, sampleStatus:'', sampleType:'', showSample: false,
    };
    onUpdateClients(clients.map(c => c.id === clientId ? { ...c, subitems: [...c.subitems, newSubitem] } : c));
  }, [clients, onUpdateClients]);

  const deleteSubitem = useCallback((clientId: string, subitemId: string) => {
    onUpdateClients(clients.map(c =>
      c.id === clientId ? { ...c, subitems: c.subitems.filter(s => s.id !== subitemId) } : c
    ));
  }, [clients, onUpdateClients]);

  const deleteClient = useCallback((clientId: string) => {
    onUpdateClients(clients.filter(c => c.id !== clientId));
    setSelectedIds(prev => { const n = new Set(prev); n.delete(clientId); return n; });
  }, [clients, onUpdateClients]);

  const addClient = useCallback(() => {
    const colors = ['#845ec2', '#2c73d2', '#0081cf', '#0089ba', '#008e9b', '#008f7a', '#4e8397'];
    const newClient: Client = {
      id: `c-${Date.now()}`, name: 'New Client', people: '', replyStatus: '',
      followUp: '',  status: 'New Lead', channel: '', importance: '',
      company: '', email: '', phone: '', requirements: '', qty: '', nbd: '', totalPrice: '',
      companyAddress: '', billingAddress: '', dateCreated: '', expanded: true,
      color: colors[clients.length % colors.length], subitems: [],
    };
    onUpdateClients([...clients, newClient]);
  }, [clients, onUpdateClients]);

  const toggleExpandAll = () => {
    const next = !allExpanded;
    setAllExpanded(next);
    onUpdateClients(clients.map(c => ({ ...c, expanded: next })));
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white flex-shrink-0">
          <button
          onClick={addClient}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#7BCBD5] hover:bg-[#61a5ad] text-white rounded-md text-xs font-medium transition-colors"
          >
          <Plus size={13} />Add Client
        </button>
        <button
          onClick={toggleExpandAll}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#7BCBD5] hover:bg-[#61a5ad] text-white rounded-md text-xs font-medium transition-colors"
        >
          {allExpanded ? <ChevronsUp size={14} /> : <ChevronsDown size={14} />}
          {allExpanded ? 'Collapse All' : 'Expand All'}
        </button>

        {/* Filter */}
        <div ref={filterRef} className="relative">
          <button
            onClick={() => setShowFilter(!showFilter)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#7BCBD5] hover:bg-[#61a5ad] text-white rounded-md text-xs font-medium transition-colors"
          >
            <Filter size={13} />
            {filterStatus === 'All' ? 'Filter by Status' : filterStatus}
            <ChevronDown size={11} />
          </button>
          {showFilter && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 min-w-44 py-1 max-h-80 overflow-y-auto">
              <button
                onClick={() => { setFilterStatus('All'); setShowFilter(false); }}
                className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50"
              >
                <span className="w-2.5 h-2.5 rounded-sm bg-gray-300" />
                All Clients
                {filterStatus === 'All' && <span className="ml-auto text-blue-500">✓</span>}
              </button>
              <div className="border-t border-gray-100 my-1" />
              {CLIENT_STATUSES.map(st => (
                <button
                  key={st}
                  onClick={() => { setFilterStatus(st); setShowFilter(false); }}
                  className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50"
                >
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: STATUS_COLORS[st] }} />
                  <span className="flex-1">{st}</span>
                  <span className="text-gray-400">{clients.filter(c => c.status === st).length}</span>
                  {filterStatus === st && <span className="text-blue-500 ml-1">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status pills beside filter by status */}
        <div className="flex items-center gap-1">
          {CLIENT_STATUSES.map(st => {
            const count = clients.filter(c => c.status === st).length;
            if (!count) return null;
            return (
              <button
                key={st}
                onClick={() => setFilterStatus(filterStatus === st ? 'All' : st)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-opacity transition transform active:scale-95 duration-150"
                style={{
                  background: STATUS_COLORS[st],
                  color: ['#FFCB00', '#BFCC94', '#abd2fa'].includes(STATUS_COLORS[st]) ? '#ffffff' : '#fff',
                  opacity: filterStatus !== 'All' && filterStatus !== st ? 0.35 : 1,
                }}>
                {st}<span className="bg-white/30 rounded-full px-1">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        {/* Bulk delete — visible when rows are selected */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-md px-3 py-1.5">
            <span className="text-xs text-red-600 font-medium">{selectedIds.size} selected</span>
            <button
              onClick={deleteSelected}
              className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-semibold transition-colors"
            >
              <Trash2 size={12} />Delete
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Clear selection"
            >
              <X size={13} />
            </button>
          </div>
        )}


      </div>

      {/* ── Board (header + rows share one scroll container) ── */}
      <div className="flex-1 overflow-auto text-gray-500 font-semibold">
        <div style={{ minWidth: TOTAL_MIN_WIDTH }}>

          {/* Sticky column header */}
          <div
            className="flex items-center flex-shrink-0 border-b border-gray-200 animated-background bg-gradient-to-r from-[#e7fdff] to-[#a3dfff] sticky top-0 z-10" // edit here 
            style={{ minWidth: TOTAL_MIN_WIDTH }}
          >
            {/* Select-all checkbox in first header cell */}
            <div className="flex items-center px-2 gap-1.5 flex-shrink-0 border-r border-gray-200" style={{ minWidth: 60, width: 60 }}>
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleSelectAll}
                className="w-3 h-3 rounded cursor-pointer accent-[#7BCBD5]"
                title={allFilteredSelected ? 'Deselect all' : 'Select all'}
              />
            </div>
            {CLIENT_HEADER_COLS.slice(1).map((col, i) => (
              <div
                key={i}
                className="flex items-center px-2 py-1.5 border-r border-gray-200 last:border-r-0 text-xs font-semibold text-gray-500 whitespace-nowrap flex-shrink-0"
                style={{ minWidth: col.width, width: col.width }}
              >
                {col.label}
              </div>
            ))}
          </div>

          {/* Client group headers */}
          {groupedClients.map((group) => (
          <React.Fragment key={group.status}>
          <div className="flex items-center gap-2.5 px-2 py-0.4 text-sm bg-gray-50 border-y border-gray-100">
            <button
            onClick={() => toggleGroup(group.status)}
            className="text-sm text-gray-500"
          >
            {collapsedGroups[group.status] ? '▷' : '▼'}
            </button>
      <div className="h-5 w-1 rounded bg-[#7BCBD5]" />
      <div>
        <div className="font-semibold text-slate-700">{group.status}</div>
        <div className="text-xs italic font-normal text-slate-500">
          {group.clients.length} Clients
        </div>
      </div>
    </div>

    {!collapsedGroups[group.status] &&
      group.clients.map((client) => (
        <ClientRow
          key={client.id}
          client={client}
          isSelected={selectedIds.has(client.id)}
          onToggleSelect={() => toggleSelect(client.id)}
          onUpdate={(updates) => updateClient(client.id, updates)}
          onUpdateSubitem={(subitemId, updates) =>
            updateSubitem(client.id, subitemId, updates)
          }
          onAddSubitem={() => addSubitem(client.id)}
          onDeleteSubitem={(subitemId) => deleteSubitem(client.id, subitemId)}
          onDelete={() => deleteClient(client.id)}
          />
          ))}
        </React.Fragment> 
        ))}
        </div>
      </div>
    </div>
  );
}
