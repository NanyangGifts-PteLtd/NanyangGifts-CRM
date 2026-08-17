'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bell, Settings, Search, ChevronDown, Info, AlertTriangle, CheckCircle, XCircle, X } from 'lucide-react';
import { Notification } from '../app/types';
import { LogoutButton } from './logout-button';
import type { User } from '@supabase/supabase-js';
import OcfConfigurationSettingsModal from "@/components/OcfConfigurationSettingsModal"
import { gradientForId } from './ui/assignee-multiselect';
import ChangePasswordModal from './Change-Password-Modal';
import { Client, ClientAssigneeMap, Profile, SearchResult, SubitemAssigneeMap } from '../app/types';


interface TopBarProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  notifications?: Notification[];
  onMarkRead?: (id: string) => void;
  onMarkAllRead: () => void;
  user: User | null;
  currentUserRole: string | null;
  clients: Client[];
  clientAssignees: ClientAssigneeMap;
  subitemAssignees: SubitemAssigneeMap;
  profiles: Profile[];
  onSelectSearchResult?: (result: SearchResult) => void;
}

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onClear?: () => void;
}

function searchResults(
  clients: Client[],
  query: string,
  clientAssignees: ClientAssigneeMap,
  subitemAssignees: Record<string, string[]>,
  profiles: Profile[],
): SearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 1) return [];
  const results: SearchResult[] = [];
  const add = (result: Omit<SearchResult, 'id' | 'query'>) => {
    const candidate = result.value.toLowerCase();
    const matchIndex = candidate.indexOf(normalized);
    if (matchIndex !== -1) {
      const exact = candidate === normalized;
      const startsWith = matchIndex === 0;
      const fieldPriority = result.field === 'Client' || result.field === 'Subitem' ? 30 : result.field === 'people' ? 25 : 0;
      const score = (exact ? 1000 : startsWith ? 600 : 300) + fieldPriority - matchIndex;
      results.push({
        ...result,
        id: `${result.kind}:${result.clientId}:${result.subitemId ?? ''}:${result.field}:${result.value}:${results.length}`,
        query,
        score,
      });
    }
  };
  const labelize = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
  const profileValues = (id: string) => {
    const profile = profiles.find((candidate) => candidate.id === id);
    return [profile?.full_name, profile?.email, id].filter((value): value is string => Boolean(value));
  };
  const addScalarFields = (clientId: string, subitemId: string | undefined, kind: SearchResult['kind'], label: string, contextPrefix: string, record: Record<string, unknown>, excluded: Set<string>) => {
    for (const [field, value] of Object.entries(record)) {
      if (excluded.has(field) || value === null || value === undefined || typeof value === 'object') continue;
      add({ clientId, subitemId, kind, label, context: `${contextPrefix} · ${labelize(field)}`, field, value: String(value) });
    }
  };
  for (const client of clients) {
    const clientFields: Array<[string, unknown]> = [
      ['Client', client.name], ['People', client.people], ['Reply Status', client.replyStatus], ['Follow Up', client.followUp],
      ['Status', client.status], ['Channel', client.channel], ['Importance', client.importance], ['Company', client.company],
      ['Email', client.email], ['Phone', client.phone], ['Requirements', client.requirements], ['NBD', client.nbd],
      ['Total Price', client.totalPrice], ['Company Address', client.companyAddress], ['Billing Address', client.billingAddress],
      ['Date Created', client.createdAt],
    ];
    for (const [field, value] of clientFields) add({ clientId: client.id, kind: 'client', label: client.name || 'Unnamed client', context: field, field, value: String(value ?? '') });
    for (const assigneeId of clientAssignees[client.id] ?? []) {
      for (const value of profileValues(assigneeId)) {
        add({ clientId: client.id, kind: 'client', label: client.name || 'Unnamed client', context: `${client.name} · People`, field: 'people', value });
      }
    }
    addScalarFields(client.id, undefined, 'client', client.name || 'Unnamed client', client.name || 'Client', client as unknown as Record<string, unknown>, new Set(['subitems', 'activityLog', 'customFields']));
    addScalarFields(client.id, undefined, 'client', client.name || 'Unnamed client', client.name || 'Client', client.customFields ?? {}, new Set());
    for (const subitem of client.subitems) {
      const subitemFields: Array<[string, unknown]> = [
        ['Subitem', subitem.name], ['People', subitem.people], ['Status', subitem.status], ['Local/Overseas', subitem.localOverseas],
        ['Quantity', subitem.qty], ['Description', subitem.description], ['Remarks', subitem.remarks], ['Shipper', subitem.shipper],
        ['Supplier', subitem.supplier], ['Cost', subitem.cost], ['Currency', subitem.currency], ['Payment', subitem.payment],
        ['Payment Status', subitem.paymentStatus], ['Mode of Payment', subitem.modeOfPayment], ['Order Number', subitem.orderNumber],
        ['Payment Remarks', subitem.paymentRemarks], ['Date Created', subitem.createdAt],
      ];
      for (const [field, value] of subitemFields) add({ clientId: client.id, subitemId: subitem.id, kind: field.startsWith('Payment') || field === 'Mode of Payment' ? 'payment' : 'subitem', label: subitem.name || 'Unnamed subitem', context: `${client.name} · ${field}`, field, value: String(value ?? '') });
      for (const assigneeId of subitemAssignees[subitem.id] ?? []) {
        for (const value of profileValues(assigneeId)) {
          add({ clientId: client.id, subitemId: subitem.id, kind: 'subitem', label: subitem.name || 'Unnamed subitem', context: `${client.name} · ${subitem.name} · People`, field: 'people', value });
        }
      }
      addScalarFields(client.id, subitem.id, 'subitem', subitem.name || 'Unnamed subitem', `${client.name} · ${subitem.name}`, subitem as unknown as Record<string, unknown>, new Set(['timelineRows', 'sampleRows', 'customFields']));
      addScalarFields(client.id, subitem.id, 'subitem', subitem.name || 'Unnamed subitem', `${client.name} · ${subitem.name}`, subitem.customFields ?? {}, new Set());
      for (const timeline of subitem.timelineRows ?? []) {
        const timelineFields: Array<[string, unknown]> = [['Timeline', timeline.name], ['Person', timeline.person], ['Remarks', timeline.remarks], ['Sub-Progress', timeline.subProgress], ['Start', timeline.timelineStart], ['End', timeline.timelineEnd], ['Dependency', timeline.dependency]];
        for (const [field, value] of timelineFields) add({ clientId: client.id, subitemId: subitem.id, kind: 'timeline', label: timeline.name || 'Timeline row', context: `${client.name} · ${subitem.name} · ${field}`, field, value: String(value ?? '') });
      }
    }
  }
  return results.sort((first, second) => (second.score ?? 0) - (first.score ?? 0)).slice(0, 30);
}

