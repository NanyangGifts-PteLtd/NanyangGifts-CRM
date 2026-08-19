"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, Plus, Trash2, Filter, ChevronsDown, ChevronsUp, X, MoreHorizontal, EyeOff } from 'lucide-react';
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
import { createClientRow, updateClientRow, deleteClientRow, createSubitemRow, updateSubitemRow, deleteSubitemRow } from '@/lib/crm';
import { fetchClientAssigneeMap } from '@/lib/assignments';
import { GenerateOcfModal } from './Generate-OCF-Modal';
import { AddGroupModal } from './Add-Group-Modal';
import { fetchCustomColumns, addCustomColumn, deleteCustomColumn, type CustomColumn } from '@/lib/custom-columns'
import ClientsLiveRefresh from './RealtimeRefresh';
import { toast } from 'sonner';
import type { SearchResult } from '../app/types';

type OptionEntry = { value: string; color: string };
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
  { key: 'logoRequirementsFile', label: 'Logo/Requirements File', width: 150, minWidth: 7 },
  { key: 'filesMiscellaneous', label: 'Files (Miscellaneous)', width: 170, minWidth: 7 },
  { key: 'totalPrice', label: 'Total Price', width: 80, minWidth: 7 },
  { key: 'totalMarkup', label: 'Total Markup', width: 90, minWidth: 7 },
  { key: 'companyAddress', label: 'Company Address', width: 115, minWidth: 7 },
  { key: 'billingAddress', label: 'Billing Address', width: 115, minWidth: 7 },
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
}: CRMBoardProps) {

  const [filterStatus, setFilterStatus] = useState<string | 'All'>('All');
  const [showFilter, setShowFilter] = useState(false);
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [archivedGroupIds, setArchivedGroupIds] = useState<Set<string>>(new Set());
  const [openGroupMenu, setOpenGroupMenu] = useState<string | null>(null);
  const archivedGroupsLoadedFor = useRef<string | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const [ocfClient, setOcfClient] = useState<Client | null>(null);
  const [isOcfModalOpen, setIsOcfModalOpen] = useState(false);
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [pendingDeleteClientId, setPendingDeleteClientId] = useState<string | null>(null);
  const [pendingDeleteSubitem, setPendingDeleteSubitem] = useState<{ clientId: string; subitemId: string } | null>(null);
  const [pendingDeleteSelected, setPendingDeleteSelected] = useState(false);

  const [replyStatusEntries, setReplyStatusEntries] = useState<OptionEntry[]>([]);
  const [clientStatusEntries, setClientStatusEntries] = useState<OptionEntry[]>([]);
  const [channelEntries, setChannelEntries] = useState<OptionEntry[]>([]);
  const [importanceEntries, setImportanceEntries] = useState<OptionEntry[]>([]);
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
  const replyStatusColors = Object.fromEntries(replyStatusEntries.map((e) => [e.value, e.color]));
  const channelColors = Object.fromEntries(channelEntries.map((e) => [e.value, e.color]));

  const [groups, setGroups] = useState<CRMGroup[]>([]);
  const [groupToDelete, setGroupToDelete] = useState<CRMGroup | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [draggedClientId, setDraggedClientId] = useState<string | null>(null);
  const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [dragOverGroupEdge, setDragOverGroupEdge] = useState<'top' | 'bottom' | null>(null);
  const [groupDragOverId, setGroupDragOverId] = useState<string | null>(null);
  const [groupDragOverEdge, setGroupDragOverEdge] = useState<'top' | 'bottom' | null>(null);

  const [headerCols, setHeaderCols] = useState<HeaderCol[]>(CLIENT_HEADER_COLS);
  const [draggedHeaderKey, setDraggedHeaderKey] = useState<string | null>(null);
  const [dragOverHeaderKey, setDragOverHeaderKey] = useState<string | null>(null);
  const [dragOverHeaderEdge, setDragOverHeaderEdge] = useState<'left' | 'right' | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showRestoreArrangementConfirm, setShowRestoreArrangementConfirm] = useState(false);
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<Set<string>>(new Set());
  const [openColumnMenu, setOpenColumnMenu] = useState<string | null>(null);
  const [showHideColumns, setShowHideColumns] = useState(false);

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

  const archiveGroup = useCallback((groupId: string) => {
    setArchivedGroupIds((previous) => new Set(previous).add(groupId));
    setOpenGroupMenu(null);
    notifyChange('Group archived', 'The group is now collapsed for your account.');
  }, [notifyChange]);

  const unarchiveGroup = useCallback((groupId: string) => {
    setArchivedGroupIds((previous) => {
      const next = new Set(previous);
      next.delete(groupId);
      return next;
    });
    setOpenGroupMenu(null);
    notifyChange('Group unarchived', 'The group will remain available in your board.');
  }, [notifyChange]);
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
    if (!currentUserId) {
      archivedGroupsLoadedFor.current = null;
      setArchivedGroupIds(new Set());
      return;
    }

    let mounted = true;
    archivedGroupsLoadedFor.current = null;
    (async () => {
      try {
        const { loadUserSetting } = await import('@/lib/user-settings');
        const value = await loadUserSetting('archivedGroups');
        if (!mounted) return;
        const ids = Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
        setArchivedGroupIds(new Set(ids));
        setCollapsedGroups((previous) => ids.reduce((next, id) => ({ ...next, [id]: true }), previous));
        archivedGroupsLoadedFor.current = currentUserId;
      } catch (error) {
        console.warn('Failed to load archived groups', error);
        if (mounted) archivedGroupsLoadedFor.current = currentUserId;
      }
    })();

    return () => { mounted = false; };
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId || archivedGroupsLoadedFor.current !== currentUserId) return;
    const ids = Array.from(archivedGroupIds);
    void import('@/lib/user-settings')
      .then(({ saveUserSetting }) => saveUserSetting('archivedGroups', ids))
      .catch((error) => console.warn('Failed to save archived groups', error));
  }, [archivedGroupIds, currentUserId]);

  useEffect(() => {
    if (!currentUserId || hiddenSettingsLoadedFor.current !== currentUserId) return;
    const keys = Array.from(hiddenColumnKeys);
    try { localStorage.setItem(`colHidden:${currentUserId}`, JSON.stringify(keys)); } catch {}
    void import('@/lib/user-settings')
      .then(({ saveUserSetting }) => saveUserSetting('colHidden', keys))
      .catch((error) => console.warn('Failed to save hidden columns', error));
  }, [hiddenColumnKeys, currentUserId]);

  const reorderClientColumns = useCallback((draggedKey: string, targetKey: string) => {
    const baseCols = headerCols.filter((c) => !['selectCheckbox', 'client', 'addClientCol', 'empty'].includes(c.key));
    const from = baseCols.findIndex((c) => c.key === draggedKey);
    const to = baseCols.findIndex((c) => c.key === targetKey);
    if (from === -1 || to === -1) return;

    const reordered = [...baseCols];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);

    const fixedFront = headerCols.filter((c) => ['selectCheckbox', 'client'].includes(c.key));
    const fixedEnd = headerCols.filter((c) => ['addClientCol', 'empty'].includes(c.key));
    const next = [...fixedFront, ...reordered, ...fixedEnd];
    setHeaderCols(next);

    try {
      const order = next.map((c) => c.key);
      localStorage.setItem('colOrder:clients:local', JSON.stringify(order));
      localStorage.setItem('colOrder:clients:local_owner', String(currentUserId ?? 'anon'));
      if (currentUserId) localStorage.setItem(`colOrder:clients:${currentUserId}`, JSON.stringify(order));
      window.dispatchEvent(new CustomEvent('clientColsReordered', { detail: order }));
    } catch {}

    if (currentUserId) {
      void import('@/lib/user-settings')
        .then(({ saveUserSetting }) => saveUserSetting('colOrder:clients', next.map((c) => c.key)))
        .catch((error) => console.warn('Failed to save client column arrangement', error));
    }
    notifyChange('Column arrangement saved', 'The client column order was saved to your account.');
  }, [headerCols, currentUserId, notifyChange]);

  const setDragPreview = (event: React.DragEvent, source: HTMLElement, includeColumnCells = false) => {
    if (!event.dataTransfer) return;
    const bounds = source.getBoundingClientRect();
    const preview = includeColumnCells ? document.createElement('div') : source.cloneNode(true) as HTMLElement;
    preview.style.position = 'fixed';
    preview.style.left = '-10000px';
    preview.style.top = '-10000px';
    preview.style.width = `${bounds.width}px`;
    preview.style.maxWidth = `${bounds.width}px`;
    preview.style.height = includeColumnCells ? `${bounds.height + 56}px` : `${bounds.height}px`;
    preview.style.opacity = '1';
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

  const handleRestoreDefaults = useCallback(async () => {
    // restore client header widths to defaults
    setHeaderCols((prev) => prev.map((c) => {
      const def = CLIENT_HEADER_COLS.find((d) => d.key === c.key);
      return { ...c, width: def?.width ?? c.width };
    }));

    // prepare maps
    const clientMap = Object.fromEntries(CLIENT_HEADER_COLS.map((c) => [c.key, c.width]));
    const subitemMap = Object.fromEntries(SUBITEM_COLS.map((c) => [c.key, c.width]));
    const paymentMap = Object.fromEntries(PAYMENT_COLS.map((c) => [c.key, c.width]));

    // write local caches
    try { localStorage.setItem('colWidths:clients:local', JSON.stringify(clientMap)); } catch {}
    try { localStorage.setItem('colWidths:subitems:local', JSON.stringify(subitemMap)); } catch {}
    try { localStorage.setItem('colWidths:payments:local', JSON.stringify(paymentMap)); } catch {}
    try { localStorage.setItem('colWidths:clients:local_owner', String(currentUserId ?? 'anon')); } catch {}
    try { localStorage.setItem('colWidths:subitems:local_owner', String(currentUserId ?? 'anon')); } catch {}
    try { localStorage.setItem('colWidths:payments:local_owner', String(currentUserId ?? 'anon')); } catch {}
    if (currentUserId) {
      try { localStorage.setItem(`colWidths:clients:${currentUserId}`, JSON.stringify(clientMap)); } catch {}
      try { localStorage.setItem(`colWidths:subitems:${currentUserId}`, JSON.stringify(subitemMap)); } catch {}
      try { localStorage.setItem(`colWidths:payments:${currentUserId}`, JSON.stringify(paymentMap)); } catch {}
    }

    // notify subitems/payment instances to reset
    try {
      window.dispatchEvent(new CustomEvent('subitemColsChanged', { detail: subitemMap }));
      window.dispatchEvent(new CustomEvent('paymentColsChanged', { detail: paymentMap }));
    } catch (e) {
      // ignore
    }

    // persist to server if authenticated
    if (currentUserId) {
      try {
        const { saveUserSetting } = await import('@/lib/user-settings');
        await Promise.all([
          saveUserSetting('colWidths:clients', clientMap),
          saveUserSetting('colWidths:subitems', subitemMap),
          saveUserSetting('colWidths:payments', paymentMap),
        ]);
      } catch (e) {
        console.warn('Failed to persist restored default column widths', e);
      }
    }
    notifyChange('Column widths restored', 'Client, subitem, and payment widths were reset to their defaults.');
  }, [currentUserId, notifyChange]);

  const handleRestoreDefaultArrangement = useCallback(async () => {
    const clientOrder = CLIENT_HEADER_COLS.map((col) => col.key);
    const subitemOrder = SUBITEM_COLS.map((col) => col.key);
    const paymentOrder = PAYMENT_COLS.map((col) => col.key);

    setHeaderCols(CLIENT_HEADER_COLS.map((col) => ({ ...col })));

    try {
      localStorage.setItem('colOrder:clients:local', JSON.stringify(clientOrder));
      localStorage.setItem('colOrder:subitems:local', JSON.stringify(subitemOrder));
      localStorage.setItem('colOrder:payments:local', JSON.stringify(paymentOrder));
      localStorage.setItem('colOrder:clients:local_owner', String(currentUserId ?? 'anon'));
      localStorage.setItem('colOrder:subitems:local_owner', String(currentUserId ?? 'anon'));
      localStorage.setItem('colOrder:payments:local_owner', String(currentUserId ?? 'anon'));
      if (currentUserId) {
        localStorage.setItem(`colOrder:clients:${currentUserId}`, JSON.stringify(clientOrder));
        localStorage.setItem(`colOrder:subitems:${currentUserId}`, JSON.stringify(subitemOrder));
        localStorage.setItem(`colOrder:payments:${currentUserId}`, JSON.stringify(paymentOrder));
      }
      window.dispatchEvent(new CustomEvent('subitemColsReordered', { detail: subitemOrder }));
      window.dispatchEvent(new CustomEvent('paymentColsReordered', { detail: paymentOrder }));
      window.dispatchEvent(new CustomEvent('clientColsReordered', { detail: clientOrder }));
    } catch {}

    if (currentUserId) {
      try {
        const { saveUserSetting } = await import('@/lib/user-settings');
        await Promise.all([
          saveUserSetting('colOrder:clients', clientOrder),
          saveUserSetting('colOrder:subitems', subitemOrder),
          saveUserSetting('colOrder:payments', paymentOrder),
        ]);
      } catch (error) {
        console.warn('Failed to persist restored default column arrangement', error);
      }
    }
    notifyChange('Column arrangement restored', 'Client, subitem, and payment columns were reset to their defaults.');
  }, [currentUserId, notifyChange]);

  // User custom columns
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [showAddColModal, setShowAddColModal] = useState<'client' | 'subitem' | null>(null);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState<'text' | 'number' | 'date'>('text');
  const [isAddingCol, setIsAddingCol] = useState(false);

  const clientCustomCols = customColumns.filter((c) => c.target === 'client');
  const subitemCustomCols = customColumns.filter((c) => c.target === 'subitem');

  const clientColumnOrderMap = React.useMemo<Record<string, number>>(() => {
    return Object.fromEntries(headerCols.map((col, index) => [col.key, index]));
  }, [headerCols]);

  const mergedHeaderCols = React.useMemo<HeaderCol[]>(() => {
    const customClientHeaderCols: HeaderCol[] = clientCustomCols.map((col) => ({
      key: `custom:${col.id}`,
      label: col.name,
      width: 120,
      minWidth: 80,
      customColumnId: col.id,
      isCustom: true,
      field_type: col.field_type,
    }));

    const addClientColHeader = headerCols.find((c) => c.key === 'addClientCol');
    const emptyHeader = headerCols.find((c) => c.key === 'empty');

    return [
      ...headerCols.filter((c) => c.key !== 'addClientCol' && c.key !== 'empty'),
      ...customClientHeaderCols,
      ...(addClientColHeader ? [addClientColHeader] : []),
      ...(emptyHeader ? [emptyHeader] : []),
    ];
  }, [headerCols, clientCustomCols]);

  const visibleClientHeaderCols = React.useMemo(
    () => mergedHeaderCols.filter((col) => !hiddenColumnKeys.has(`client:${col.key}`) || ['selectCheckbox', 'client', 'addClientCol', 'empty'].includes(col.key)),
    [mergedHeaderCols, hiddenColumnKeys],
  );

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
          setHeaderCols((prev) => prev.map((c) => ({ ...c, width: c.key === 'empty' ? 44 : value[c.key] ?? c.width })));
          return;
        }

        // fallback: try localStorage
        try {
          const raw = localStorage.getItem(`colWidths:clients:${currentUserId}`);
          if (raw) {
            const map = JSON.parse(raw) as Record<string, number>;
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
        setReplyStatusEntries(replyOpts);
        setClientStatusEntries(statusOpts);
        setChannelEntries(channelOpts);
        setImportanceEntries(importanceOpts);
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
      notifyChange('Group added', `${trimmed} is now available on the board.`);
    } catch (error) {
      console.error('Failed to add group', error);
      toast.error('Group could not be added', { description: error instanceof Error ? error.message : 'The group was not saved.' });
    }
  }, [groups, currentUserId, notifyChange]);

  const handleDeleteGroup = useCallback(async () => {
    if (!groupToDelete) return;
    if (currentUserRole !== 'director' && currentUserRole !== 'dev') {
      toast.error('Group deletion is restricted', { description: 'Only directors and dev users can delete groups.' });
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
  }, [newColName, newColType, showAddColModal, customColumns]);

  const handleDeleteCustomColumn = useCallback(async (id: string) => {
    try {
      await deleteCustomColumn(id);
      setCustomColumns((prev) => prev.filter((c) => c.id !== id));

      const updatedClients = clients.map((client) => {
        const next = { ...(client.customFields ?? {}) };
        delete next[id];
        return { ...client, customFields: next };
      });

      setClients(updatedClients);

      await Promise.all(
        updatedClients.map((client) =>
          updateClientRow(client.id, { customFields: client.customFields ?? {} })
        )
      );
    } catch (e) {
      console.error('Failed to delete column', e);
    }
  }, [clients, setClients]);

  // --- Resize ---
  const startResize = (key: string, startX: number) => {
    const startCol = mergedHeaderCols.find((col) => col.key === key);
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
      notifyChange('Column width saved', `The ${key} column width was saved.`);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // --- OCF ---
  function handleOpenOcfModal(client: Client) { setOcfClient(client); setIsOcfModalOpen(true); }
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

  const handleGroupDragStart = useCallback((groupId: string, event: React.DragEvent) => {
    event.dataTransfer?.setData('text/plain', groupId);
    event.dataTransfer?.setData('application/x-crm-group-row', groupId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
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

    return matchesStatus && matchesSubitemStatus && matchesPayment && matchesPaymentStatus && matchesPeople && matchesImportance && matchesReplyStatus && matchesChannel && matchesSubprogress;
  });

  const groupedClients = groups.map((group) => ({
    group,
    clients: displayedClients.filter((c) => c.groupId === group.id),
  }));

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
  ].filter((value) => value !== 'All').length;

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

  const updateClient = useCallback(async (clientId: string, updates: Partial<Client>) => {
    let nextUpdates = { ...updates };
    let movedToGroupName: string | null = null;
    if (updates.status) {
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
      if (movedToGroupName && updates.status) {
        const previousClient = clients.find((client) => client.id === clientId);
        const clientName = previousClient?.name || 'Client';
        const statusToastId = toast.success(`${clientName} moved to ${movedToGroupName}`, {
          description: `Status changed to ${updates.status}.`,
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
  }, [clients, groups, setClients]);

  const updateSubitem = useCallback(async (_clientId: string, subitemId: string, updates: Partial<Subitem>) => {
    setClients((prev) => prev.map((c) => ({
      ...c, subitems: c.subitems.map((s) => s.id === subitemId ? { ...s, ...updates } : s),
    })));
    try { await updateSubitemRow(subitemId, updates); }
    catch (error: any) { setClients(clients); console.error('Failed to update subitem', error); }
  }, [clients]);

  const undoActivity = useCallback(async (entry: import('../app/types').ActivityEntry) => {
    if (entry.action === 'field_changed') {
      const fieldMap: Record<string, keyof Client> = {
        replyStatus: 'replyStatus', followUp: 'followUp', status: 'status', channel: 'channel',
        importance: 'importance', name: 'name', people: 'people', company: 'company', email: 'email',
        phone: 'phone', requirements: 'requirements', nbd: 'nbd', totalPrice: 'totalPrice',
        companyAddress: 'companyAddress', billingAddress: 'billingAddress',
      };
      const field = entry.fieldName ? fieldMap[entry.fieldName] : undefined;
      if (!field || !entry.clientId) return;
      const updates = { [field]: entry.oldValue } as Partial<Client>;
      await updateClient(entry.clientId, updates);
      toast.success('Change undone', { description: `${entry.fieldName} was restored to its previous value.` });
      return;
    }

    if (entry.action === 'subitem_field_changed' && entry.subitemId && entry.fieldName && !entry.fieldName.startsWith('timeline:')) {
      const updates = { [entry.fieldName]: entry.oldValue } as Partial<Subitem>;
      setClients((previous) => previous.map((client) => ({
        ...client,
        subitems: client.subitems.map((subitem) => subitem.id === entry.subitemId ? { ...subitem, ...updates } : subitem),
      })));
      await updateSubitemRow(entry.subitemId, updates);
      toast.success('Change undone', { description: `${entry.fieldName} was restored to its previous value.` });
    }
  }, [updateClient, setClients]);

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
        createdAt: createdClient.created_at ?? '', expanded: createdClient.expanded ?? true,
        color: createdClient.color ?? '#7BCBD5', subitems: [], activityLog: [], customFields: {}
      };
      setClients((prev) => [newClient, ...prev]);
      setExpandedIds((prev) => [...prev, newClient.id]);
      notifyChange('Client added', `${newClient.name} was added to the board.`);
      fetchClientAssigneeMap()
        .then((m) => setClientAssignees(m))
        .catch((e) => console.error('Failed to refresh assignees', e));
    } catch (error: any) { console.error('Failed to add client', error); toast.error('Client could not be added', { description: error?.message || 'The client was not saved.' }); }
  }, [currentUserId, groups, setClients, setExpandedIds, notifyChange]);

  const deleteClient = useCallback(async (clientId: string) => {
    setClients((prev) => prev.filter((c) => c.id !== clientId));
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(clientId); return next; });
    try { await deleteClientRow(clientId); notifyChange('Client deleted', 'The client and its related records were removed.'); }
    catch (error: any) { setClients(clients); console.error('Failed to delete client', error); toast.error('Client could not be deleted', { description: error?.message || 'The client was not deleted.' }); }
  }, [clients, setClients, notifyChange]);

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
    setClients((prev) => prev.filter((c) => !selectedIds.has(c.id)));
    setSelectedIds(new Set());
    try { await Promise.all(ids.map((id) => deleteClientRow(id))); notifyChange('Clients deleted', `${ids.length} selected client${ids.length === 1 ? '' : 's'} were removed.`); }
    catch (error: any) { setClients(clients); console.error('Failed to delete selected', error); toast.error('Selected clients could not be deleted', { description: error?.message || 'The selected clients were not deleted.' }); }
  }, [selectedIds, clients, setClients, notifyChange]);

  const addSubitem = useCallback(async (clientId: string) => {
      try { await createSubitemRow(clientId); await reloadClients(); notifyChange('Subitem added', 'The new subitem is now available under the client.'); }
    catch (error: any) { console.error('Failed to add subitem', error); toast.error('Subitem could not be added', { description: error?.message || 'The subitem was not saved.' }); }
  }, [reloadClients, notifyChange]);

  const deleteSubitem = useCallback(async (_clientId: string, subitemId: string) => {
    setClients((prev) => prev.map((c) => ({ ...c, subitems: c.subitems.filter((s) => s.id !== subitemId) })));
    try { await deleteSubitemRow(subitemId); notifyChange('Subitem deleted', 'The subitem was removed.'); }
    catch (error: any) { setClients(clients); console.error('Failed to delete subitem', error); toast.error('Subitem could not be deleted', { description: error?.message || 'The subitem was not deleted.' }); }
  }, [clients, setClients, notifyChange]);

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center gap-2 px-2 py-1 border-b border-gray-200 bg-white flex-shrink-0">
        <button onClick={addClient} className="flex items-center gap-1 px-2 py-1 bg-[#43adc4] hover:bg-[#0f8da8] text-white rounded-md text-[10px] font-medium transition-colors transition transform active:scale-95 duration-150">
          <Plus size={12} /> Add Client
        </button>
        <button onClick={() => setShowAddGroupModal(true)} className="flex items-center gap-1 px-2 py-1 bg-[#43adc4] hover:bg-[#0f8da8] text-white rounded-md text-[10px] font-medium transition-colors transition transform active:scale-95 duration-150">
          <Plus size={12} /> Add Group
        </button>
        <AddGroupModal open={showAddGroupModal} onClose={() => setShowAddGroupModal(false)} onSubmit={handleAddGroup} />

        <button onClick={toggleExpandAll} className="flex items-center gap-1 px-2 py-1 bg-[#43adc4] hover:bg-[#0f8da8] text-white rounded-md text-[10px] font-medium transition-colors transition transform active:scale-95 duration-150">
          {allExpanded ? <ChevronsUp size={12} /> : <ChevronsDown size={12} />}
          {allExpanded ? 'Collapse All' : 'Expand All'}
        </button>

        <div ref={filterRef} className="relative">
          <button onClick={() => { setFocusedFilterColumn(null); setShowFilter(!showFilter); }} className="flex items-center gap-1 px-2 py-1 bg-[#43adc4] hover:bg-[#0f8da8] text-white rounded-md text-[10px] font-medium transition-colors transition transform active:scale-95 duration-150">
            <Filter size={12} />
            Filter
            {activeFilterCount > 0 && <span className="rounded-full bg-white/25 px-1.5">{activeFilterCount}</span>}
            <ChevronDown size={11} />
          </button>
          {showFilter && (
            <div className="absolute top-full left-0 mt-1 w-[min(680px,calc(100vw-1rem))] bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-3">
              <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-2">
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

              <div className="flex gap-3 overflow-x-auto pb-1">
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
            </div>
          )}
        </div>

        <div className="relative">
          <button onClick={() => setShowHideColumns((open) => !open)} className="flex items-center gap-1 px-2 py-1 bg-[#43adc4] hover:bg-[#0f8da8] text-white rounded-md text-[10px] font-medium transition-colors transform active:scale-95 duration-150">
            <EyeOff size={12} /> Hide
            {hiddenColumnKeys.size > 0 && <span className="rounded-full bg-white/25 px-1.5">{hiddenColumnKeys.size}</span>}
            <ChevronDown size={11} />
          </button>
          {showHideColumns && (
            <div className="absolute top-full left-0 mt-1 w-64 max-h-[min(520px,calc(100vh-5rem))] overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-xl z-50">
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

        <button onClick={() => setShowRestoreConfirm(true)} className="flex items-center gap-1 px-2 py-1 bg-[#43adc4] hover:bg-[#0f8da8] text-white rounded-md text-[10px] font-medium transition-colors transform active:scale-95 duration-150">
          Restore default column widths
        </button>
        <button onClick={() => setShowRestoreArrangementConfirm(true)} className="flex items-center gap-1 px-2 py-1 bg-[#43adc4] hover:bg-[#0f8da8] text-white rounded-md text-[10px] font-medium transition-colors transform active:scale-95 duration-150">
          Restore default column arrangement
        </button>

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
            <button onClick={() => setPendingDeleteSelected(true)} className="flex items-center gap-1 text-[10px] text-red-600 hover:text-red-800 font-semibold transition-colors">
              <Trash2 size={12} /> Delete
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={13} />
            </button>
          </div>
        )}
      </div>

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
              This will reset client, subitem, and payment column widths to their default values. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { setShowRestoreConfirm(false); await handleRestoreDefaults(); }}>
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRestoreArrangementConfirm} onOpenChange={setShowRestoreArrangementConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore default column arrangement?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset the client, subitem, and payment columns to their default order. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { setShowRestoreArrangementConfirm(false); await handleRestoreDefaultArrangement(); }}>
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex min-w-0 text-gray-500 font-semibold">
        <div style={{ minWidth: totalMinWidth }}>
          <div className="hidden" style={{ minWidth: totalMinWidth }}>
            {visibleClientHeaderCols.map((col) => {
              const fixedKeys = new Set(['selectCheckbox', 'client', 'addClientCol', 'empty']);
              const isDraggable = !col.isCustom && !fixedKeys.has(col.key);
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
                      className="w-3 h-3 rounded cursor-pointer accent-[#7BCBD5]"
                    />
                  ) : col.key === 'addClientCol' ? (
                    <button
                      type="button"
                      onClick={() => setShowAddColModal('client')}
                      className="mx-auto flex h-5 w-5 items-center justify-center rounded-md text-teal-500 hover:bg-teal-100 hover:text-black"
                      title="Add client column"
                    >
                      <Plus size={14} />
                    </button>
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
                onDragOver={(event) => handleGroupDragOver(event, group.id, 'top')}
                onDragEnter={(event) => handleGroupDragEnter(event, group.id, 'top')}
                onDragLeave={() => {
                  if (groupDragOverId === group.id && groupDragOverEdge === 'top') {
                    setGroupDragOverId(null);
                    setGroupDragOverEdge(null);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleGroupDrop(group.id, groupDragOverEdge ?? 'top');
                }}
                onDragEnd={handleGroupDragEnd}
                className={`group relative flex cursor-grab items-center gap-2.5 px-2 py-1 text-sm border-y border-gray-100 bg-gray-50 active:cursor-grabbing ${groupDragOverId === group.id ? 'ring-1 ring-[#0f8da8]/40' : ''}`}
              >
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); setOpenGroupMenu(openGroupMenu === group.id ? null : group.id); }}
                  onMouseDown={(event) => event.stopPropagation()}
                  className="absolute -left-9 top-1/2 z-30 -translate-y-1/2 rounded bg-white/90 p-1 text-gray-400 opacity-0 shadow-sm transition-opacity hover:text-gray-700 group-hover:opacity-100"
                  title={`Group actions for ${group.name}`}
                >
                  <MoreHorizontal size={14} />
                </button>
                {openGroupMenu === group.id && (
                  <div className="absolute -left-9 top-full z-[90] mt-1 w-40 rounded-md border border-gray-200 bg-white p-1 text-left shadow-xl">
                    {archivedGroupIds.has(group.id) ? (
                      <button type="button" onClick={() => unarchiveGroup(group.id)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[10px] font-medium text-gray-700 hover:bg-gray-50">
                        Unarchive group
                      </button>
                    ) : (
                      <button type="button" onClick={() => archiveGroup(group.id)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[10px] font-medium text-gray-700 hover:bg-gray-50">
                        Archive group
                      </button>
                    )}
                  </div>
                )}
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

              {!collapsedGroups[group.id] && (
                <div data-client-group={group.id} onDragOver={(event) => handleDragOver(event, group.id, 'top')} onDrop={() => handleDrop(group.id)} onDragLeave={() => { setDragOverGroupId(null); setDragOverGroupEdge(null); }} className="relative" style={{ minWidth: totalMinWidth }}>
                  <div className="relative flex text-[12.6px] items-center justify-center min-w-0 flex-shrink-0 border border-[#D0D4E4] overflow-visible bg-gradient-to-r from-[#e7fdff] to-[#a3dfff]" style={{ minWidth: totalMinWidth, width: totalMinWidth }}>
                    {visibleClientHeaderCols.map((col) => {
                      const fixedKeys = new Set(['selectCheckbox', 'client', 'addClientCol', 'empty']);
                      const isDraggable = !col.isCustom && !fixedKeys.has(col.key);
                      const isDragging = draggedHeaderKey === col.key;
                      const isDragOver = dragOverHeaderKey === col.key;

                      return (
                        <div
                          key={col.key}
                          draggable={isDraggable}
                          onContextMenu={(event) => {
                            if (['selectCheckbox', 'client', 'addClientCol', 'empty'].includes(col.key)) return;
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
                            <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} className="w-3 h-3 rounded cursor-pointer accent-[#7BCBD5]" />
                          ) : col.key === 'addClientCol' ? (
                            <button type="button" onClick={() => setShowAddColModal('client')} className="mx-auto flex h-5 w-5 items-center justify-center rounded-md text-teal-500 hover:bg-teal-100 hover:text-black" title="Add client column"><Plus size={14} /></button>
                          ) : (
                            <div className="flex items-center gap-1 min-w-0 max-w-full px-1"><span className="truncate">{col.label}</span>{col.isCustom && col.customColumnId ? <button type="button" onClick={() => handleDeleteCustomColumn(col.customColumnId!)} className="text-gray-400 hover:text-red-500 flex-shrink-0" title="Delete column"><X size={12} /></button> : null}</div>
                          )}
                          {!['selectCheckbox', 'client', 'addClientCol', 'empty'].includes(col.key) && (
                            <button
                              type="button"
                              onClick={(event) => { event.stopPropagation(); setOpenColumnMenu(openColumnMenu === `client:${group.id}:${col.key}` ? null : `client:${group.id}:${col.key}`); }}
                              onMouseDown={(event) => event.stopPropagation()}
                              className="absolute right-0.5 top-0.5 z-30 hidden rounded bg-white/90 p-0.5 text-gray-400 shadow-sm hover:text-gray-700 group-hover:block"
                              title={`Column options for ${col.label}`}
                            >
                              <MoreHorizontal size={12} />
                            </button>
                          )}
                          {openColumnMenu === `client:${group.id}:${col.key}` && (
                            <div className="absolute left-0 top-full z-[80] mt-1 w-36 rounded-md border border-gray-200 bg-white p-1 text-left shadow-xl">
                              {['people', 'status', 'replyStatus', 'importance', 'channel'].includes(col.key) && <button type="button" onClick={() => { openColumnFilter(col.key === 'people' ? 'people' : `client:${col.key}`); setOpenColumnMenu(null); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[10px] font-medium text-gray-700 hover:bg-gray-50"><Filter size={12} /> Filter</button>}
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
                  onDeleteSubitem={(subitemId) => setPendingDeleteSubitem({ clientId: client.id, subitemId })}
                  onDelete={() => setPendingDeleteClientId(client.id)}
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
                  onAddPayment={handleAddPayment}
                  onDeletePayment={handleDeletePayment}
                  onAddPaymentStatus={handleAddPaymentStatus}
                  onDeletePaymentStatus={handleDeletePaymentStatus}
                  onAddModeOfPayment={handleAddModeOfPayment}
                  onDeleteModeOfPayment={handleDeleteModeOfPayment}
                  clientCustomCols={clientCustomCols}
                  updateClientCustomField={updateClientCustomField}
                  subitemCustomCols={subitemCustomCols}
                  onDeleteCustomColumn={handleDeleteCustomColumn}
                  onRequestAddSubitemCol={() => setShowAddColModal('subitem')}
                  onUpdateOptionColor={updateOptionColor}
                  onFilterColumn={openColumnFilter}
                  hiddenColumnKeys={hiddenColumnKeys}
                  onHideColumn={hideColumn}
                  onSetColumnVisibility={setColumnVisibility}
                  currentUserRole={currentUserRole ?? undefined}
                  currentUserId={currentUserId}
                  onUndoActivity={undoActivity}
                  groupNamesById={Object.fromEntries(groups.map((group) => [group.id, group.name]))}
                />
              ))}

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

              <GenerateOcfModal
                open={isOcfModalOpen}
                client={ocfClient}
                onClose={handleCloseOcfModal}
                onCreated={({ internalUrl }) => { window.open(internalUrl, "_blank", "noopener,noreferrer"); }}
              />
            </React.Fragment>
          ))}
        </div>
      </div>
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
      <ClientsLiveRefresh />
    </div>
  );
}