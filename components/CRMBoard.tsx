'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Plus, Trash2, Filter, ChevronsDown, ChevronsUp, X } from 'lucide-react';
import { Client, Subitem, ClientStatus, Profile, ClientAssigneeMap, SubitemAssigneeMap, CRMGroup } from '../app/types';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import { ClientRow } from './ui/clientrows';
import { fetchProfiles, saveClientAssignees, saveSubitemAssignees } from '@/lib/assignments';
import { createClientRow, updateClientRow, deleteClientRow, createSubitemRow, updateSubitemRow, deleteSubitemRow } from '@/lib/crm';
import { fetchClientAssigneeMap } from '@/lib/assignments';
import { GenerateOcfModal } from './Generate-OCF-Modal';
import { AddGroupModal } from './Add-Group-Modal';

type OptionEntry = { value: string; color: string };

const CLIENT_HEADER_COLS = [
  { key: 'selectCheckbox', label: '', width: 60, minWidth: 7 },
  { key: 'client', label: 'Client', width: 250, minWidth: 7 },
  { key: 'people', label: 'People', width: 60, minWidth: 7 },
  { key: 'replyStatus', label: 'Reply Status', width: 80, minWidth: 7 },
  { key: 'followUp', label: 'Follow Up', width: 100, minWidth: 7 },
  { key: 'status', label: 'Status', width: 80, minWidth: 7 },
  { key: 'channel', label: 'Channel', width: 80, minWidth: 7 },
  { key: 'importance', label: 'Importance', width: 80, minWidth: 7 },
  { key: 'company', label: 'Company', width: 80, minWidth: 7 },
  { key: 'email', label: 'Email', width: 90, minWidth: 7 },
  { key: 'phone', label: 'Phone', width: 80, minWidth: 7 },
  { key: 'requirements', label: 'Requirements', width: 90, minWidth: 7 },
  { key: 'nbd', label: 'NBD', width: 100, minWidth: 7 },
  { key: 'totalPrice', label: 'Total Price', width: 80, minWidth: 7 },
  { key: 'companyAddress', label: 'Company Address', width: 115, minWidth: 7 },
  { key: 'billingAddress', label: 'Billing Address', width: 115, minWidth: 7 },
  { key: 'dateCreated', label: 'Date Created', width: 90, minWidth: 7 },
  { key: 'empty', label: '', width: 778, minWidth: 7 },
];

interface CRMBoardProps {
  clients: Client[];
  expandedIds: string[];
  setExpandedIds: React.Dispatch<React.SetStateAction<string[]>>;
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  reloadClients: () => Promise<void>;
  search?: string;
}

export async function fetchAllSubitemAssignees(): Promise<SubitemAssigneeMap> {
  const supabase = createSupabaseClient();
  const { data } = await supabase.from('subitem_assignees').select('subitem_id, user_id');
  return (data ?? []).reduce((acc, row) => {
    acc[row.subitem_id] = [...(acc[row.subitem_id] ?? []), row.user_id];
    return acc;
  }, {} as SubitemAssigneeMap);
}

