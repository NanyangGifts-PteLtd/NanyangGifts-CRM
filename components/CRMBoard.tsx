"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, Plus, Trash2, Filter, ChevronsDown, ChevronsUp, X, MoreHorizontal, EyeOff, Copy, MoveRight, Search, Columns3, ListRestart, ArrowDownUp, RotateCcw, ArrowUp, ArrowDown } from 'lucide-react';
import { Client, Subitem, ClientStatus, Profile, ClientAssigneeMap, SubitemAssigneeMap, CRMGroup } from '../app/types';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import { ClientRow } from './ui/clientrows';
import { gradientForId } from './ui/assignee-multiselect';
import { SUBITEM_COLS, PAYMENT_COLS } from './ui/subitems';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from './ui/alert-dialog';
import { fetchProfiles, saveClientAssignees, saveSubitemAssignees } from '@/lib/assignments';
import { createClientRow, updateClientRow, deleteClientRow, createSubitemRow, updateSubitemRow, deleteSubitemRow, moveSubitemRow, reorderSubitemRows, duplicateSubitemRow, duplicateClientRow } from '@/lib/crm';
import { fetchClientAssigneeMap } from '@/lib/assignments';
import { GenerateOcfModal } from './Generate-OCF-Modal';
import { OcfChooserModal } from './OcfChooserModal';
import { AddGroupModal } from './Add-Group-Modal';
import { fetchCustomColumns, addCustomColumn, deleteCustomColumn, type CustomColumn } from '@/lib/custom-columns'
import ClientsLiveRefresh from './RealtimeRefresh';
import { toast } from 'sonner';
import type { SearchResult } from '../app/types';
import { calculateSubitemFinancials, parseSubitemNumber } from '@/lib/subitem-calculations';
import { ClientDetailView } from './ClientDetailView';
import { SubitemDetailView } from './SubitemDetailView';
import { AdvancedFilters, type AdvancedFilterColumn, type AdvancedFilterRule } from './AdvancedFilters';
import { uploadCrmFiles } from '@/lib/crm-files';

type OptionEntry = { value: string; color: string };
const normalizeBlacklistPhone = (value: string) => value.replace(/\D/g, '');
type CustomerMatchPending = {
  clientId: string;
  clientName: string;
  field: 'phone' | 'company';
  oldValue: string;
  value: string;
  linkedProfileId: string | null;
  exactProfile: { id: string; name: string } | null;
  suggestions: Array<{ id: string; name: string; similarity: number }>;
};
type ColumnScope = 'client' | 'subitem' | 'all';
type BoardSortSetting = { category: 'client' | 'subitem' | 'payment'; column: string; direction: 'asc' | 'desc' };
const DEFAULT_BOARD_SORT: BoardSortSetting = { category: 'client', column: 'dateCreated', direction: 'desc' };
type HeaderCol = {
  key: string;
  label: string;
  width: number;
  minWidth: number;
  customColumnId?: string;
  isCustom?: boolean;
  field_type?: 'text' | 'number' | 'date';
};

const CLIENT_HEADER_COLS: HeaderCol[] = [
  { key: 'selectCheckbox', label: '', width: 60, minWidth: 7 },
  { key: 'client', label: 'Client', width: 250, minWidth: 7 },
  { key: 'people', label: 'People', width: 60, minWidth: 7 },
  { key: 'pm', label: 'PM', width: 60, minWidth: 7 },
  { key: 'replyStatus', label: 'Reply Status', width: 80, minWidth: 7 },
  { key: 'followUp', label: 'Follow Up', width: 100, minWidth: 7 },
  { key: 'status', label: 'Status', width: 80, minWidth: 7 },
  { key: 'channel', label: 'Channel', width: 80, minWidth: 7 },
  { key: 'importance', label: 'Importance', width: 80, minWidth: 7 },
  { key: 'company', label: 'Company', width: 80, minWidth: 7 },
  { key: 'billingAddress', label: 'Billing Address', width: 115, minWidth: 7 },
  { key: 'email', label: 'Email', width: 90, minWidth: 7 },
  { key: 'phone', label: 'Phone', width: 80, minWidth: 7 },
  { key: 'requirements', label: 'Requirements', width: 90, minWidth: 7 },
  { key: 'nbd', label: 'NBD', width: 100, minWidth: 7 },
  { key: 'logoRequirementsFile', label: 'Logo/Requirements File', width: 150, minWidth: 7 },
  { key: 'filesMiscellaneous', label: 'Files (Miscellaneous)', width: 170, minWidth: 7 },
  { key: 'totalPrice', label: 'Total Price', width: 80, minWidth: 7 },
  { key: 'totalMarkup', label: 'Total Markup', width: 90, minWidth: 7 },
  { key: 'progress', label: 'Progress', width: 110, minWidth: 7 },
  { key: 'dateCreated', label: 'Date Created', width: 90, minWidth: 7 },
  { key: 'addClientCol', label: '', width: 44, minWidth: 44 },
  { key: 'empty', label: '', width: 44, minWidth: 44 },
];

interface CRMBoardProps {
  clients: Client[];
  expandedIds: string[];
  setExpandedIds: React.Dispatch<React.SetStateAction<string[]>>;
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  reloadClients: () => Promise<void>;
  search?: string;
  currentUserRole?: string | null;
  clientAssignees: ClientAssigneeMap;
  setClientAssignees: React.Dispatch<React.SetStateAction<ClientAssigneeMap>>;
  subitemAssignees: SubitemAssigneeMap;
  setSubitemAssignees: React.Dispatch<React.SetStateAction<SubitemAssigneeMap>>;
  searchTarget?: SearchResult | null;
  openClientId?: string | null;
  onOpenClientHandled?: () => void;
}

export async function fetchAllSubitemAssignees(): Promise<SubitemAssigneeMap> {
  const supabase = createSupabaseClient();
  const { data } = await supabase.from('subitem_assignees').select('subitem_id, user_id');
  return (data ?? []).reduce((acc, row) => {
    acc[row.subitem_id] = [...(acc[row.subitem_id] ?? []), row.user_id];
    return acc;
  }, {} as SubitemAssigneeMap);
}

