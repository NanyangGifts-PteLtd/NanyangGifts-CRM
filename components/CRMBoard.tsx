'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronDown,
  Plus,
  Trash2,
  Filter,
  ChevronsDown,
  ChevronsUp,
  X,
} from 'lucide-react';
import {
  Client,
  Subitem,
  ClientStatus,
  Profile,
  ClientAssigneeMap,
  SubitemAssigneeMap,
} from '../app/types';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import { ClientRow, CLIENT_STATUSES, STATUS_COLORS } from './ui/clientrows';
import {
  fetchProfiles,
  fetchClientAssigneeIds,
  fetchSubitemAssigneeIds,
  saveClientAssignees,
  saveSubitemAssignees,
} from '@/lib/assignments';
import {
  createClientRow,
  updateClientRow,
  deleteClientRow,
  createSubitemRow,
  updateSubitemRow,
  deleteSubitemRow,
} from '@/lib/crm';

const CLIENT_HEADER_COLS = [
  { label: '', width: 60 },
  { label: 'Client', width: 180 },
  { label: 'People', width: 90 },
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
  { label: 'Billing Address', width: 115 },
  { label: 'Date Created', width: 90 },
  { label: '', width: 60 },
];

const TOTAL_MIN_WIDTH = CLIENT_HEADER_COLS.reduce((s, c) => s + c.width, 0);

interface CRMBoardProps {
  clients: Client[];
  reloadClients: () => Promise<void>;
  search?: string;
}