export function CRMBoard({ clients, expandedIds, setExpandedIds, setClients, reloadClients, search = '' }: CRMBoardProps) {
  const [filterStatus, setFilterStatus] = useState<string | 'All'>('All');
  const [showFilter, setShowFilter] = useState(false);

  const expandedIdSet = React.useMemo(() => new Set(expandedIds), [expandedIds]);
  const allExpanded = clients.length > 0 && clients.every((c) => expandedIdSet.has(c.id));

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [clientAssignees, setClientAssignees] = useState<ClientAssigneeMap>({});
  const [subitemAssignees, setSubitemAssignees] = useState<SubitemAssigneeMap>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const filterRef = useRef<HTMLDivElement>(null);
  const [ocfClient, setOcfClient] = useState<Client | null>(null);
  const [isOcfModalOpen, setIsOcfModalOpen] = useState(false);
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);

  const [replyStatusEntries, setReplyStatusEntries] = useState<OptionEntry[]>([]);
  const [clientStatusEntries, setClientStatusEntries] = useState<OptionEntry[]>([]);
  const [channelEntries, setChannelEntries] = useState<OptionEntry[]>([]);
  const [importanceEntries, setImportanceEntries] = useState<OptionEntry[]>([]);
  const [paymentStatusEntries, setPaymentStatusEntries] = useState<OptionEntry[]>([]);
  const [modeOfPaymentEntries, setModeOfPaymentEntries] = useState<OptionEntry[]>([]);
  const [shipperEntries, setShipperEntries] = useState<OptionEntry[]>([]);
  const [localOverseasEntries, setLocalOverseasEntries] = useState<OptionEntry[]>([]);
  const [subitemStatusEntries, setSubitemStatusEntries] = useState<OptionEntry[]>([]);
  
  const replyStatuses = replyStatusEntries.map((e) => e.value);
  const clientStatuses = clientStatusEntries.map((e) => e.value);
  const channelOptions = channelEntries.map((e) => e.value);
  const importanceOptions = importanceEntries.map((e) => e.value);
  const statusColors = Object.fromEntries(clientStatusEntries.map((e) => [e.value, e.color]));

  const [groups, setGroups] = useState<CRMGroup[]>([]);
  const [groupToDelete, setGroupToDelete] = useState<CRMGroup | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [draggedClientId, setDraggedClientId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [headerCols, setHeaderCols] = useState(CLIENT_HEADER_COLS);

  const totalMinWidth = headerCols.reduce((sum, col) => sum + col.width, 0);
  const colWidth = React.useMemo(
    () => Object.fromEntries(headerCols.map((c) => [c.key, c.width])),
    [headerCols]
  );

  const fetchOptions = useCallback(async (code: string): Promise<OptionEntry[]> => {
    const supabase = createSupabaseClient();
    const { data: group } = await supabase
      .from('option_groups').select('id').eq('code', code).single();
    if (!group) return [];
    const { data } = await supabase
      .from('option_values').select('value, color').eq('group_id', group.id).order('sort_order');
    return data ?? [];
  }, []);

  async function fetchGroups(): Promise<CRMGroup[]> {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from('crm_groups').select('id, name, color, sort_order')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
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
          groupsData,
          replyOpts,
          statusOpts,
          channelOpts,
          importanceOpts,
          paymentStatusOpts,
          modeOfPaymentOpts,
          shipperOpts,
          localOverseasOpts,
          subitemStatusOpts,
        ] = await Promise.all([
          fetchProfiles(),
          supabase.auth.getUser(),
          fetchClientAssigneeMap(),
          fetchAllSubitemAssignees(),
          fetchGroups(),
          fetchOptions('reply_status'),
          fetchOptions('client_status'),
          fetchOptions('channel'),
          fetchOptions('importance'),
          fetchOptions('payment_status'),
          fetchOptions('mode_of_payment'),
          fetchOptions('shipper'),
          fetchOptions('local_overseas'),
          fetchOptions('subitem_status'),
        ]);

        setProfiles(profilesData);
        setCurrentUserId(user?.id ?? null);
        setClientAssignees(allClientAssigneeMap);
        setSubitemAssignees(allSubitemAssigneeMap);
        setGroups(groupsData);
        setReplyStatusEntries(replyOpts);
        setClientStatusEntries(statusOpts);
        setChannelEntries(channelOpts);
        setImportanceEntries(importanceOpts);
        setPaymentStatusEntries(paymentStatusOpts);
        setModeOfPaymentEntries(modeOfPaymentOpts);
        setShipperEntries(shipperOpts);
        setLocalOverseasEntries(localOverseasOpts);
        setSubitemStatusEntries(subitemStatusOpts);

      } catch (error: any) {
        console.error('Failed to load assignments', error);
      }
    };
    void loadAssignments();
  }, [fetchOptions]);

  useEffect(() => {
    if (!showFilter) return;
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilter(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFilter]);

  // --- Option handlers ---

  const getOptionGroupId = useCallback(async (code: string) => {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from('option_groups')
    .select('id')
    .eq('code', code)
    .single();

  if (error) {
    console.error(`Failed to fetch option group id for ${code}`, error);
    return null;
  }

  return data?.id ?? null;
}, []);

const insertOptionValue = useCallback(
  async (
    code: string,
    name: string,
    currentEntries: OptionEntry[],
    setEntries: React.Dispatch<React.SetStateAction<OptionEntry[]>>
  ) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const groupId = await getOptionGroupId(code);
    if (!groupId) return;

    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from('option_values')
      .insert({
        group_id: groupId,
        value: trimmed,
        color: '#d1d5db',
        sort_order: currentEntries.length,
      })
      .select('value, color')
      .single();

    if (error) {
      console.error(`Failed to insert option into ${code}`, error);
      return;
    }

    setEntries((prev) => [...prev, data]);
  },
  [getOptionGroupId]
);