export function CRMBoard({ clients,
  expandedIds,
  setExpandedIds,
  setClients,
  reloadClients,
  search = '',
  currentUserRole,
  clientAssignees,
  setClientAssignees,
  subitemAssignees,
  setSubitemAssignees,
  searchTarget,
  openClientId,
  onOpenClientHandled,
}: CRMBoardProps) {

  const [filterStatus, setFilterStatus] = useState<string | 'All'>('All');
  const [showFilter, setShowFilter] = useState(false);
  const [filterMode, setFilterMode] = useState<'quick' | 'advanced'>('advanced');
  const [advancedRules, setAdvancedRules] = useState<AdvancedFilterRule[]>([{ id: 'initial', column: '', condition: '', value: '' }]);
  const [advancedJoin, setAdvancedJoin] = useState<'and' | 'or'>('and');
  const [filterSubprogress, setFilterSubprogress] = useState<string>('All');
  const [filterSubitemStatus, setFilterSubitemStatus] = useState('All');
  const [filterPayment, setFilterPayment] = useState('All');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('All');
  const [filterPeople, setFilterPeople] = useState('All');
  const [filterImportance, setFilterImportance] = useState('All');
  const [filterReplyStatus, setFilterReplyStatus] = useState('All');
  const [filterChannel, setFilterChannel] = useState('All');
  const processedSearchTarget = useRef<string | null>(null);

  useEffect(() => {
    if (!searchTarget) return;
    if (processedSearchTarget.current === searchTarget.id) return;

    const selector = searchTarget.subitemId ? `[data-subitem-id="${searchTarget.subitemId}"]` : `[data-client-id="${searchTarget.clientId}"]`;
    let attempts = 0;

    const tryHighlight = () => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) {
        attempts += 1;
        if (attempts < 25) {
          window.setTimeout(tryHighlight, 150);
          return;
        }
        return;
      }

      processedSearchTarget.current = searchTarget.id;
      element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      element.classList.add('search-result-highlight');
      window.setTimeout(() => element.classList.remove('search-result-highlight'), 1800);
    };

    window.setTimeout(tryHighlight, searchTarget.subitemId ? 100 : 0);
  }, [searchTarget]);
  const [focusedFilterColumn, setFocusedFilterColumn] = useState<string | null>(null);
  const expandedIdSet = React.useMemo(() => new Set(expandedIds), [expandedIds]);
  const allExpanded = clients.length > 0 && clients.every((c) => expandedIdSet.has(c.id));

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [blacklistedPhones, setBlacklistedPhones] = useState<Set<string>>(new Set());
  const [customerMatchPending, setCustomerMatchPending] = useState<CustomerMatchPending | null>(null);
  const [savingCustomerMatch, setSavingCustomerMatch] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [openGroupMenu, setOpenGroupMenu] = useState<string | null>(null);

  useEffect(() => {
    if (!searchTarget) return;

    const targetGroupId = clients.find((client) => client.id === searchTarget.clientId)?.groupId;
    setExpandedIds((current) => current.includes(searchTarget.clientId) ? current : [...current, searchTarget.clientId]);

    if (targetGroupId) {
      setCollapsedGroups((current) => current[targetGroupId] ? { ...current, [targetGroupId]: false } : current);
    }

    if (searchTarget.kind === 'timeline') {
      setClients((current) => current.map((client) => client.id !== searchTarget.clientId ? client : {
        ...client,
        subitems: client.subitems.map((subitem) => searchTarget.subitemId && subitem.id !== searchTarget.subitemId ? subitem : {
          ...subitem,
          showTimeline: true,
          showPayments: false,
          showSample: false,
        }),
      }));
    }
  }, [searchTarget, setClients, setExpandedIds]);

  const filterRef = useRef<HTMLDivElement>(null);
  const [ocfClient, setOcfClient] = useState<Client | null>(null);
  const [isOcfChooserOpen, setIsOcfChooserOpen] = useState(false);
  const [isOcfModalOpen, setIsOcfModalOpen] = useState(false);
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [pendingDeleteClientId, setPendingDeleteClientId] = useState<string | null>(null);
  const [pendingDeleteSubitem, setPendingDeleteSubitem] = useState<{ clientId: string; subitemId: string } | null>(null);
  const [pendingDeleteSelectedSubitems, setPendingDeleteSelectedSubitems] = useState<string[] | null>(null);
  const [selectedSubitemIds, setSelectedSubitemIds] = useState<string[]>([]);
  const [showSubitemMoveMenu, setShowSubitemMoveMenu] = useState(false);
  const [subitemMoveSearch, setSubitemMoveSearch] = useState('');
  const [isMovingSubitems, setIsMovingSubitems] = useState(false);
  const [isDuplicatingSubitems, setIsDuplicatingSubitems] = useState(false);
  const [showClientMoveMenu, setShowClientMoveMenu] = useState(false);
  const [clientMoveSearch, setClientMoveSearch] = useState('');
  const [isMovingClients, setIsMovingClients] = useState(false);
  const [isDuplicatingClients, setIsDuplicatingClients] = useState(false);
  const [detailClientId, setDetailClientId] = useState<string | null>(null);
  const [detailClientInitialTab, setDetailClientInitialTab] = useState<"files" | null>(null);
  const [detailSubitem, setDetailSubitem] = useState<{ clientId: string; subitemId: string } | null>(null);
  const onOpenClientHandledRef = useRef(onOpenClientHandled);
  onOpenClientHandledRef.current = onOpenClientHandled;

  useEffect(() => {
    if (!openClientId || !clients.some((client) => client.id === openClientId)) return;
    setDetailSubitem(null);
    setDetailClientId(openClientId);
    onOpenClientHandledRef.current?.();
  }, [clients, openClientId]);

  useEffect(() => {
    let active = true;
    void fetch('/api/customer-profiles')
      .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Unable to load blacklist.'); return result; })
      .then((result) => {
        if (!active) return;
        const numbers = (result.clients ?? [])
          .filter((profile: { is_blacklisted?: boolean }) => profile.is_blacklisted)
          .flatMap((profile: { phone_number?: string; phone_numbers?: Array<{ phone_number?: string }> }) => profile.phone_numbers?.length ? profile.phone_numbers.map((phone) => phone.phone_number ?? '') : [profile.phone_number ?? ''])
          .map(normalizeBlacklistPhone)
          .filter(Boolean);
        setBlacklistedPhones(new Set(numbers));
      })
      .catch((error) => console.error('Failed to load client blacklist', error));
    return () => { active = false; };
  }, []);

  const clientPmAssigneeIds = useCallback((client: Client) => {
    try {
      const ids = JSON.parse(client.customFields?.pmAssigneeIds ?? '[]');
      return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }, []);

  const canEditClientRecord = useCallback((clientId: string) => {
    if (!currentUserId) return false;
    const client = clients.find((item) => item.id === clientId);
    return !!client && ((clientAssignees[clientId] ?? []).includes(currentUserId) || clientPmAssigneeIds(client).includes(currentUserId));
  }, [clientAssignees, clientPmAssigneeIds, clients, currentUserId]);

  const canEditSubitemRecord = useCallback((clientId: string, subitemId: string) => {
    if (!currentUserId) return false;
    return canEditClientRecord(clientId) || (subitemAssignees[subitemId] ?? []).includes(currentUserId);
  }, [canEditClientRecord, currentUserId, subitemAssignees]);

  const canEditSelectedClients = useMemo(
    () => [...selectedIds].every((clientId) => canEditClientRecord(clientId)),
    [canEditClientRecord, selectedIds],
  );
  const canEditSelectedSubitems = useMemo(
    () => selectedSubitemIds.every((subitemId) => {
      const owner = clients.find((client) => client.subitems.some((subitem) => subitem.id === subitemId));
      return !!owner && canEditSubitemRecord(owner.id, subitemId);
    }),
    [canEditSubitemRecord, clients, selectedSubitemIds],
  );

  const showAssignmentPermissionError = useCallback(() => {
    toast.error('You can only edit items that are assigned to you');
  }, []);
  const [pendingDeleteSelected, setPendingDeleteSelected] = useState(false);

  const [replyStatusEntries, setReplyStatusEntries] = useState<OptionEntry[]>([]);
  const [clientStatusEntries, setClientStatusEntries] = useState<OptionEntry[]>([]);
  const [channelEntries, setChannelEntries] = useState<OptionEntry[]>([]);
  const [importanceEntries, setImportanceEntries] = useState<OptionEntry[]>([]);
  const [progressEntries, setProgressEntries] = useState<OptionEntry[]>([]);
  const [paymentEntries, setPaymentEntries] = useState<OptionEntry[]>([]);
  const [paymentStatusEntries, setPaymentStatusEntries] = useState<OptionEntry[]>([]);
  const [modeOfPaymentEntries, setModeOfPaymentEntries] = useState<OptionEntry[]>([]);
  const [shipperEntries, setShipperEntries] = useState<OptionEntry[]>([]);
  const [localOverseasEntries, setLocalOverseasEntries] = useState<OptionEntry[]>([]);
  const [subitemStatusEntries, setSubitemStatusEntries] = useState<OptionEntry[]>([]);
  const [currencyEntries, setCurrencyEntries] = useState<OptionEntry[]>([]);
  const [subitemSubprogressEntries, setSubitemSubprogressEntries] = useState<OptionEntry[]>([]);

  const replyStatuses = replyStatusEntries.map((e) => e.value);
  const clientStatuses = clientStatusEntries.map((e) => e.value);
  const channelOptions = channelEntries.map((e) => e.value);
  const importanceOptions = importanceEntries.map((e) => e.value);
  const progressOptions = progressEntries.map((e) => e.value);
  const subprogressOptions = subitemSubprogressEntries.map((e) => e.value);
  const subitemStatusOptionsForFilter = subitemStatusEntries.map((e) => e.value);
  const paymentOptionsForFilter = paymentEntries.map((e) => e.value);
  const paymentStatusOptionsForFilter = paymentStatusEntries.map((e) => e.value);
  const peopleOptions = profiles.filter((profile) => profile.id).map((profile) => ({ value: profile.id, label: profile.full_name || profile.email || profile.id }));
  const peopleProfilesById = Object.fromEntries(profiles.map((profile) => [profile.id, profile]));
  const statusColors = Object.fromEntries(clientStatusEntries.map((e) => [e.value, e.color]));
  const subProgressColors = Object.fromEntries(subitemSubprogressEntries.map((e) => [e.value, e.color]));
  const subitemStatusColors = Object.fromEntries(subitemStatusEntries.map((e) => [e.value, e.color]));
  const paymentColors = Object.fromEntries(paymentEntries.map((e) => [e.value, e.color]));
  const paymentStatusColors = Object.fromEntries(paymentStatusEntries.map((e) => [e.value, e.color]));
  const importanceColors = Object.fromEntries(importanceEntries.map((e) => [e.value, e.color]));
  const progressColors = Object.fromEntries(progressEntries.map((e) => [e.value, e.color]));
  const replyStatusColors = Object.fromEntries(replyStatusEntries.map((e) => [e.value, e.color]));
  const channelColors = Object.fromEntries(channelEntries.map((e) => [e.value, e.color]));

  const [groups, setGroups] = useState<CRMGroup[]>([]);
  const allGroupsCollapsed = groups.length > 0 && groups.every((group) => collapsedGroups[group.id]);
  const [groupToDelete, setGroupToDelete] = useState<CRMGroup | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [draggedClientId, setDraggedClientId] = useState<string | null>(null);
  const [draggedSubitem, setDraggedSubitem] = useState<{ id: string; sourceClientId: string } | null>(null);
  const [dragOverSubitemClientId, setDragOverSubitemClientId] = useState<string | null>(null);
  const [subitemDropMarker, setSubitemDropMarker] = useState<{ clientId: string; subitemId: string; edge: 'top' | 'bottom' } | null>(null);
  const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [dragOverGroupEdge, setDragOverGroupEdge] = useState<'top' | 'bottom' | null>(null);
  const [groupDragOverId, setGroupDragOverId] = useState<string | null>(null);
  const [groupDragOverEdge, setGroupDragOverEdge] = useState<'top' | 'bottom' | null>(null);
  const [pendingCloseLead, setPendingCloseLead] = useState<{ clientId: string; updates: Partial<Client> } | null>(null);
  const [closeLeadFiles, setCloseLeadFiles] = useState<{ purchaseOrder: File | null; signedQuotation: File | null; proofOfPayment: File | null }>({ purchaseOrder: null, signedQuotation: null, proofOfPayment: null });
  const [signedOcfCheck, setSignedOcfCheck] = useState<{ loading: boolean; signedAt: string | null; error: boolean }>({ loading: false, signedAt: null, error: false });
  const [savingCloseLead, setSavingCloseLead] = useState(false);

  const [headerCols, setHeaderCols] = useState<HeaderCol[]>(CLIENT_HEADER_COLS);
  const [clientMergedOrderKeys, setClientMergedOrderKeys] = useState<string[]>([]);
  const [customClientWidths, setCustomClientWidths] = useState<Record<string, number>>({});
  const [draggedHeaderKey, setDraggedHeaderKey] = useState<string | null>(null);
  const [dragOverHeaderKey, setDragOverHeaderKey] = useState<string | null>(null);
  const [dragOverHeaderEdge, setDragOverHeaderEdge] = useState<'left' | 'right' | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showRestoreArrangementConfirm, setShowRestoreArrangementConfirm] = useState(false);
  const [showRestoreSortingConfirm, setShowRestoreSortingConfirm] = useState(false);
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<Set<string>>(new Set());
  const [openColumnMenu, setOpenColumnMenu] = useState<string | null>(null);
  const [showHideColumns, setShowHideColumns] = useState(false);
  const [showBoardMoreMenu, setShowBoardMoreMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [boardSort, setBoardSort] = useState<BoardSortSetting>(DEFAULT_BOARD_SORT);

  useEffect(() => {
    if (!pendingCloseLead) {
      setSignedOcfCheck({ loading: false, signedAt: null, error: false });
      return;
    }
    let active = true;
    setSignedOcfCheck({ loading: true, signedAt: null, error: false });
    const supabase = createSupabaseClient();
    void supabase
      .from('order_confirmations')
      .select('client_signed_at')
      .eq('client_id', pendingCloseLead.clientId)
      .not('client_signed_at', 'is', null)
      .order('client_signed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        setSignedOcfCheck({ loading: false, signedAt: error ? null : data?.client_signed_at ?? null, error: Boolean(error) });
      });
    return () => { active = false; };
  }, [pendingCloseLead]);

  const notifyChange = useCallback((title: string, description: string) => {
    toast.success(title, {
      description,
      action: {
        label: 'Details',
        onClick: () => toast(title, { description }),
      },
    });
  }, []);

  const openColumnFilter = useCallback((column: string) => {
    setFocusedFilterColumn(column);
    setShowFilter(true);
  }, []);

  const hiddenSettingsLoadedFor = useRef<string | null>(null);

  const hideColumn = useCallback((key: string) => {
    setHiddenColumnKeys((previous) => new Set(previous).add(key));
    setOpenColumnMenu(null);
    notifyChange('Column hidden', `${key.replace(/^[^:]+:/, '')} is hidden for your account.`);
  }, [notifyChange]);

  const setColumnVisibility = useCallback((key: string, visible: boolean) => {
    setHiddenColumnKeys((previous) => {
      const next = new Set(previous);
      if (visible) next.delete(key);
      else next.add(key);
      return next;
    });
    notifyChange(visible ? 'Column restored' : 'Column hidden', visible ? `${key.replace(/^[^:]+:/, '')} is visible again.` : `${key.replace(/^[^:]+:/, '')} is hidden for your account.`);
  }, [notifyChange]);

  useEffect(() => {
    if (!currentUserId) {
      hiddenSettingsLoadedFor.current = null;
      setHiddenColumnKeys(new Set());
      return;
    }

    let mounted = true;
    hiddenSettingsLoadedFor.current = null;
    (async () => {
      try {
        const { loadUserSetting } = await import('@/lib/user-settings');
        const value = await loadUserSetting('colHidden');
        if (!mounted) return;
        const keys = Array.isArray(value) ? value.filter((key): key is string => typeof key === 'string') : [];
        setHiddenColumnKeys(new Set(keys));
        hiddenSettingsLoadedFor.current = currentUserId;
        try {
          localStorage.setItem(`colHidden:${currentUserId}`, JSON.stringify(keys));
        } catch {}
      } catch (error) {
        console.warn('Failed to load saved hidden columns', error);
        if (mounted) hiddenSettingsLoadedFor.current = currentUserId;
      }
    })();

    return () => { mounted = false; };
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId || hiddenSettingsLoadedFor.current !== currentUserId) return;
    const keys = Array.from(hiddenColumnKeys);
    try { localStorage.setItem(`colHidden:${currentUserId}`, JSON.stringify(keys)); } catch {}
    void import('@/lib/user-settings')
      .then(({ saveUserSetting }) => saveUserSetting('colHidden', keys))
      .catch((error) => console.warn('Failed to save hidden columns', error));
  }, [hiddenColumnKeys, currentUserId]);

  const setDragPreview = (event: React.DragEvent, source: HTMLElement, includeColumnCells = false) => {
    if (!event.dataTransfer) return;
    const bounds = source.getBoundingClientRect();
    const preview = includeColumnCells ? document.createElement('div') : source.cloneNode(true) as HTMLElement;
    // The clone is appended to document.body, so preserve the CRM Board typography context.
    preview.classList.add('crm-board');
    preview.style.position = 'fixed';
    preview.style.left = '-10000px';
    preview.style.top = '-10000px';
    preview.style.width = `${bounds.width}px`;
    preview.style.maxWidth = `${bounds.width}px`;
    preview.style.height = includeColumnCells ? `${bounds.height + 56}px` : `${bounds.height}px`;
    preview.style.setProperty('opacity', '1', 'important');
    preview.style.filter = 'none';
    preview.style.pointerEvents = 'none';
    preview.style.boxShadow = '0 8px 20px rgba(15, 23, 42, 0.22)';
    preview.style.borderRadius = '3px';
    preview.style.background = '#ffffff';
    if (includeColumnCells) {
      preview.style.border = '1px solid #8edbe7';
      preview.style.overflow = 'hidden';
      preview.innerHTML = `<div style="height:${bounds.height}px;display:flex;align-items:center;justify-content:center;padding:0 8px;box-sizing:border-box;background:#e7fdff;color:#334155;font-weight:600;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-bottom:1px solid #d0d4e4">${source.textContent?.trim() ?? ''}</div>`;
      const sourceCenter = bounds.left + bounds.width / 2;
      const groupContainer = source.closest<HTMLElement>('[data-client-group]');
      const groupRows = groupContainer
        ? Array.from(groupContainer.querySelectorAll<HTMLElement>('[data-client-row]'))
        : [];
      const rowScope: ParentNode = groupRows.length > 0 && groupContainer ? groupContainer : document;
      const visibleCells = Array.from(rowScope.querySelectorAll<HTMLElement>('[data-client-row]'))
        .flatMap((row) => Array.from(row.querySelectorAll<HTMLElement>('[style*="order"]')))
        .filter((cell) => {
          const cellBounds = cell.getBoundingClientRect();
          return cellBounds.top >= bounds.bottom - 1
            && Math.abs(cellBounds.left + cellBounds.width / 2 - sourceCenter) < Math.max(8, bounds.width / 2);
        })
        .sort((first, second) => first.getBoundingClientRect().top - second.getBoundingClientRect().top)
        .slice(0, 2);
      visibleCells.forEach((cell) => {
        const cellPreview = cell.cloneNode(true) as HTMLElement;
        cellPreview.style.width = `${bounds.width}px`;
        cellPreview.style.minWidth = `${bounds.width}px`;
        cellPreview.style.height = '28px';
        cellPreview.style.border = '0';
        cellPreview.style.borderBottom = '1px solid #d0d4e4';
        cellPreview.style.overflow = 'hidden';
        cellPreview.style.opacity = '1';
        cellPreview.querySelectorAll<HTMLElement>('*').forEach((element) => {
          element.style.opacity = '1';
        });
        preview.appendChild(cellPreview);
      });
    }
    document.body.appendChild(preview);
    event.dataTransfer.setDragImage(preview, Math.min(bounds.width / 2, 90), Math.min(bounds.height / 2, includeColumnCells ? 28 : 16));
    window.setTimeout(() => preview.remove(), 0);
  };

  const handleRestoreDefaults = useCallback(async (scope: ColumnScope) => {
    // restore client header widths to defaults
    if (scope === 'client' || scope === 'all') {
      setHeaderCols((prev) => prev.map((c) => {
        const def = CLIENT_HEADER_COLS.find((d) => d.key === c.key);
        return { ...c, width: def?.width ?? c.width };
      }));
      setCustomClientWidths({});
    }

    // prepare maps
    const clientMap = Object.fromEntries(CLIENT_HEADER_COLS.map((c) => [c.key, c.width]));
    const subitemMap = Object.fromEntries(SUBITEM_COLS.map((c) => [c.key, c.width]));
    const paymentMap = Object.fromEntries(PAYMENT_COLS.map((c) => [c.key, c.width]));

    // write local caches
    if (scope === 'client' || scope === 'all') try { localStorage.setItem('colWidths:clients:local', JSON.stringify(clientMap)); localStorage.setItem('colWidths:clients:local_owner', String(currentUserId ?? 'anon')); } catch {}
    if (scope === 'subitem' || scope === 'all') try { localStorage.setItem('colWidths:subitems:local', JSON.stringify(subitemMap)); localStorage.setItem('colWidths:payments:local', JSON.stringify(paymentMap)); localStorage.setItem('colWidths:subitems:local_owner', String(currentUserId ?? 'anon')); localStorage.setItem('colWidths:payments:local_owner', String(currentUserId ?? 'anon')); } catch {}
    if (currentUserId) {
      if (scope === 'client' || scope === 'all') try { localStorage.setItem(`colWidths:clients:${currentUserId}`, JSON.stringify(clientMap)); } catch {}
      if (scope === 'subitem' || scope === 'all') try { localStorage.setItem(`colWidths:subitems:${currentUserId}`, JSON.stringify(subitemMap)); localStorage.setItem(`colWidths:payments:${currentUserId}`, JSON.stringify(paymentMap)); } catch {}
    }

    // notify subitems/payment instances to reset
    try {
      if (scope === 'subitem' || scope === 'all') {
        window.dispatchEvent(new CustomEvent('subitemColsChanged', { detail: subitemMap }));
        window.dispatchEvent(new CustomEvent('paymentColsChanged', { detail: paymentMap }));
      }
    } catch (e) {
      // ignore
    }

    // persist to server if authenticated
    if (currentUserId) {
      try {
        const { saveUserSetting } = await import('@/lib/user-settings');
        const saves = [];
        if (scope === 'client' || scope === 'all') saves.push(saveUserSetting('colWidths:clients', clientMap));
        if (scope === 'subitem' || scope === 'all') saves.push(saveUserSetting('colWidths:subitems', subitemMap), saveUserSetting('colWidths:payments', paymentMap));
        await Promise.all(saves);
      } catch (e) {
        console.warn('Failed to persist restored default column widths', e);
      }
    }
    notifyChange('Column widths restored', scope === 'client' ? 'Client column widths were reset.' : scope === 'subitem' ? 'Subitem and payment column widths were reset.' : 'All column widths were reset.');
  }, [currentUserId, notifyChange]);

  const handleRestoreDefaultArrangement = useCallback(async (scope: ColumnScope) => {
    const clientOrder = CLIENT_HEADER_COLS.map((col) => col.key);
    const subitemOrder = SUBITEM_COLS.map((col) => col.key);
    const paymentOrder = PAYMENT_COLS.map((col) => col.key);

    if (scope === 'client' || scope === 'all') {
      setHeaderCols(CLIENT_HEADER_COLS.map((col) => ({ ...col })));
      setClientMergedOrderKeys([]);
    }

    try {
      if (scope === 'client' || scope === 'all') { localStorage.setItem('colOrder:clients:local', JSON.stringify(clientOrder)); localStorage.setItem('colOrder:clients:local_owner', String(currentUserId ?? 'anon')); }
      if (scope === 'subitem' || scope === 'all') { localStorage.setItem('colOrder:subitems:local', JSON.stringify(subitemOrder)); localStorage.setItem('colOrder:payments:local', JSON.stringify(paymentOrder)); localStorage.setItem('colOrder:subitems:local_owner', String(currentUserId ?? 'anon')); localStorage.setItem('colOrder:payments:local_owner', String(currentUserId ?? 'anon')); }
      if (currentUserId) {
        if (scope === 'client' || scope === 'all') localStorage.setItem(`colOrder:clients:${currentUserId}`, JSON.stringify(clientOrder));
        if (scope === 'subitem' || scope === 'all') { localStorage.setItem(`colOrder:subitems:${currentUserId}`, JSON.stringify(subitemOrder)); localStorage.setItem(`colOrder:payments:${currentUserId}`, JSON.stringify(paymentOrder)); }
      }
      if (scope === 'subitem' || scope === 'all') { window.dispatchEvent(new CustomEvent('subitemColsReordered', { detail: subitemOrder })); window.dispatchEvent(new CustomEvent('paymentColsReordered', { detail: paymentOrder })); }
      if (scope === 'client' || scope === 'all') window.dispatchEvent(new CustomEvent('clientColsReordered', { detail: clientOrder }));
    } catch {}

    if (currentUserId) {
      try {
        const { saveUserSetting } = await import('@/lib/user-settings');
        const saves = [];
        if (scope === 'client' || scope === 'all') saves.push(saveUserSetting('colOrder:clients', clientOrder));
        if (scope === 'subitem' || scope === 'all') saves.push(saveUserSetting('colOrder:subitems', subitemOrder), saveUserSetting('colOrder:payments', paymentOrder));
        await Promise.all(saves);
      } catch (error) {
        console.warn('Failed to persist restored default column arrangement', error);
      }
    }
    notifyChange('Column arrangement restored', scope === 'client' ? 'Client columns were reset.' : scope === 'subitem' ? 'Subitem and payment columns were reset.' : 'All columns were reset.');
  }, [currentUserId, notifyChange]);

  // User custom columns
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [showAddColModal, setShowAddColModal] = useState<'client' | 'subitem' | null>(null);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState<'text' | 'number' | 'date'>('text');
  const [isAddingCol, setIsAddingCol] = useState(false);
  const [pendingDeleteCustomColumn, setPendingDeleteCustomColumn] = useState<CustomColumn | null>(null);
  const [isDeletingCustomColumn, setIsDeletingCustomColumn] = useState(false);
  const canCreateCustomColumns = ['director', 'dev'].includes(String(currentUserRole ?? '').trim().toLowerCase());

  const clientCustomCols = customColumns.filter((c) => c.target === 'client');
  const subitemCustomCols = customColumns.filter((c) => c.target === 'subitem');

  const mergedHeaderCols = React.useMemo<HeaderCol[]>(() => {
    const customClientHeaderCols: HeaderCol[] = clientCustomCols.map((col) => ({
      key: `custom:${col.id}`,
      label: col.name,
      width: customClientWidths[`custom:${col.id}`] ?? 120,
      minWidth: 80,
      customColumnId: col.id,
      isCustom: true,
      field_type: col.field_type,
    }));

    const addClientColHeader = headerCols.find((c) => c.key === 'addClientCol');
    const emptyHeader = headerCols.find((c) => c.key === 'empty');

    const fixedFront = headerCols.filter((c) => ['selectCheckbox', 'client'].includes(c.key));
    const middle = [
      ...headerCols.filter((c) => !['selectCheckbox', 'client', 'addClientCol', 'empty'].includes(c.key)),
      ...customClientHeaderCols,
    ];
    const ordered = clientMergedOrderKeys.map((key) => middle.find((col) => col.key === key)).filter(Boolean) as HeaderCol[];
    const remaining = middle.filter((col) => !clientMergedOrderKeys.includes(col.key));

    return [...fixedFront, ...ordered, ...remaining, ...(addClientColHeader ? [addClientColHeader] : []), ...(emptyHeader ? [emptyHeader] : [])];
  }, [headerCols, clientCustomCols, clientMergedOrderKeys, customClientWidths]);

  // Headers and row cells must use the exact same merged order. Building this
  // from only headerCols leaves every custom cell on the same fallback order.
  const clientColumnOrderMap = React.useMemo<Record<string, number>>(() => {
    return Object.fromEntries(mergedHeaderCols.map((col, index) => [col.key, index]));
  }, [mergedHeaderCols]);

  const visibleClientHeaderCols = React.useMemo(
    () => mergedHeaderCols.filter((col) => !hiddenColumnKeys.has(`client:${col.key}`) || ['selectCheckbox', 'client', 'addClientCol', 'empty'].includes(col.key)),
    [mergedHeaderCols, hiddenColumnKeys],
  );

  const visibleClientCustomCols = React.useMemo(
    () => clientCustomCols.filter((col) => !hiddenColumnKeys.has(`client:custom:${col.id}`)),
    [clientCustomCols, hiddenColumnKeys],
  );

  const reorderClientColumns = useCallback((draggedKey: string, targetKey: string) => {
    const baseCols = mergedHeaderCols.filter((col) => !['selectCheckbox', 'client', 'addClientCol', 'empty'].includes(col.key));
    const from = baseCols.findIndex((col) => col.key === draggedKey);
    const to = baseCols.findIndex((col) => col.key === targetKey);
    if (from === -1 || to === -1) return;

    const reordered = [...baseCols];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const fixedFront = mergedHeaderCols.filter((col) => ['selectCheckbox', 'client'].includes(col.key));
    const fixedEnd = mergedHeaderCols.filter((col) => ['addClientCol', 'empty'].includes(col.key));
    const next = [...fixedFront, ...reordered, ...fixedEnd];

    setClientMergedOrderKeys(reordered.map((col) => col.key));
    setHeaderCols((current) => {
      const byKey = new Map(current.map((col) => [col.key, col]));
      return next.map((col) => byKey.get(col.key)).filter(Boolean) as HeaderCol[];
    });

    const order = next.map((col) => col.key);
    try {
      localStorage.setItem('colOrder:clients:local', JSON.stringify(order));
      localStorage.setItem('colOrder:clients:local_owner', String(currentUserId ?? 'anon'));
      if (currentUserId) localStorage.setItem(`colOrder:clients:${currentUserId}`, JSON.stringify(order));
      window.dispatchEvent(new CustomEvent('clientColsReordered', { detail: order }));
    } catch {}
    if (currentUserId) void import('@/lib/user-settings').then(({ saveUserSetting }) => saveUserSetting('colOrder:clients', order)).catch((error) => console.warn('Failed to save client column arrangement', error));
    notifyChange('Column arrangement saved', 'The client column order was saved to your account.');
  }, [mergedHeaderCols, currentUserId, notifyChange]);

  const hideableColumnGroups = React.useMemo(() => [
    {
      label: 'Client columns',
      columns: mergedHeaderCols.filter((col) => !['selectCheckbox', 'client', 'addClientCol', 'empty'].includes(col.key)).map((col) => ({ key: `client:${col.key}`, label: col.label })),
    },
    {
      label: 'Subitem columns',
      columns: [
        ...SUBITEM_COLS.filter((col) => col.key !== 'name').map((col) => ({ key: `subitem:${col.key}`, label: col.label })),
        ...subitemCustomCols.map((col) => ({ key: `subitem:custom:${col.id}`, label: col.name })),
      ],
    },
    {
      label: 'Payment columns',
      columns: PAYMENT_COLS.filter((col) => col.key !== 'name').map((col) => ({ key: `payment:${col.key}`, label: col.label })),
    },
  ], [mergedHeaderCols, subitemCustomCols]);

  // If the authenticated user changes, clear any generic local caches owned by other users
  useEffect(() => {
    try {
      if (!window?.localStorage) return;
      const clientOwner = localStorage.getItem('colWidths:clients:local_owner');
      const subOwner = localStorage.getItem('colWidths:subitems:local_owner');
      const payOwner = localStorage.getItem('colWidths:payments:local_owner');
      const clientOrderOwner = localStorage.getItem('colOrder:clients:local_owner');
      const subitemOrderOwner = localStorage.getItem('colOrder:subitems:local_owner');
      const paymentOrderOwner = localStorage.getItem('colOrder:payments:local_owner');
      // if signed in and owners exist but don't match, clear and reset defaults
      if (currentUserId) {
        let didClear = false;
        if (clientOwner && clientOwner !== currentUserId) {
          try { localStorage.removeItem('colWidths:clients:local'); localStorage.removeItem('colWidths:clients:local_owner'); } catch {}
          setHeaderCols(CLIENT_HEADER_COLS.map((c) => ({ ...c })));
          didClear = true;
        }
        if (subOwner && subOwner !== currentUserId) {
          try { localStorage.removeItem('colWidths:subitems:local'); localStorage.removeItem('colWidths:subitems:local_owner'); } catch {}
          // notify subitems to reset to defaults
          try { window.dispatchEvent(new CustomEvent('subitemColsChanged', { detail: Object.fromEntries(SUBITEM_COLS.map(c => [c.key, c.width])) })); } catch {}
          didClear = true;
        }
        if (payOwner && payOwner !== currentUserId) {
          try { localStorage.removeItem('colWidths:payments:local'); localStorage.removeItem('colWidths:payments:local_owner'); } catch {}
          try { window.dispatchEvent(new CustomEvent('paymentColsChanged', { detail: Object.fromEntries(PAYMENT_COLS.map(c => [c.key, c.width])) })); } catch {}
          didClear = true;
        }
        if (clientOrderOwner && clientOrderOwner !== currentUserId) {
          try { localStorage.removeItem('colOrder:clients:local'); localStorage.removeItem('colOrder:clients:local_owner'); } catch {}
          setHeaderCols(CLIENT_HEADER_COLS.map((c) => ({ ...c })));
        }
        if (subitemOrderOwner && subitemOrderOwner !== currentUserId) {
          try { localStorage.removeItem('colOrder:subitems:local'); localStorage.removeItem('colOrder:subitems:local_owner'); } catch {}
          try { window.dispatchEvent(new CustomEvent('subitemColsReordered', { detail: SUBITEM_COLS.map((c) => c.key) })); } catch {}
        }
        if (paymentOrderOwner && paymentOrderOwner !== currentUserId) {
          try { localStorage.removeItem('colOrder:payments:local'); localStorage.removeItem('colOrder:payments:local_owner'); } catch {}
          try { window.dispatchEvent(new CustomEvent('paymentColsReordered', { detail: PAYMENT_COLS.map((c) => c.key) })); } catch {}
        }

        // if we cleared other-user caches, persist defaults for current user if they have none
        if (didClear) {
          (async () => {
            try {
              const { saveUserSetting } = await import('@/lib/user-settings');
              const clientMap = Object.fromEntries(CLIENT_HEADER_COLS.map((c) => [c.key, c.width]));
              const subMap = Object.fromEntries(SUBITEM_COLS.map((c) => [c.key, c.width]));
              const payMap = Object.fromEntries(PAYMENT_COLS.map((c) => [c.key, c.width]));
              try { localStorage.setItem(`colWidths:clients:${currentUserId}`, JSON.stringify(clientMap)); } catch {}
              try { localStorage.setItem(`colWidths:subitems:${currentUserId}`, JSON.stringify(subMap)); } catch {}
              try { localStorage.setItem(`colWidths:payments:${currentUserId}`, JSON.stringify(payMap)); } catch {}
              await Promise.all([
                saveUserSetting('colWidths:clients', clientMap),
                saveUserSetting('colWidths:subitems', subMap),
                saveUserSetting('colWidths:payments', payMap),
              ]);
            } catch (e) {
              // ignore persistence errors
            }
          })();
        }
      }
    } catch (e) {
      // ignore
    }
    try { window.dispatchEvent(new CustomEvent('authChanged', { detail: currentUserId })); } catch {}
  }, [currentUserId]);

  const totalMinWidth = visibleClientHeaderCols.reduce((sum, col) => sum + col.width, 0);
  const colWidth = React.useMemo(
    () => Object.fromEntries(visibleClientHeaderCols.map((c) => [c.key, c.width])),
    [visibleClientHeaderCols]
  );

  // Persist client column widths per-user in DB (fallback to localStorage)
  // Apply most-recent local cache immediately on mount so SPA nav restores quickly
  useEffect(() => {
    try {
      const raw = localStorage.getItem('colOrder:clients:local');
      if (!raw) return;
      const owner = localStorage.getItem('colOrder:clients:local_owner');
      if (currentUserId && owner && owner !== currentUserId) return;
      const order = JSON.parse(raw) as string[];
      if (!Array.isArray(order) || order.length === 0) return;
      setClientMergedOrderKeys(order.filter((key) => !['selectCheckbox', 'client', 'addClientCol', 'empty'].includes(key)));

      setHeaderCols((prev) => {
        const fixedFront = prev.filter((c) => ['selectCheckbox', 'client'].includes(c.key));
        const fixedEnd = prev.filter((c) => ['addClientCol', 'empty'].includes(c.key));
        const middle = prev.filter((c) => !['selectCheckbox', 'client', 'addClientCol', 'empty'].includes(c.key));
        const ordered = order
          .map((key) => middle.find((c) => c.key === key))
          .filter(Boolean) as HeaderCol[];
        const remaining = middle.filter((c) => !order.includes(c.key));
        return [...fixedFront, ...ordered, ...remaining, ...fixedEnd];
      });
    } catch (e) {
      // ignore
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    let mounted = true;
    (async () => {
      try {
        const { loadUserSetting } = await import('@/lib/user-settings');
        const order = await loadUserSetting('colOrder:clients');
        if (!mounted || !Array.isArray(order) || order.length === 0) return;
        setClientMergedOrderKeys(order.filter((key) => !['selectCheckbox', 'client', 'addClientCol', 'empty'].includes(key)));

        setHeaderCols((prev) => {
          const fixedFront = prev.filter((col) => ['selectCheckbox', 'client'].includes(col.key));
          const fixedEnd = prev.filter((col) => ['addClientCol', 'empty'].includes(col.key));
          const middle = prev.filter((col) => !['selectCheckbox', 'client', 'addClientCol', 'empty'].includes(col.key));
          const ordered = order.map((key) => middle.find((col) => col.key === key)).filter(Boolean) as HeaderCol[];
          const remaining = middle.filter((col) => !order.includes(col.key));
          return [...fixedFront, ...ordered, ...remaining, ...fixedEnd];
        });
      } catch (error) {
        console.warn('Failed to load saved client column arrangement', error);
      }
    })();
    return () => { mounted = false; };
  }, [currentUserId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('colWidths:clients:local');
      if (!raw) return;
      const owner = localStorage.getItem('colWidths:clients:local_owner');
      // only apply generic local cache when unauthenticated or when owner matches current user
      if (currentUserId) {
        if (owner && owner !== currentUserId) {
          // if owner doesn't match the signed-in user, reset to defaults so old widths don't leak
          setHeaderCols(CLIENT_HEADER_COLS.map((c) => ({ ...c })));
          return;
        }
      }
      const map = JSON.parse(raw) as Record<string, number>;
      setCustomClientWidths(Object.fromEntries(Object.entries(map).filter(([key, value]) => key.startsWith('custom:') && typeof value === 'number')));
      setHeaderCols((prev) => prev.map((c) => ({ ...c, width: c.key === 'empty' ? 44 : map[c.key] ?? c.width })));
    } catch (e) {
      // ignore
    }
  }, [currentUserId]);
  useEffect(() => {
    if (!currentUserId) return;
    let mounted = true;
    (async () => {
      try {
        const { loadUserSetting } = await import('@/lib/user-settings');
        const value = await loadUserSetting('colWidths:clients');
        if (!mounted) return;
        if (value && typeof value === 'object') {
          setCustomClientWidths(Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key, width]) => key.startsWith('custom:') && typeof width === 'number')) as Record<string, number>);
          setHeaderCols((prev) => prev.map((c) => ({ ...c, width: c.key === 'empty' ? 44 : value[c.key] ?? c.width })));
          return;
        }

        // fallback: try localStorage
        try {
          const raw = localStorage.getItem(`colWidths:clients:${currentUserId}`);
          if (raw) {
            const map = JSON.parse(raw) as Record<string, number>;
            setCustomClientWidths(Object.fromEntries(Object.entries(map).filter(([key, value]) => key.startsWith('custom:') && typeof value === 'number')));
            setHeaderCols((prev) => prev.map((c) => ({ ...c, width: c.key === 'empty' ? 44 : map[c.key] ?? c.width })));
          }
        } catch (e) {
          // ignore
        }
      } catch (e) {
        console.error('Failed to load saved client column widths', e);
      }
    })();
    return () => { mounted = false; };
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    (async () => {
      try {
          const { saveUserSetting } = await import('@/lib/user-settings');
          const map = Object.fromEntries(mergedHeaderCols.map((c) => [c.key, c.width]));
          // always write to localStorage for immediate reloads/navigation
          try { localStorage.setItem(`colWidths:clients:${currentUserId}`, JSON.stringify(map)); } catch {}
          try { localStorage.setItem('colWidths:clients:local', JSON.stringify(map)); } catch {}
          try { localStorage.setItem('colWidths:clients:local_owner', String(currentUserId ?? 'anon')); } catch {}
          // then persist to server (async)
          await saveUserSetting('colWidths:clients', map);
      } catch (e) {
        console.error('Failed to save client column widths', e);
      }
    })();
  }, [mergedHeaderCols, currentUserId]);

  const updateClientCustomField = useCallback(
    async (clientId: string, columnId: string, value: string) => {
      const targetClient = clients.find((c) => c.id === clientId);
      if (!targetClient) return;

      const nextCustomFields = {
        ...(targetClient.customFields ?? {}),
        [columnId]: value,
      };

      setClients((prev) =>
        prev.map((c) =>
          c.id === clientId
            ? { ...c, customFields: nextCustomFields }
            : c
        )
      );

      try {
        await updateClientRow(clientId, { customFields: nextCustomFields });
      } catch (error) {
        console.error('Failed to update client custom field', error);
        setClients(clients);
      }
    },
    [clients, setClients]
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
  const supabase = createSupabaseClient();

  const clientsChannel = supabase
    .channel('crmboard-clients-live')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'clients' },
      async (payload) => {
        console.log('Realtime client insert:', payload);
      }
    )
    .subscribe((status) => {
      console.log('Realtime status:', status);
    });

  const assigneesChannel = supabase
    .channel('crmboard-clients-assignees-live')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'client_assignees' },
      async (payload) => {
        console.log('Realtime assignee insert:', payload);
        await reloadClients();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(clientsChannel);
    supabase.removeChannel(assigneesChannel);
  };
}, [reloadClients]);

  useEffect(() => {
    const loadAssignments = async () => {
      try {
        const supabase = createSupabaseClient();
        const [
          profilesData,
          { data: { user } },
          groupsData,
          replyOpts,
          statusOpts,
          channelOpts,
          importanceOpts,
          progressOpts,
          paymentOpts,
          paymentStatusOpts,
          modeOfPaymentOpts,
          shipperOpts,
          localOverseasOpts,
          subitemStatusOpts,
          currencyOpts,
          subitemSubprogressOpts,
          customColumnsData

        ] = await Promise.all([
          fetchProfiles(),
          supabase.auth.getUser(),
          fetchGroups(),
          fetchOptions('reply_status'),
          fetchOptions('client_status'),
          fetchOptions('channel'),
          fetchOptions('importance'),
          fetchOptions('progress'),
          fetchOptions('payment'),
          fetchOptions('payment_status'),
          fetchOptions('mode_of_payment'),
          fetchOptions('shipper'),
          fetchOptions('local_overseas'),
          fetchOptions('subitem_status'),
          fetchOptions('currency'),
          fetchOptions('subitem_subprogress'),
          fetchCustomColumns(),
        ]);

        setProfiles(profilesData);
        setCurrentUserId(user?.id ?? null);
        setGroups(groupsData);
        const navigationGroupId = searchTarget
          ? clients.find((client) => client.id === searchTarget.clientId)?.groupId
          : null;
        setCollapsedGroups(Object.fromEntries(groupsData.map((group) => [group.id, group.id !== navigationGroupId])));
        setReplyStatusEntries(replyOpts);
        setClientStatusEntries(statusOpts);
        setChannelEntries(channelOpts);
        setImportanceEntries(importanceOpts);
        setProgressEntries(progressOpts);
        setPaymentEntries(paymentOpts);
        setPaymentStatusEntries(paymentStatusOpts);
        setModeOfPaymentEntries(modeOfPaymentOpts);
        setShipperEntries(shipperOpts);
        setLocalOverseasEntries(localOverseasOpts);
        setSubitemStatusEntries(subitemStatusOpts);
        setCurrencyEntries(currencyOpts);
        setSubitemSubprogressEntries(subitemSubprogressOpts);
        setCustomColumns(customColumnsData);

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

  useEffect(() => {
    if (!openGroupMenu && !openColumnMenu && !showHideColumns && !showBoardMoreMenu && !showSortMenu) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-crm-menu-trigger], [data-crm-menu]')) return;
      setOpenGroupMenu(null);
      setOpenColumnMenu(null);
      setShowHideColumns(false);
      setShowBoardMoreMenu(false);
      setShowSortMenu(false);
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openGroupMenu, openColumnMenu, showHideColumns, showBoardMoreMenu, showSortMenu]);


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
      if (!groupId) {
        toast.error('Option could not be added', { description: `The ${code.replaceAll('_', ' ')} option group was not found.` });
        return;
      }

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
        toast.error('Option could not be added', { description: error.message });
        return;
      }

      setEntries((prev) => [...prev, data]);
      notifyChange('Option added', `${trimmed} is now available in the ${code.replaceAll('_', ' ')} list.`);
    },
    [getOptionGroupId, notifyChange]
  );

  const deleteOptionValue = useCallback(
    async (
      code: string,
      name: string,
      setEntries: React.Dispatch<React.SetStateAction<OptionEntry[]>>
    ) => {
      const groupId = await getOptionGroupId(code);
      if (!groupId) {
        toast.error('Option could not be deleted', { description: `The ${code.replaceAll('_', ' ')} option group was not found.` });
        return;
      }

      const supabase = createSupabaseClient();
      const { error } = await supabase
        .from('option_values')
        .delete()
        .eq('group_id', groupId)
        .eq('value', name);

      if (error) {
        console.error(`Failed to delete option from ${code}`, error);
        toast.error('Option could not be deleted', { description: error.message });
        return;
      }

      setEntries((prev) => prev.filter((e) => e.value !== name));
      notifyChange('Option deleted', `${name} was removed from the ${code.replaceAll('_', ' ')} list.`);
    },
    [getOptionGroupId, notifyChange]
  );

  const updateOptionColor = useCallback(async (code: string, name: string, color: string) => {
    const groupId = await getOptionGroupId(code);
    if (!groupId) {
      toast.error('Label color could not be changed', { description: `The ${code.replaceAll('_', ' ')} option group was not found.` });
      return;
    }

    const supabase = createSupabaseClient();
    const { error } = await supabase
      .from('option_values')
      .update({ color })
      .eq('group_id', groupId)
      .eq('value', name);

    if (error) {
      console.error(`Failed to update option color for ${code}`, error);
      toast.error('Label color could not be changed', { description: error.message });
      return;
    }

    const setters: Record<string, React.Dispatch<React.SetStateAction<OptionEntry[]>>> = {
      reply_status: setReplyStatusEntries,
      client_status: setClientStatusEntries,
      channel: setChannelEntries,
      importance: setImportanceEntries,
      progress: setProgressEntries,
      payment: setPaymentEntries,
      payment_status: setPaymentStatusEntries,
      mode_of_payment: setModeOfPaymentEntries,
      shipper: setShipperEntries,
      local_overseas: setLocalOverseasEntries,
      subitem_status: setSubitemStatusEntries,
      currency: setCurrencyEntries,
      subitem_subprogress: setSubitemSubprogressEntries,
    };
    setters[code]?.((previous) => previous.map((entry) => entry.value === name ? { ...entry, color } : entry));
    notifyChange('Label color changed', `${name} now uses the selected color.`);
  }, [getOptionGroupId, notifyChange]);

  const renameOptionValue = useCallback(async (code: string, oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;

    const groupId = await getOptionGroupId(code);
    if (!groupId) {
      toast.error('Label could not be renamed', { description: `The ${code.replaceAll('_', ' ')} option group was not found.` });
      return;
    }

    const supabase = createSupabaseClient();
    const { error: optionError } = await supabase.from('option_values').update({ value: trimmed }).eq('group_id', groupId).eq('value', oldName);
    if (optionError) {
      toast.error('Label could not be renamed', { description: optionError.message });
      return;
    }

    const fieldMap: Record<string, { table: 'clients' | 'subitems'; column: string }> = {
      reply_status: { table: 'clients', column: 'reply_status' }, client_status: { table: 'clients', column: 'status' },
      channel: { table: 'clients', column: 'channel' }, importance: { table: 'clients', column: 'importance' }, progress: { table: 'clients', column: 'progress' },
      payment: { table: 'subitems', column: 'payment' }, payment_status: { table: 'subitems', column: 'payment_status' },
      mode_of_payment: { table: 'subitems', column: 'mode_of_payment' }, shipper: { table: 'subitems', column: 'shipper' },
      local_overseas: { table: 'subitems', column: 'local_overseas' }, subitem_status: { table: 'subitems', column: 'status' },
      currency: { table: 'subitems', column: 'currency' },
    };
    const field = fieldMap[code];
    if (field) {
      const { error } = await supabase.from(field.table).update({ [field.column]: trimmed }).eq(field.column, oldName);
      if (error) {
        await supabase.from('option_values').update({ value: oldName }).eq('group_id', groupId).eq('value', trimmed);
        toast.error('Label could not be renamed', { description: error.message });
        return;
      }
    } else if (code === 'subitem_subprogress') {
      const { data: rows, error: readError } = await supabase.from('subitems').select('id, timeline_rows');
      if (readError) { toast.error('Existing timeline labels could not be updated', { description: readError.message }); return; }
      for (const row of rows ?? []) {
        const timelineRows = (row.timeline_rows ?? []).map((timelineRow: { subProgress?: string }) => timelineRow.subProgress === oldName ? { ...timelineRow, subProgress: trimmed } : timelineRow);
        if (JSON.stringify(timelineRows) !== JSON.stringify(row.timeline_rows ?? [])) await supabase.from('subitems').update({ timeline_rows: timelineRows }).eq('id', row.id);
      }
    }

    const setters: Record<string, React.Dispatch<React.SetStateAction<OptionEntry[]>>> = {
      reply_status: setReplyStatusEntries, client_status: setClientStatusEntries, channel: setChannelEntries,
      importance: setImportanceEntries, progress: setProgressEntries, payment: setPaymentEntries, payment_status: setPaymentStatusEntries,
      mode_of_payment: setModeOfPaymentEntries, shipper: setShipperEntries, local_overseas: setLocalOverseasEntries,
      subitem_status: setSubitemStatusEntries, currency: setCurrencyEntries, subitem_subprogress: setSubitemSubprogressEntries,
    };
    setters[code]?.((previous) => previous.map((entry) => entry.value === oldName ? { ...entry, value: trimmed } : entry));
    await reloadClients();
    notifyChange('Label renamed', `${oldName} was renamed to ${trimmed}.`);
  }, [getOptionGroupId, notifyChange, reloadClients]);

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

  const handleAddCurrency = useCallback(
    async (name: string) => {
      await insertOptionValue('currency', name, currencyEntries, setCurrencyEntries);
    },
    [insertOptionValue, currencyEntries]
  );

  const handleDeleteCurrency = useCallback(
    async (name: string) => {
      await deleteOptionValue('currency', name, setCurrencyEntries);
    },
    [deleteOptionValue]
  );

  const handleAddSubitemSubprogress = useCallback(
    async (name: string) => {
      await insertOptionValue('subitem_subprogress', name, subitemSubprogressEntries, setSubitemSubprogressEntries);
    },
    [insertOptionValue, subitemSubprogressEntries]
  );

  const handleDeleteSubitemSubprogress = useCallback(
    async (name: string) => {
      await deleteOptionValue('subitem_subprogress', name, setSubitemSubprogressEntries);
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

  const handleAddPayment = useCallback(
    async (name: string) => {
      await insertOptionValue('payment', name, paymentEntries, setPaymentEntries);
    },
    [insertOptionValue, paymentEntries]
  );

  const handleDeletePayment = useCallback(
    async (name: string) => {
      await deleteOptionValue('payment', name, setPaymentEntries);
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
    if (error) { console.error(error); toast.error('Reply status could not be added', { description: error.message }); return; }
    setReplyStatusEntries((prev) => [...prev, data]);
    notifyChange('Option added', `${trimmed} was added to Reply Status.`);
  }, [replyStatuses.length, notifyChange]);

  const handleDeleteReplyStatus = useCallback(async (name: string) => {
    const supabase = createSupabaseClient();
    const { error } = await supabase.from('option_values').delete().eq('value', name);
    if (error) { console.error(error); toast.error('Reply status could not be deleted', { description: error.message }); return; }
    setReplyStatusEntries((prev) => prev.filter((e) => e.value !== name));
    notifyChange('Option deleted', `${name} was removed from Reply Status.`);
  }, [notifyChange]);

  const handleAddStatus = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const supabase = createSupabaseClient();
    const { data: group } = await supabase.from('option_groups').select('id').eq('code', 'client_status').single();
    if (!group) return;
    const { data, error } = await supabase.from('option_values')
      .insert({ group_id: group.id, value: trimmed, color: '#d1d5db', sort_order: clientStatuses.length })
      .select('value, color').single();
    if (error) { console.error(error); toast.error('Status could not be added', { description: error.message }); return; }
    setClientStatusEntries((prev) => [...prev, data]);
    notifyChange('Option added', `${trimmed} was added to Status.`);
  }, [clientStatuses.length, notifyChange]);

  const handleDeleteStatus = useCallback(async (name: string) => {
    const supabase = createSupabaseClient();
    const { error } = await supabase.from('option_values').delete().eq('value', name);
    if (error) { console.error(error); toast.error('Status could not be deleted', { description: error.message }); return; }
    setClientStatusEntries((prev) => prev.filter((e) => e.value !== name));
    notifyChange('Option deleted', `${name} was removed from Status.`);
  }, [notifyChange]);

  const handleAddChannel = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const supabase = createSupabaseClient();
    const { data: group } = await supabase.from('option_groups').select('id').eq('code', 'channel').single();
    if (!group) return;
    const { data, error } = await supabase.from('option_values')
      .insert({ group_id: group.id, value: trimmed, color: '#d1d5db', sort_order: channelOptions.length })
      .select('value, color').single();
    if (error) { console.error(error); toast.error('Channel could not be added', { description: error.message }); return; }
    setChannelEntries((prev) => [...prev, data]);
    notifyChange('Option added', `${trimmed} was added to Channel.`);
  }, [channelOptions.length, notifyChange]);

  const handleDeleteChannel = useCallback(async (name: string) => {
    const supabase = createSupabaseClient();
    const { error } = await supabase.from('option_values').delete().eq('value', name);
    if (error) { console.error(error); toast.error('Channel could not be deleted', { description: error.message }); return; }
    setChannelEntries((prev) => prev.filter((e) => e.value !== name));
    notifyChange('Option deleted', `${name} was removed from Channel.`);
  }, [notifyChange]);

  const handleAddImportance = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const supabase = createSupabaseClient();
    const { data: group } = await supabase.from('option_groups').select('id').eq('code', 'importance').single();
    if (!group) return;
    const { data, error } = await supabase.from('option_values')
      .insert({ group_id: group.id, value: trimmed, color: '#d1d5db', sort_order: importanceOptions.length })
      .select('value, color').single();
    if (error) { console.error(error); toast.error('Importance could not be added', { description: error.message }); return; }
    setImportanceEntries((prev) => [...prev, data]);
    notifyChange('Option added', `${trimmed} was added to Importance.`);
  }, [importanceOptions.length, notifyChange]);

  const handleDeleteImportance = useCallback(async (name: string) => {
    const supabase = createSupabaseClient();
    const { error } = await supabase.from('option_values').delete().eq('value', name);
    if (error) { console.error(error); toast.error('Importance could not be deleted', { description: error.message }); return; }
    setImportanceEntries((prev) => prev.filter((e) => e.value !== name));
    notifyChange('Option deleted', `${name} was removed from Importance.`);
  }, [notifyChange]);

  const handleAddProgress = useCallback(async (name: string) => {
    await insertOptionValue('progress', name, progressEntries, setProgressEntries);
  }, [insertOptionValue, progressEntries]);

  const handleDeleteProgress = useCallback(async (name: string) => {
    await deleteOptionValue('progress', name, setProgressEntries);
  }, [deleteOptionValue]);

  // --- Groups ---
  const handleAddGroup = useCallback(async (name: string) => {
    if (!['director', 'admin', 'dev'].includes(currentUserRole ?? '')) {
      toast.error('Group creation is restricted', { description: 'Only directors, admins, and dev users can create groups.' });
      return;
    }
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
      setCollapsedGroups((prev) => ({ ...prev, [data.id]: true }));
      notifyChange('Group added', `${trimmed} is now available on the board.`);
    } catch (error) {
      console.error('Failed to add group', error);
      toast.error('Group could not be added', { description: error instanceof Error ? error.message : 'The group was not saved.' });
    }
  }, [groups, currentUserId, notifyChange]);

  const handleDeleteGroup = useCallback(async () => {
    if (!groupToDelete) return;
    if (!['director', 'admin', 'dev'].includes(currentUserRole ?? '')) {
      setOpenGroupMenu(null);
      return;
    }
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
      notifyChange('Group deleted', `${groupToDelete.name} and its clients were removed.`);
      setGroupToDelete(null);
    } catch (error) {
      console.error('Failed to delete group', error);
      toast.error('Group could not be deleted', { description: error instanceof Error ? error.message : 'The group was not deleted.' });
    } finally {
      setIsDeletingGroup(false);
    }
  }, [groupToDelete, clients, setClients, notifyChange, currentUserRole]);


  // Custom col handlers

  const handleAddCustomColumn = useCallback(async () => {
    if (!canCreateCustomColumns) {
      toast.error('Only directors and developers can create custom columns.');
      return;
    }
    const trimmed = newColName.trim();
    if (!trimmed || !showAddColModal) return;
    setIsAddingCol(true);
    try {
      const col = await addCustomColumn(
        trimmed,
        showAddColModal,
        newColType,
        customColumns.filter((c) => c.target === showAddColModal).length
      );
      setCustomColumns((prev) => [...prev, col]);
      setNewColName('');
      setNewColType('text');
      setShowAddColModal(null);
    } catch (e) {
      console.error('Failed to add column', e);
    } finally {
      setIsAddingCol(false);
    }
  }, [canCreateCustomColumns, newColName, newColType, showAddColModal, customColumns]);

  const handleDeleteCustomColumn = useCallback((id: string) => {
    const column = customColumns.find((item) => item.id === id);
    if (column) setPendingDeleteCustomColumn(column);
  }, [customColumns]);

  const confirmDeleteCustomColumn = useCallback(async () => {
    if (!pendingDeleteCustomColumn) return;
    try {
      setIsDeletingCustomColumn(true);
      await deleteCustomColumn(pendingDeleteCustomColumn.id);
      setCustomColumns((prev) => prev.filter((c) => c.id !== pendingDeleteCustomColumn.id));

      const updatedClients = clients.map((client) => {
        const next = { ...(client.customFields ?? {}) };
        delete next[pendingDeleteCustomColumn.id];
        return { ...client, customFields: next };
      });

      setClients(updatedClients);

      await Promise.all(
        updatedClients.map((client) =>
          updateClientRow(client.id, { customFields: client.customFields ?? {} })
        )
      );
      setPendingDeleteCustomColumn(null);
    } catch (e) {
      console.error('Failed to delete column', e);
      toast.error('Column could not be deleted', { description: e instanceof Error ? e.message : 'The custom column was not deleted.' });
    } finally {
      setIsDeletingCustomColumn(false);
    }
  }, [clients, pendingDeleteCustomColumn, setClients]);

  // --- Resize ---
  const startResize = (key: string, startX: number) => {
    const startCol = mergedHeaderCols.find((col) => col.key === key);
    if (!startCol) return;
    const startWidth = startCol.width;
    const onMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      const nextWidth = Math.max(startCol.minWidth ?? 60, startWidth + delta);
      if (key.startsWith('custom:')) {
        setCustomClientWidths((current) => ({ ...current, [key]: nextWidth }));
      } else {
        setHeaderCols((prev) => prev.map((col) => col.key === key ? { ...col, width: nextWidth } : col));
      }
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      notifyChange('Column width saved', `The ${key} column width was saved.`);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // --- OCF ---
  function handleOpenOcfModal(client: Client) { setOcfClient(client); setIsOcfChooserOpen(true); }
  function handleCloseOcfModal() { setIsOcfModalOpen(false); setOcfClient(null); }

  // --- Drag ---
  const handleDragStart = useCallback((clientId: string, event: React.DragEvent) => {
    event.dataTransfer?.setData('text/plain', clientId);
    event.dataTransfer?.setData('application/x-crm-client-row', clientId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    setDragPreview(event, event.currentTarget as HTMLElement);
    setDraggedClientId(clientId);
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent, groupId: string, edge: 'top' | 'bottom') => {
    if (!Array.from(e.dataTransfer.types).includes('application/x-crm-client-row')) return;
    e.preventDefault();
    setDragOverGroupId(groupId);
    setDragOverGroupEdge(edge);
  }, []);
  const handleDragEnd = useCallback(() => {
    setDraggedClientId(null);
    setDragOverGroupId(null);
    setDragOverGroupEdge(null);
  }, []);

  const handleSubitemDragStart = useCallback((subitemId: string, sourceClientId: string, event: React.DragEvent<HTMLElement>) => {
    event.dataTransfer?.setData('text/plain', subitemId);
    event.dataTransfer?.setData('application/x-crm-subitem', subitemId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';

    const source = event.currentTarget;
    const preview = source.cloneNode(true) as HTMLElement;
    preview.style.position = 'fixed';
    preview.style.left = '-10000px';
    preview.style.top = '-10000px';
    preview.style.width = `${Math.min(source.getBoundingClientRect().width, 360)}px`;
    preview.style.height = '30px';
    preview.style.background = '#ffffff';
    preview.style.border = '1px solid #8edbe7';
    preview.style.boxShadow = '0 8px 20px rgba(15, 23, 42, 0.22)';
    preview.style.opacity = '1';
    preview.style.pointerEvents = 'none';
    document.body.appendChild(preview);
    event.dataTransfer?.setDragImage(preview, 24, 15);
    window.setTimeout(() => preview.remove(), 0);
    setDraggedSubitem({ id: subitemId, sourceClientId });
    setDraggedClientId(null);
    setSubitemDropMarker(null);
  }, []);

  const handleSubitemDragOver = useCallback((event: React.DragEvent<HTMLDivElement>, clientId: string) => {
    if (!Array.from(event.dataTransfer.types).includes('application/x-crm-subitem')) return;
    event.preventDefault();
    event.stopPropagation();
    setDragOverSubitemClientId(clientId);
  }, []);

  const handleSubitemDragEnd = useCallback(() => {
    setDraggedSubitem(null);
    setDragOverSubitemClientId(null);
    setSubitemDropMarker(null);
  }, []);

  const handleSubitemRowDragOver = useCallback((event: React.DragEvent<HTMLTableRowElement>, clientId: string, targetSubitemId: string) => {
    if (!Array.from(event.dataTransfer.types).includes('application/x-crm-subitem')) return;
    // Cross-client drops retain the existing whole-client drop zone. Row markers
    // are reserved for reordering within the current client.
    if (draggedSubitem?.sourceClientId !== clientId) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    const edge = event.clientY < bounds.top + bounds.height / 2 ? 'top' : 'bottom';
    setSubitemDropMarker({ clientId, subitemId: targetSubitemId, edge });
  }, [draggedSubitem]);

  const handleSubitemRowDrop = useCallback(async (event: React.DragEvent<HTMLTableRowElement>, clientId: string, targetSubitemId: string) => {
    if (!Array.from(event.dataTransfer.types).includes('application/x-crm-subitem')) return;
    if (!draggedSubitem || draggedSubitem.sourceClientId !== clientId) return;
    event.preventDefault();
    event.stopPropagation();
    const marker = subitemDropMarker?.clientId === clientId && subitemDropMarker.subitemId === targetSubitemId
      ? subitemDropMarker
      : { clientId, subitemId: targetSubitemId, edge: 'bottom' as const };
    const client = clients.find((item) => item.id === clientId);
    if (!client || draggedSubitem.id === targetSubitemId) {
      handleSubitemDragEnd();
      return;
    }
    const moving = client.subitems.find((item) => item.id === draggedSubitem.id);
    if (!moving) {
      handleSubitemDragEnd();
      return;
    }
    const remaining = client.subitems.filter((item) => item.id !== moving.id);
    let targetIndex = remaining.findIndex((item) => item.id === marker.subitemId);
    if (targetIndex < 0) targetIndex = remaining.length;
    if (marker.edge === 'bottom') targetIndex += 1;
    const reordered = [...remaining];
    reordered.splice(targetIndex, 0, moving);
    const positioned = reordered.map((item, position) => ({ ...item, position }));
    handleSubitemDragEnd();
    setClients((previous) => previous.map((item) => item.id === clientId ? { ...item, subitems: positioned } : item));
    try {
      await reorderSubitemRows(clientId, positioned.map((item) => item.id));
    } catch (error) {
      console.error('Failed to reorder subitems', error);
      toast.error('Subitems could not be reordered', { description: error instanceof Error ? error.message : 'Please try again.' });
      await reloadClients();
    }
  }, [clients, draggedSubitem, handleSubitemDragEnd, reloadClients, setClients, subitemDropMarker]);

  const handleSubitemDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>, targetClientId: string) => {
    if (!Array.from(event.dataTransfer.types).includes('application/x-crm-subitem')) return;
    event.preventDefault();
    event.stopPropagation();
    const movingSubitem = draggedSubitem;
    handleSubitemDragEnd();
    if (!movingSubitem || movingSubitem.sourceClientId === targetClientId) return;

    const sourceClient = clients.find((client) => client.id === movingSubitem.sourceClientId);
    const subitem = sourceClient?.subitems.find((item) => item.id === movingSubitem.id);
    if (!subitem) return;

    setClients((previous) => previous.map((client) => {
      if (client.id === movingSubitem.sourceClientId) {
        return { ...client, subitems: client.subitems.filter((item) => item.id !== movingSubitem.id) };
      }
      if (client.id === targetClientId) {
        return { ...client, subitems: [...client.subitems, subitem] };
      }
      return client;
    }));

    try {
      await moveSubitemRow(movingSubitem.id, targetClientId);
      await reloadClients();
    } catch (error) {
      console.error('Failed to move subitem', error);
      await reloadClients();
      toast.error('Subitem could not be moved', { description: error instanceof Error ? error.message : 'The subitem was not moved.' });
    }
  }, [clients, draggedSubitem, handleSubitemDragEnd, reloadClients, setClients]);

  const handleGroupDragStart = useCallback((groupId: string, event: React.DragEvent) => {
    event.dataTransfer?.setData('text/plain', groupId);
    event.dataTransfer?.setData('application/x-crm-group-row', groupId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    setDragPreview(event, event.currentTarget as HTMLElement);
    setDraggedGroupId(groupId);
    setGroupDragOverId(null);
    setGroupDragOverEdge(null);
  }, []);

  const handleGroupDragOver = useCallback((e: React.DragEvent, groupId: string, edge: 'top' | 'bottom') => {
    if (!Array.from(e.dataTransfer.types).includes('application/x-crm-group-row')) return;
    e.preventDefault();
    setGroupDragOverId(groupId);
    setGroupDragOverEdge(edge);
  }, []);

  const handleGroupDragEnter = useCallback((e: React.DragEvent, groupId: string, edge: 'top' | 'bottom') => {
    if (!Array.from(e.dataTransfer.types).includes('application/x-crm-group-row')) return;
    e.preventDefault();
    setGroupDragOverId(groupId);
    setGroupDragOverEdge(edge);
  }, []);

  const handleGroupDragEnd = useCallback(() => {
    setDraggedGroupId(null);
    setGroupDragOverId(null);
    setGroupDragOverEdge(null);
  }, []);

  const handleGroupDrop = useCallback(async (targetGroupId: string, edge: 'top' | 'bottom') => {
    if (!draggedGroupId) return;
    const sourceGroupId = draggedGroupId;
    setDraggedGroupId(null);
    setGroupDragOverId(null);
    setGroupDragOverEdge(null);
    if (sourceGroupId === targetGroupId) return;

    const nextGroups = [...groups];
    const sourceIndex = nextGroups.findIndex((group) => group.id === sourceGroupId);
    const targetIndex = nextGroups.findIndex((group) => group.id === targetGroupId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const [movedGroup] = nextGroups.splice(sourceIndex, 1);
    const insertIndex = edge === 'bottom' ? targetIndex + 1 : targetIndex;
    nextGroups.splice(insertIndex, 0, movedGroup);

    const reorderedGroups = nextGroups.map((group, index) => ({
      ...group,
      sort_order: index,
    }));

    setGroups(reorderedGroups);

    try {
      const supabase = createSupabaseClient();
      await Promise.all(
        reorderedGroups.map((group) =>
          supabase.from('crm_groups').update({ sort_order: group.sort_order }).eq('id', group.id)
        )
      );
    } catch (error) {
      console.error('Failed to reorder groups', error);
      setGroups(groups);
    }
  }, [draggedGroupId, groups, setGroups]);

  const handleDrop = useCallback(async (groupId: string) => {
    if (!draggedClientId) return;
    const localDraggedId = draggedClientId;
    setDraggedClientId(null);
    setDragOverGroupId(null);
    setDragOverGroupEdge(null);
    const targetGroup = groups.find((g) => g.id === groupId);
    const draggedClient = clients.find((c) => c.id === localDraggedId);
    if (!targetGroup || !draggedClient) return;
    const matchingStatus = clientStatuses.find(
      (s) => s.toLowerCase() === targetGroup.name.toLowerCase()
    ) as ClientStatus | undefined;
    const updates: Partial<Client> = { groupId };
    if (targetGroup.name.trim().toLowerCase().startsWith('closed leads')) updates.status = 'Closed';
    else if (matchingStatus) updates.status = matchingStatus;
    if (updates.status === 'Closed' && draggedClient.status !== 'Closed') {
      if (!draggedClient.email.trim()) {
        toast.error('An Email address is required to close this lead', { description: 'Fill in the lead’s Email column before closing it.' });
        return;
      }
      setCloseLeadFiles({ purchaseOrder: null, signedQuotation: null, proofOfPayment: null });
      setPendingCloseLead({ clientId: localDraggedId, updates });
      return;
    }
    setClients((prev) => prev.map((c) => c.id === localDraggedId ? { ...c, ...updates } : c));
    try {
      await updateClientRow(localDraggedId, updates);
    } catch (err) {
      setClients(clients);
      console.error('Failed to move client to group', err);
    }
  }, [draggedClientId, clients, groups, clientStatuses, setClients]);

  const advancedColumns = useMemo<AdvancedFilterColumn[]>(() => {
    const unique = (values: unknown[]) => [...new Set(values.flatMap((value) => Array.isArray(value) ? value : [value]).map((value) => String(value ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const profileName = (id: string) => peopleProfilesById[id]?.full_name || peopleProfilesById[id]?.email || id;
    const clientValue = (client: Client, key: string): unknown => {
      if (key === 'client') return client.name;
      if (key === 'people') return (clientAssignees[client.id] ?? []).map(profileName);
      if (key === 'pm') return clientPmAssigneeIds(client).map(profileName);
      if (key.startsWith('custom:')) return client.customFields?.[key.slice(7)] ?? '';
      return (client as unknown as Record<string, unknown>)[key] ?? '';
    };
    const subitemValue = (subitem: Subitem, key: string): unknown => {
      if (key === 'people') return (subitemAssignees[subitem.id] ?? []).map(profileName);
      if (key === 'markup' || key === 'percentMarkup') return calculateSubitemFinancials(subitem)[key];
      if (key === 'idealMarkup' || key === 'priceToSet') return subitem.customFields?.[key] ?? '';
      if (key.startsWith('custom:')) return subitem.customFields?.[key.slice(7)] ?? '';
      return (subitem as unknown as Record<string, unknown>)[key] ?? '';
    };
    const clientColumns = mergedHeaderCols.filter((column) => !['selectCheckbox', 'addClientCol', 'empty'].includes(column.key)).map((column) => ({ key: `client:${column.key}`, label: column.label || column.key, category: 'Client' as const, values: unique(clients.map((client) => clientValue(client, column.key))) }));
    const allSubitemColumns = [...SUBITEM_COLS, ...subitemCustomCols.map((column) => ({ key: `custom:${column.id}`, label: column.name, width: 120, minWidth: 80 }))];
    const subitemColumns = allSubitemColumns.map((column) => ({ key: `subitem:${column.key}`, label: column.label, category: 'Subitem' as const, values: unique(clients.flatMap((client) => client.subitems.map((subitem) => subitemValue(subitem, column.key)))) }));
    const paymentColumns = PAYMENT_COLS.map((column) => ({ key: `payment:${column.key}`, label: column.label, category: 'Payment' as const, values: unique(clients.flatMap((client) => client.subitems.map((subitem) => subitemValue(subitem, column.key)))) }));
    return [...clientColumns, ...subitemColumns, ...paymentColumns];
  }, [clientAssignees, clientPmAssigneeIds, clients, mergedHeaderCols, peopleProfilesById, subitemAssignees, subitemCustomCols]);

  const matchesAdvancedRule = useCallback((client: Client, rule: AdvancedFilterRule) => {
    if (!rule.column || !rule.condition) return true;
    const [category, ...keyParts] = rule.column.split(':');
    const key = keyParts.join(':');
    const profileName = (id: string) => peopleProfilesById[id]?.full_name || peopleProfilesById[id]?.email || id;
    let values: unknown[];
    if (category === 'client') {
      const value = key === 'client' ? client.name : key === 'people' ? (clientAssignees[client.id] ?? []).map(profileName) : key === 'pm' ? clientPmAssigneeIds(client).map(profileName) : key.startsWith('custom:') ? client.customFields?.[key.slice(7)] : (client as unknown as Record<string, unknown>)[key];
      values = Array.isArray(value) ? value : [value];
    } else {
      values = client.subitems.flatMap((subitem) => {
        const value = key === 'people' ? (subitemAssignees[subitem.id] ?? []).map(profileName) : key === 'markup' || key === 'percentMarkup' ? calculateSubitemFinancials(subitem)[key] : key.startsWith('custom:') ? subitem.customFields?.[key.slice(7)] : (subitem as unknown as Record<string, unknown>)[key];
        return Array.isArray(value) ? value : [value];
      });
    }
    const query = rule.value.trim().toLowerCase();
    const tests = values.map((value) => String(value ?? '').toLowerCase());
    if (rule.condition === 'is' || rule.condition === 'text is') return tests.some((value) => value === query);
    if (rule.condition === 'is not' || rule.condition === 'text is not') return tests.every((value) => value !== query);
    if (rule.condition === 'contains') return tests.some((value) => value.includes(query));
    if (rule.condition === 'does not contain') return tests.every((value) => !value.includes(query));
    return tests.some((value) => value.startsWith(query));
  }, [clientAssignees, clientPmAssigneeIds, peopleProfilesById, subitemAssignees]);

  // --- Filtering ---
  const displayedClients = clients.filter((client) => {
    const matchesStatus = filterStatus === 'All' || client.status === filterStatus;

    const matchesSubitemStatus = filterSubitemStatus === 'All' || client.subitems.some((subitem) => subitem.status === filterSubitemStatus);
    const matchesPayment = filterPayment === 'All' || client.subitems.some((subitem) => subitem.payment === filterPayment);
    const matchesPaymentStatus = filterPaymentStatus === 'All' || client.subitems.some((subitem) => subitem.paymentStatus === filterPaymentStatus);
    const matchesPeople = filterPeople === 'All' ||
      (clientAssignees[client.id] ?? []).includes(filterPeople) ||
      client.subitems.some((subitem) => (subitemAssignees[subitem.id] ?? []).includes(filterPeople));
    const matchesImportance = filterImportance === 'All' || client.importance === filterImportance;
    const matchesReplyStatus = filterReplyStatus === 'All' || client.replyStatus === filterReplyStatus;
    const matchesChannel = filterChannel === 'All' || client.channel === filterChannel;

    const matchesSubprogress =
      filterSubprogress === 'All' ||
      client.subitems.some((subitem) =>
        (subitem.timelineRows ?? []).some(
          (row) => (row.subProgress ?? '') === filterSubprogress
        )
      );

    const populatedRules = advancedRules.filter((rule) => rule.column && rule.condition && rule.value.trim());
    const matchesAdvanced = !populatedRules.length || (advancedJoin === 'and' ? populatedRules.every((rule) => matchesAdvancedRule(client, rule)) : populatedRules.some((rule) => matchesAdvancedRule(client, rule)));
    return matchesStatus && matchesSubitemStatus && matchesPayment && matchesPaymentStatus && matchesPeople && matchesImportance && matchesReplyStatus && matchesChannel && matchesSubprogress && matchesAdvanced;
  });

  const clientSortColumns = mergedHeaderCols.filter((column) => !['selectCheckbox', 'addClientCol', 'empty'].includes(column.key));
  const subitemSortColumns = [...SUBITEM_COLS, ...subitemCustomCols.map((column) => ({ key: `custom:${column.id}`, label: column.name, width: 120, minWidth: 80, field_type: column.field_type }))];
  const paymentSortColumns = PAYMENT_COLS;
  const selectedSortColumns = boardSort.category === 'client' ? clientSortColumns : boardSort.category === 'subitem' ? subitemSortColumns : paymentSortColumns;
  const activeBoardSort = selectedSortColumns.some((column) => column.key === boardSort.column) ? boardSort : DEFAULT_BOARD_SORT;
  const clientSortValue = (client: Client, column: string): string | number => {
    if (column === 'client') return client.name ?? '';
    if (column === 'people') return (clientAssignees[client.id] ?? []).map((id) => peopleProfilesById[id]?.full_name || peopleProfilesById[id]?.email || '').filter(Boolean).join(', ');
    if (column === 'pm') return clientPmAssigneeIds(client).map((id) => peopleProfilesById[id]?.full_name || peopleProfilesById[id]?.email || '').filter(Boolean).join(', ');
    if (column === 'dateCreated') return client.createdAt ?? '';
    if (column === 'totalMarkup') return client.subitems.reduce((total, subitem) => total + calculateSubitemFinancials(subitem).markup, 0);
    if (column.startsWith('custom:')) return client.customFields?.[column.slice(7)] ?? '';
    return String((client as unknown as Record<string, unknown>)[column] ?? '');
  };
  const compareClients = (first: Client, second: Client) => {
    if (activeBoardSort.category !== 'client') return new Date(second.createdAt || 0).getTime() - new Date(first.createdAt || 0).getTime();
    const column = activeBoardSort.column;
    const firstValue = clientSortValue(first, column);
    const secondValue = clientSortValue(second, column);
    const firstBlank = firstValue === '' || firstValue === null || firstValue === undefined;
    const secondBlank = secondValue === '' || secondValue === null || secondValue === undefined;
    if (firstBlank !== secondBlank) return firstBlank ? 1 : -1;

    const columnDefinition = clientSortColumns.find((item) => item.key === column);
    const isDate = ['followUp', 'nbd', 'dateCreated'].includes(column) || columnDefinition?.field_type === 'date';
    const isNumber = ['totalPrice', 'totalMarkup'].includes(column) || columnDefinition?.field_type === 'number';
    let comparison = 0;
    if (isDate) {
      const firstTime = new Date(String(firstValue)).getTime();
      const secondTime = new Date(String(secondValue)).getTime();
      comparison = (Number.isFinite(firstTime) ? firstTime : 0) - (Number.isFinite(secondTime) ? secondTime : 0);
    } else if (isNumber) {
      const firstNumber = Number(String(firstValue).replace(/[^0-9.-]/g, '')) || 0;
      const secondNumber = Number(String(secondValue).replace(/[^0-9.-]/g, '')) || 0;
      comparison = firstNumber - secondNumber;
    } else comparison = String(firstValue).localeCompare(String(secondValue), undefined, { numeric: true, sensitivity: 'base' });
    if (comparison !== 0) return activeBoardSort.direction === 'asc' ? comparison : -comparison;
    return new Date(second.createdAt || 0).getTime() - new Date(first.createdAt || 0).getTime();
  };

  const subitemSortValue = (subitem: Subitem, column: string): string | number => {
    const financials = calculateSubitemFinancials(subitem);
    if (column === 'people') return (subitemAssignees[subitem.id] ?? []).map((id) => peopleProfilesById[id]?.full_name || peopleProfilesById[id]?.email || '').filter(Boolean).join(', ');
    if (column.startsWith('custom:')) return subitem.customFields?.[column.slice(7)] ?? '';
    if (column === 'cSgd' || column === 'tcSgd' || column === 'tc' || column === 'price' || column === 'markup' || column === 'percentMarkup') return financials[column] ?? '';
    if (column === 'priceToSet') {
      const idealMarkup = Number(subitem.customFields?.idealMarkup || 0);
      return financials.quantity > 0 ? (idealMarkup + financials.tc) / financials.quantity : '';
    }
    if (column === 'idealMarkup') return subitem.customFields?.idealMarkup ?? '';
    if (column === 'totalUc') return Number(subitem.cost || 0) * Number(subitem.qty || 0);
    if (column === 'totalC') {
      if (!subitem.currency) return '';
      const rate = subitem.currency === 'MYR' ? 3 : subitem.currency === 'RMB' ? 5 : 1;
      return Number(subitem.cost || 0) * Number(subitem.qty || 0) + Number(subitem.manpower || 0) * rate + Number(subitem.ls || 0) * rate;
    }
    return (subitem as unknown as Record<string, string | number | null | undefined>)[column] ?? '';
  };
  const compareSubitems = (first: Subitem, second: Subitem) => {
    if (activeBoardSort.category === 'client') return 0;
    const firstValue = subitemSortValue(first, activeBoardSort.column);
    const secondValue = subitemSortValue(second, activeBoardSort.column);
    const firstBlank = firstValue === '' || firstValue === null || firstValue === undefined;
    const secondBlank = secondValue === '' || secondValue === null || secondValue === undefined;
    if (firstBlank !== secondBlank) return firstBlank ? 1 : -1;
    const definition = selectedSortColumns.find((column) => column.key === activeBoardSort.column);
    const fieldType = definition && 'field_type' in definition ? definition.field_type : undefined;
    const numericKeys = new Set(['qty', 'cost', 'cSgd', 'tcSgd', 'manpower', 'ls', 'os', 'tc', 'uc', 'pl', 'sl', 'price', 'up', 'markup', 'percentMarkup', 'idealMarkup', 'priceToSet', 'totalUc', 'totalC', 'quantityProduced', 'qtyFor', 'paymentAmount', 'difference']);
    const isDate = activeBoardSort.column === 'createdAt' || fieldType === 'date';
    const isNumber = numericKeys.has(activeBoardSort.column) || fieldType === 'number';
    let comparison = 0;
    if (isDate) comparison = new Date(String(firstValue)).getTime() - new Date(String(secondValue)).getTime();
    else if (isNumber) comparison = (Number(String(firstValue).replace(/[^0-9.-]/g, '')) || 0) - (Number(String(secondValue).replace(/[^0-9.-]/g, '')) || 0);
    else comparison = String(firstValue).localeCompare(String(secondValue), undefined, { numeric: true, sensitivity: 'base' });
    if (comparison !== 0) return activeBoardSort.direction === 'asc' ? comparison : -comparison;
    return new Date(second.createdAt || 0).getTime() - new Date(first.createdAt || 0).getTime();
  };

  const groupedClients = groups.map((group) => ({
    group,
    clients: displayedClients
      .filter((c) => c.groupId === group.id)
      .sort(compareClients)
      .map((client) => activeBoardSort.category === 'client' ? client : ({ ...client, subitems: [...client.subitems].sort(compareSubitems) })),
  }));

  const parentClientOptions = useMemo(
    () => clients.map((client) => ({ id: client.id, name: client.name || 'Unnamed client', groupName: groups.find((group) => group.id === client.groupId)?.name || 'Ungrouped' })),
    [clients, groups],
  );

  const selectedSubitems = useMemo(
    () => clients.flatMap((client) => client.subitems.filter((subitem) => selectedSubitemIds.includes(subitem.id))),
    [clients, selectedSubitemIds],
  );
  const selectedSubitemTotals = useMemo(
    () => selectedSubitems.reduce((totals, subitem) => {
      const financials = calculateSubitemFinancials(subitem);
      const unitCost = subitem.currency?.trim() && financials.quantity > 0 ? financials.tc / financials.quantity : 0;
      return {
        totalPrice: totals.totalPrice + financials.price,
        totalMarkup: totals.totalMarkup + financials.markup,
        totalUp: totals.totalUp + parseSubitemNumber(subitem.up),
        totalUc: totals.totalUc + unitCost,
      };
    }, { totalPrice: 0, totalMarkup: 0, totalUp: 0, totalUc: 0 }),
    [selectedSubitems],
  );

  const selectedClientTotals = useMemo(() => clients.filter((client) => selectedIds.has(client.id)).reduce((totals, client) => {
    const clientTotals = client.subitems.reduce((subitemTotals, subitem) => {
      const financials = calculateSubitemFinancials(subitem);
      const unitCost = subitem.currency?.trim() && financials.quantity > 0 ? financials.tc / financials.quantity : 0;
      return {
        totalPrice: subitemTotals.totalPrice + financials.price,
        totalMarkup: subitemTotals.totalMarkup + financials.markup,
        totalUp: subitemTotals.totalUp + parseSubitemNumber(subitem.up),
        totalUc: subitemTotals.totalUc + unitCost,
      };
    }, { totalPrice: 0, totalMarkup: 0, totalUp: 0, totalUc: 0 });
    return {
      totalPrice: totals.totalPrice + clientTotals.totalPrice,
      totalMarkup: totals.totalMarkup + clientTotals.totalMarkup,
      totalUp: totals.totalUp + clientTotals.totalUp,
      totalUc: totals.totalUc + clientTotals.totalUc,
    };
  }, { totalPrice: 0, totalMarkup: 0, totalUp: 0, totalUc: 0 }), [clients, selectedIds]);
  const orderedMoveGroups = useMemo(() => {
    const orderedGroups = groups.map((group) => ({
    name: group.name,
    clients: parentClientOptions.filter((client) => client.groupName === group.name && (!subitemMoveSearch.trim() || client.name.toLowerCase().includes(subitemMoveSearch.trim().toLowerCase()))),
    })).filter((group) => group.clients.length > 0);
    const ungroupedClients = parentClientOptions.filter((client) => client.groupName === 'Ungrouped' && (!subitemMoveSearch.trim() || client.name.toLowerCase().includes(subitemMoveSearch.trim().toLowerCase())));
    return ungroupedClients.length ? [...orderedGroups, { name: 'Ungrouped', clients: ungroupedClients }] : orderedGroups;
  }, [groups, parentClientOptions, subitemMoveSearch]);

  const filteredClients = displayedClients;
  const allFilteredSelected = filteredClients.length > 0 && filteredClients.every((c) => selectedIds.has(c.id));

  const activeFilterCount = [
    filterStatus,
    filterSubprogress,
    filterSubitemStatus,
    filterPayment,
    filterPaymentStatus,
    filterPeople,
    filterImportance,
    filterReplyStatus,
    filterChannel,
  ].filter((value) => value !== 'All').length + advancedRules.filter((rule) => rule.column && rule.condition && rule.value.trim()).length;

  const renderFilterColumn = ({
    label,
    value,
    options,
    onChange,
    countFor,
    colors,
    renderOption,
  }: {
    label: string;
    value: string;
    options: Array<string | { value: string; label: string }>;
    onChange: (value: string) => void;
    countFor: (value: string) => number;
    colors?: Record<string, string>;
    renderOption?: (value: string, label: string) => React.ReactNode;
  }) => (
    <div className={`min-w-48 shrink-0 ${focusedFilterColumn && focusedFilterColumn !== ({
      Status: 'client:status',
      'Subitem Subprogress': 'subitem:subprogress',
      'Subitem Status': 'subitem:status',
      Payment: 'payment:payment',
      'Payment Status': 'payment:paymentStatus',
      People: 'people',
      Importance: 'client:importance',
      'Reply Status': 'client:replyStatus',
      Channel: 'client:channel',
    } as Record<string, string>)[label] ? 'hidden' : ''}`}>
      <div className="mb-2 text-[11px] font-semibold text-gray-500">{label}</div>
      <div className="max-h-60 space-y-1 overflow-y-auto pr-1">
        <button onClick={() => onChange('All')} className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-left text-[10px] font-semibold hover:bg-gray-50">
          <span className="h-2.5 w-2.5 rounded-sm bg-gray-300" />
          <span className="flex-1">All</span>
          {value === 'All' && <span className="text-blue-500">✓</span>}
        </button>
        {options.map((option) => {
          const optionValue = typeof option === 'string' ? option : option.value;
          const optionLabel = typeof option === 'string' ? option : option.label;
          return (
            <button key={optionValue} onClick={() => onChange(optionValue)} className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-left text-[10px] font-semibold hover:bg-gray-50">
              {renderOption ? renderOption(optionValue, optionLabel) : (
                <span className="h-2.5 w-2.5 rounded-sm bg-[#7BCBD5]" style={colors?.[optionValue] ? { background: colors[optionValue] } : undefined} />
              )}
              <span className="flex-1 truncate">{optionLabel}</span>
              <span className="text-gray-400">{countFor(optionValue)}</span>
              {value === optionValue && <span className="text-blue-500">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );

  // --- Selection ---
  const toggleExpandAll = useCallback(() => {
    allExpanded ? setExpandedIds([]) : setExpandedIds(clients.map((c) => c.id));
  }, [allExpanded, clients, setExpandedIds]);

  const toggleCollapseAllGroups = useCallback(() => {
    setCollapsedGroups((previous) => {
      const shouldExpand = groups.length > 0 && groups.every((group) => previous[group.id]);
      return Object.fromEntries(groups.map((group) => [group.id, !shouldExpand]));
    });
  }, [groups]);

  const toggleGroup = useCallback((id: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (!event.ctrlKey || event.altKey || event.shiftKey) return;

      if (event.key.toLowerCase() === 'g') {
        event.preventDefault();
        toggleCollapseAllGroups();
      }
      if (event.key.toLowerCase() === 'i') {
        event.preventDefault();
        toggleExpandAll();
      }
    };

    window.addEventListener('keydown', handleKeyboardShortcut);
    return () => window.removeEventListener('keydown', handleKeyboardShortcut);
  }, [toggleCollapseAllGroups, toggleExpandAll]);

  const toggleSelect = useCallback((id: string) => {
    if (selectedSubitemIds.length > 0) return;
    setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }, [selectedSubitemIds.length]);

  const toggleSelectAll = useCallback(() => {
    if (selectedSubitemIds.length > 0) return;
    if (allFilteredSelected) {
      setSelectedIds((prev) => { const next = new Set(prev); filteredClients.forEach((c) => next.delete(c.id)); return next; });
    } else {
      setSelectedIds((prev) => { const next = new Set(prev); filteredClients.forEach((c) => next.add(c.id)); return next; });
    }
  }, [allFilteredSelected, filteredClients, selectedSubitemIds.length]);

  const toggleSelectGroup = useCallback((groupClientIds: string[]) => {
    if (selectedSubitemIds.length > 0 || groupClientIds.length === 0) return;
    setSelectedIds((previous) => {
      const next = new Set(previous);
      const allGroupClientsSelected = groupClientIds.every((clientId) => next.has(clientId));
      groupClientIds.forEach((clientId) => allGroupClientsSelected ? next.delete(clientId) : next.add(clientId));
      return next;
    });
  }, [selectedSubitemIds.length]);

  // --- Assignees ---
  const handleClientAssigneesChange = useCallback(async (clientId: string, ids: string[]) => {
    const previousIds = clientAssignees[clientId] ?? [];
    setClientAssignees((prev) => ({ ...prev, [clientId]: ids }));
    try {
      await saveClientAssignees(clientId, ids, currentUserId);
      const clientName = clients.find((client) => client.id === clientId)?.name ?? 'A client';
      await Promise.all(ids.filter((id) => !previousIds.includes(id)).map((recipientUserId) => fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientUserId, clientId, message: `You have been assigned to ${clientName}.` }),
      })));
    }
    catch (error: any) { console.error('Failed to save client assignees', error); }
  }, [clientAssignees, clients, currentUserId]);

  const handleSubitemAssigneesChange = useCallback(async (subitemId: string, ids: string[]) => {
    const previousIds = subitemAssignees[subitemId] ?? [];
    setSubitemAssignees((prev) => ({ ...prev, [subitemId]: ids }));
    try {
      await saveSubitemAssignees(subitemId, ids, currentUserId);
      const parentClient = clients.find((client) => client.subitems.some((subitem) => subitem.id === subitemId));
      if (!parentClient) return;
      const subitem = parentClient?.subitems.find((item) => item.id === subitemId);
      const subitemName = subitem?.name || 'a subitem';
      const clientName = parentClient?.name || 'a client';
      await Promise.all(ids.filter((id) => !previousIds.includes(id)).map((recipientUserId) => fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientUserId,
          clientId: parentClient?.id,
          message: `You have been assigned to subitem ${subitemName} under ${clientName}.`,
        }),
      })));
    }
    catch (error: any) { console.error('Failed to save subitem assignees', error); }
  }, [clients, currentUserId, subitemAssignees]);

  const STATUS_TO_GROUP_NAME: Partial<Record<ClientStatus, string>> = {
    'Follow Up': 'Follow Up',
    'Shortlisted': 'Shortlisted',
  };
  const CLOSING_QUALIFYING_SUBITEM_STATUSES = new Set([
    'awarded',
    'to verify at a later date',
    'verified',
    '[variation] cost difference',
  ]);
  const hasClosingQualifiedSubitem = (client: Client) => client.subitems.some((subitem) => {
    const status = subitem.status?.trim().toLowerCase() ?? '';
    return CLOSING_QUALIFYING_SUBITEM_STATUSES.has(status) || /cost difference$/i.test(status);
  });

  const currentClosedLeadsGroupName = () => `Closed Leads - ${new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'Asia/Singapore' }).format(new Date())}`;

  const ensureCurrentClosedLeadsGroup = useCallback(async () => {
    const name = currentClosedLeadsGroupName();
    const existing = groups.find((group) => group.name.trim().toLowerCase() === name.toLowerCase());
    if (existing) return existing;

    const supabase = createSupabaseClient();
    const nextSort = groups.length ? Math.max(...groups.map((group) => group.sort_order ?? 0)) + 1 : 0;
    const { data, error } = await supabase
      .from('crm_groups')
      .insert({ name, color: '#7BCBD5', sort_order: nextSort, created_by: currentUserId })
      .select('id, name, color, sort_order')
      .single();
    if (error) throw error;
    setGroups((previous) => previous.some((group) => group.id === data.id) ? previous : [...previous, data]);
    setCollapsedGroups((previous) => ({ ...previous, [data.id]: false }));
    return data;
  }, [currentUserId, groups]);

  const commitCustomerMatch = useCallback(async (pending: CustomerMatchPending, action: 'link' | 'different' | 'same_add' | 'same_correct', profileId?: string) => {
    setSavingCustomerMatch(true);
    try {
      const response = await fetch('/api/customer-profiles/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'apply', ...pending, action, profileId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to match this customer profile.');
      const matchedCompanyName = pending.field === 'company' && action === 'link' && typeof result.companyName === 'string'
        ? result.companyName
        : pending.value;
      const update = { [pending.field]: matchedCompanyName } as Partial<Client>;
      setClients((current) => current.map((client) => client.id === pending.clientId ? { ...client, ...update } : client));
      await updateClientRow(pending.clientId, update, { customerProfileAction: action });
      setCustomerMatchPending(null);
      toast.success(action === 'different' ? 'Customer profile linked' : action === 'link' ? 'Existing profile linked' : 'Customer profile updated');
    } catch (error) {
      toast.error('Customer information was not changed', { description: error instanceof Error ? error.message : 'The customer profile could not be updated.' });
    } finally {
      setSavingCustomerMatch(false);
    }
  }, [setClients]);

  const updateClient = useCallback(async (clientId: string, updates: Partial<Client>, closeRequirementsApproved = false) => {
    const existingClient = clients.find((client) => client.id === clientId);
    const pmAssignmentOnly = Object.keys(updates).length === 1 && updates.customFields !== undefined && updates.customFields.pmAssigneeIds !== undefined && Object.entries(updates.customFields).every(([key, value]) => key === 'pmAssigneeIds' || existingClient?.customFields?.[key] === value);
    if (!pmAssignmentOnly && !canEditClientRecord(clientId)) {
      showAssignmentPermissionError();
      return;
    }
    const customerField = updates.phone !== undefined && updates.phone !== existingClient?.phone
      ? 'phone'
      : updates.company !== undefined && updates.company !== existingClient?.company
        ? 'company'
        : null;
    if (existingClient && customerField) {
      const value = String(updates[customerField] ?? '').trim();
      const oldValue = String(existingClient[customerField] ?? '').trim();
      if (!value) {
        toast.error(`${customerField === 'phone' ? 'Phone number' : 'Company name'} cannot be blank`, { description: 'A customer profile can only be matched using a filled value.' });
        return;
      }
      try {
        const response = await fetch('/api/customer-profiles/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'preview', clientId, clientName: existingClient.name, field: customerField, oldValue, value }),
        });
        const preview = await response.json();
        if (!response.ok) throw new Error(preview.error || 'Unable to check customer profiles.');
        const pending: CustomerMatchPending = { clientId, clientName: existingClient.name, field: customerField, oldValue, value, linkedProfileId: preview.linkedProfileId ?? null, exactProfile: preview.exactProfile ?? null, suggestions: preview.suggestions ?? [] };
        if (oldValue || pending.suggestions.length) {
          setCustomerMatchPending(pending);
          return;
        }
        await commitCustomerMatch(pending, preview.exactProfileId ? 'link' : 'different', preview.exactProfileId ?? undefined);
      } catch (error) {
        toast.error('Customer matching failed', { description: error instanceof Error ? error.message : 'The field was not changed.' });
      }
      return;
    }
    let nextUpdates = { ...updates };
    let movedToGroupName: string | null = null;
    const selectedGroup = updates.groupId ? groups.find((group) => group.id === updates.groupId) : null;
    const isMovingToClosedLeads = !!selectedGroup?.name.trim().toLowerCase().startsWith('closed leads');
    const isBecomingClosed = updates.status === 'Closed' || isMovingToClosedLeads;
    if (isBecomingClosed && !existingClient?.email.trim()) {
      toast.error('An Email address is required to close this lead', { description: 'Fill in the lead’s Email column before closing it.' });
      return;
    }
    if (isBecomingClosed && existingClient?.status !== 'Closed' && !closeRequirementsApproved) {
      setCloseLeadFiles({ purchaseOrder: null, signedQuotation: null, proofOfPayment: null });
      setPendingCloseLead({ clientId, updates });
      return;
    }
    if (isMovingToClosedLeads) {
      nextUpdates.status = 'Closed';
      movedToGroupName = selectedGroup?.name ?? null;
    }
    if (updates.status === 'Closed') {
      try {
        const closedLeadsGroup = await ensureCurrentClosedLeadsGroup();
        nextUpdates.groupId = closedLeadsGroup.id;
        movedToGroupName = closedLeadsGroup.name;
      } catch (error) {
        toast.error('Closed Leads group could not be prepared', { description: error instanceof Error ? error.message : 'The lead was not closed.' });
        return;
      }
    } else if (updates.status) {
      const targetGroupName = STATUS_TO_GROUP_NAME[updates.status];
      if (targetGroupName) {
        const matchingGroup = groups.find((g) => g.name.toLowerCase() === targetGroupName.toLowerCase());
        if (matchingGroup) {
          nextUpdates.groupId = matchingGroup.id;
          movedToGroupName = matchingGroup.name;
        }
      }
    }
    setClients((prev) => prev.map((c) => c.id === clientId ? { ...c, ...nextUpdates } : c));
    try {
      await updateClientRow(clientId, nextUpdates, movedToGroupName ? { automated: true, reason: 'status_group_automation' } : undefined);
      if (movedToGroupName && nextUpdates.status) {
        const previousClient = clients.find((client) => client.id === clientId);
        const clientName = previousClient?.name || 'Client';
        const statusToastId = toast.success(`${clientName} moved to ${movedToGroupName}`, {
          description: `Status changed to ${nextUpdates.status}.`,
          action: {
            label: 'Undo',
            onClick: () => {
              if (!previousClient) return;
              const rollback = { status: previousClient.status, groupId: previousClient.groupId } as Partial<Client>;
              void updateClient(clientId, rollback)
                .then(() => {
                  toast.dismiss(statusToastId);
                  toast.success('Automation undone', { description: `${clientName} was restored to its previous status and group.` });
                })
                .catch((error) => toast.error('Undo failed', { description: error?.message || 'The previous status could not be restored.' }));
            },
          },
        });
      }
    }
    catch (error: any) {
      setClients(clients);
      console.error('Failed to update client', error);
      toast.error('Client update failed', { description: error?.message || 'The client change could not be saved.' });
    }
  }, [canEditClientRecord, clients, commitCustomerMatch, ensureCurrentClosedLeadsGroup, groups, setClients, showAssignmentPermissionError]);

  const confirmCloseLead = useCallback(async () => {
    const hasClosingEvidence = Boolean(closeLeadFiles.purchaseOrder || closeLeadFiles.signedQuotation || closeLeadFiles.proofOfPayment || signedOcfCheck.signedAt);
    if (!pendingCloseLead || !hasClosingEvidence) return;
    const client = clients.find((item) => item.id === pendingCloseLead.clientId);
    if (!client) return;
    if (!client.email.trim()) {
      toast.error('An Email address is required to close this lead', { description: 'Fill in the lead’s Email column before closing it.' });
      return;
    }
    setSavingCloseLead(true);
    try {
      const toAttachment = async (file: File, category: string) => {
        const [stored] = await uploadCrmFiles([file], `clients/${pendingCloseLead.clientId}/closed-lead-files`);
        return { ...stored, kind: 'file', category, actorName: currentUserId ?? 'Unknown user', createdAt: new Date().toISOString() };
      };
      const uploads: Array<[File | null, string]> = [
        [closeLeadFiles.purchaseOrder, 'Purchase order'],
        [closeLeadFiles.signedQuotation, 'Signed quotation'],
        [closeLeadFiles.proofOfPayment, 'Proof of payment'],
      ];
      const files = await Promise.all(uploads.filter((upload): upload is [File, string] => upload[0] instanceof File).map(([file, category]) => toAttachment(file, category)));
      let existingFiles: Record<string, string>[] = [];
      try { const parsed = JSON.parse(client.customFields?.closedLeadFiles ?? '[]'); if (Array.isArray(parsed)) existingFiles = parsed; } catch {}
      await updateClient(pendingCloseLead.clientId, {
        ...pendingCloseLead.updates,
        customFields: {
          ...(client.customFields ?? {}),
          ...(pendingCloseLead.updates.customFields ?? {}),
          closedLeadFiles: JSON.stringify([...existingFiles, ...files]),
          ...(signedOcfCheck.signedAt ? { closedLeadOcfSignedAt: signedOcfCheck.signedAt } : {}),
        },
      }, true);
      setPendingCloseLead(null);
      setCloseLeadFiles({ purchaseOrder: null, signedQuotation: null, proofOfPayment: null });
    } catch (error) {
      toast.error('Client could not be closed', { description: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setSavingCloseLead(false);
    }
  }, [clients, closeLeadFiles, currentUserId, pendingCloseLead, signedOcfCheck.signedAt, updateClient]);

  const updateSubitem = useCallback(async (clientId: string, subitemId: string, updates: Partial<Subitem>) => {
    if (!canEditSubitemRecord(clientId, subitemId)) {
      showAssignmentPermissionError();
      return;
    }
    setClients((prev) => prev.map((c) => ({
      ...c, subitems: c.subitems.map((s) => s.id === subitemId ? { ...s, ...updates } : s),
    })));
    try { await updateSubitemRow(subitemId, updates); }
    catch (error: any) { setClients(clients); console.error('Failed to update subitem', error); }
  }, [canEditSubitemRecord, clients, showAssignmentPermissionError]);

  const undoActivity = useCallback(async (entry: import('../app/types').ActivityEntry) => {
    if (entry.action === 'field_changed') {
      const fieldMap: Record<string, keyof Client> = {
        replyStatus: 'replyStatus', followUp: 'followUp', status: 'status', channel: 'channel',
        importance: 'importance', name: 'name', people: 'people', company: 'company', email: 'email',
        phone: 'phone', requirements: 'requirements', nbd: 'nbd', totalPrice: 'totalPrice',
        billingAddress: 'billingAddress',
      };
      const field = entry.fieldName ? fieldMap[entry.fieldName] : undefined;
      if (!field || !entry.clientId) return;
      if (!canEditClientRecord(entry.clientId)) { showAssignmentPermissionError(); return; }
      const updates = { [field]: entry.oldValue } as Partial<Client>;
      await updateClient(entry.clientId, updates);
      toast.success('Change undone', { description: `${entry.fieldName} was restored to its previous value.` });
      return;
    }

    if (entry.action === 'subitem_field_changed' && entry.subitemId && entry.fieldName && !entry.fieldName.startsWith('timeline:')) {
      if (!entry.clientId || !canEditSubitemRecord(entry.clientId, entry.subitemId)) { showAssignmentPermissionError(); return; }
      if (entry.fieldName === 'parentClient') {
        const oldClientId = typeof entry.meta?.oldClientId === 'string' ? entry.meta.oldClientId : null;
        const newClientId = typeof entry.meta?.newClientId === 'string' ? entry.meta.newClientId : null;
        if (!oldClientId || !newClientId) return;

        setClients((previous) => previous.map((client) => {
          if (client.id === newClientId) {
            return { ...client, subitems: client.subitems.filter((subitem) => subitem.id !== entry.subitemId) };
          }
          if (client.id === oldClientId) {
            const movedSubitem = clients.find((item) => item.id === newClientId)?.subitems.find((subitem) => subitem.id === entry.subitemId);
            return movedSubitem ? { ...client, subitems: [...client.subitems, movedSubitem] } : client;
          }
          return client;
        }));

        await moveSubitemRow(entry.subitemId, oldClientId);
        toast.success('Move undone', { description: 'The subitem was moved back to its previous client.' });
        return;
      }

      const updates = { [entry.fieldName]: entry.oldValue } as Partial<Subitem>;
      setClients((previous) => previous.map((client) => ({
        ...client,
        subitems: client.subitems.map((subitem) => subitem.id === entry.subitemId ? { ...subitem, ...updates } : subitem),
      })));
      await updateSubitemRow(entry.subitemId, updates);
      toast.success('Change undone', { description: `${entry.fieldName} was restored to its previous value.` });
    }
  }, [canEditClientRecord, canEditSubitemRecord, clients, setClients, showAssignmentPermissionError, updateClient]);

  const addClient = useCallback(async () => {
    try {
      const defaultGroupId = groups[0]?.id ?? null;
      const createdClient = await createClientRow(currentUserId ?? null, defaultGroupId);
      const newClient: Client = {
        id: createdClient.id, name: createdClient.name ?? '', people: createdClient.people ?? '',
        replyStatus: createdClient.reply_status ?? '', followUp: createdClient.follow_up ?? '',
        status: (createdClient.status as ClientStatus) ?? 'New Lead', channel: createdClient.channel ?? '',
        importance: createdClient.importance ?? '', progress: createdClient.progress ?? '', company: createdClient.company ?? '',
        email: createdClient.email ?? '', phone: createdClient.phone ?? '',
        requirements: createdClient.requirements ?? '', nbd: createdClient.nbd ?? '',
        groupId: createdClient.group_id ?? defaultGroupId, totalPrice: createdClient.total_price ?? '',
        billingAddress: createdClient.billing_address ?? '',
        createdAt: createdClient.created_at ?? '', expanded: createdClient.expanded ?? true,
        color: createdClient.color ?? '#7BCBD5', subitems: [], activityLog: [], customFields: {}
      };
      setClients((prev) => [newClient, ...prev]);
      if (currentUserId) setClientAssignees((previous) => ({ ...previous, [newClient.id]: [currentUserId] }));
      setExpandedIds((prev) => [...prev, newClient.id]);
      notifyChange('Client added', `${newClient.name} was added to the board.`);
      fetchClientAssigneeMap()
        .then((m) => setClientAssignees(m))
        .catch((e) => console.error('Failed to refresh assignees', e));
    } catch (error: any) { console.error('Failed to add client', error); toast.error('Client could not be added', { description: error?.message || 'The client was not saved.' }); }
  }, [currentUserId, groups, setClientAssignees, setClients, setExpandedIds, notifyChange]);

  const deleteClient = useCallback(async (clientId: string) => {
    if (!canEditClientRecord(clientId)) { showAssignmentPermissionError(); return; }
    setClients((prev) => prev.filter((c) => c.id !== clientId));
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(clientId); return next; });
    try { await deleteClientRow(clientId); notifyChange('Client deleted', 'The client and its related records were removed.'); }
    catch (error: any) { setClients(clients); console.error('Failed to delete client', error); toast.error('Client could not be deleted', { description: error?.message || 'The client was not deleted.' }); }
  }, [canEditClientRecord, clients, setClients, notifyChange, showAssignmentPermissionError]);

  const pendingClientToDelete = useMemo(
    () => clients.find((client) => client.id === pendingDeleteClientId) ?? null,
    [clients, pendingDeleteClientId],
  );

  const pendingSubitemToDelete = useMemo(() => {
    if (!pendingDeleteSubitem) return null;
    const client = clients.find((item) => item.id === pendingDeleteSubitem.clientId);
    const subitem = client?.subitems.find((item) => item.id === pendingDeleteSubitem.subitemId);
    return { clientName: client?.name ?? 'this client', subitemName: subitem?.name ?? 'this subitem' };
  }, [clients, pendingDeleteSubitem]);

  const deleteSelected = useCallback(async () => {
    const ids = [...selectedIds];
    if (ids.some((clientId) => !canEditClientRecord(clientId))) { showAssignmentPermissionError(); return; }
    setClients((prev) => prev.filter((c) => !selectedIds.has(c.id)));
    setSelectedIds(new Set());
    try { await Promise.all(ids.map((id) => deleteClientRow(id))); notifyChange('Clients deleted', `${ids.length} selected client${ids.length === 1 ? '' : 's'} were removed.`); }
    catch (error: any) { setClients(clients); console.error('Failed to delete selected', error); toast.error('Selected clients could not be deleted', { description: error?.message || 'The selected clients were not deleted.' }); }
  }, [canEditClientRecord, selectedIds, clients, setClients, notifyChange, showAssignmentPermissionError]);

  const duplicateSelectedClients = useCallback(async () => {
    if ([...selectedIds].some((clientId) => !canEditClientRecord(clientId))) { showAssignmentPermissionError(); return; }
    setIsDuplicatingClients(true);
    try {
      await Promise.all([...selectedIds].map((clientId) => duplicateClientRow(clientId)));
      await reloadClients();
      const [nextClientAssignees, nextSubitemAssignees] = await Promise.all([fetchClientAssigneeMap(), fetchAllSubitemAssignees()]);
      setClientAssignees(nextClientAssignees);
      setSubitemAssignees(nextSubitemAssignees);
      toast.success('Clients duplicated', { description: `${selectedIds.size} selected client${selectedIds.size === 1 ? '' : 's'} were copied with their subitems.` });
      setSelectedIds(new Set());
    } catch (error) {
      await reloadClients();
      toast.error('Clients could not be duplicated', { description: error instanceof Error ? error.message : 'The selected clients were not duplicated.' });
    } finally {
      setIsDuplicatingClients(false);
    }
  }, [canEditClientRecord, reloadClients, selectedIds, setClientAssignees, setSubitemAssignees, showAssignmentPermissionError]);

  const duplicateClientAction = useCallback(async (clientId: string) => {
    if (!canEditClientRecord(clientId)) { showAssignmentPermissionError(); return; }
    try {
      await duplicateClientRow(clientId);
      await reloadClients();
      const [nextClientAssignees, nextSubitemAssignees] = await Promise.all([fetchClientAssigneeMap(), fetchAllSubitemAssignees()]);
      setClientAssignees(nextClientAssignees); setSubitemAssignees(nextSubitemAssignees);
      toast.success("Client duplicated");
    } catch (error: any) { toast.error("Client could not be duplicated", { description: error?.message || "Please try again." }); }
  }, [canEditClientRecord, reloadClients, setClientAssignees, setSubitemAssignees, showAssignmentPermissionError]);

  const moveClientAction = useCallback(async (clientId: string, targetGroupId: string) => {
    if (!canEditClientRecord(clientId)) { showAssignmentPermissionError(); return; }
    await updateClient(clientId, { groupId: targetGroupId });
    toast.success("Client moved", { description: "The client was moved to the selected group." });
  }, [canEditClientRecord, showAssignmentPermissionError, updateClient]);

  const moveSelectedClients = useCallback(async (targetGroupId: string) => {
    if ([...selectedIds].some((clientId) => !canEditClientRecord(clientId))) { showAssignmentPermissionError(); return; }
    setIsMovingClients(true);
    try {
      const targetGroup = groups.find((group) => group.id === targetGroupId);
      const updates: Partial<Client> = { groupId: targetGroupId };
      if (targetGroup?.name.trim().toLowerCase().startsWith('closed leads')) updates.status = 'Closed';
      if (updates.status === 'Closed') {
        if (selectedIds.size !== 1) {
          toast.error('Close leads one at a time', { description: 'Each lead requires its own purchase order, signed quotation, proof of payment, and OCF confirmation.' });
          return;
        }
        await updateClient([...selectedIds][0], updates);
        return;
      }
      await Promise.all([...selectedIds].map((clientId) => updateClientRow(clientId, updates)));
      await reloadClients();
      toast.success('Clients moved', { description: `${selectedIds.size} selected client${selectedIds.size === 1 ? '' : 's'} were moved to the chosen group.` });
      setSelectedIds(new Set());
    } catch (error) {
      await reloadClients();
      toast.error('Clients could not be moved', { description: error instanceof Error ? error.message : 'The selected clients were not moved.' });
    } finally {
      setIsMovingClients(false);
      setShowClientMoveMenu(false);
      setClientMoveSearch('');
    }
  }, [canEditClientRecord, groups, reloadClients, selectedIds, showAssignmentPermissionError, updateClient]);

  const addSubitem = useCallback(async (clientId: string, name: string) => {
      const trimmedName = name.trim();
      if (!trimmedName) return;
      if (!canEditClientRecord(clientId)) { showAssignmentPermissionError(); throw new Error('You can only edit items that are assigned to you'); }
      try {
        const createdSubitem = await createSubitemRow(clientId, trimmedName, currentUserId);
        setClients((previous) => previous.map((client) => client.id === clientId ? { ...client, subitems: [...client.subitems, createdSubitem] } : client));
        if (currentUserId) setSubitemAssignees((previous) => ({ ...previous, [createdSubitem.id]: [currentUserId] }));
        notifyChange('Subitem added', `${trimmedName} is now available under the client.`);
      }
    catch (error: any) { console.error('Failed to add subitem', error); toast.error('Subitem could not be added', { description: error?.message || 'The subitem was not saved.' }); throw error; }
  }, [canEditClientRecord, currentUserId, notifyChange, setClients, setSubitemAssignees, showAssignmentPermissionError]);

  const deleteSubitem = useCallback(async (_clientId: string, subitemId: string) => {
    if (!canEditSubitemRecord(_clientId, subitemId)) { showAssignmentPermissionError(); return; }
    setSelectedSubitemIds((previous) => previous.filter((id) => id !== subitemId));
    setClients((prev) => prev.map((c) => ({ ...c, subitems: c.subitems.filter((s) => s.id !== subitemId) })));
    try { await deleteSubitemRow(subitemId); notifyChange('Subitem deleted', 'The subitem was removed.'); }
    catch (error: any) { setClients(clients); console.error('Failed to delete subitem', error); toast.error('Subitem could not be deleted', { description: error?.message || 'The subitem was not deleted.' }); }
  }, [canEditSubitemRecord, clients, setClients, notifyChange, showAssignmentPermissionError]);

  const moveSelectedSubitems = useCallback(async (subitemIds: string[], targetClientId: string) => {
    if (subitemIds.some((subitemId) => {
      const owner = clients.find((client) => client.subitems.some((subitem) => subitem.id === subitemId));
      return !owner || !canEditSubitemRecord(owner.id, subitemId);
    })) { showAssignmentPermissionError(); return; }
    setIsMovingSubitems(true);
    try {
      await Promise.all(subitemIds.map((subitemId) => moveSubitemRow(subitemId, targetClientId)));
      await reloadClients();
      toast.success('Subitems moved', { description: `${subitemIds.length} subitem${subitemIds.length === 1 ? '' : 's'} moved to the selected client.` });
    } catch (error) {
      await reloadClients();
      toast.error('Subitems could not be moved', { description: error instanceof Error ? error.message : 'The subitems were not moved.' });
    } finally {
      setIsMovingSubitems(false);
    }
  }, [canEditSubitemRecord, clients, reloadClients, showAssignmentPermissionError]);

  const duplicateSelectedSubitems = useCallback(async () => {
    if (!canEditSelectedSubitems) { showAssignmentPermissionError(); return; }
    setIsDuplicatingSubitems(true);
    try {
      // Preserve the board sequence for a multi-item duplication. Running these
      // sequentially avoids concurrent appends assigning arbitrary positions.
      const orderedIds = clients
        .flatMap((client) => client.subitems.map((subitem) => subitem.id))
        .filter((id) => selectedSubitemIds.includes(id));
      for (const subitemId of orderedIds) await duplicateSubitemRow(subitemId);
      await reloadClients();
      toast.success('Subitems duplicated', { description: `${selectedSubitemIds.length} subitem${selectedSubitemIds.length === 1 ? '' : 's'} duplicated.` });
      clearSubitemSelection();
    } catch (error) {
      await reloadClients();
      toast.error('Subitems could not be duplicated', { description: error instanceof Error ? error.message : 'The selected subitems were not duplicated.' });
    } finally {
      setIsDuplicatingSubitems(false);
    }
  }, [canEditSelectedSubitems, clients, reloadClients, selectedSubitemIds, showAssignmentPermissionError]);

  const duplicateSubitemAction = useCallback(async (subitemId: string) => {
    const owner = clients.find((client) => client.subitems.some((subitem) => subitem.id === subitemId));
    if (!owner || !canEditSubitemRecord(owner.id, subitemId)) { showAssignmentPermissionError(); return; }
    try { await duplicateSubitemRow(subitemId); await reloadClients(); toast.success("Subitem duplicated"); }
    catch (error: any) { toast.error("Subitem could not be duplicated", { description: error?.message || "Please try again." }); }
  }, [canEditSubitemRecord, clients, reloadClients, showAssignmentPermissionError]);

  const moveSubitemAction = useCallback(async (subitemId: string, targetClientId: string) => {
    await moveSelectedSubitems([subitemId], targetClientId);
  }, [moveSelectedSubitems]);

  const toggleSubitemSelection = useCallback((subitemId: string) => {
    if (selectedIds.size > 0) return;
    setSelectedSubitemIds((previous) => previous.includes(subitemId)
      ? previous.filter((id) => id !== subitemId)
      : [...previous, subitemId]);
  }, [selectedIds.size]);

  const toggleAllSubitems = useCallback((subitemIds: string[]) => {
    if (selectedIds.size > 0) return;
    setSelectedSubitemIds((previous) => {
      const allSelected = subitemIds.length > 0 && subitemIds.every((id) => previous.includes(id));
      return allSelected
        ? previous.filter((id) => !subitemIds.includes(id))
        : [...new Set([...previous, ...subitemIds])];
    });
  }, [selectedIds.size]);

  const clearSubitemSelection = useCallback(() => {
    setSelectedSubitemIds([]);
    setShowSubitemMoveMenu(false);
    setSubitemMoveSearch('');
  }, []);

  return (
    <div className="crm-board flex flex-col h-full bg-white">
      {detailSubitem && (() => {
        const owner = clients.find((client) => client.id === detailSubitem.clientId);
        const subitem = owner?.subitems.find((item) => item.id === detailSubitem.subitemId);
        if (!owner || !subitem) return null;
        return <SubitemDetailView key={subitem.id} subitem={subitem} clientName={owner.name} siblings={owner.subitems} profiles={profiles} assigneeIds={subitemAssignees[subitem.id] ?? []} canEdit={canEditSubitemRecord(owner.id, subitem.id)} onClose={() => setDetailSubitem(null)} onNavigate={(next) => setDetailSubitem({ clientId: owner.id, subitemId: next.id })} onUpdate={(updates) => updateSubitem(owner.id, subitem.id, updates)} onAssigneesChange={(ids) => handleSubitemAssigneesChange(subitem.id, ids)} activityLog={owner.activityLog ?? []} onUndo={undoActivity} options={{ status: subitemStatusEntries, localOverseas: localOverseasEntries, shipper: shipperEntries, currency: currencyEntries, payment: paymentEntries, paymentStatus: paymentStatusEntries, modeOfPayment: modeOfPaymentEntries, subProgress: subitemSubprogressEntries }} moveTargetGroups={groupedClients.map(({ group, clients: groupClients }) => ({ name: group.name, clients: groupClients.map((target) => ({ id: target.id, name: target.name })) }))} onDuplicate={() => duplicateSubitemAction(subitem.id)} onMove={(targetClientId) => moveSubitemAction(subitem.id, targetClientId)} onDelete={() => { setDetailSubitem(null); setPendingDeleteSubitem({ clientId: owner.id, subitemId: subitem.id }); }} />;
      })()}
      {detailClientId && (() => {
        const detailClient = clients.find((client) => client.id === detailClientId);
        if (!detailClient) return null;
        return <ClientDetailView key={detailClient.id} client={detailClient} clients={groupedClients.flatMap(({ clients: groupClients }) => groupClients)} profiles={profiles} assigneeIds={clientAssignees[detailClient.id] ?? []} pmIds={clientPmAssigneeIds(detailClient)} canEdit={canEditClientRecord(detailClient.id)} currentUserId={currentUserId} currentUserRole={currentUserRole} groups={groups} initialTab={detailClientInitialTab ?? undefined} onDuplicate={() => duplicateClientAction(detailClient.id)} onMove={(groupId) => moveClientAction(detailClient.id, groupId)} onDelete={() => { setDetailClientId(null); setDetailClientInitialTab(null); setPendingDeleteClientId(detailClient.id); }} onClose={() => { setDetailClientId(null); setDetailClientInitialTab(null); }} onNavigate={(client) => { setDetailClientId(client.id); setDetailClientInitialTab(null); }} onUpdate={(updates) => updateClient(detailClient.id, updates)} onChangeAssignees={(ids) => handleClientAssigneesChange(detailClient.id, ids)} onUndo={undoActivity} statusOptions={clientStatusEntries} replyStatusOptions={replyStatusEntries} channelOptions={channelEntries} importanceOptions={importanceEntries} groupNamesById={Object.fromEntries(groups.map((group) => [group.id, group.name]))} />;
      })()}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 z-[100] flex min-h-16 w-[min(900px,calc(100vw-2rem))] -translate-x-1/2 items-center gap-5 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-2xl">
          <div className="whitespace-nowrap text-base font-medium text-slate-800">{selectedIds.size} Client{selectedIds.size === 1 ? '' : 's'} selected</div>
          <button type="button" disabled={isDuplicatingClients || !canEditSelectedClients} title={!canEditSelectedClients ? 'You can only edit items that are assigned to you' : 'Duplicate selected clients'} onClick={() => void duplicateSelectedClients()} className="flex items-center gap-1.5 rounded px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"><Copy size={17} /> {isDuplicatingClients ? 'Duplicating...' : 'Duplicate'}</button>
          <div className="relative">
            <button type="button" disabled={isMovingClients || !canEditSelectedClients} onClick={() => setShowClientMoveMenu((open) => !open)} title={!canEditSelectedClients ? 'You can only edit items that are assigned to you' : 'Move selected clients'} className="flex items-center gap-1.5 rounded px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"><MoveRight size={17} /> {isMovingClients ? 'Moving...' : 'Move'}</button>
            {showClientMoveMenu && !isMovingClients && <div className="absolute bottom-full left-0 mb-2 max-h-96 w-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-2xl">
              <div className="mb-3 text-base font-medium text-slate-800">Move to group</div>
              <div className="relative mb-2"><Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" /><input autoFocus value={clientMoveSearch} onChange={(event) => setClientMoveSearch(event.target.value)} placeholder="Search groups" className="h-10 w-full rounded border border-slate-200 pl-8 pr-2 text-sm outline-none focus:border-sky-400" /></div>
              {groups.filter((group) => group.name.toLowerCase().includes(clientMoveSearch.toLowerCase())).map((group) => <button key={group.id} type="button" onClick={() => void moveSelectedClients(group.id)} className="block w-full rounded px-2 py-2 text-left text-sm text-slate-700 hover:bg-sky-50">{group.name}</button>)}
              {groups.filter((group) => group.name.toLowerCase().includes(clientMoveSearch.toLowerCase())).length === 0 && <div className="px-2 py-5 text-center text-sm text-slate-400">No groups found.</div>}
            </div>}
          </div>
          <button type="button" disabled={!canEditSelectedClients} onClick={() => setPendingDeleteSelected(true)} title={!canEditSelectedClients ? 'You can only delete items that are assigned to you' : 'Delete selected clients'} className="flex items-center gap-1.5 rounded px-3 py-2 text-sm text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"><Trash2 size={17} /> Delete</button>
          <div className="ml-auto whitespace-nowrap text-center text-sm text-slate-600"><div>Total Price</div><div className="font-medium text-slate-900">{selectedClientTotals.totalPrice.toFixed(2)}</div></div>
          <div className="whitespace-nowrap text-center text-sm text-slate-600"><div>Total Markup</div><div className={`font-medium ${selectedClientTotals.totalMarkup >= 0 ? 'text-green-600' : 'text-red-500'}`}>{selectedClientTotals.totalMarkup.toFixed(2)}</div></div>
          <div className="whitespace-nowrap text-center text-sm text-slate-600"><div>Total U.P</div><div className="font-medium text-slate-900">{selectedClientTotals.totalUp.toFixed(2)}</div></div>
          <div className="whitespace-nowrap text-center text-sm text-slate-600"><div>Total U.C</div><div className="font-medium text-slate-900">{selectedClientTotals.totalUc.toFixed(2)}</div></div>
          <button type="button" onClick={() => setSelectedIds(new Set())} className="rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700" title="Clear selection"><X size={21} /></button>
        </div>
      )}
      {selectedSubitemIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 z-[100] flex min-h-16 w-[min(900px,calc(100vw-2rem))] -translate-x-1/2 items-center gap-5 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-2xl">
          <div className="whitespace-nowrap text-base font-medium text-slate-800">{selectedSubitemIds.length} Subitem{selectedSubitemIds.length === 1 ? '' : 's'} selected</div>
          <button type="button" disabled={isDuplicatingSubitems || !canEditSelectedSubitems} title={!canEditSelectedSubitems ? 'You can only edit items that are assigned to you' : 'Duplicate selected subitems'} onClick={() => void duplicateSelectedSubitems()} className="flex items-center gap-1.5 rounded px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"><Copy size={17} /> {isDuplicatingSubitems ? 'Duplicating...' : 'Duplicate'}</button>
          <div className="relative">
            <button type="button" disabled={isMovingSubitems || !canEditSelectedSubitems} onClick={() => setShowSubitemMoveMenu((open) => !open)} title={!canEditSelectedSubitems ? 'You can only edit items that are assigned to you' : 'Move selected subitems'} className="flex items-center gap-1.5 rounded px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"><MoveRight size={17} /> {isMovingSubitems ? 'Moving...' : 'Move'}</button>
            {showSubitemMoveMenu && !isMovingSubitems && (
              <div className="absolute bottom-full left-0 mb-2 max-h-96 w-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-2xl">
                <div className="mb-3 text-base font-medium text-slate-800">Choose a new parent</div>
                <div className="relative mb-3"><Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" /><input autoFocus value={subitemMoveSearch} onChange={(event) => setSubitemMoveSearch(event.target.value)} placeholder="Search clients" className="h-10 w-full rounded border border-slate-200 pl-8 pr-2 text-sm outline-none focus:border-sky-400" /></div>
                {orderedMoveGroups.map((group) => (
                  <div key={group.name} className="mb-3"><div className="px-1 py-1 text-xs font-medium text-sky-600">{group.name}</div>{group.clients.map((client) => <button key={client.id} type="button" onClick={async () => { setShowSubitemMoveMenu(false); await moveSelectedSubitems(selectedSubitemIds, client.id); clearSubitemSelection(); }} className="block w-full rounded px-2 py-2 text-left text-sm text-slate-700 hover:bg-sky-50">{client.name}</button>)}</div>
                ))}
                {orderedMoveGroups.length === 0 && <div className="px-2 py-5 text-center text-sm text-slate-400">No clients found.</div>}
              </div>
            )}
          </div>
          <button type="button" disabled={!canEditSelectedSubitems} onClick={() => setPendingDeleteSelectedSubitems(selectedSubitemIds)} title={!canEditSelectedSubitems ? 'You can only delete items that are assigned to you' : 'Delete selected subitems'} className="flex items-center gap-1.5 rounded px-3 py-2 text-sm text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"><Trash2 size={17} /> Delete</button>
          <div className="ml-auto whitespace-nowrap text-center text-sm text-slate-600"><div>Total Price</div><div className="font-medium text-slate-900">{selectedSubitemTotals.totalPrice.toFixed(2)}</div></div>
          <div className="whitespace-nowrap text-center text-sm text-slate-600"><div>Total Markup</div><div className={`font-medium ${selectedSubitemTotals.totalMarkup >= 0 ? 'text-green-600' : 'text-red-500'}`}>{selectedSubitemTotals.totalMarkup.toFixed(2)}</div></div>
          <div className="whitespace-nowrap text-center text-sm text-slate-600"><div>Total U.P</div><div className="font-medium text-slate-900">{selectedSubitemTotals.totalUp.toFixed(2)}</div></div>
          <div className="whitespace-nowrap text-center text-sm text-slate-600"><div>Total U.C</div><div className="font-medium text-slate-900">{selectedSubitemTotals.totalUc.toFixed(2)}</div></div>
          <button type="button" onClick={clearSubitemSelection} className="rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700" title="Clear selection"><X size={21} /></button>
        </div>
      )}
      <div className="flex items-center gap-2 px-2 py-1 border-b border-gray-200 bg-white flex-shrink-0">
        <button onClick={addClient} className="flex items-center gap-1 px-2 py-1 bg-[#43adc4] hover:bg-[#0f8da8] text-white rounded-md text-[10px] font-medium transition-colors transition transform active:scale-95 duration-150">
          <Plus size={12} /> Add Client
        </button>
        <button onClick={() => setShowAddGroupModal(true)} disabled={!['director', 'admin', 'dev'].includes(currentUserRole ?? '')} className="flex items-center gap-1 px-2 py-1 bg-[#43adc4] hover:bg-[#0f8da8] text-white rounded-md text-[10px] font-medium transition-colors transition transform active:scale-95 duration-150 disabled:cursor-not-allowed disabled:opacity-50">
          <Plus size={12} /> Add Group
        </button>
        <AddGroupModal open={showAddGroupModal} onClose={() => setShowAddGroupModal(false)} onSubmit={handleAddGroup} />

        <button onClick={toggleCollapseAllGroups} disabled={groups.length === 0} title="Ctrl + G" className="flex items-center gap-1 px-2 py-1 bg-[#43adc4] hover:bg-[#0f8da8] text-white rounded-md text-[10px] font-medium transition-colors transition transform active:scale-95 duration-150 disabled:cursor-not-allowed disabled:opacity-50">
          {allGroupsCollapsed ? <ChevronsDown size={12} /> : <ChevronsUp size={12} />}
          {allGroupsCollapsed ? 'Expand All Groups' : 'Collapse All Groups'}
        </button>

        <button onClick={toggleExpandAll} title="Ctrl + I" className="flex items-center gap-1 px-2 py-1 bg-[#43adc4] hover:bg-[#0f8da8] text-white rounded-md text-[10px] font-medium transition-colors transition transform active:scale-95 duration-150">
          {allExpanded ? <ChevronsUp size={12} /> : <ChevronsDown size={12} />}
          {allExpanded ? 'Collapse All Clients' : 'Expand All Clients'}
        </button>

        <div ref={filterRef} className="relative">
          <div className="inline-flex overflow-hidden rounded-md text-[10px] font-medium text-white shadow-sm">
            <button onClick={() => { setFocusedFilterColumn(null); setFilterMode('quick'); setShowFilter(!showFilter || filterMode !== 'quick'); setShowSortMenu(false); }} className="flex items-center gap-1 bg-[#43adc4] px-2 py-1 transition-colors hover:bg-[#0f8da8] active:scale-95">
              <Filter size={12} />
              Filter
              {activeFilterCount > 0 && <span className="rounded-full bg-white/25 px-1.5">{activeFilterCount}</span>}
            </button>
            <button type="button" onClick={() => { setFocusedFilterColumn(null); setFilterMode('advanced'); setShowFilter(true); setShowSortMenu(false); }} className="border-l border-white/35 bg-[#43adc4] px-1.5 transition-colors hover:bg-[#0f8da8] active:scale-95" title="Open advanced filters" aria-label="Open advanced filters"><ChevronDown size={11} /></button>
          </div>
          {showFilter && (
            <div className={`absolute top-full left-0 z-50 mt-1 rounded-lg ${filterMode === 'quick' ? 'w-[min(680px,calc(100vw-1rem))] border border-gray-200 bg-white p-3 shadow-xl' : ''}`}>
              {filterMode === 'advanced' && <AdvancedFilters columns={advancedColumns} rules={advancedRules} join={advancedJoin} onRulesChange={setAdvancedRules} onJoinChange={setAdvancedJoin} onClear={() => setAdvancedRules([{ id: crypto.randomUUID(), column: '', condition: '', value: '' }])} />}
              <div className={`${filterMode === 'advanced' ? 'hidden' : ''} mb-3 flex items-center justify-between border-b border-gray-100 pb-2`}>
                <div className="flex items-center gap-2">
                  {focusedFilterColumn && <button onClick={() => setFocusedFilterColumn(null)} className="text-xs text-gray-500 hover:text-gray-800">←</button>}
                  <span className="text-xs font-semibold text-gray-800">Quick filters{focusedFilterColumn ? ` · ${focusedFilterColumn}` : ''}</span>
                </div>
                <button
                  onClick={() => {
                    setFilterStatus('All');
                    setFilterSubprogress('All');
                    setFilterSubitemStatus('All');
                    setFilterPayment('All');
                    setFilterPaymentStatus('All');
                    setFilterPeople('All');
                    setFilterImportance('All');
                    setFilterReplyStatus('All');
                    setFilterChannel('All');
                  }}
                  className="text-[10px] font-medium text-gray-400 hover:text-gray-700 disabled:opacity-40"
                  disabled={activeFilterCount === 0}
                >
                  Clear all
                </button>
              </div>

              <div className={`${filterMode === 'advanced' ? 'hidden' : ''} flex gap-3 overflow-x-auto pb-1`}>
                {renderFilterColumn({ label: 'Status', value: filterStatus, options: clientStatuses, onChange: setFilterStatus, countFor: (value) => clients.filter((client) => client.status === value).length, colors: statusColors })}
                {renderFilterColumn({ label: 'Subitem Subprogress', value: filterSubprogress, options: subprogressOptions, onChange: setFilterSubprogress, countFor: (value) => clients.filter((client) => client.subitems.some((subitem) => (subitem.timelineRows ?? []).some((row) => (row.subProgress ?? '') === value))).length, colors: subProgressColors })}
                {renderFilterColumn({ label: 'Subitem Status', value: filterSubitemStatus, options: subitemStatusOptionsForFilter, onChange: setFilterSubitemStatus, countFor: (value) => clients.filter((client) => client.subitems.some((subitem) => subitem.status === value)).length, colors: subitemStatusColors })}
                {renderFilterColumn({ label: 'Payment', value: filterPayment, options: paymentOptionsForFilter, onChange: setFilterPayment, countFor: (value) => clients.filter((client) => client.subitems.some((subitem) => subitem.payment === value)).length, colors: paymentColors })}
                {renderFilterColumn({ label: 'Payment Status', value: filterPaymentStatus, options: paymentStatusOptionsForFilter, onChange: setFilterPaymentStatus, countFor: (value) => clients.filter((client) => client.subitems.some((subitem) => subitem.paymentStatus === value)).length, colors: paymentStatusColors })}
                {renderFilterColumn({
                  label: 'People',
                  value: filterPeople,
                  options: peopleOptions,
                  onChange: setFilterPeople,
                  countFor: (value) => clients.filter((client) => (clientAssignees[client.id] ?? []).includes(value) || client.subitems.some((subitem) => (subitemAssignees[subitem.id] ?? []).includes(value))).length,
                  renderOption: (value, label) => {
                    const profile = peopleProfilesById[value];
                    const displayLabel = profile?.full_name || profile?.email || label;
                    const initials = displayLabel.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';
                    return (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: gradientForId(value) }} title={displayLabel}>
                        {initials}
                      </span>
                    );
                  },
                })}
                {renderFilterColumn({ label: 'Importance', value: filterImportance, options: importanceOptions, onChange: setFilterImportance, countFor: (value) => clients.filter((client) => client.importance === value).length, colors: importanceColors })}
                {renderFilterColumn({ label: 'Reply Status', value: filterReplyStatus, options: replyStatuses, onChange: setFilterReplyStatus, countFor: (value) => clients.filter((client) => client.replyStatus === value).length, colors: replyStatusColors })}
                {renderFilterColumn({ label: 'Channel', value: filterChannel, options: channelOptions, onChange: setFilterChannel, countFor: (value) => clients.filter((client) => client.channel === value).length, colors: channelColors })}
              </div>
              <div className={`${filterMode === 'advanced' ? 'absolute bottom-4 right-5' : 'mt-3 border-t border-gray-100 pt-2 text-right'}`}><button type="button" onClick={() => setFilterMode((mode) => mode === 'advanced' ? 'quick' : 'advanced')} className="text-xs text-slate-500 hover:text-sky-700">Switch to {filterMode === 'advanced' ? 'quick filters' : 'advanced filters'}</button></div>
            </div>
          )}
        </div>

        <div className="relative" data-crm-menu-trigger>
          <button type="button" onClick={() => { setShowSortMenu((open) => !open); setShowHideColumns(false); setShowBoardMoreMenu(false); }} className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-white transition active:scale-95 ${showSortMenu || activeBoardSort.category !== DEFAULT_BOARD_SORT.category || activeBoardSort.column !== DEFAULT_BOARD_SORT.column || activeBoardSort.direction !== DEFAULT_BOARD_SORT.direction ? 'bg-[#0f8da8]' : 'bg-[#43adc4] hover:bg-[#0f8da8]'}`}>
            <ArrowDownUp size={12} /> Sort <ChevronDown size={11} />
          </button>
          {showSortMenu && <div data-crm-menu className="absolute left-0 top-full z-50 mt-1 w-[430px] max-w-[calc(100vw-1rem)] rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <div className="mb-3"><h3 className="text-sm font-semibold text-slate-800">Sort board items</h3><p className="mt-0.5 text-xs text-slate-500">Client sorting applies within groups; subitem and payment sorting applies within each client.</p></div>
            <div className="grid gap-2 sm:grid-cols-[1fr_150px]">
              <label className="grid gap-1 text-[11px] font-medium text-slate-500">Column<select value={`${activeBoardSort.category}:${activeBoardSort.column}`} onChange={(event) => { const [category, ...columnParts] = event.target.value.split(':'); setBoardSort((current) => ({ ...current, category: category as BoardSortSetting['category'], column: columnParts.join(':') })); }} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400">
                <optgroup label="Client columns">{clientSortColumns.map((column) => <option key={`client:${column.key}`} value={`client:${column.key}`}>{column.label || column.key}</option>)}</optgroup>
                <optgroup label="Subitem columns">{subitemSortColumns.map((column) => <option key={`subitem:${column.key}`} value={`subitem:${column.key}`}>{column.label || column.key}</option>)}</optgroup>
                <optgroup label="Payment columns">{paymentSortColumns.map((column) => <option key={`payment:${column.key}`} value={`payment:${column.key}`}>{column.label || column.key}</option>)}</optgroup>
              </select></label>
              <label className="grid gap-1 text-[11px] font-medium text-slate-500">Direction<select value={activeBoardSort.direction} onChange={(event) => setBoardSort((current) => ({ ...current, direction: event.target.value as 'asc' | 'desc' }))} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400"><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>
            </div>
          </div>}
        </div>

        <div className="relative" data-crm-menu-trigger>
          <button onClick={() => { setShowHideColumns((open) => !open); setShowSortMenu(false); setShowBoardMoreMenu(false); }} className="flex items-center gap-1 px-2 py-1 bg-[#43adc4] hover:bg-[#0f8da8] text-white rounded-md text-[10px] font-medium transition-colors transform active:scale-95 duration-150">
            <EyeOff size={12} /> Hide
            {hiddenColumnKeys.size > 0 && <span className="rounded-full bg-white/25 px-1.5">{hiddenColumnKeys.size}</span>}
            <ChevronDown size={11} />
          </button>
          {showHideColumns && (
            <div data-crm-menu className="absolute top-full left-0 mt-1 w-64 max-h-[min(520px,calc(100vh-5rem))] overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-xl z-50">
              <div className="flex items-center justify-between border-b border-gray-100 px-2 pb-2">
                <span className="text-xs font-semibold text-gray-800">Display columns</span>
                <button onClick={() => setHiddenColumnKeys(new Set())} className="text-[10px] font-medium text-gray-400 hover:text-gray-700">Show all</button>
              </div>
              {hideableColumnGroups.map((group) => (
                <div key={group.label} className="pt-2">
                  <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{group.label}</div>
                  {group.columns.map((column) => {
                    const visible = !hiddenColumnKeys.has(column.key);
                    return (
                      <label key={column.key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50">
                        <input type="checkbox" checked={visible} onChange={(event) => setColumnVisibility(column.key, event.target.checked)} className="h-3.5 w-3.5 rounded accent-[#0f8da8]" />
                        <span className="truncate">{column.label || 'Unnamed column'}</span>
                      </label>
                    );
                  })}
                </div>
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
          <div className="relative ml-1" data-crm-menu-trigger>
            <button type="button" onClick={() => { setShowBoardMoreMenu((open) => !open); setShowSortMenu(false); setShowHideColumns(false); }} className="flex h-6 w-6 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800" title="More board actions">
              <MoreHorizontal size={16} />
            </button>
            {showBoardMoreMenu && (
              <div data-crm-menu className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-gray-200 bg-white p-1.5 shadow-xl">
                <button type="button" onClick={() => { setShowBoardMoreMenu(false); setShowRestoreConfirm(true); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50">
                  <Columns3 size={15} className="text-[#43adc4]" /> Restore default column widths
                </button>
                <button type="button" onClick={() => { setShowBoardMoreMenu(false); setShowRestoreArrangementConfirm(true); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50">
                  <ListRestart size={15} className="text-[#43adc4]" /> Restore default column arrangement
                </button>
                <button type="button" onClick={() => { setShowBoardMoreMenu(false); setShowRestoreSortingConfirm(true); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50">
                  <RotateCcw size={15} className="text-[#43adc4]" /> Restore default column sorting
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1" />
      </div>

      <AlertDialog open={!!customerMatchPending} onOpenChange={(open) => { if (!open && !savingCustomerMatch) setCustomerMatchPending(null); }}>
        <AlertDialogContent className="max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{customerMatchPending?.oldValue ? 'Is this the same customer?' : 'Match this customer profile'}</AlertDialogTitle>
            <AlertDialogDescription>
              {customerMatchPending?.oldValue
                ? <>You changed {customerMatchPending.field === 'phone' ? 'the phone number' : 'the company name'} from <span className="font-semibold text-slate-700">{customerMatchPending.oldValue}</span> to <span className="font-semibold text-slate-700">{customerMatchPending.value}</span>. Choose how this should affect Customer Profiles.</>
                : <>Choose an existing profile for <span className="font-semibold text-slate-700">{customerMatchPending?.value}</span>, or create a new one.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {customerMatchPending && <div className="space-y-3 py-1">
            {customerMatchPending.exactProfile && customerMatchPending.exactProfile.id !== customerMatchPending.linkedProfileId && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">This value already belongs to another profile</p>
              <p className="mt-1 text-xs">The edited {customerMatchPending.field === 'phone' ? 'phone number' : 'company name'} is already used by <span className="font-semibold">{customerMatchPending.exactProfile.name}</span>. Choosing “different customer” will detach this lead from its original profile and link it to that existing profile. It will not create a duplicate.</p>
            </div>}
            {customerMatchPending.exactProfile && customerMatchPending.exactProfile.id === customerMatchPending.linkedProfileId && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">This value already belongs to the customer profile currently linked to this lead.</div>}
            {customerMatchPending.field === 'company' && customerMatchPending.suggestions.length > 0 && <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-700">Similar company profiles</p>
              <div className="space-y-1.5">{customerMatchPending.suggestions.map((suggestion) => <button key={suggestion.id} type="button" disabled={savingCustomerMatch} onClick={() => void commitCustomerMatch(customerMatchPending, 'link', suggestion.id)} className="flex w-full items-center justify-between rounded-md border border-violet-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 hover:border-violet-400 hover:bg-violet-50 disabled:opacity-50"><span>{suggestion.name}</span><span className="text-[11px] font-normal text-violet-600">Use this company</span></button>)}</div>
            </div>}
            {customerMatchPending.oldValue && <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-3">
              <p className="text-sm font-semibold text-sky-900">This is the same customer</p>
              <p className="mt-0.5 text-xs text-sky-700">{customerMatchPending.exactProfile && customerMatchPending.exactProfile.id !== customerMatchPending.linkedProfileId ? 'Unavailable because this value is already owned by another profile. Cancel and reconcile those profiles first if they represent the same customer.' : 'Update the profile rather than detaching this lead.'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {customerMatchPending.field === 'phone' && <button type="button" disabled={savingCustomerMatch || Boolean(customerMatchPending.exactProfile && customerMatchPending.exactProfile.id !== customerMatchPending.linkedProfileId)} onClick={() => void commitCustomerMatch(customerMatchPending, 'same_add')} className="rounded-md border border-sky-300 bg-white px-3 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50">Add as another phone number</button>}
                <button type="button" disabled={savingCustomerMatch || Boolean(customerMatchPending.exactProfile && customerMatchPending.exactProfile.id !== customerMatchPending.linkedProfileId)} onClick={() => void commitCustomerMatch(customerMatchPending, 'same_correct')} className="rounded-md border border-sky-300 bg-white px-3 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50">Correct the existing {customerMatchPending.field === 'phone' ? 'number' : 'company name'}</button>
              </div>
            </div>}
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-800">{customerMatchPending.oldValue ? 'This is a different customer' : 'Create a new profile'}</p>
              <p className="mt-0.5 text-xs text-slate-500">{customerMatchPending.exactProfile ? `The original profile remains unchanged. This lead will be linked to the existing profile for ${customerMatchPending.exactProfile.name}.` : customerMatchPending.oldValue ? 'The original profile remains unchanged and is detached from this lead.' : 'No listed profile represents this customer.'}</p>
              <button type="button" disabled={savingCustomerMatch} onClick={() => void commitCustomerMatch(customerMatchPending, 'different')} className="mt-2 rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50">{savingCustomerMatch ? 'Saving...' : customerMatchPending.exactProfile ? `Link to ${customerMatchPending.exactProfile.name}` : customerMatchPending.oldValue ? 'Use as a different customer' : 'Create new profile'}</button>
            </div>
          </div>}
          <AlertDialogFooter><AlertDialogCancel disabled={savingCustomerMatch}>Cancel edit</AlertDialogCancel></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingDeleteSelected} onOpenChange={setPendingDeleteSelected}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected clients?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedIds.size} selected client{selectedIds.size === 1 ? '' : 's'}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setPendingDeleteSelected(false);
                await deleteSelected();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingDeleteClientId} onOpenChange={(open) => !open && setPendingDeleteClientId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this client?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <span className="font-semibold text-gray-700">{pendingClientToDelete?.name ?? 'this client'}</span> and all of its related data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!pendingDeleteClientId) return;
                const clientId = pendingDeleteClientId;
                setPendingDeleteClientId(null);
                await deleteClient(clientId);
              }}
            >
              Delete client
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingDeleteSelectedSubitems} onOpenChange={(open) => !open && setPendingDeleteSelectedSubitems(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected subitems?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {pendingDeleteSelectedSubitems?.length ?? 0} selected subitems. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const selected = pendingDeleteSelectedSubitems;
                if (!selected) return;
                const hasLockedSubitem = selected.some((subitemId) => {
                  const owner = clients.find((client) => client.subitems.some((subitem) => subitem.id === subitemId));
                  return !owner || !canEditSubitemRecord(owner.id, subitemId);
                });
                if (hasLockedSubitem) { showAssignmentPermissionError(); return; }
                setPendingDeleteSelectedSubitems(null);
                setSelectedSubitemIds((previous) => previous.filter((id) => !selected.includes(id)));
                await Promise.all(selected.map((subitemId) => deleteSubitem('', subitemId)));
              }}
            >
              Delete subitems
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingDeleteSubitem} onOpenChange={(open) => !open && setPendingDeleteSubitem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this subitem?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <span className="font-semibold text-gray-700">{pendingSubitemToDelete?.subitemName ?? 'this subitem'}</span> from <span className="font-semibold text-gray-700">{pendingSubitemToDelete?.clientName ?? 'this client'}</span>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!pendingDeleteSubitem) return;
                const { clientId, subitemId } = pendingDeleteSubitem;
                setPendingDeleteSubitem(null);
                await deleteSubitem(clientId, subitemId);
              }}
            >
              Delete subitem
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRestoreConfirm} onOpenChange={setShowRestoreConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore default column widths?</AlertDialogTitle>
            <AlertDialogDescription>
              Choose which section&apos;s widths to restore. Subitem also includes payment columns.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { setShowRestoreConfirm(false); await handleRestoreDefaults('client'); }}>Client only</AlertDialogAction>
            <AlertDialogAction onClick={async () => { setShowRestoreConfirm(false); await handleRestoreDefaults('subitem'); }}>Subitem only</AlertDialogAction>
            <AlertDialogAction onClick={async () => { setShowRestoreConfirm(false); await handleRestoreDefaults('all'); }}>Restore all</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRestoreArrangementConfirm} onOpenChange={setShowRestoreArrangementConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore default column arrangement?</AlertDialogTitle>
            <AlertDialogDescription>
              Choose which section&apos;s arrangement to restore. Subitem also includes payment columns.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { setShowRestoreArrangementConfirm(false); await handleRestoreDefaultArrangement('client'); }}>Client only</AlertDialogAction>
            <AlertDialogAction onClick={async () => { setShowRestoreArrangementConfirm(false); await handleRestoreDefaultArrangement('subitem'); }}>Subitem only</AlertDialogAction>
            <AlertDialogAction onClick={async () => { setShowRestoreArrangementConfirm(false); await handleRestoreDefaultArrangement('all'); }}>Restore all</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRestoreSortingConfirm} onOpenChange={setShowRestoreSortingConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore default column sorting?</AlertDialogTitle>
            <AlertDialogDescription>
              Choose the section to restore. The board default is clients by Date Created, newest first; subitem and payment rows return to their original order.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowRestoreSortingConfirm(false); if (boardSort.category === 'client') setBoardSort(DEFAULT_BOARD_SORT); notifyChange('Client sorting restored', boardSort.category === 'client' ? 'Clients are sorted by Date Created with the newest at the top.' : 'The active subitem/payment sort was left unchanged.'); }}>Client only</AlertDialogAction>
            <AlertDialogAction onClick={() => { setShowRestoreSortingConfirm(false); if (boardSort.category !== 'client') setBoardSort(DEFAULT_BOARD_SORT); notifyChange('Subitem sorting restored', boardSort.category !== 'client' ? 'Subitem and payment rows use their original order.' : 'The active client sort was left unchanged.'); }}>Subitem only</AlertDialogAction>
            <AlertDialogAction onClick={() => { setShowRestoreSortingConfirm(false); setBoardSort(DEFAULT_BOARD_SORT); notifyChange('Column sorting restored', 'All sorting was restored to the board defaults.'); }}>Restore all</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingCloseLead} onOpenChange={(open) => { if (!open && !savingCloseLead) { setPendingCloseLead(null); setCloseLeadFiles({ purchaseOrder: null, signedQuotation: null, proofOfPayment: null }); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this lead?</AlertDialogTitle>
            <AlertDialogDescription>Provide at least one closing document, or use a signed OCF already associated with this client.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-4 py-2">
            {(() => {
              const closingClient = pendingCloseLead ? clients.find((client) => client.id === pendingCloseLead.clientId) : null;
              if (!closingClient) return null;
              return <>
                {!hasClosingQualifiedSubitem(closingClient) && <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"><strong>Warning:</strong> This lead has no subitem that has been awarded. You may still continue if this is intentional.</div>}
                {!closingClient.email.trim() && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"><strong>Email required:</strong> Fill in the lead’s Email column before it can be closed.</div>}
              </>;
            })()}
            {([['purchaseOrder', 'Purchase order'], ['signedQuotation', 'Signed quotation'], ['proofOfPayment', 'Proof of payment']] as const).map(([key, label]) => <label key={key} className="grid gap-1.5 text-sm font-medium text-slate-700">{label}<input type="file" disabled={savingCloseLead} onChange={(event) => setCloseLeadFiles((current) => ({ ...current, [key]: event.target.files?.[0] ?? null }))} className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-sky-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-sky-700 hover:file:bg-sky-200 disabled:opacity-50" />{closeLeadFiles[key] && <span className="text-xs font-normal text-emerald-700">{closeLeadFiles[key]?.name}</span>}</label>)}
            <div className={`rounded-lg border px-3 py-2 text-sm font-medium ${signedOcfCheck.loading ? 'border-slate-200 bg-slate-50 text-slate-600' : signedOcfCheck.signedAt ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : signedOcfCheck.error ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
              {signedOcfCheck.loading ? 'Checking for signed OCFs…' : signedOcfCheck.signedAt ? <>An OCF has been signed{` (${new Date(signedOcfCheck.signedAt).toLocaleDateString('en-SG')})`}.</> : signedOcfCheck.error ? 'Could not check for signed OCFs. Upload a closing document to continue.' : 'No signed OCFs found for client'}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingCloseLead}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={savingCloseLead || !(closeLeadFiles.purchaseOrder || closeLeadFiles.signedQuotation || closeLeadFiles.proofOfPayment || signedOcfCheck.signedAt) || !clients.find((client) => client.id === pendingCloseLead?.clientId)?.email.trim()} onClick={(event) => { event.preventDefault(); void confirmCloseLead(); }}>{savingCloseLead ? 'Closing…' : 'Confirm close'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex min-w-0 text-gray-500 font-semibold">
        <div style={{ minWidth: totalMinWidth }}>
          <div className="hidden" style={{ minWidth: totalMinWidth }}>
            {visibleClientHeaderCols.map((col) => {
              const fixedKeys = new Set(['selectCheckbox', 'client', 'addClientCol', 'empty']);
              const isDraggable = !fixedKeys.has(col.key);
              const isDragging = draggedHeaderKey === col.key;
              const isDragOver = dragOverHeaderKey === col.key;

              return (
                <div
                  key={col.key}
                  draggable={isDraggable}
                  onDragStart={(e) => {
                    if (!isDraggable) return;
                    e.dataTransfer?.setData('text/plain', col.key);
                    e.dataTransfer?.setData('application/x-crm-client-column', col.key);
                    e.dataTransfer!.effectAllowed = 'move';
                    setDragPreview(e, e.currentTarget, true);
                    setDraggedHeaderKey(col.key);
                  }}
                  onDragOver={(e) => {
                    if (!isDraggable) return;
                    if (!Array.from(e.dataTransfer.types).includes('application/x-crm-client-column')) return;
                    e.preventDefault();
                    setDragOverHeaderKey(col.key);
                    const bounds = e.currentTarget.getBoundingClientRect();
                    setDragOverHeaderEdge(e.clientX < bounds.left + bounds.width / 2 ? 'left' : 'right');
                  }}
                  onDragLeave={() => {
                    if (dragOverHeaderKey === col.key) {
                      setDragOverHeaderKey(null);
                      setDragOverHeaderEdge(null);
                    }
                  }}
                  onDrop={(e) => {
                    if (!Array.from(e.dataTransfer.types).includes('application/x-crm-client-column')) return;
                    e.preventDefault();
                    const draggedKey = e.dataTransfer?.getData('text/plain') || draggedHeaderKey;
                    if (!draggedKey || draggedKey === col.key || !isDraggable) {
                      setDraggedHeaderKey(null);
                      setDragOverHeaderKey(null);
                      setDragOverHeaderEdge(null);
                      return;
                    }

                    reorderClientColumns(draggedKey, col.key);
                    setDraggedHeaderKey(null);
                    setDragOverHeaderKey(null);
                    setDragOverHeaderEdge(null);
                  }}
                  className={`relative flex justify-center items-center border-[#D0D4E4] border-r flex-shrink-0 ${isDragging ? 'opacity-60' : ''} ${isDraggable ? (draggedHeaderKey ? 'cursor-grabbing' : 'cursor-grab') : ''} ${isDragOver && isDraggable ? 'bg-[#dff9ff]' : ''}`}
                  style={{ minWidth: col.width, width: col.width }}
                >
                  {col.key === 'selectCheckbox' ? (
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      disabled={selectedSubitemIds.length > 0}
                      title={selectedSubitemIds.length > 0 ? "Clients and subitems cannot be selected together" : "Select all clients"}
                      className={`w-3 h-3 rounded accent-[#7BCBD5] ${selectedSubitemIds.length > 0 ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
                    />
                  ) : col.key === 'addClientCol' ? (
                    canCreateCustomColumns ? <button
                        type="button"
                        onClick={() => setShowAddColModal('client')}
                        className="mx-auto flex h-5 w-5 items-center justify-center rounded-md text-teal-500 hover:bg-teal-100 hover:text-black"
                        title="Add client column"
                      >
                        <Plus size={14} />
                      </button> : null
                  ) : (
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="truncate">{col.label}</span>
                      {col.isCustom && col.customColumnId ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomColumn(col.customColumnId!)}
                          className="text-gray-400 hover:text-red-500 flex-shrink-0"
                          title="Delete column"
                        >
                          <X size={12} />
                        </button>
                      ) : null}
                    </div>
                  )}
                  {isDragOver && isDraggable && (
                    <div className={`pointer-events-none absolute inset-y-0 z-20 w-1 bg-[#0f8da8] shadow-[0_0_5px_rgba(15,141,168,0.6)] ${dragOverHeaderEdge === 'left' ? 'left-0' : 'right-0'}`} />
                  )}

                  <div
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      startResize(col.key, e.clientX);
                    }}
                    onDragStart={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    className="absolute right-0 top-0 z-40 h-full w-2 cursor-col-resize border-l border-transparent hover:border-[#7BCBD5]"
                  />
                </div>
              );
            })}
          </div>


          {groupedClients.map(({ group, clients: groupClients }) => (
            <React.Fragment key={group.id}>
              {groupDragOverId === group.id && groupDragOverEdge === 'top' && (
                <div className="pointer-events-none h-1 w-full bg-[#0f8da8] shadow-[0_0_5px_rgba(15,141,168,0.6)]" />
              )}

              <div
                draggable
                onDragStart={(event) => handleGroupDragStart(group.id, event)}
                onDragOver={(event) => {
                  if (Array.from(event.dataTransfer.types).includes('application/x-crm-client-row')) handleDragOver(event, group.id, 'top');
                  else handleGroupDragOver(event, group.id, 'top');
                }}
                onDragEnter={(event) => {
                  if (Array.from(event.dataTransfer.types).includes('application/x-crm-client-row')) handleDragOver(event, group.id, 'top');
                  else handleGroupDragEnter(event, group.id, 'top');
                }}
                onDragLeave={(event) => {
                  if (event.currentTarget.contains(event.relatedTarget as Node)) return;
                  if (groupDragOverId === group.id && groupDragOverEdge === 'top') {
                    setGroupDragOverId(null);
                    setGroupDragOverEdge(null);
                  }
                  if (dragOverGroupId === group.id) {
                    setDragOverGroupId(null);
                    setDragOverGroupEdge(null);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (Array.from(event.dataTransfer.types).includes('application/x-crm-client-row')) void handleDrop(group.id);
                  else void handleGroupDrop(group.id, groupDragOverEdge ?? 'top');
                }}
                onDragEnd={handleGroupDragEnd}
                onContextMenu={(event) => { event.preventDefault(); setOpenGroupMenu(group.id); }}
                className={`group relative flex min-h-[58px] cursor-grab items-center gap-3 px-3 py-2 text-sm border-y border-gray-100 bg-gray-50 active:cursor-grabbing ${groupDragOverId === group.id || dragOverGroupId === group.id ? 'ring-2 ring-inset ring-[#0f8da8]/50 bg-sky-50' : ''}`}
              >
                <button
                  type="button"
                  data-crm-menu-trigger
                  onClick={(event) => { event.stopPropagation(); setOpenGroupMenu(openGroupMenu === group.id ? null : group.id); }}
                  onMouseDown={(event) => event.stopPropagation()}
                  className="absolute -left-9 top-1/2 z-30 -translate-y-1/2 rounded bg-white/90 p-1 text-gray-400 opacity-0 shadow-sm transition-opacity hover:text-gray-700 group-hover:opacity-100"
                  title={`Group actions for ${group.name}`}
                >
                  <MoreHorizontal size={14} />
                </button>
                {openGroupMenu === group.id && (
                  <div data-crm-menu className="absolute -left-9 top-full z-[90] mt-1 w-40 rounded-md border border-gray-200 bg-white p-1 text-left shadow-xl">
                    <button
                      type="button"
                      disabled={!['director', 'admin', 'dev'].includes(currentUserRole ?? '') || isDeletingGroup}
                      onClick={() => { setOpenGroupMenu(null); setGroupToDelete(group); }}
                      title={!['director', 'admin', 'dev'].includes(currentUserRole ?? '') ? 'You do not have the necessary permission.' : 'Delete group'}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[10px] font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent"
                    >
                      <Trash2 size={12} /> Delete group
                    </button>
                  </div>
                )}
                <button onClick={() => toggleGroup(group.id)} className="text-base text-gray-500">
                  {collapsedGroups[group.id] ? '▷' : '▼'}
                </button>
                <div className="h-8 w-1.5 rounded bg-[#7BCBD5]" />
                <div>
                  <div className="crm-group-name text-lg leading-6 text-slate-700">{group.name}</div>
                  <div className="text-[13px] italic font-normal text-slate-500">
                    {groupClients.length} {groupClients.length === 1 ? 'Client' : 'Clients'} / {groupClients.reduce((total, client) => total + client.subitems.length, 0)} {groupClients.reduce((total, client) => total + client.subitems.length, 0) === 1 ? 'Subitem' : 'Subitems'}
                  </div>
                </div>
              </div>

              {!collapsedGroups[group.id] && (
                <div data-client-group={group.id} onDragOver={(event) => handleDragOver(event, group.id, 'top')} onDrop={() => handleDrop(group.id)} onDragLeave={() => { setDragOverGroupId(null); setDragOverGroupEdge(null); }} className="relative" style={{ minWidth: totalMinWidth }}>
                  <div className="relative flex text-[12.6px] items-center justify-center min-w-0 flex-shrink-0 border border-[#D0D4E4] overflow-visible bg-white" style={{ minWidth: totalMinWidth, width: totalMinWidth }}>
                    {visibleClientHeaderCols.map((col) => {
                      const fixedKeys = new Set(['selectCheckbox', 'client', 'addClientCol', 'empty']);
                      const isDraggable = !fixedKeys.has(col.key);
                      const isDragging = draggedHeaderKey === col.key;
                      const isDragOver = dragOverHeaderKey === col.key;

                      return (
                        <div
                          key={col.key}
                          draggable={isDraggable}
                          onContextMenu={(event) => {
                            if (['selectCheckbox', 'addClientCol', 'empty'].includes(col.key)) return;
                            event.preventDefault();
                            setOpenColumnMenu(`client:${group.id}:${col.key}`);
                          }}
                          onDragStart={(event) => {
                            if (!isDraggable) return;
                            event.dataTransfer?.setData('text/plain', col.key);
                            event.dataTransfer?.setData('application/x-crm-client-column', col.key);
                            event.dataTransfer!.effectAllowed = 'move';
                            setDragPreview(event, event.currentTarget, true);
                            setDraggedHeaderKey(col.key);
                          }}
                          onDragOver={(event) => {
                            if (!isDraggable || !Array.from(event.dataTransfer.types).includes('application/x-crm-client-column')) return;
                            event.preventDefault();
                            setDragOverHeaderKey(col.key);
                            const bounds = event.currentTarget.getBoundingClientRect();
                            setDragOverHeaderEdge(event.clientX < bounds.left + bounds.width / 2 ? 'left' : 'right');
                          }}
                          onDragLeave={() => {
                            if (dragOverHeaderKey === col.key) {
                              setDragOverHeaderKey(null);
                              setDragOverHeaderEdge(null);
                            }
                          }}
                          onDrop={(event) => {
                            if (!Array.from(event.dataTransfer.types).includes('application/x-crm-client-column')) return;
                            event.preventDefault();
                            const draggedKey = event.dataTransfer?.getData('text/plain') || draggedHeaderKey;
                            if (draggedKey && draggedKey !== col.key && isDraggable) reorderClientColumns(draggedKey, col.key);
                            setDraggedHeaderKey(null);
                            setDragOverHeaderKey(null);
                            setDragOverHeaderEdge(null);
                          }}
                          className={`group relative flex h-7 justify-center items-center overflow-visible border-[#D0D4E4] border-r flex-shrink-0 ${isDragging ? 'opacity-60' : ''} ${isDraggable ? (draggedHeaderKey ? 'cursor-grabbing' : 'cursor-grab') : ''} ${isDragOver && isDraggable ? 'bg-[#dff9ff]' : ''}`}
                          data-highlight-aggregate={col.key === 'totalPrice' || col.key === 'totalMarkup' ? 'true' : undefined}
                          style={{ minWidth: col.width, width: col.width, boxShadow: col.key === 'totalPrice' || col.key === 'totalMarkup' ? 'inset 0 -2px 0 #ef4444' : undefined }}
                        >
                          {col.key === 'selectCheckbox' ? (
                            <input
                              type="checkbox"
                              checked={groupClients.length > 0 && groupClients.every((client) => selectedIds.has(client.id))}
                              onChange={() => toggleSelectGroup(groupClients.map((client) => client.id))}
                              disabled={selectedSubitemIds.length > 0 || groupClients.length === 0}
                              title={selectedSubitemIds.length > 0 ? "Clients and subitems cannot be selected together" : "Select clients in this group"}
                              className={`w-3 h-3 rounded accent-[#7BCBD5] ${selectedSubitemIds.length > 0 || groupClients.length === 0 ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
                            />
                          ) : col.key === 'addClientCol' ? (
                            canCreateCustomColumns ? <button type="button" onClick={() => setShowAddColModal('client')} className="mx-auto flex h-5 w-5 items-center justify-center rounded-md text-teal-500 hover:bg-teal-100 hover:text-black" title="Add client column"><Plus size={14} /></button> : null
                          ) : (
                            <div className="flex items-center gap-1 min-w-0 max-w-full px-1"><span className="truncate">{col.label}</span>{col.isCustom && col.customColumnId ? <button type="button" onClick={() => handleDeleteCustomColumn(col.customColumnId!)} className="text-gray-400 hover:text-red-500 flex-shrink-0" title="Delete column"><X size={12} /></button> : null}</div>
                          )}
                          {!['selectCheckbox', 'addClientCol', 'empty'].includes(col.key) && (
                            <button
                              type="button"
                              data-crm-menu-trigger
                              onClick={(event) => { event.stopPropagation(); setOpenColumnMenu(openColumnMenu === `client:${group.id}:${col.key}` ? null : `client:${group.id}:${col.key}`); }}
                              onMouseDown={(event) => event.stopPropagation()}
                              className="absolute right-0.5 top-0.5 z-30 hidden rounded bg-white/90 p-0.5 text-gray-400 shadow-sm hover:text-gray-700 group-hover:block"
                              title={`Column options for ${col.label}`}
                            >
                              <MoreHorizontal size={12} />
                            </button>
                          )}
                          {openColumnMenu === `client:${group.id}:${col.key}` && (
                            <div data-crm-menu className="absolute left-0 top-full z-[80] mt-1 w-40 rounded-md border border-gray-200 bg-white p-1 text-left shadow-xl">
                              {['people', 'status', 'replyStatus', 'importance', 'channel'].includes(col.key) && <button type="button" onClick={() => { openColumnFilter(col.key === 'people' ? 'people' : `client:${col.key}`); setOpenColumnMenu(null); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[10px] font-medium text-gray-700 hover:bg-gray-50"><Filter size={12} /> Filter</button>}
                              <button type="button" onClick={() => { setBoardSort({ category: 'client', column: col.key, direction: 'asc' }); setOpenColumnMenu(null); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[10px] font-medium text-gray-700 hover:bg-gray-50"><ArrowUp size={12} /> Sort ascending</button>
                              <button type="button" onClick={() => { setBoardSort({ category: 'client', column: col.key, direction: 'desc' }); setOpenColumnMenu(null); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[10px] font-medium text-gray-700 hover:bg-gray-50"><ArrowDown size={12} /> Sort descending</button>
                              <button type="button" onClick={() => hideColumn(`client:${col.key}`)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[10px] font-medium text-gray-700 hover:bg-gray-50">
                                <EyeOff size={12} /> Hide column
                              </button>
                            </div>
                          )}
                          {isDragOver && isDraggable && <div className={`pointer-events-none absolute inset-y-0 z-20 w-1 bg-[#0f8da8] shadow-[0_0_5px_rgba(15,141,168,0.6)] ${dragOverHeaderEdge === 'left' ? 'left-0' : 'right-0'}`} />}
                          <div
                            onMouseDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              startResize(col.key, event.clientX);
                            }}
                            onDragStart={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                            }}
                            className="absolute right-0 top-0 z-40 h-full w-2 cursor-col-resize border-l border-transparent hover:border-[#7BCBD5]"
                          />
                        </div>
                      );
                    })}
                    {dragOverGroupId === group.id && dragOverGroupEdge === 'top' && <div className="pointer-events-none absolute inset-x-0 -bottom-0.5 z-30 h-1 bg-[#0f8da8] shadow-[0_0_5px_rgba(15,141,168,0.6)]" />}
                  </div>
                </div>
              )}

              {!collapsedGroups[group.id] && (
                <div
                  data-client-group-drop-zone={group.id}
                  onDragOver={(event) => handleDragOver(event, group.id, 'top')}
                  onDrop={(event) => { event.preventDefault(); void handleDrop(group.id); }}
                  onDragLeave={(event) => {
                    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
                    setDragOverGroupId(null);
                    setDragOverGroupEdge(null);
                  }}
                  className="relative"
                  style={{ minWidth: totalMinWidth }}
                >
                {groupClients.map((client) => (
                <ClientRow
                  key={client.id}
                  client={client}
                  isBlacklisted={blacklistedPhones.has(normalizeBlacklistPhone(client.phone ?? '')) && Boolean(normalizeBlacklistPhone(client.phone ?? ''))}
                  isExpanded={expandedIdSet.has(client.id)}
                  onToggleExpand={() => setExpandedIds((prev) => prev.includes(client.id) ? prev.filter((id) => id !== client.id) : [...prev, client.id])}
                  onOpenOcfModal={handleOpenOcfModal}
                  onOpenDetail={() => setDetailClientId(client.id)}
                  isSelected={selectedIds.has(client.id)}
                  onToggleSelect={() => toggleSelect(client.id)}
                  onUpdate={(updates) => updateClient(client.id, updates)}
                  onUpdateSubitem={(subitemId, updates) => updateSubitem(client.id, subitemId, updates)}
                  onAddSubitem={(name) => addSubitem(client.id, name)}
                  onDeleteSubitem={(subitemId) => setPendingDeleteSubitem({ clientId: client.id, subitemId })}
                  selectedSubitemIds={selectedSubitemIds}
                  onToggleSubitemSelection={toggleSubitemSelection}
                  onToggleAllSubitems={toggleAllSubitems}
                  onSubitemDragStart={(subitemId, event) => handleSubitemDragStart(subitemId, client.id, event)}
                  onSubitemDragEnd={handleSubitemDragEnd}
                  onSubitemRowDragOver={(event, subitemId) => handleSubitemRowDragOver(event, client.id, subitemId)}
                  onSubitemRowDrop={(event, subitemId) => void handleSubitemRowDrop(event, client.id, subitemId)}
                  subitemDropMarker={subitemDropMarker?.clientId === client.id ? { subitemId: subitemDropMarker.subitemId, edge: subitemDropMarker.edge } : null}
                  onSubitemDragOver={handleSubitemDragOver}
                  onSubitemDrop={handleSubitemDrop}
                  isSubitemDropTarget={dragOverSubitemClientId === client.id && draggedSubitem?.sourceClientId !== client.id}
                  onDelete={() => setPendingDeleteClientId(client.id)}
                  canDelete={canEditClientRecord(client.id)}
                  profiles={profiles}
                  clientAssignedIds={clientAssignees[client.id] ?? []}
                  onChangeClientAssignees={(ids) => handleClientAssigneesChange(client.id, ids)}
                  subitemAssigneeMap={subitemAssignees}
                  onChangeSubitemAssignees={handleSubitemAssigneesChange}
                  colWidth={colWidth}
                  boardWidth={totalMinWidth}
                  columnOrderMap={clientColumnOrderMap}
                  onDragStart={(event) => handleDragStart(client.id, event)}
                  onDragEnd={handleDragEnd}
                  isDragging={draggedClientId === client.id}
                  replyStatusOptions={replyStatusEntries}
                  statusOptions={clientStatusEntries}
                  channelOptions={channelEntries}
                  importanceOptions={importanceEntries}
                  progressOptions={progressEntries}
                  paymentOptions={paymentEntries}
                  paymentStatusOptions={paymentStatusEntries}
                  modeOfPaymentOptions={modeOfPaymentEntries}
                  shipperOptions={shipperEntries}
                  localOverseasOptions={localOverseasEntries}
                  subitemStatusOptions={subitemStatusEntries}
                  currencyOptions={currencyEntries}
                  subitemSubprogressOptions={subitemSubprogressEntries}
                  onAddSubitemSubprogress={handleAddSubitemSubprogress}
                  onDeleteSubitemSubprogress={handleDeleteSubitemSubprogress}
                  onAddCurrency={handleAddCurrency}
                  onDeleteCurrency={handleDeleteCurrency}
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
                  onAddProgress={handleAddProgress}
                  onDeleteProgress={handleDeleteProgress}
                  onAddPayment={handleAddPayment}
                  onDeletePayment={handleDeletePayment}
                  onAddPaymentStatus={handleAddPaymentStatus}
                  onDeletePaymentStatus={handleDeletePaymentStatus}
                  onAddModeOfPayment={handleAddModeOfPayment}
                  onDeleteModeOfPayment={handleDeleteModeOfPayment}
                  clientCustomCols={visibleClientCustomCols}
                  updateClientCustomField={updateClientCustomField}
                  subitemCustomCols={subitemCustomCols}
                  onDeleteCustomColumn={handleDeleteCustomColumn}
                  onRequestAddSubitemCol={() => {
                    if (canCreateCustomColumns) setShowAddColModal('subitem');
                    else toast.error('Only directors and developers can create custom columns.');
                  }}
                  onUpdateOptionColor={updateOptionColor}
                  onRenameOption={renameOptionValue}
                  onFilterColumn={openColumnFilter}
                  onSortColumn={(category, column, direction) => setBoardSort({ category, column, direction })}
                  hiddenColumnKeys={hiddenColumnKeys}
                  onHideColumn={hideColumn}
                  onSetColumnVisibility={setColumnVisibility}
                  currentUserRole={currentUserRole ?? undefined}
                  currentUserId={currentUserId}
                  onUndoActivity={undoActivity}
                  groupNamesById={Object.fromEntries(groups.map((group) => [group.id, group.name]))}
                  groups={groups}
                  onDuplicateClient={() => duplicateClientAction(client.id)}
                  onMoveClient={(groupId) => moveClientAction(client.id, groupId)}
                  subitemMoveTargetGroups={groupedClients.map(({ group, clients: groupClients }) => ({ name: group.name, clients: groupClients.map((target) => ({ id: target.id, name: target.name })) }))}
                  onDuplicateSubitemAction={duplicateSubitemAction}
                  onMoveSubitemAction={moveSubitemAction}
                  onOpenSubitemDetail={(subitemId) => setDetailSubitem({ clientId: client.id, subitemId })}
                />
                ))}
                </div>
              )}

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

              {!collapsedGroups[group.id] && (
                <div
                  onDragOver={(event) => handleGroupDragOver(event, group.id, 'bottom')}
                  onDragEnter={(event) => handleGroupDragEnter(event, group.id, 'bottom')}
                  onDrop={(event) => {
                    event.preventDefault();
                    handleGroupDrop(group.id, 'bottom');
                  }}
                  onDragLeave={() => {
                    if (groupDragOverId === group.id && groupDragOverEdge === 'bottom') {
                      setGroupDragOverId(null);
                      setGroupDragOverEdge(null);
                    }
                  }}
                  className="relative h-1"
                  style={{ minWidth: totalMinWidth }}
                >
                  {groupDragOverId === group.id && groupDragOverEdge === 'bottom' && (
                    <div className="pointer-events-none absolute inset-x-0 -top-0.5 z-30 h-1 bg-[#0f8da8] shadow-[0_0_5px_rgba(15,141,168,0.6)]" />
                  )}
                </div>
              )}

              {collapsedGroups[group.id] && (
                <div
                  onDragOver={(event) => handleGroupDragOver(event, group.id, 'bottom')}
                  onDragEnter={(event) => handleGroupDragEnter(event, group.id, 'bottom')}
                  onDrop={(event) => {
                    event.preventDefault();
                    handleGroupDrop(group.id, 'bottom');
                  }}
                  onDragLeave={() => {
                    if (groupDragOverId === group.id && groupDragOverEdge === 'bottom') {
                      setGroupDragOverId(null);
                      setGroupDragOverEdge(null);
                    }
                  }}
                  className="relative h-1"
                >
                  {groupDragOverId === group.id && groupDragOverEdge === 'bottom' && (
                    <div className="pointer-events-none absolute inset-x-0 -top-0.5 z-30 h-1 bg-[#0f8da8] shadow-[0_0_5px_rgba(15,141,168,0.6)]" />
                  )}
                </div>
              )}

            </React.Fragment>
          ))}
        </div>
      </div>
      <GenerateOcfModal
        open={isOcfModalOpen}
        client={ocfClient}
        onClose={handleCloseOcfModal}
        onSaveFinalArtwork={async (subitemId, file) => {
          if (!ocfClient) return;
          const [artwork] = await uploadCrmFiles([file], `subitems/${subitemId}/ocf-final-artwork`);
          await updateSubitem(ocfClient.id, subitemId, { customFields: { ...(ocfClient.subitems.find((item) => item.id === subitemId)?.customFields ?? {}), ocfFinalArtworkFile: JSON.stringify(artwork) } });
        }}
        onCreated={({ internalUrl }) => { void reloadClients(); window.open(internalUrl, "_blank", "noopener,noreferrer"); }}
      />
      <OcfChooserModal open={isOcfChooserOpen} client={ocfClient} canGenerate={String(currentUserRole ?? '').trim().toLowerCase() !== 'pm'} onClose={() => { setIsOcfChooserOpen(false); setOcfClient(null); }} onView={() => { if (!ocfClient) return; setIsOcfChooserOpen(false); setDetailClientInitialTab("files"); setDetailClientId(ocfClient.id); setOcfClient(null); }} onGenerate={() => { setIsOcfChooserOpen(false); setIsOcfModalOpen(true); }} />
      {showAddColModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30">
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-2xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">
              Add {showAddColModal} column
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 font-medium">Column name</label>
                <input
                  autoFocus
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustomColumn(); }}
                  placeholder="e.g. Contract Value"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#7BCBD5] focus:ring-2 focus:ring-[#7BCBD5]/20"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Type</label>
                <select
                  value={newColType}
                  onChange={(e) => setNewColType(e.target.value as 'text' | 'number' | 'date')}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#7BCBD5]"
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => { setShowAddColModal(null); setNewColName(''); }}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustomColumn}
                disabled={isAddingCol || !newColName.trim()}
                className="rounded-xl bg-[#7BCBD5] px-4 py-2 text-sm font-medium text-white hover:bg-[#6bc0ca] disabled:opacity-50"
              >
                {isAddingCol ? 'Adding...' : 'Add Column'}
              </button>
            </div>
          </div>
        </div>
      )}
      {pendingDeleteCustomColumn && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/30 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">Delete custom column?</h2>
              <p className="mt-2 text-xs leading-5 text-gray-500">
                <span className="font-semibold text-gray-700">{pendingDeleteCustomColumn.name}</span> is a shared {pendingDeleteCustomColumn.target} column. Deleting it will remove the column from the CRM Board for every user.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4">
              <button type="button" disabled={isDeletingCustomColumn} onClick={() => setPendingDeleteCustomColumn(null)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">Cancel</button>
              <button type="button" disabled={isDeletingCustomColumn} onClick={() => void confirmDeleteCustomColumn()} className="rounded-xl bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50">{isDeletingCustomColumn ? 'Deleting...' : 'Delete column'}</button>
            </div>
          </div>
        </div>
      )}
      <ClientsLiveRefresh />
    </div>
  );
}