const notifIcon = (type: Notification['type']) => {
  if (type === 'success') return <CheckCircle size={14} className="text-green-500" />;
  if (type === 'warning') return <AlertTriangle size={14} className="text-orange-400" />;
  if (type === 'error') return <XCircle size={14} className="text-red-500" />;
  return <Info size={14} className="text-blue-400" />;
};

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search clients, items...',
  onFocus,
  onBlur,
  onClear,
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (typeof onChange === 'function') {
      onChange(event.target.value);
    }
  };

  return (
    <div className="flex-1 max-w-90 relative">
      <Search
        size={13}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-800"
      />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        className="w-full text-gray-900 text-xs font-semibold pl-8 pr-3 py-1.5 rounded-md border focus:outline-none focus:border-[#7BCBD5] placeholder-gray-500 bg-[#e7fdff] animated-background bg-gradient-to-r from-[#e7fdff] to-[#a3dfff]"
      />
      {value && onClear && (
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={onClear} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-500 hover:bg-white/70 hover:text-gray-900" title="Clear search">
          <X size={13} />
        </button>
      )}
    </div>
  );
};

function escapeCsv(value: unknown): string {
  const str = String(value ?? "");
  return `"${str.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escapeCsv(row[h])).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildClientSubitemCsvRows(
  clients: Client[],
  clientAssignees: ClientAssigneeMap,
  profiles: Profile[]
) {
  const rows: Record<string, unknown>[] = [];

  for (const client of clients) {
    const clientAssigneeNames = (clientAssignees[client.id] ?? [])
      .map((id) => profiles.find((p) => p.id === id)?.full_name ?? "")
      .filter(Boolean)
      .join("; ");

    if (!client.subitems?.length) {
      rows.push({
        clientId: client.id,
        clientName: client.name ?? "",
        clientPeople: clientAssigneeNames,
        clientStatus: client.status ?? "",
        clientCompany: client.company ?? "",
        clientEmail: client.email ?? "",
        subitemId: "",
        subitemName: "",
        subitemStatus: "",
        subitemAssignees: "",
      });
      continue;
    }

    for (const subitem of client.subitems) {
      rows.push({
        clientId: client.id,
        clientName: client.name ?? "",
        clientPeople: clientAssigneeNames,
        clientStatus: client.status ?? "",
        clientCompany: client.company ?? "",
        clientEmail: client.email ?? "",
        subitemId: subitem.id,
        subitemName: subitem.name ?? "",
        subitemStatus: subitem.status ?? "",
        subitemAssignees: "",
      });
    }
  }

  return rows;
}

export default function TopBar({
  value = '',
  onChange = () => { },
  placeholder = 'Search clients, items, people...',
  notifications = [],
  onMarkRead = () => { },
  onMarkAllRead = () => { },
  user,
  currentUserRole,
  clients,
  clientAssignees,
  subitemAssignees,
  profiles
  , onSelectSearchResult
}: TopBarProps) {
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const notifsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [showOcfSettings, setShowOcfSettings] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [hasNewNotification, setHasNewNotification] = useState(false);
  const results = searchResults(clients, value, clientAssignees, subitemAssignees, profiles);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('crm:recent-searches') || '[]');
      if (Array.isArray(saved)) setRecentSearches(saved.filter((item): item is string => typeof item === 'string').slice(0, 8));
    } catch {}
  }, []);

  const rememberSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setRecentSearches((previous) => {
      const next = [trimmed, ...previous.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8);
      try { localStorage.setItem('crm:recent-searches', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const removeRecentSearch = (query: string) => {
    setRecentSearches((previous) => {
      const next = previous.filter((item) => item !== query);
      try { localStorage.setItem('crm:recent-searches', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const previousUnreadCount = useRef(unreadCount);

  useEffect(() => {
    if (unreadCount > previousUnreadCount.current) {
      setHasNewNotification(true);
      const timer = window.setTimeout(() => setHasNewNotification(false), 1400);
      previousUnreadCount.current = unreadCount;
      return () => window.clearTimeout(timer);
    }
    previousUnreadCount.current = unreadCount;
  }, [unreadCount]);

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    'User';

  const userEmail = user?.email || 'No email';

  const initial =
    displayName?.trim()?.charAt(0)?.toUpperCase() || 'U';


  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifsRef.current && !notifsRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearchResults(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="h-16 bg-[#ffffff] flex items-center px-4 gap-3 border-b border-[#f2f8ff] flex-shrink-0 overflow-visible sticky top-0 z-50">
      <div ref={searchRef} className="relative flex-1 max-w-90">
        <SearchBar
          value={value}
          onChange={(next) => { onChange(next); setShowSearchResults(true); }}
          onFocus={() => setShowSearchResults(true)}
          onBlur={() => { if (value.trim()) rememberSearch(value); }}
          onClear={() => { onChange(''); setShowSearchResults(true); }}
          placeholder={placeholder}
        />
        {showSearchResults && !value.trim() && recentSearches.length > 0 && (
          <div className="absolute left-0 top-full z-[70] mt-1 w-[min(520px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2 text-[11px] font-semibold text-gray-500">
              <span>Recent searches</span>
              <button type="button" onClick={() => { setRecentSearches([]); localStorage.removeItem('crm:recent-searches'); }} className="text-gray-400 hover:text-gray-700">Clear all</button>
            </div>
            {recentSearches.map((query) => (
              <div key={query} className="flex items-center border-b border-gray-100 hover:bg-slate-50">
                <button type="button" onClick={() => { onChange(query); setShowSearchResults(true); }} className="flex-1 px-3 py-2 text-left text-xs text-slate-700">{query}</button>
                <button type="button" onClick={() => removeRecentSearch(query)} className="mr-2 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700" title="Remove recent search"><X size={13} /></button>
              </div>
            ))}
          </div>
        )}
        {showSearchResults && value.trim().length >= 1 && (
          <div className="absolute left-0 top-full z-[70] mt-1 max-h-96 w-[min(520px,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl">
            {results.length === 0 ? <div className="p-4 text-xs text-gray-400">No matching clients, subitems, payments, or timeline values.</div> : results.map((result) => {
              const matchIndex = result.value.toLowerCase().indexOf(result.query.trim().toLowerCase());
              const before = result.value.slice(0, Math.max(0, matchIndex));
              const match = result.value.slice(Math.max(0, matchIndex), Math.max(0, matchIndex) + result.query.trim().length);
              const after = result.value.slice(Math.max(0, matchIndex) + result.query.trim().length);
              return <button key={result.id} type="button" onClick={() => { rememberSearch(result.query); onSelectSearchResult?.(result); setShowSearchResults(false); }} className="flex w-full items-start gap-3 border-b border-gray-100 px-3 py-2 text-left hover:bg-slate-50"><span className="mt-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{result.kind}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-slate-800">{result.label}</span><span className="block truncate text-[11px] text-slate-500">{result.context}: {before}<mark className="bg-yellow-200 text-slate-800">{match}</mark>{after}</span></span></button>;
            })}
          </div>
        )}
      </div>

      <div ref={notifsRef} className="relative">
        <button
          onClick={() => {
            setShowNotifs(!showNotifs);
            setShowProfile(false);
            setShowSettings(false);
          }}
          className={`relative p-2 rounded-md hover:bg-[#43adc4] text-black-300 hover:text-white transition-colors transition transform active:scale-95 duration-150 ${hasNewNotification ? 'animate-[notification-shake_0.7s_ease-in-out]' : ''}`}
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span
              className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white flex items-center justify-center"
              style={{ fontSize: '9px' }}
            >
              {unreadCount}
              {hasNewNotification && <span className="absolute inset-0 rounded-full bg-red-400 opacity-60 animate-ping" />}
            </span>
          )}
        </button>

        {showNotifs && (
          <div className="absolute right-0 top-full mt-1 w-80 bg-white font-semibold rounded-lg shadow-2xl border border-gray-200 z-[60] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b">
              <span className="text-xs font-semibold text-gray-700">Notifications</span>
              <button onClick={onMarkAllRead} className="text-xs text-blue-500 hover:text-blue-700">
                Mark all read
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">No notifications</div>
              ) : (
                notifications.map(n => (
                  <button
                    key={n.id}
                    onClick={() => onMarkRead(n.id)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex gap-2.5 items-start ${!n.read ? 'bg-blue-50/50' : ''
                      }`}
                  >
                    <div className="mt-0.5 flex-shrink-0">{notifIcon(n.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 leading-snug">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{n.time}</p>
                    </div>
                    {!n.read && <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div ref={settingsRef} className="relative">
        <button
          onClick={() => {
            setShowSettings(!showSettings);
            setShowNotifs(false);
            setShowProfile(false);
          }}
          className="p-2 rounded-md hover:bg-[#43adc4] text-black-300 hover:text-white transition-colors transition transform active:scale-95 duration-150"
        >
          <Settings size={16} />
        </button>
        {showSettings && (
          <div className="absolute right-0 top-full mt-1 w-64 bg-white font-semibold rounded-lg shadow-2xl border border-gray-200 z-[60] overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b">
              <span className="text-xs font-semibold text-gray-700">Settings</span>
            </div>

            <div className="px-2 py-2">
              <p className="px-2 pb-1 text-[11px] uppercase tracking-wide text-gray-400">General</p>

              {(currentUserRole === "director" || currentUserRole === "dev") && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSettings(false);
                      setShowOcfSettings(true);
                    }}
                    className="w-full rounded-md px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                  >
                    OCF Configuration
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const rows = buildClientSubitemCsvRows(clients, clientAssignees, profiles);
                      downloadCsv(`crm-export-${new Date().toISOString().slice(0, 10)}.csv`, rows);
                      setShowSettings(false);
                    }}
                    className="w-full rounded-md px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                  >
                    Export board to CSV
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div ref={profileRef} className="relative ml-auto">
        <button
          onClick={() => {
            setShowProfile(!showProfile);
            setShowNotifs(false);
            setShowSettings(false);
          }}
          className="flex text-black hover:text-white items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-[#43adc4] transition-colors transition transform active:scale-95 duration-150"
        >
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold"
            style={{ background: user?.id ? gradientForId(user.id) : 'linear-gradient(150deg, #76d8f8, #753eff)' }}>
            {initial}
          </div>
          <span className="font-semibold text-xs hidden lg:block truncate max-w-28">
            {displayName}
          </span>
          <ChevronDown size={12} className="text-black hidden lg:block" />
        </button>

        {showProfile && (
          <div className="absolute right-0 top-full mt-1 w-56 bg-white font-semibold rounded-lg shadow-2xl border border-gray-200 z-[60] overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b">
              <p className="text-xs font-semibold text-gray-800 truncate">{userEmail}</p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">Online</p>
            </div>


            <button
              key="Account Settings"
              onClick={() => { setShowProfile(false); setShowChangePassword(true); }}
              className="w-full text-left px-4 py-2 text-xs hover:bg-[#e7fdff] text-gray-700"
            >
              Account Settings
            </button>

            <div className="text-left">
              <LogoutButton className="w-full justify-start px-4 py-2 text-xs bg-white hover:bg-[#e7fdff] text-red-500" />
            </div>
          </div>
        )}
      </div>
      <OcfConfigurationSettingsModal
        open={showOcfSettings}
        onClose={() => setShowOcfSettings(false)}
        currentUserRole={currentUserRole}
      />
      <ChangePasswordModal
        open={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </div>

  );
}