export function CRMBoard({ clients, reloadClients, search = '' }: CRMBoardProps) {
  const [filterStatus, setFilterStatus] = useState<ClientStatus | 'All'>('All');
  const [showFilter, setShowFilter] = useState(false);
  const [allExpanded, setAllExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [clientAssignees, setClientAssignees] = useState<ClientAssigneeMap>({});
  const [subitemAssignees, setSubitemAssignees] = useState<SubitemAssigneeMap>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const displayedClients = clients.filter((client) => {
    const matchesStatus = filterStatus === 'All' || client.status === filterStatus;
    const q = search.trim().toLowerCase();

    const clientAssignedProfiles =
      (clientAssignees[client.id] ?? [])
        .map((id) => profiles.find((p) => p.id === id))
        .filter(Boolean) as Profile[];

    const matchesSearch =
      !q ||
      client.name.toLowerCase().includes(q) ||
      client.company.toLowerCase().includes(q) ||
      clientAssignedProfiles.some(
        (p) =>
          (p.full_name ?? '').toLowerCase().includes(q) ||
          (p.email ?? '').toLowerCase().includes(q)
      ) ||
      client.subitems.some((subitem) => (subitem.name ?? '').toLowerCase().includes(q));

    return matchesStatus && matchesSearch;
  });

  const GROUP_ORDER: ClientStatus[] = [
    'New Lead',
    'Contacted',
    'Quoted',
    'Failed',
    'Overdue',
    'Follow Up',
    'Shortlisted',
    'Project Started',
    'Project Done',
    'Closed',
    'Unqualified',
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
    const loadAssignments = async () => {
      try {
        const supabase = createSupabaseClient();

        const [
          profilesData,
          {
            data: { user },
          },
        ] = await Promise.all([fetchProfiles(), supabase.auth.getUser()]);

        setProfiles(profilesData);
        setCurrentUserId(user?.id ?? null);

        const clientEntries = await Promise.all(
          clients.map(async (client) => [client.id, await fetchClientAssigneeIds(client.id)] as const)
        );

        const subitemEntries = await Promise.all(
          clients.flatMap((client) =>
            client.subitems.map(
              async (subitem) => [subitem.id, await fetchSubitemAssigneeIds(subitem.id)] as const
            )
          )
        );

        setClientAssignees(Object.fromEntries(clientEntries));
        setSubitemAssignees(Object.fromEntries(subitemEntries));
      } catch (error: any) {
        console.error('Failed to load assignments', {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          full: error,
        });
      }
    };

    void loadAssignments();
  }, [clients]);

  const handleClientAssigneesChange = useCallback(
    async (clientId: string, ids: string[]) => {
      setClientAssignees((prev) => ({ ...prev, [clientId]: ids }));
      try {
        await saveClientAssignees(clientId, ids, currentUserId);
      } catch (error: any) {
        console.error('Failed to save client assignees', {
          clientId,
          ids,
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          full: error,
        });
      }
    },
    [currentUserId]
  );

  const handleSubitemAssigneesChange = useCallback(
    async (subitemId: string, ids: string[]) => {
      setSubitemAssignees((prev) => ({ ...prev, [subitemId]: ids }));
      try {
        await saveSubitemAssignees(subitemId, ids, currentUserId);
      } catch (error: any) {
        console.error('Failed to save subitem assignees', {
          subitemId,
          ids,
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          full: error,
        });
      }
    },
    [currentUserId]
  );

  useEffect(() => {
    if (!showFilter) return;

    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilter(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFilter]);

  const filteredClients =
    filterStatus === 'All' ? clients : clients.filter((c) => c.status === filterStatus);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allFilteredSelected =
    filteredClients.length > 0 && filteredClients.every((c) => selectedIds.has(c.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredClients.forEach((c) => next.delete(c.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredClients.forEach((c) => next.add(c.id));
        return next;
      });
    }
  };

  const deleteSelected = useCallback(async () => {
    try {
      await Promise.all([...selectedIds].map((id) => deleteClientRow(id)));
      setSelectedIds(new Set());
      await reloadClients();
    } catch (error: any) {
      console.error('Failed to delete selected clients', {
        ids: [...selectedIds],
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        full: error,
      });
    }
  }, [selectedIds, reloadClients]);

  const updateClient = useCallback(
    async (clientId: string, updates: Partial<Client>) => {
      try {
        await updateClientRow(clientId, updates);
        await reloadClients();
      } catch (error: any) {
        console.error('Failed to update client', {
          clientId,
          updates,
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          full: error,
        });
      }
    },
    [reloadClients]
  );

  const updateSubitem = useCallback(
    async (_clientId: string, subitemId: string, updates: Partial<Subitem>) => {
      try {
        await updateSubitemRow(subitemId, updates);
        await reloadClients();
      } catch (error: any) {
        console.error('Failed to update subitem', {
          subitemId,
          updates,
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          full: error,
        });
      }
    },
    [reloadClients]
  );

  const addSubitem = useCallback(
    async (clientId: string) => {
      try {
        await createSubitemRow(clientId);
        await reloadClients();
      } catch (error: any) {
        console.error('Failed to add subitem', {
          clientId,
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          full: error,
        });
      }
    },
    [reloadClients]
  );

  const deleteSubitem = useCallback(
    async (_clientId: string, subitemId: string) => {
      try {
        await deleteSubitemRow(subitemId);
        await reloadClients();
      } catch (error: any) {
        console.error('Failed to delete subitem', {
          subitemId,
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          full: error,
        });
      }
    },
    [reloadClients]
  );

  const deleteClient = useCallback(
    async (clientId: string) => {
      try {
        await deleteClientRow(clientId);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(clientId);
          return next;
        });
        await reloadClients();
      } catch (error: any) {
        console.error('Failed to delete client', {
          clientId,
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          full: error,
        });
      }
    },
    [reloadClients]
  );

  const addClient = useCallback(async () => {
    try {
      await createClientRow();
      await reloadClients();
    } catch (error: any) {
      console.error('Failed to add client', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        full: error,
      });
    }
  }, [reloadClients]);

  const toggleExpandAll = useCallback(async () => {
    const next = !allExpanded;
    setAllExpanded(next);

    try {
      await Promise.all(
        clients.map((client) => updateClientRow(client.id, { expanded: next }))
      );
      await reloadClients();
    } catch (error: any) {
      console.error('Failed to toggle expand all', {
        expanded: next,
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        full: error,
      });
    }
  }, [allExpanded, clients, reloadClients]);

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white flex-shrink-0">
        <button
          onClick={addClient}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#7BCBD5] hover:bg-[#61a5ad] text-white rounded-md text-xs font-medium transition-colors"
        >
          <Plus size={13} />
          Add Client
        </button>

        <button
          onClick={toggleExpandAll}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#7BCBD5] hover:bg-[#61a5ad] text-white rounded-md text-xs font-medium transition-colors"
        >
          {allExpanded ? <ChevronsUp size={14} /> : <ChevronsDown size={14} />}
          {allExpanded ? 'Collapse All' : 'Expand All'}
        </button>

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
                onClick={() => {
                  setFilterStatus('All');
                  setShowFilter(false);
                }}
                className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50"
              >
                <span className="w-2.5 h-2.5 rounded-sm bg-gray-300" />
                All Clients
                {filterStatus === 'All' && <span className="ml-auto text-blue-500">✓</span>}
              </button>

              <div className="border-t border-gray-100 my-1" />

              {CLIENT_STATUSES.map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setFilterStatus(st);
                    setShowFilter(false);
                  }}
                  className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ background: STATUS_COLORS[st] }}
                  />
                  <span className="flex-1">{st}</span>
                  <span className="text-gray-400">{clients.filter((c) => c.status === st).length}</span>
                  {filterStatus === st && <span className="text-blue-500 ml-1">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {CLIENT_STATUSES.map((st) => {
            const count = clients.filter((c) => c.status === st).length;
            if (!count) return null;

            return (
              <button
                key={st}
                onClick={() => setFilterStatus(filterStatus === st ? 'All' : st)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-opacity transition transform active:scale-95 duration-150"
                style={{
                  background: STATUS_COLORS[st],
                  color: '#ffffff',
                  opacity: filterStatus !== 'All' && filterStatus !== st ? 0.35 : 1,
                }}
              >
                {st}
                <span className="bg-white/30 rounded-full px-1">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-md px-3 py-1.5">
            <span className="text-xs text-red-600 font-medium">{selectedIds.size} selected</span>
            <button
              onClick={deleteSelected}
              className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-semibold transition-colors"
            >
              <Trash2 size={12} />
              Delete
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

      <div className="flex-1 overflow-auto text-gray-500 font-semibold">
        <div style={{ minWidth: TOTAL_MIN_WIDTH }}>
          <div
            className="flex items-center flex-shrink-0 border-b border-gray-200 animated-background bg-gradient-to-r from-[#e7fdff] to-[#a3dfff] sticky top-0 z-10"
            style={{ minWidth: TOTAL_MIN_WIDTH }}
          >
            <div
              className="flex items-center px-2 gap-1.5 flex-shrink-0 border-r border-gray-200"
              style={{ minWidth: 60, width: 60 }}
            >
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

          {groupedClients.map((group) => (
            <React.Fragment key={group.status}>
              <div className="flex items-center gap-2.5 px-2 py-0.4 text-sm bg-gray-50 border-y border-gray-100">
                <button onClick={() => toggleGroup(group.status)} className="text-sm text-gray-500">
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
                    profiles={profiles}
                    clientAssignedIds={clientAssignees[client.id] ?? []}
                    onChangeClientAssignees={(ids) =>
                      handleClientAssigneesChange(client.id, ids)
                    }
                    subitemAssigneeMap={subitemAssignees}
                    onChangeSubitemAssignees={handleSubitemAssigneesChange}
                  />
                ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}