const deleteOptionValue = useCallback(
  async (
    code: string,
    name: string,
    setEntries: React.Dispatch<React.SetStateAction<OptionEntry[]>>
  ) => {
    const groupId = await getOptionGroupId(code);
    if (!groupId) return;

    const supabase = createSupabaseClient();
    const { error } = await supabase
      .from('option_values')
      .delete()
      .eq('group_id', groupId)
      .eq('value', name);

    if (error) {
      console.error(`Failed to delete option from ${code}`, error);
      return;
    }

    setEntries((prev) => prev.filter((e) => e.value !== name));
  },
  [getOptionGroupId]
);

const handleAddShipper = useCallback(
  async (name: string) => {
    await insertOptionValue('shipper', name, shipperEntries, setShipperEntries);
  },
  [insertOptionValue, shipperEntries]
);

const handleDeleteShipper = useCallback(
  async (name: string) => {
    await deleteOptionValue('shipper', name, setShipperEntries);
  },
  [deleteOptionValue]
);

const handleAddLocalOverseas = useCallback(
  async (name: string) => {
    await insertOptionValue('local_overseas', name, localOverseasEntries, setLocalOverseasEntries);
  },
  [insertOptionValue, shipperEntries]
);

const handleDeleteLocalOverseas = useCallback(
  async (name: string) => {
    await deleteOptionValue('local_overseas', name, setLocalOverseasEntries);
  },
  [deleteOptionValue]
);

const handleAddSubitemStatus = useCallback(
  async (name: string) => {
    await insertOptionValue('subitem_status', name, subitemStatusEntries, setSubitemStatusEntries);
  },
  [insertOptionValue, subitemStatusEntries]
);

const handleDeleteSubitemStatus = useCallback(
  async (name: string) => {
    await deleteOptionValue('subitem_status', name, setSubitemStatusEntries);
  },
  [deleteOptionValue]
);

const handleAddPaymentStatus = useCallback(
  async (name: string) => {
    await insertOptionValue('payment_status', name, paymentStatusEntries, setPaymentStatusEntries);
  },
  [insertOptionValue, paymentStatusEntries]
);

const handleDeletePaymentStatus = useCallback(
  async (name: string) => {
    await deleteOptionValue('payment_status', name, setPaymentStatusEntries);
  },
  [deleteOptionValue]
);

const handleAddModeOfPayment = useCallback(
  async (name: string) => {
    await insertOptionValue('mode_of_payment', name, modeOfPaymentEntries, setModeOfPaymentEntries);
  },
  [insertOptionValue, modeOfPaymentEntries]
);

