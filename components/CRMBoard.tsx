"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Plus, Trash2, Filter, ChevronsDown, ChevronsUp, X } from 'lucide-react';
import { Client, Subitem, ClientStatus, Profile, ClientAssigneeMap, SubitemAssigneeMap, CRMGroup } from '../app/types';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import { ClientRow } from './ui/clientrows';
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
  { key: 'totalPrice', label: 'Total Price', width: 80, minWidth: 7 },
  { key: 'companyAddress', label: 'Company Address', width: 115, minWidth: 7 },
  { key: 'billingAddress', label: 'Billing Address', width: 115, minWidth: 7 },
  { key: 'dateCreated', label: 'Date Created', width: 90, minWidth: 7 },
  { key: 'addClientCol', label: '', width: 44, minWidth: 44 },
  { key: 'empty', label: '', width: 800, minWidth: 7 },
];

interface CRMBoardProps {
  clients: Client[];
  expandedIds: string[];
  setExpandedIds: React.Dispatch<React.SetStateAction<string[]>>;
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  reloadClients: () => Promise<void>;
  search?: string;
  clientAssignees: ClientAssigneeMap;
  setClientAssignees: React.Dispatch<React.SetStateAction<ClientAssigneeMap>>;
  subitemAssignees: SubitemAssigneeMap;
  setSubitemAssignees: React.Dispatch<React.SetStateAction<SubitemAssigneeMap>>;
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
  clientAssignees,
  setClientAssignees,
  subitemAssignees,
  setSubitemAssignees,
}: CRMBoardProps) {

  const [filterStatus, setFilterStatus] = useState<string | 'All'>('All');
  const [showFilter, setShowFilter] = useState(false);
  const [filterSubprogress, setFilterSubprogress] = useState<string>('All');
  const [showSubprogressFilter, setShowSubprogressFilter] = useState(false);
  const subprogressFilterRef = useRef<HTMLDivElement>(null);
  const expandedIdSet = React.useMemo(() => new Set(expandedIds), [expandedIds]);
  const allExpanded = clients.length > 0 && clients.every((c) => expandedIdSet.has(c.id));

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [profiles, setProfiles] = useState<Profile[]>([]);
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
  const statusColors = Object.fromEntries(clientStatusEntries.map((e) => [e.value, e.color]));
  const subProgressColors = Object.fromEntries(subitemSubprogressEntries.map((e) => [e.value, e.color]));

  const [groups, setGroups] = useState<CRMGroup[]>([]);
  const [groupToDelete, setGroupToDelete] = useState<CRMGroup | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [draggedClientId, setDraggedClientId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [dragOverGroupEdge, setDragOverGroupEdge] = useState<'top' | 'bottom' | null>(null);

  const [headerCols, setHeaderCols] = useState<HeaderCol[]>(CLIENT_HEADER_COLS);
  const [draggedHeaderKey, setDraggedHeaderKey] = useState<string | null>(null);
  const [dragOverHeaderKey, setDragOverHeaderKey] = useState<string | null>(null);
  const [dragOverHeaderEdge, setDragOverHeaderEdge] = useState<'left' | 'right' | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showRestoreArrangementConfirm, setShowRestoreArrangementConfirm] = useState(false);

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
  }, [headerCols, currentUserId]);

  const setDragPreview = (event: React.DragEvent, source: HTMLElement, includeColumnCells = false) => {
    if (!event.dataTransfer) return;
    const bounds = source.getBoundingClientRect();
    const preview = includeColumnCells ? document.createElement('div') : source.cloneNode(true) as HTMLElement;
    preview.style.position = 'fixed';
    preview.style.left = '-10000px';
    preview.style.top = '-10000px';
    preview.style.width = `${bounds.width}px`;
    preview.style.maxWidth = `${bounds.width}px`;
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
      const visibleCells = Array.from((groupContainer ?? document).querySelectorAll<HTMLElement>('[data-client-row]'))
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
  }, [currentUserId]);

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
  }, [currentUserId]);

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

  const totalMinWidth = mergedHeaderCols.reduce((sum, col) => sum + col.width, 0);
  const colWidth = React.useMemo(
    () => Object.fromEntries(mergedHeaderCols.map((c) => [c.key, c.width])),
    [mergedHeaderCols]
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
      setHeaderCols((prev) => prev.map((c) => ({ ...c, width: map[c.key] ?? c.width })));
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
          setHeaderCols((prev) => prev.map((c) => ({ ...c, width: value[c.key] ?? c.width })));
          return;
        }

        // fallback: try localStorage
        try {
          const raw = localStorage.getItem(`colWidths:clients:${currentUserId}`);
          if (raw) {
            const map = JSON.parse(raw) as Record<string, number>;
            setHeaderCols((prev) => prev.map((c) => ({ ...c, width: map[c.key] ?? c.width })));
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

  useEffect(() => {
    if (!showSubprogressFilter) return;

    const handler = (e: MouseEvent) => {
      if (subprogressFilterRef.current && !subprogressFilterRef.current.contains(e.target as Node)) {
        setShowSubprogressFilter(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSubprogressFilter]);

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

    const matchesSubprogress =
      filterSubprogress === 'All' ||
      client.subitems.some((subitem) =>
        (subitem.timelineRows ?? []).some(
          (row) => (row.subProgress ?? '') === filterSubprogress
        )
      );

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
    return matchesStatus && matchesSearch && matchesSubprogress;
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
        color: createdClient.color ?? '#7BCBD5', subitems: [], activityLog: [], customFields: {}
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
          <button onClick={() => setShowFilter(!showFilter)} className="flex items-center gap-1 px-2 py-1 bg-[#43adc4] hover:bg-[#0f8da8] text-white rounded-md text-[10px] font-medium transition-colors transition transform active:scale-95 duration-150">
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
        
        <div ref={subprogressFilterRef} className="relative">
          <button
            onClick={() => setShowSubprogressFilter(!showSubprogressFilter)}
            className="flex items-center gap-1 px-2 py-1 bg-[#43adc4] hover:bg-[#0f8da8] text-white rounded-md text-[10px] font-medium transition-colors transform active:scale-95 duration-150"
          >
            <Filter size={12} />
            {filterSubprogress === 'All' ? 'Filter by Subitem Subprogress' : filterSubprogress}
            <ChevronDown size={11} />
          </button>

          {showSubprogressFilter && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 min-w-44 py-1 max-h-80 overflow-y-auto">
              <button
                onClick={() => {
                  setFilterSubprogress('All');
                  setShowSubprogressFilter(false);
                }}
                className="flex items-center font-semibold gap-2 w-full text-left px-3 py-1.5 text-[10px] hover:bg-gray-50"
              >
                <span className="w-2.5 h-2.5 rounded-sm bg-gray-300" />
                <span className="flex-1">All Subprogress</span>
                {filterSubprogress === 'All' && <span className="ml-auto text-blue-500">✓</span>}
              </button>

              <div className="border-t border-gray-100 my-1" />

              {subprogressOptions.map((sp) => {
                const count = clients.filter((client) =>
                  client.subitems.some((subitem) =>
                    (subitem.timelineRows ?? []).some(
                      (row) => (row.subProgress ?? '') === sp
                    )
                  )
                ).length;

                return (
                  <button
                    key={sp}
                    onClick={() => {
                      setFilterSubprogress(sp);
                      setShowSubprogressFilter(false);
                    }}
                    className="flex items-center font-semibold gap-2 w-full text-left px-3 py-1.5 text-[10px] hover:bg-gray-50"
                  >
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#7BCBD5]" style={{ background: subProgressColors[sp] ?? '#9ca3af' }} />
                    <span className="flex-1">{sp}</span>
                    <span className="text-gray-400">{count}</span>
                    {filterSubprogress === sp && <span className="text-blue-500 ml-1">✓</span>}
                  </button>
                );
              })}
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
            <button onClick={deleteSelected} className="flex items-center gap-1 text-[10px] text-red-600 hover:text-red-800 font-semibold transition-colors">
              <Trash2 size={12} /> Delete
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={13} />
            </button>
          </div>
        )}
      </div>

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
            {mergedHeaderCols.map((col) => {
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
                    onMouseDown={(e) => startResize(col.key, e.clientX)}
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize"
                  />
                </div>
              );
            })}
          </div>


          {groupedClients.map(({ group, clients: groupClients }) => (
            <React.Fragment key={group.id}>
              <div
                className="flex items-center gap-2.5 px-2 py-1 text-sm border-y border-gray-100 bg-gray-50"
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

              {!collapsedGroups[group.id] && (
                <div data-client-group={group.id} onDragOver={(event) => handleDragOver(event, group.id, 'top')} onDrop={() => handleDrop(group.id)} onDragLeave={() => { setDragOverGroupId(null); setDragOverGroupEdge(null); }} className="relative" style={{ minWidth: totalMinWidth }}>
                <div className="relative flex text-[12.6px] items-center justify-center w-full min-w-0 flex-shrink-0 border border-[#D0D4E4] overflow-hidden bg-gradient-to-r from-[#e7fdff] to-[#a3dfff]" style={{ minWidth: totalMinWidth }}>
                  {mergedHeaderCols.map((col) => {
                    const fixedKeys = new Set(['selectCheckbox', 'client', 'addClientCol', 'empty']);
                    const isDraggable = !col.isCustom && !fixedKeys.has(col.key);
                    const isDragging = draggedHeaderKey === col.key;
                    const isDragOver = dragOverHeaderKey === col.key;

                    return (
                      <div
                        key={col.key}
                        draggable={isDraggable}
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
                        className={`relative flex h-7 justify-center items-center border-[#D0D4E4] border-r flex-shrink-0 ${isDragging ? 'opacity-60' : ''} ${isDraggable ? (draggedHeaderKey ? 'cursor-grabbing' : 'cursor-grab') : ''} ${isDragOver && isDraggable ? 'bg-[#dff9ff]' : ''}`}
                        style={{ minWidth: col.width, width: col.width }}
                      >
                        {col.key === 'selectCheckbox' ? (
                          <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} className="w-3 h-3 rounded cursor-pointer accent-[#7BCBD5]" />
                        ) : col.key === 'addClientCol' ? (
                          <button type="button" onClick={() => setShowAddColModal('client')} className="mx-auto flex h-5 w-5 items-center justify-center rounded-md text-teal-500 hover:bg-teal-100 hover:text-black" title="Add client column"><Plus size={14} /></button>
                        ) : (
                          <div className="flex items-center gap-1 min-w-0 max-w-full px-1"><span className="truncate">{col.label}</span>{col.isCustom && col.customColumnId ? <button type="button" onClick={() => handleDeleteCustomColumn(col.customColumnId!)} className="text-gray-400 hover:text-red-500 flex-shrink-0" title="Delete column"><X size={12} /></button> : null}</div>
                        )}
                        {isDragOver && isDraggable && <div className={`pointer-events-none absolute inset-y-0 z-20 w-1 bg-[#0f8da8] shadow-[0_0_5px_rgba(15,141,168,0.6)] ${dragOverHeaderEdge === 'left' ? 'left-0' : 'right-0'}`} />}
                        <div onMouseDown={(event) => startResize(col.key, event.clientX)} className="absolute right-0 top-0 h-full w-1 cursor-col-resize" />
                      </div>
                    );
                  })}
                  {dragOverGroupId === group.id && dragOverGroupEdge === 'top' && <div className="pointer-events-none absolute inset-x-0 -bottom-0.5 z-30 h-1 bg-[#0f8da8] shadow-[0_0_5px_rgba(15,141,168,0.6)]" />}
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
                  currentUserId={currentUserId}


                />
              ))}
              {!collapsedGroups[group.id] && (
                <div onDragOver={(event) => handleDragOver(event, group.id, 'bottom')} onDrop={() => handleDrop(group.id)} onDragLeave={() => { setDragOverGroupId(null); setDragOverGroupEdge(null); }} className="relative h-1" style={{ minWidth: totalMinWidth }}>
                  {dragOverGroupId === group.id && dragOverGroupEdge === 'bottom' && <div className="pointer-events-none absolute inset-x-0 -top-0.5 z-30 h-1 bg-[#0f8da8] shadow-[0_0_5px_rgba(15,141,168,0.6)]" />}
                </div>
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