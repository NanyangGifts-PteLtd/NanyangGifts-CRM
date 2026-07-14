'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Plus, Trash2, Filter, ChevronsDown, ChevronsUp, X } from 'lucide-react';
import { Client, Subitem, ClientStatus, Profile, ClientAssigneeMap, SubitemAssigneeMap } from '../app/types';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import { ClientRow, CLIENT_STATUSES, STATUS_COLORS } from './ui/clientrows';
import { fetchProfiles, saveClientAssignees, saveSubitemAssignees } from '@/lib/assignments';
import { createClientRow, updateClientRow, deleteClientRow, createSubitemRow, updateSubitemRow, deleteSubitemRow } from '@/lib/crm';
import { fetchClientAssigneeMap } from '@/lib/assignments';
import { GenerateOcfModal } from './Generate-OCF-Modal';
const CLIENT_HEADER_COLS = [
  { label: '', width: 60 },
  { label: 'Client', width: 220 },
  { label: 'People', width: 60 },
  { label: 'Reply Status', width: 80 },
  { label: 'Follow Up', width: 100 },
  { label: 'Status', width: 80 },
  { label: 'Channel', width: 80 },
  { label: 'Importance', width: 80 },
  { label: 'Company', width: 80 },
  { label: 'Email', width: 80 },
  { label: 'Phone', width: 80 },
  { label: 'Requirements', width: 90 },
  { label: 'NBD', width: 80 },
  { label: 'Total Price', width: 80 },
  { label: 'Company Address', width: 115 },
  { label: 'Billing Address', width: 115 },
  { label: 'Date Created', width: 90 },
  { label: '', width: 465 },
];

const TOTAL_MIN_WIDTH = CLIENT_HEADER_COLS.reduce((s, c) => s + c.width, 0);

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

interface CRMBoardProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  reloadClients: () => Promise<void>;
  search?: string;
}


export async function fetchAllSubitemAssignees(): Promise<SubitemAssigneeMap> {
  const supabase = createSupabaseClient()
  const { data } = await supabase
    .from('subitem_assignees')
    .select('subitem_id, user_id')
  return (data ?? []).reduce((acc, row) => {
    acc[row.subitem_id] = [...(acc[row.subitem_id] ?? []), row.user_id]
    return acc
  }, {} as SubitemAssigneeMap)
}

