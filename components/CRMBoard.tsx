'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronDown, Plus, Trash2,
  Filter, ChevronsDown, ChevronsUp, X
} from 'lucide-react';
import { Client, Subitem, TimelineRow, ClientStatus, SampleRow, ActivityEntry} from '../app/types';
import { createClient } from '@/lib/supabase/client';
import { ClientRow, CLIENT_STATUSES, STATUS_COLORS } from './ui/clientrows';

async function getCurrentActorName() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "Unknown user";

  return (
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email ||
    "Unknown user"
  );
}


// ─── Constants ────────────────────────────────────────────────────────────────

const supabase = createClient();
const {
  data: { user },
} = await supabase.auth.getUser();

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
const EXCLUDED_ACTIVITY_FIELDS = new Set<keyof Client>(["expanded"]);

const updateClient = useCallback(
  async (clientId: string, updates: Partial<Client>) => {
    const actorName = await getCurrentActorName();

    onUpdateClients(
      clients.map((client) => {
        if (client.id !== clientId) return client;

        const newEntries: ActivityEntry[] = Object.entries(updates)
          .filter(([field, newValue]) => {
            const typedField = field as keyof Client;

            if (EXCLUDED_ACTIVITY_FIELDS.has(typedField)) return false;

            return client[typedField] !== newValue;
          })
          .map(([field, newValue]) => ({
            id: crypto.randomUUID(),
            action: "field_changed",
            fieldName: field,
            oldValue: client[field as keyof Client],
            newValue,
            actorName,
            createdAt: new Date().toISOString(),
          }));

        return {
          ...client,
          ...updates,
          activityLog: [...(client.activityLog ?? []), ...newEntries],
        };
      })
    );
  },
  [clients, onUpdateClients]
);

// Update subitem 
const updateSubitem = useCallback(
  async (clientId: string, subitemId: string, updates: Partial<Subitem>) => {
    const actorName = await getCurrentActorName();

    onUpdateClients(
      clients.map((client) => {
        if (client.id !== clientId) return client;

        const targetSubitem = client.subitems.find((s) => s.id === subitemId);
        if (!targetSubitem) return client;

        const subitemEntries: ActivityEntry[] = Object.entries(updates)
          .filter(([field, newValue]) => {
            return targetSubitem[field as keyof Subitem] !== newValue;
          })
          .map(([field, newValue]) => ({
            id: crypto.randomUUID(),
            action: "subitem_field_changed",
            fieldName: field,
            oldValue: targetSubitem[field as keyof Subitem],
            newValue,
            actorName,
            createdAt: new Date().toISOString(),
            subitemId,
            subitemName:
              (targetSubitem as { item?: string; name?: string }).item ??
              (targetSubitem as { item?: string; name?: string }).name ??
              "Subitem",
          }));

        return {
          ...client,
          subitems: client.subitems.map((s) =>
            s.id === subitemId ? { ...s, ...updates } : s
          ),
          activityLog: [...(client.activityLog ?? []), ...subitemEntries],
        };
      })
    );
  },
  [clients, onUpdateClients]
);

  const addSubitem = useCallback(
  async (clientId: string) => {
    const actorName = await getCurrentActorName();
    const now = Date.now();

    const timelineRows: TimelineRow[] = [
      { id: `tl-${now}-1`, name: "Sample", person: "", remarks: "", subProgress: "", timelineStart: "", timelineEnd: "", duration: "", dependency: "", status: "" },
      { id: `tl-${now}-2`, name: "Production", person: "", remarks: "", subProgress: "", timelineStart: "", timelineEnd: "", duration: "", dependency: "Sample", status: "" },
      { id: `tl-${now}-3`, name: "Check Production Status (+3 from production start)", person: "", subProgress: "", timelineStart: "", timelineEnd: "", duration: "", dependency: "", status: "", remarks: "" },
      { id: `tl-${now}-4`, name: "Local Shipping", person: "", remarks: "", subProgress: "", timelineStart: "", timelineEnd: "", duration: "", dependency: "Production FS-1", status: "" },
      { id: `tl-${now}-5`, name: "Sea/Air Freight", person: "", remarks: "", subProgress: "", timelineStart: "", timelineEnd: "", duration: "", dependency: "Local Shipping", status: "" },
      { id: `tl-${now}-6`, name: "Check Shipment Status (+3 from shipment start)", person: "", subProgress: "", timelineStart: "", timelineEnd: "", duration: "", dependency: "", remarks: "", status: "" },
      { id: `tl-${now}-7`, name: "NBD", person: "", remarks: "", subProgress: "", timelineStart: "", timelineEnd: "", duration: "", dependency: "", status: "" },
    ];

    const sampleRows: SampleRow[] = [];

    const newSubitem: Subitem = {
      id: `s-${now}`, name: "New Item", people: "", status: "", qty: "", description: "",
      supplier: "", cost: "", manpower: "", ls: "", os: "", tc: "", uc: "", tcSgd: "",
      price: "", up: "", owner: "", shipper: "", paymentStatus: "", total: "",
      lsRmb: "", totalC: "", modeOfPayment: "", orderNumber: "", quantityProduced: "",
      sample: "",qtyFor: "",paymentAmount: "",difference: "",paymentRemarks: "",
      numOfCartons: "",cnTracking: "",sgTracking: "",localOverseas: "Local",
      remarks: "",sampleOrderStatus: "",timelineRows,showTimeline: false,
      showPayments: false,sampleRows,sampleStatus: "",sampleType: "",showSample: false,
    };

    onUpdateClients(
      clients.map((client) => {
        if (client.id !== clientId) return client;

        const entry: ActivityEntry = {
          id: crypto.randomUUID(),
          action: "subitem_added",
          actorName,
          createdAt: new Date().toISOString(),
          subitemId: newSubitem.id,
          subitemName: newSubitem.name ?? "Subitem",
          newValue: newSubitem,
        };

        return {
          ...client,
          subitems: [...client.subitems, newSubitem],
          activityLog: [...(client.activityLog ?? []), entry],
        };
      })
    );
  },
  [clients, onUpdateClients]
);
  const deleteSubitem = useCallback(
  async (clientId: string, subitemId: string) => {
    const actorName = await getCurrentActorName();

    onUpdateClients(
      clients.map((client) => {
        if (client.id !== clientId) return client;

        const targetSubitem = client.subitems.find((s) => s.id === subitemId);
        if (!targetSubitem) return client;

        const entry: ActivityEntry = {
          id: crypto.randomUUID(),
          action: "subitem_deleted",
          actorName,
          createdAt: new Date().toISOString(),
          subitemId,
          subitemName:
            (targetSubitem as { item?: string; name?: string }).item ??
            (targetSubitem as { item?: string; name?: string }).name ??
            "Subitem",
          oldValue: targetSubitem,
        };

        return {
          ...client,
          subitems: client.subitems.filter((s) => s.id !== subitemId),
          activityLog: [...(client.activityLog ?? []), entry],
        };
      })
    );
  },
  [clients, onUpdateClients]
);

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
