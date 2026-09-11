"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Client, ClientAssigneeMap, SubitemAssigneeMap, Profile, Notification, SearchResult, CRMGroup } from '../../types';
import { fetchClientsWithSubitems } from '@/lib/crm';
import { CRMBoard } from '@/components/CRMBoard';
import Sidebar, { type SidePanel } from '../../../components/Sidebar';
import TopBar from '../../../components/TopBar';
import type { User } from '@supabase/supabase-js';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import { ReportsPanel } from '@/components/ReportsPanel';
import { RoundRobinAdminPanel } from '@/components/RoundRobinPanel';
import GanttChart from '@/components/Gantt-Chart';
import { fetchClientAssignmentMaps } from '@/lib/assignments';
import { fetchAllSubitemAssignees } from '@/components/CRMBoard';
import { TeamPanel } from '@/components/TeamPanel';
import { UserAdminPanel } from '@/components/UserAdminPanel';
import { CustomerProfilesPanel } from '@/components/CustomerProfilesPanel';
import { AppLiveRefresh } from '@/components/AppLiveRefresh';
import { boardProtectionDelay, getBoardWriteRevision, isBoardRecordProtected } from '@/lib/board-write-coordinator';

export default function Page() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<SidePanel>('crm');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedClientIds, setExpandedClientIds] = useState<string[]>([]);
  const [clientAssignees, setClientAssignees] = useState<ClientAssigneeMap>({});
  const [clientPmAssignees, setClientPmAssignees] = useState<ClientAssigneeMap>({});
  const [subitemAssignees, setSubitemAssignees] = useState<SubitemAssigneeMap>({});
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [groups, setGroups] = useState<CRMGroup[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [searchTarget, setSearchTarget] = useState<SearchResult | null>(null);
  const [profileLeadClientId, setProfileLeadClientId] = useState<string | null>(null);
  const [crmMetadataVersion, setCrmMetadataVersion] = useState(0);
  const [labelOptionsVersion, setLabelOptionsVersion] = useState(0);
  const [groupVersion, setGroupVersion] = useState(0);
  const [roundRobinVersion, setRoundRobinVersion] = useState(0);
  const reconciliationTimer = useRef<number | null>(null);
  const recordsRefreshSequence = useRef(0);

  const selectSearchResult = useCallback((result: SearchResult) => {
    // currently setting to CRM panel since only CRM panel has search results, change in the future when other panels have search results
    setActivePanel('crm');
    const client = clients.find((item) => item.id === result.clientId);
    if (client && result.subitemId && !expandedClientIds.includes(client.id)) {
      setExpandedClientIds((previous) => [...previous, client.id]);
    }
    setSearchTarget(result);
  }, [clients, expandedClientIds]);

  const openGanttClientTimeline = useCallback((clientId: string, subitemId?: string) => {
    setActivePanel('crm');
    setExpandedClientIds((current) => current.includes(clientId) ? current : [...current, clientId]);
    setClients((current) => current.map((client) => client.id !== clientId ? client : {
      ...client,
      subitems: client.subitems.map((subitem) => subitemId && subitem.id !== subitemId ? subitem : { ...subitem, showTimeline: true, showPayments: false, showSample: false }),
    }));
    setSearchTarget({
      id: `gantt-timeline-${clientId}-${subitemId ?? 'all'}-${Date.now()}`,
      clientId,
      subitemId,
      kind: 'timeline',
      label: 'Timeline',
      context: 'Opened from Gantt Chart',
      field: 'Timeline',
      value: '',
      query: '',
    });
  }, []);

  const reloadClients = useCallback(async () => {
    const refreshSequence = ++recordsRefreshSequence.current;
    const writeRevisionAtStart = getBoardWriteRevision();
    try {
      const [rows, clientAssignmentMaps, subitemAssigneeMap] = await Promise.all([
        fetchClientsWithSubitems(),
        fetchClientAssignmentMaps(),
        fetchAllSubitemAssignees(),
      ]);

      // Never allow an older or edit-stale request to install its snapshot.
      // A fresh reconciliation will pick up both the latest local write and
      // any concurrent remote changes.
      if (
        refreshSequence !== recordsRefreshSequence.current ||
        writeRevisionAtStart !== getBoardWriteRevision()
      ) {
        if (refreshSequence === recordsRefreshSequence.current) {
          if (reconciliationTimer.current !== null) window.clearTimeout(reconciliationTimer.current);
          reconciliationTimer.current = window.setTimeout(() => {
            reconciliationTimer.current = null;
            void reloadClients();
          }, 100);
        }
        return;
      }

      const protectionDelay = boardProtectionDelay();
      setClients((current) => {
        const currentClients = new Map(current.map((client) => [client.id, client]));
        return rows.map((incomingClient) => {
          const localClient = currentClients.get(incomingClient.id);
          if (!localClient) return incomingClient;

          const localSubitems = new Map(localClient.subitems.map((item) => [item.id, item]));
          const mergedSubitems = incomingClient.subitems.map((incomingSubitem) => {
            if (!isBoardRecordProtected("subitem", incomingSubitem.id)) return incomingSubitem;
            const localSubitem = localSubitems.get(incomingSubitem.id);
            if (!localSubitem) return incomingSubitem;
            return localSubitem;
          });

          if (isBoardRecordProtected("client", incomingClient.id)) {
            return { ...localClient, subitems: mergedSubitems };
          }
          return { ...incomingClient, subitems: mergedSubitems };
        });
      });
      setClientAssignees((current) => {
        const next = { ...clientAssignmentMaps.people };
        for (const [clientId, ids] of Object.entries(current)) {
          if (isBoardRecordProtected("client", clientId)) next[clientId] = ids;
        }
        return next;
      });
      setClientPmAssignees((current) => {
        const next = { ...clientAssignmentMaps.pm };
        for (const [clientId, ids] of Object.entries(current)) {
          if (isBoardRecordProtected("client", clientId)) next[clientId] = ids;
        }
        return next;
      });
      setSubitemAssignees((current) => {
        const next = { ...subitemAssigneeMap };
        for (const [subitemId, ids] of Object.entries(current)) {
          if (isBoardRecordProtected("subitem", subitemId)) next[subitemId] = ids;
        }
        return next;
      });
      if (protectionDelay > 0) {
        if (reconciliationTimer.current !== null) window.clearTimeout(reconciliationTimer.current);
        reconciliationTimer.current = window.setTimeout(() => {
          reconciliationTimer.current = null;
          void reloadClients();
        }, Math.max(350, protectionDelay + 100));
      }
    } catch (error) {
      console.error('Failed to load clients', error);
    }
  }, []);

  useEffect(() => {
    void reloadClients();
  }, [reloadClients]);

  useEffect(() => {
    if (activePanel !== 'crm' && searchTarget) {
      setSearchTarget(null);
    }
  }, [activePanel, searchTarget]);

  useEffect(() => {
    const openCrmBoardBin = () => {
      setActivePanel('crm');
      window.setTimeout(
        () => window.dispatchEvent(new Event('crm:open-bin')),
        0,
      );
    };
    window.addEventListener('crm:open-bin-request', openCrmBoardBin);
    return () => window.removeEventListener('crm:open-bin-request', openCrmBoardBin);
  }, []);

  useEffect(() => {
    if (!searchTarget) return;

    const timeout = window.setTimeout(() => {
      setSearchTarget(null);
    }, 2500);

    return () => window.clearTimeout(timeout);
  }, [searchTarget]);

  useEffect(() => {
    const loadUserAndRole = async () => {
      const supabase = createSupabaseClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user ?? null);

      if (!user) {
        setCurrentUserRole(null);
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (error) {
        console.error('Failed to load profile role', error);
        setCurrentUserRole(null);
        return;
      }

      setCurrentUserRole(profile?.role ?? null);
    };

    void loadUserAndRole();
  }, []);

  const loadNotifications = useCallback(async () => {
    const response = await fetch('/api/notifications');
    if (!response.ok) return;
    setNotifications(await response.json() as Notification[]);
  }, []);

  useEffect(() => {
    void loadNotifications();
    const interval = window.setInterval(() => void loadNotifications(), 60_000);
    return () => window.clearInterval(interval);
  }, [loadNotifications]);

  const markNotificationRead = useCallback(async (id: string) => {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setNotifications((previous) => previous.map((notification) => notification.id === id ? { ...notification, read: true } : notification));
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) });
    setNotifications((previous) => previous.map((notification) => ({ ...notification, read: true })));
  }, []);

  useEffect(() => {
    const loadProfiles = async () => {
      const supabase = createSupabaseClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url')
        .order('full_name', { ascending: true, nullsFirst: true });

      if (error) {
        console.error('Failed to load profiles', error);
        return;
      }

      setProfiles((data ?? []) as Profile[]);
    };

    void loadProfiles();
  }, []);

  useEffect(() => () => {
    if (reconciliationTimer.current !== null) window.clearTimeout(reconciliationTimer.current);
  }, []);

  const reloadProfiles = useCallback(async () => {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, avatar_url')
      .order('full_name', { ascending: true, nullsFirst: true });
    if (error) {
      console.error('Failed to refresh profiles', error);
      return;
    }
    setProfiles((data ?? []) as Profile[]);
  }, []);

  const reloadGroups = useCallback(async () => {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from('crm_groups')
      .select('id, name, color, sort_order')
      .order('sort_order', { ascending: true });
    if (error) {
      console.error('Failed to refresh CRM groups', error);
      return;
    }
    setGroups((data ?? []) as CRMGroup[]);
  }, []);

  const refreshBoardMetadata = useCallback(() => {
    setCrmMetadataVersion((version) => version + 1);
  }, []);

  const refreshLabelOptions = useCallback(() => {
    setLabelOptionsVersion((version) => version + 1);
  }, []);

  const refreshGroupsInPlace = useCallback(() => {
    void reloadGroups();
    setGroupVersion((version) => version + 1);
  }, [reloadGroups]);

  const refreshRoundRobin = useCallback(() => {
    setRoundRobinVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    const loadGroups = async () => {
      const supabase = createSupabaseClient();
      const { data, error } = await supabase
        .from('crm_groups')
        .select('id, name, color, sort_order')
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Failed to load CRM groups for the Gantt chart', error);
        return;
      }

      setGroups((data ?? []) as CRMGroup[]);
    };

    void loadGroups();
  }, []);

  const renderPanel = () => {
    switch (activePanel) {
      case 'crm':
        return (
          <CRMBoard
            key={crmMetadataVersion}
            clients={clients}
            expandedIds={expandedClientIds}
            setExpandedIds={setExpandedClientIds}
            setClients={setClients}
            reloadClients={reloadClients}
            search={search}
            currentUserRole={currentUserRole}
            clientAssignees={clientAssignees}
            setClientAssignees={setClientAssignees}
            clientPmAssignees={clientPmAssignees}
            setClientPmAssignees={setClientPmAssignees}
            subitemAssignees={subitemAssignees}
            setSubitemAssignees={setSubitemAssignees}
            searchTarget={searchTarget}
            openClientId={profileLeadClientId}
            onOpenClientHandled={() => setProfileLeadClientId(null)}
            labelOptionsVersion={labelOptionsVersion}
            groupVersion={groupVersion}
          />
        );

      case 'ganttchart':
        return (
          <div className="h-full min-h-0 w-full text-sm text-gray-500">
            <GanttChart clients={clients} groups={groups} profiles={profiles} clientAssignees={clientAssignees} subitemAssignees={subitemAssignees} onOpenClientTimeline={openGanttClientTimeline} />
          </div>
        );

      case 'emails':
        return (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            Outlook goes here
          </div>
        );

      case 'reports':
        return (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            <ReportsPanel clients={clients} />
          </div>
        );

      case 'roundrobin':
        return (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            <RoundRobinAdminPanel key={roundRobinVersion} profiles={profiles} currentUserRole={currentUserRole} />
          </div>
        );

      case 'team':
        return <TeamPanel profiles={profiles} />;

      case 'customerprofiles':
        return <CustomerProfilesPanel currentUserRole={currentUserRole} boardClients={clients} onOpenLead={(clientId) => { setProfileLeadClientId(clientId); setActivePanel('crm'); }} />;

      case 'useradmin':
        return currentUserRole === 'director' || currentUserRole === 'dev'
          ? <UserAdminPanel profiles={profiles} />
          : null;

      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc]">
      <AppLiveRefresh
        onRecordsRefresh={reloadClients}
        onProfilesRefresh={reloadProfiles}
        onGroupsRefresh={refreshGroupsInPlace}
        onNotificationsRefresh={loadNotifications}
        onBoardMetadataRefresh={refreshBoardMetadata}
        onLabelOptionsRefresh={refreshLabelOptions}
        onRoundRobinRefresh={refreshRoundRobin}
      />
      <Sidebar
        activePanel={activePanel}
        onChangePanel={setActivePanel}
        emailUnread={0}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        currentUserRole={currentUserRole}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          value={search}
          onChange={setSearch}
          onMarkAllRead={markAllNotificationsRead}
          onMarkRead={markNotificationRead}
          notifications={notifications}
          user={user}
          currentUserRole={currentUserRole}
          clients={clients}
          clientAssignees={clientAssignees}
          subitemAssignees={subitemAssignees}
          profiles={profiles}
          onSelectSearchResult={selectSearchResult}
        />

        <main className="min-h-0 flex-1 overflow-y-auto pl-10">
          {renderPanel()}
        </main>
      </div>
    </div>
  );
}