export function CRMBoard({ clients, setClients, reloadClients, search = '' }: CRMBoardProps) {

  const [filterStatus, setFilterStatus] = useState<ClientStatus | 'All'>('All');
  const [showFilter, setShowFilter] = useState(false);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(clients.filter((c) => c.expanded).map((c) => c.id))
  );
  const allExpanded = expandedIds.size === clients.length && clients.length > 0;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [clientAssignees, setClientAssignees] = useState<ClientAssigneeMap>({});
  const [subitemAssignees, setSubitemAssignees] = useState<SubitemAssigneeMap>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const filterRef = useRef<HTMLDivElement>(null);
  const [ocfClient, setOcfClient] = useState<Client | null>(null);
  const [isOcfModalOpen, setIsOcfModalOpen] = useState(false);

  function handleOpenOcfModal(client: Client) {
    setOcfClient(client);
    setIsOcfModalOpen(true);
  }

  function handleCloseOcfModal() {
    setIsOcfModalOpen(false);
    setOcfClient(null);
  }


  useEffect(() => {
    const loadAssignments = async () => {
      try {
        const supabase = createSupabaseClient();

        const [
          profilesData,
          { data: { user } },
          allClientAssigneeMap,
          allSubitemAssigneeMap,
        ] = await Promise.all([
          fetchProfiles(),
          supabase.auth.getUser(),
          fetchClientAssigneeMap(),
          fetchAllSubitemAssignees(),
        ]);

        setProfiles(profilesData);
        setCurrentUserId(user?.id ?? null);
        setClientAssignees(allClientAssigneeMap);
        setSubitemAssignees(allSubitemAssigneeMap);
      } catch (error: any) {
        console.error('Failed to load assignments', error);
      }
    };

    void loadAssignments();
  }, []);

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

  const displayedClients = clients.filter((client) => {
    const matchesStatus = filterStatus === 'All' || client.status === filterStatus;
    const q = search.trim().toLowerCase();

    const clientAssignedProfiles = (clientAssignees[client.id] ?? [])
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
      client.subitems.some((s) => (s.name ?? '').toLowerCase().includes(q));

    return matchesStatus && matchesSearch;
  });

  const groupedClients = GROUP_ORDER.map((status) => ({
    status,
    clients: displayedClients.filter((c) => c.status === status),
  })).filter((g) => g.clients.length > 0);

  const filteredClients =
    filterStatus === 'All' ? clients : clients.filter((c) => c.status === filterStatus);

  const allFilteredSelected =
    filteredClients.length > 0 && filteredClients.every((c) => selectedIds.has(c.id));

  // --- Expand / collapse ---
  const toggleExpandAll = useCallback(() => {
    if (allExpanded) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(clients.map((c) => c.id)));
    }
  }, [allExpanded, clients]);

  const toggleGroup = useCallback((groupStatus: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupStatus]: !prev[groupStatus] }));
  }, []);

  // --- Selection ---
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
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
  }, [allFilteredSelected, filteredClients]);

  // --- Assignees ---
  const handleClientAssigneesChange = useCallback(
    async (clientId: string, ids: string[]) => {
      setClientAssignees((prev) => ({ ...prev, [clientId]: ids })); // optimistic
      try {
        await saveClientAssignees(clientId, ids, currentUserId);
      } catch (error: any) {
        console.error('Failed to save client assignees', error);
      }
    },
    [currentUserId]
  );

  const handleSubitemAssigneesChange = useCallback(
    async (subitemId: string, ids: string[]) => {
      setSubitemAssignees((prev) => ({ ...prev, [subitemId]: ids })); // optimistic
      try {
        await saveSubitemAssignees(subitemId, ids, currentUserId);
      } catch (error: any) {
        console.error('Failed to save subitem assignees', error);
      }
    },
    [currentUserId]
  );


  const updateClient = useCallback(
    async (clientId: string, updates: Partial<Client>) => {
      setClients((prev) =>
        prev.map((c) => (c.id === clientId ? { ...c, ...updates } : c))
      );
      try {
        await updateClientRow(clientId, updates);
      } catch (error: any) {
        setClients(clients);
        console.error('Failed to update client', error);
      }
    },
    [clients]
  );

  const updateSubitem = useCallback(
    async (_clientId: string, subitemId: string, updates: Partial<Subitem>) => {
      setClients((prev) =>
        prev.map((c) => ({
          ...c,
          subitems: c.subitems.map((s) =>
            s.id === subitemId ? { ...s, ...updates } : s
          ),
        }))
      );
      try {
        await updateSubitemRow(subitemId, updates);
      } catch (error: any) {
        setClients(clients);
        console.error('Failed to update subitem', error);
      }
    },
    [clients]
  );