const handleDeleteModeOfPayment = useCallback(
  async (name: string) => {
    await deleteOptionValue('mode_of_payment', name, setModeOfPaymentEntries);
  },
  [deleteOptionValue]
);
  const handleAddReplyStatus = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const supabase = createSupabaseClient();
    const { data: group } = await supabase.from('option_groups').select('id').eq('code', 'reply_status').single();
    if (!group) return;
    const { data, error } = await supabase.from('option_values')
      .insert({ group_id: group.id, value: trimmed, color: '#d1d5db', sort_order: replyStatuses.length })
      .select('value, color').single();
    if (error) { console.error(error); return; }
    setReplyStatusEntries((prev) => [...prev, data]);
  }, [replyStatuses.length]);

  const handleDeleteReplyStatus = useCallback(async (name: string) => {
    const supabase = createSupabaseClient();
    const { error } = await supabase.from('option_values').delete().eq('value', name);
    if (error) { console.error(error); return; }
    setReplyStatusEntries((prev) => prev.filter((e) => e.value !== name));
  }, []);

  const handleAddStatus = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const supabase = createSupabaseClient();
    const { data: group } = await supabase.from('option_groups').select('id').eq('code', 'client_status').single();
    if (!group) return;
    const { data, error } = await supabase.from('option_values')
      .insert({ group_id: group.id, value: trimmed, color: '#d1d5db', sort_order: clientStatuses.length })
      .select('value, color').single();
    if (error) { console.error(error); return; }
    setClientStatusEntries((prev) => [...prev, data]);
  }, [clientStatuses.length]);

  const handleDeleteStatus = useCallback(async (name: string) => {
    const supabase = createSupabaseClient();
    const { error } = await supabase.from('option_values').delete().eq('value', name);
    if (error) { console.error(error); return; }
    setClientStatusEntries((prev) => prev.filter((e) => e.value !== name));
  }, []);

  const handleAddChannel = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const supabase = createSupabaseClient();
    const { data: group } = await supabase.from('option_groups').select('id').eq('code', 'channel').single();
    if (!group) return;
    const { data, error } = await supabase.from('option_values')
      .insert({ group_id: group.id, value: trimmed, color: '#d1d5db', sort_order: channelOptions.length })
      .select('value, color').single();
    if (error) { console.error(error); return; }
    setChannelEntries((prev) => [...prev, data]);
  }, [channelOptions.length]);

  const handleDeleteChannel = useCallback(async (name: string) => {
    const supabase = createSupabaseClient();
    const { error } = await supabase.from('option_values').delete().eq('value', name);
    if (error) { console.error(error); return; }
    setChannelEntries((prev) => prev.filter((e) => e.value !== name));
  }, []);

  const handleAddImportance = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const supabase = createSupabaseClient();
    const { data: group } = await supabase.from('option_groups').select('id').eq('code', 'importance').single();
    if (!group) return;
    const { data, error } = await supabase.from('option_values')
      .insert({ group_id: group.id, value: trimmed, color: '#d1d5db', sort_order: importanceOptions.length })
      .select('value, color').single();
    if (error) { console.error(error); return; }
    setImportanceEntries((prev) => [...prev, data]);
  }, [importanceOptions.length]);

  const handleDeleteImportance = useCallback(async (name: string) => {
    const supabase = createSupabaseClient();
    const { error } = await supabase.from('option_values').delete().eq('value', name);
    if (error) { console.error(error); return; }
    setImportanceEntries((prev) => prev.filter((e) => e.value !== name));
  }, []);

  // --- Groups ---
  const handleAddGroup = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (groups.some((g) => g.name.toLowerCase() === trimmed.toLowerCase())) {
      window.alert('Group already exists');
      return;
    }
    try {
      const supabase = createSupabaseClient();
      const nextSort = groups.length ? Math.max(...groups.map((g) => g.sort_order ?? 0)) + 1 : 0;
      const { data, error } = await supabase.from('crm_groups')
        .insert({ name: trimmed, color: '#7BCBD5', sort_order: nextSort, created_by: currentUserId })
        .select('id, name, color, sort_order').single();
      if (error) throw error;
      setGroups((prev) => [...prev, data]);
    } catch (error) {
      console.error('Failed to add group', error);
    }
  }, [groups, currentUserId]);

  const handleDeleteGroup = useCallback(async () => {
    if (!groupToDelete) return;
    try {
      setIsDeletingGroup(true);
      const supabase = createSupabaseClient();
      const clientIdsInGroup = clients.filter((c) => c.groupId === groupToDelete.id).map((c) => c.id);
      if (clientIdsInGroup.length > 0) {
        const { error } = await supabase.from('clients').delete().in('id', clientIdsInGroup);
        if (error) throw error;
      }
      const { error } = await supabase.from('crm_groups').delete().eq('id', groupToDelete.id);
      if (error) throw error;
      setClients((prev) => prev.filter((c) => c.groupId !== groupToDelete.id));
      setGroups((prev) => prev.filter((g) => g.id !== groupToDelete.id));
      setCollapsedGroups((prev) => { const next = { ...prev }; delete next[groupToDelete.id]; return next; });
      setGroupToDelete(null);
    } catch (error) {
      console.error('Failed to delete group', error);
    } finally {
      setIsDeletingGroup(false);
    }
  }, [groupToDelete, clients, setClients]);

  // --- Resize ---
  const startResize = (key: string, startX: number) => {
    const startCol = headerCols.find((col) => col.key === key);
    if (!startCol) return;
    const startWidth = startCol.width;
    const onMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      setHeaderCols((prev) => prev.map((col) =>
        col.key === key ? { ...col, width: Math.max(col.minWidth ?? 60, startWidth + delta) } : col
      ));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // --- OCF ---
  function handleOpenOcfModal(client: Client) { setOcfClient(client); setIsOcfModalOpen(true); }
  function handleCloseOcfModal() { setIsOcfModalOpen(false); setOcfClient(null); }

  // --- Drag ---
  const handleDragStart = useCallback((clientId: string) => setDraggedClientId(clientId), []);
  const handleDragOver = useCallback((e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    setDragOverGroupId(groupId);
  }, []);
  const handleDragEnd = useCallback(() => { setDraggedClientId(null); setDragOverGroupId(null); }, []);

  const handleDrop = useCallback(async (groupId: string) => {
    if (!draggedClientId) return;
    const localDraggedId = draggedClientId;
    setDraggedClientId(null);
    setDragOverGroupId(null);
    const targetGroup = groups.find((g) => g.id === groupId);
    const draggedClient = clients.find((c) => c.id === localDraggedId);
    if (!targetGroup || !draggedClient) return;
    const matchingStatus = clientStatuses.find(
      (s) => s.toLowerCase() === targetGroup.name.toLowerCase()
    ) as ClientStatus | undefined;
    const updates: Partial<Client> = { groupId };
    if (matchingStatus) updates.status = matchingStatus;
    setClients((prev) => prev.map((c) => c.id === localDraggedId ? { ...c, ...updates } : c));
    try {
      await updateClientRow(localDraggedId, updates);
    } catch (err) {
      setClients(clients);
      console.error('Failed to move client to group', err);
    }
  }, [draggedClientId, clients, groups, clientStatuses, setClients]);

  // --- Filtering ---
  const displayedClients = clients.filter((client) => {
    const matchesStatus = filterStatus === 'All' || client.status === filterStatus;
    const q = search.trim().toLowerCase();
    const clientAssignedProfiles = (clientAssignees[client.id] ?? [])
      .map((id) => profiles.find((p) => p.id === id)).filter(Boolean) as Profile[];
    const matchesSearch = !q ||
      client.name.toLowerCase().includes(q) ||
      client.company.toLowerCase().includes(q) ||
      clientAssignedProfiles.some((p) =>
        (p.full_name ?? '').toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q)
      ) ||
      client.subitems.some((s) => (s.name ?? '').toLowerCase().includes(q));
    return matchesStatus && matchesSearch;
  });

  const groupedClients = groups.map((group) => ({
    group,
    clients: displayedClients.filter((c) => c.groupId === group.id),
  }));

  const filteredClients = filterStatus === 'All' ? clients : clients.filter((c) => c.status === filterStatus);
  const allFilteredSelected = filteredClients.length > 0 && filteredClients.every((c) => selectedIds.has(c.id));

  // --- Selection ---
  const toggleExpandAll = useCallback(() => {
    allExpanded ? setExpandedIds([]) : setExpandedIds(clients.map((c) => c.id));
  }, [allExpanded, clients, setExpandedIds]);

  const toggleGroup = useCallback((id: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => { const next = new Set(prev); filteredClients.forEach((c) => next.delete(c.id)); return next; });
    } else {
      setSelectedIds((prev) => { const next = new Set(prev); filteredClients.forEach((c) => next.add(c.id)); return next; });
    }
  }, [allFilteredSelected, filteredClients]);

  // --- Assignees ---
  const handleClientAssigneesChange = useCallback(async (clientId: string, ids: string[]) => {
    setClientAssignees((prev) => ({ ...prev, [clientId]: ids }));
    try { await saveClientAssignees(clientId, ids, currentUserId); }
    catch (error: any) { console.error('Failed to save client assignees', error); }
  }, [currentUserId]);

  const handleSubitemAssigneesChange = useCallback(async (subitemId: string, ids: string[]) => {
    setSubitemAssignees((prev) => ({ ...prev, [subitemId]: ids }));
    try { await saveSubitemAssignees(subitemId, ids, currentUserId); }
    catch (error: any) { console.error('Failed to save subitem assignees', error); }
  }, [currentUserId]);

  const STATUS_TO_GROUP_NAME: Partial<Record<ClientStatus, string>> = {
    'Follow Up': 'Follow Up',
    'Shortlisted': 'Shortlisted',
  };

  const updateClient = useCallback(async (clientId: string, updates: Partial<Client>) => {
    let nextUpdates = { ...updates };
    if (updates.status) {
      const targetGroupName = STATUS_TO_GROUP_NAME[updates.status];
      if (targetGroupName) {
        const matchingGroup = groups.find((g) => g.name.toLowerCase() === targetGroupName.toLowerCase());
        if (matchingGroup) nextUpdates.groupId = matchingGroup.id;
      }
    }
    setClients((prev) => prev.map((c) => c.id === clientId ? { ...c, ...nextUpdates } : c));
    try { await updateClientRow(clientId, nextUpdates); }
    catch (error: any) { setClients(clients); console.error('Failed to update client', error); }
  }, [clients, groups, setClients]);

  const updateSubitem = useCallback(async (_clientId: string, subitemId: string, updates: Partial<Subitem>) => {
    setClients((prev) => prev.map((c) => ({
      ...c, subitems: c.subitems.map((s) => s.id === subitemId ? { ...s, ...updates } : s),
    })));
    try { await updateSubitemRow(subitemId, updates); }
    catch (error: any) { setClients(clients); console.error('Failed to update subitem', error); }
  }, [clients]);

  const addClient = useCallback(async () => {
    try {
      const defaultGroupId = groups[0]?.id ?? null;
      const createdClient = await createClientRow(currentUserId ?? null, defaultGroupId);
      const newClient: Client = {
        id: createdClient.id, name: createdClient.name ?? '', people: createdClient.people ?? '',
        replyStatus: createdClient.reply_status ?? '', followUp: createdClient.follow_up ?? '',
        status: (createdClient.status as ClientStatus) ?? 'New Lead', channel: createdClient.channel ?? '',
        importance: createdClient.importance ?? '', company: createdClient.company ?? '',
        email: createdClient.email ?? '', phone: createdClient.phone ?? '',
        requirements: createdClient.requirements ?? '', nbd: createdClient.nbd ?? '',
        groupId: createdClient.group_id ?? defaultGroupId, totalPrice: createdClient.total_price ?? '',
        companyAddress: createdClient.company_address ?? '', billingAddress: createdClient.billing_address ?? '',
        dateCreated: createdClient.date_created ?? '', expanded: createdClient.expanded ?? true,
        color: createdClient.color ?? '#7BCBD5', subitems: [], activityLog: [],
      };
      setClients((prev) => [newClient, ...prev]);
      setExpandedIds((prev) => [...prev, newClient.id]);
      fetchClientAssigneeMap()
        .then((m) => setClientAssignees(m))
        .catch((e) => console.error('Failed to refresh assignees', e));
    } catch (error: any) { console.error('Failed to add client', error); }
  }, [currentUserId, groups, setClients, setExpandedIds]);

  const deleteClient = useCallback(async (clientId: string) => {
    setClients((prev) => prev.filter((c) => c.id !== clientId));
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(clientId); return next; });
    try { await deleteClientRow(clientId); }
    catch (error: any) { setClients(clients); console.error('Failed to delete client', error); }
  }, [clients, setClients]);

  const deleteSelected = useCallback(async () => {
    const ids = [...selectedIds];
    setClients((prev) => prev.filter((c) => !selectedIds.has(c.id)));
    setSelectedIds(new Set());
    try { await Promise.all(ids.map((id) => deleteClientRow(id))); }
    catch (error: any) { setClients(clients); console.error('Failed to delete selected', error); }
  }, [selectedIds, clients, setClients]);

  const addSubitem = useCallback(async (clientId: string) => {
    try { await createSubitemRow(clientId); await reloadClients(); }
    catch (error: any) { console.error('Failed to add subitem', error); }
  }, [reloadClients]);

  const deleteSubitem = useCallback(async (_clientId: string, subitemId: string) => {
    setClients((prev) => prev.map((c) => ({ ...c, subitems: c.subitems.filter((s) => s.id !== subitemId) })));
    try { await deleteSubitemRow(subitemId); }
    catch (error: any) { setClients(clients); console.error('Failed to delete subitem', error); }
  }, [clients, setClients]);

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center gap-2 px-2 py-1 border-b border-gray-200 bg-white flex-shrink-0">
        <button onClick={addClient} className="flex items-center gap-1 px-2 py-1 bg-[#a0e2eb] hover:bg-[#7BCBD5] text-white rounded-md text-[10px] font-medium transition-colors transition transform active:scale-95 duration-150">
          <Plus size={12} /> Add Client
        </button>
        <button onClick={() => setShowAddGroupModal(true)} className="flex items-center gap-1 px-2 py-1 bg-[#a0e2eb] hover:bg-[#7BCBD5] text-white rounded-md text-[10px] font-medium transition-colors transition transform active:scale-95 duration-150">
          <Plus size={12} /> Add Group
        </button>
        <AddGroupModal open={showAddGroupModal} onClose={() => setShowAddGroupModal(false)} onSubmit={handleAddGroup} />

        <button onClick={toggleExpandAll} className="flex items-center gap-1 px-2 py-1 bg-[#a0e2eb] hover:bg-[#7BCBD5] text-white rounded-md text-[10px] font-medium transition-colors transition transform active:scale-95 duration-150">
          {allExpanded ? <ChevronsUp size={12} /> : <ChevronsDown size={12} />}
          {allExpanded ? 'Collapse All' : 'Expand All'}
        </button>

        <div ref={filterRef} className="relative">
          <button onClick={() => setShowFilter(!showFilter)} className="flex items-center gap-1 px-2 py-1 bg-[#a0e2eb] hover:bg-[#7BCBD5] text-white rounded-md text-[10px] font-medium transition-colors transition transform active:scale-95 duration-150">
            <Filter size={12} />
            {filterStatus === 'All' ? 'Filter by Status' : filterStatus}
            <ChevronDown size={11} />
          </button>
          {showFilter && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 min-w-44 py-1 max-h-80 overflow-y-auto">
              <button onClick={() => { setFilterStatus('All'); setShowFilter(false); }} className="flex items-center font-semibold gap-2 w-full text-left px-3 py-1.5 text-[10px] hover:bg-gray-50">
                <span className="w-2.5 h-2.5 rounded-sm bg-gray-300" /> All Clients
                {filterStatus === 'All' && <span className="ml-auto text-blue-500">✓</span>}
              </button>
              <div className="border-t border-gray-100 my-1" />
              {clientStatuses.map((st) => (
                <button key={st} onClick={() => { setFilterStatus(st); setShowFilter(false); }} className="flex items-center font-semibold gap-2 w-full text-left px-3 py-1.5 text-[10px] hover:bg-gray-50">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: statusColors[st] ?? '#9ca3af' }} />
                  <span className="flex-1">{st}</span>
                  <span className="text-gray-400">{clients.filter((c) => c.status === st).length}</span>
                  {filterStatus === st && <span className="text-blue-500 ml-1">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {clientStatuses.map((st) => {
            const count = clients.filter((c) => c.status === st).length;
            if (!count) return null;
            return (
              <button key={st} onClick={() => setFilterStatus(filterStatus === st ? 'All' : st)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap flex-shrink-0 transition-opacity transform active:scale-95 duration-150"
                style={{ background: statusColors[st], color: '#ffffff', opacity: filterStatus !== 'All' && filterStatus !== st ? 0.35 : 1 }}
              >
                {st} <span className="bg-white/30 rounded-full px-1">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1" />
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-md px-3 py-1.5">
            <span className="text-[10px] text-red-600 font-medium">{selectedIds.size} selected</span>
            <button onClick={deleteSelected} className="flex items-center gap-1 text-[10px] text-red-600 hover:text-red-800 font-semibold transition-colors">
              <Trash2 size={12} /> Delete
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={13} />
            </button>
          </div>
        )}
      </div>

      <div className="flex min-w-0 text-gray-500 font-semibold">
        <div style={{ minWidth: totalMinWidth }}>
          <div className="flex items-center justify-center w-full min-w-0 flex-shrink-0 border-r border-[#D0D4E4] overflow-hidden animated-background bg-gradient-to-r from-[#e7fdff] to-[#a3dfff] sticky top-0 z-10" style={{ minWidth: totalMinWidth }}>
            <div className="border-[#D0D4E4] flex overflow-hidden min-w-0 items-center px-2.5 flex-shrink-0" style={{ minWidth: colWidth.selectCheckbox, width: colWidth.selectCheckbox }}>
              <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} className="w-3 h-3 rounded cursor-pointer accent-[#7BCBD5]" />
            </div>
            {headerCols.slice(1).map((col) => (
              <div key={col.key} className="relative flex min-w-0 overflow-hidden items-center justify-center px-1 py-1.5 border-r border-[#D0D4E4] last:border-r-0 text-[11px] font-semibold text-gray-600 whitespace-nowrap" style={{ minWidth: col.width, width: col.width }}>
                {col.label}
                <div onMouseDown={(e) => { e.preventDefault(); startResize(col.key, e.clientX); }} className="absolute top-0 right-0 h-full w-2 cursor-col-resize hover:bg-[#7BCBD5]/20" />
              </div>
            ))}
          </div>

          {groupedClients.map(({ group, clients: groupClients }) => (
            <React.Fragment key={group.id}>
              <div
                onDragOver={(e) => handleDragOver(e, group.id)}
                onDrop={() => handleDrop(group.id)}
                onDragLeave={() => setDragOverGroupId(null)}
                className={`flex items-center gap-2.5 px-2 py-1 text-sm border-y border-gray-100 transition-colors ${dragOverGroupId === group.id ? 'bg-[#e7fdff]' : 'bg-gray-50'}`}
              >
                <button onClick={() => toggleGroup(group.id)} className="text-sm text-gray-500">
                  {collapsedGroups[group.id] ? '▷' : '▼'}
                </button>
                <div className="h-5 w-1 rounded bg-[#7BCBD5]" />
                <div>
                  <div className="font-semibold text-slate-700">{group.name}</div>
                  <div className="text-xs italic font-normal text-slate-500">{groupClients.length} {groupClients.length === 1 ? 'Client' : 'Clients'}</div>
                </div>
                <button onClick={() => setGroupToDelete(group)} className="rounded-md mb-auto p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-600 transition-colors" title="Delete group">
                  <Trash2 size={14} />
                </button>
              </div>

              {groupToDelete && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/20 backdrop-blur-[2px] px-4">
                  <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl">
                    <div className="border-b border-gray-100 px-5 py-4">
                      <h2 className="text-sm font-semibold text-gray-900">Delete group</h2>
                      <p className="mt-1 text-xs text-gray-500">This will permanently delete <span className="font-semibold text-gray-700">{groupToDelete.name}</span> and all its clients.</p>
                    </div>
                    <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
                      <button onClick={() => setGroupToDelete(null)} disabled={isDeletingGroup} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                      <button onClick={handleDeleteGroup} disabled={isDeletingGroup} className="rounded-xl bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50">
                        {isDeletingGroup ? 'Deleting...' : 'Delete group'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {!collapsedGroups[group.id] && groupClients.map((client) => (
                <ClientRow
                  key={client.id}
                  client={client}
                  isExpanded={expandedIdSet.has(client.id)}
                  onToggleExpand={() => setExpandedIds((prev) => prev.includes(client.id) ? prev.filter((id) => id !== client.id) : [...prev, client.id])}
                  onOpenOcfModal={handleOpenOcfModal}
                  isSelected={selectedIds.has(client.id)}
                  onToggleSelect={() => toggleSelect(client.id)}
                  onUpdate={(updates) => updateClient(client.id, updates)}
                  onUpdateSubitem={(subitemId, updates) => updateSubitem(client.id, subitemId, updates)}
                  onAddSubitem={() => addSubitem(client.id)}
                  onDeleteSubitem={(subitemId) => deleteSubitem(client.id, subitemId)}
                  onDelete={() => deleteClient(client.id)}
                  profiles={profiles}
                  clientAssignedIds={clientAssignees[client.id] ?? []}
                  onChangeClientAssignees={(ids) => handleClientAssigneesChange(client.id, ids)}
                  subitemAssigneeMap={subitemAssignees}
                  onChangeSubitemAssignees={handleSubitemAssigneesChange}
                  colWidth={colWidth}
                  onDragStart={() => handleDragStart(client.id)}
                  onDragEnd={handleDragEnd}
                  isDragging={draggedClientId === client.id}
                  replyStatusOptions={replyStatusEntries}
                  statusOptions={clientStatusEntries}
                  channelOptions={channelEntries}
                  importanceOptions={importanceEntries}
                  paymentStatusOptions={paymentStatusEntries}
                  modeOfPaymentOptions={modeOfPaymentEntries}
                  shipperOptions={shipperEntries}
                  localOverseasOptions={localOverseasEntries}
                  subitemStatusOptions={subitemStatusEntries}
                  onAddSubitemStatus={handleAddSubitemStatus}
                  onDeleteSubitemStatus={handleDeleteSubitemStatus}
                  onAddLocalOverseas={handleAddLocalOverseas}
                  onDeleteLocalOverseas={handleDeleteLocalOverseas}
                  onAddShipper={handleAddShipper}
                  onDeleteShipper={handleDeleteShipper}
                  onAddReplyStatus={handleAddReplyStatus}
                  onDeleteReplyStatus={handleDeleteReplyStatus}
                  onAddStatus={handleAddStatus}
                  onDeleteStatus={handleDeleteStatus}
                  onAddChannel={handleAddChannel}
                  onDeleteChannel={handleDeleteChannel}
                  onAddImportance={handleAddImportance}
                  onDeleteImportance={handleDeleteImportance}
                  onAddPaymentStatus={handleAddPaymentStatus}
                  onDeletePaymentStatus={handleDeletePaymentStatus}
                  onAddModeOfPayment={handleAddModeOfPayment}
                  onDeleteModeOfPayment={handleDeleteModeOfPayment}
                
                />
              ))}

              <GenerateOcfModal
                open={isOcfModalOpen}
                client={ocfClient}
                onClose={handleCloseOcfModal}
                onCreated={({ internalUrl }) => { window.location.href = internalUrl; }}
              />
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}