const addClient = useCallback(async () => {
  try {
    const createdClient = await createClientRow(currentUserId ?? null);

    const newClient: Client = {
      id: createdClient.id,
      name: createdClient.name ?? '',
      people: createdClient.people ?? '',
      replyStatus: createdClient.reply_status ?? '',
      followUp: createdClient.follow_up ?? '',
      status: (createdClient.status as ClientStatus) ?? 'New Lead',
      channel: createdClient.channel ?? '',
      importance: createdClient.importance ?? '',
      company: createdClient.company ?? '',
      email: createdClient.email ?? '',
      phone: createdClient.phone ?? '',
      requirements: createdClient.requirements ?? '',
      qty: createdClient.qty ?? '',
      nbd: createdClient.nbd ?? '',
      totalPrice: createdClient.total_price ?? '',
      companyAddress: createdClient.company_address ?? '',
      billingAddress: createdClient.billing_address ?? '',
      dateCreated: createdClient.date_created ?? '',
      expanded: createdClient.expanded ?? true,
      color: createdClient.color ?? '#7BCBD5',
      subitems: [],
      activityLog: [],
    };

    setClients((prev) => [newClient, ...prev]);
    setExpandedIds((prev) => new Set(prev).add(newClient.id));

    fetchClientAssigneeMap()
      .then((assigneeMap) => setClientAssignees(assigneeMap))
      .catch((error) => console.error('Failed to refresh client assignees', error));
  } catch (error: any) {
    console.error('Failed to add client', error);
  }
}, [currentUserId, setClients]);

  const deleteClient = useCallback(
    async (clientId: string) => {
      setClients((prev) => prev.filter((c) => c.id !== clientId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(clientId);
        return next;
      });
      try {
        await deleteClientRow(clientId);
      } catch (error: any) {
        setClients(clients);
        console.error('Failed to delete client', error);
      }
    },
    [clients]
  );

  const deleteSelected = useCallback(async () => {
    const ids = [...selectedIds];
    setClients((prev) => prev.filter((c) => !selectedIds.has(c.id)));
    setSelectedIds(new Set());
    try {
      await Promise.all(ids.map((id) => deleteClientRow(id)));
    } catch (error: any) {
      setClients(clients);
      console.error('Failed to delete selected clients', error);
    }
  }, [selectedIds, clients]);

  const addSubitem = useCallback(
    async (clientId: string) => {
      try {
        await createSubitemRow(clientId);
        await reloadClients();
      } catch (error: any) {
        console.error('Failed to add subitem', error);
      }
    },
    [reloadClients]
  );

  const deleteSubitem = useCallback(
    async (_clientId: string, subitemId: string) => {
      setClients((prev) =>
        prev.map((c) => ({
          ...c,
          subitems: c.subitems.filter((s) => s.id !== subitemId),
        }))
      );
      try {
        await deleteSubitemRow(subitemId);
      } catch (error: any) {
        setClients(clients);
        console.error('Failed to delete subitem', error);
      }
    },
    [clients]
  );

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-2 py-1 border-b border-gray-200 bg-white flex-shrink-0">
        <button
          onClick={addClient}
          className="flex items-center gap-1 px-2 py-1 bg-[#7BCBD5] hover:bg-[#61a5ad] text-white rounded-md text-[10px] font-medium transition-colors transition transform active:scale-95 duration-150"
        >
          <Plus size={12} />
          Add Client
        </button>

        <button
          onClick={toggleExpandAll}
          className="flex items-center gap-1 px-2 py-1 bg-[#7BCBD5] hover:bg-[#61a5ad] text-white rounded-md text-[10px] font-medium transition-colors transition transform active:scale-95 duration-150"
        >
          {allExpanded ? <ChevronsUp size={12} /> : <ChevronsDown size={12} />}
          {allExpanded ? 'Collapse All' : 'Expand All'}
        </button>

        <div ref={filterRef} className="relative">
          <button
            onClick={() => setShowFilter(!showFilter)}
            className="flex items-center gap-1 px-2 py-1 bg-[#7BCBD5] hover:bg-[#61a5ad] text-white rounded-md text-[10px] font-medium transition-colors transition transform active:scale-95 duration-150"
          >
            <Filter size={12} />
            {filterStatus === 'All' ? 'Filter by Status' : filterStatus}
            <ChevronDown size={11} />
          </button>

          {showFilter && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 min-w-44 py-1 max-h-80 overflow-y-auto">
              <button
                onClick={() => { setFilterStatus('All'); setShowFilter(false); }}
                className="flex items-center font-semibold gap-2 w-full text-left px-3 py-1.5 text-[10px] hover:bg-gray-50"
              >
                <span className="w-2.5 h-2.5 rounded-sm bg-gray-300" />
                All Clients
                {filterStatus === 'All' && <span className="ml-auto text-blue-500">✓</span>}
              </button>

              <div className="border-t border-gray-100 my-1" />

              {CLIENT_STATUSES.map((st) => (
                <button
                  key={st}
                  onClick={() => { setFilterStatus(st); setShowFilter(false); }}
                  className="flex items-center font-semibold gap-2 w-full text-left px-3 py-1.5 text-[10px] hover:bg-gray-50"
                >
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: STATUS_COLORS[st] }} />
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
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap flex-shrink-0 transition-opacity transition transform active:scale-95 duration-150"
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
            <span className="text-[10px] text-red-600 font-medium">{selectedIds.size} selected</span>
            <button
              onClick={deleteSelected}
              className="flex items-center gap-1 text-[10px] text-red-600 hover:text-red-800 font-semibold transition-colors"
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

      {/* Table */}
      <div className="flex-1 overflow-auto text-gray-500 font-semibold">
        <div style={{ minWidth: TOTAL_MIN_WIDTH }}>
          {/* Header */}
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
                className="flex items-center px-2 py-1.5 border-r border-gray-500 last:border-r-0 text-[11px] font-semibold text-gray-500 whitespace-nowrap flex-shrink-0"
                style={{ minWidth: col.width, width: col.width }}
              >
                {col.label}
              </div>
            ))}
          </div>

          {/* Grouped rows */}
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
                    isExpanded={expandedIds.has(client.id)}
                    onToggleExpand={() =>
                      setExpandedIds((prev) => {
                        const next = new Set(prev);
                        next.has(client.id) ? next.delete(client.id) : next.add(client.id);
                        return next;
                      })
                    }
                    onOpenOcfModal={handleOpenOcfModal}
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
              <GenerateOcfModal
                open={isOcfModalOpen}
                client={ocfClient}
                onClose={handleCloseOcfModal}
                onCreated={({ internalUrl }) => {
                  window.location.href = internalUrl;
                }}/>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}