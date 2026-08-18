"use client";

import { useCallback, useEffect, useState } from 'react';
import type { Client, ClientAssigneeMap, SubitemAssigneeMap, Profile, Notification, SearchResult } from '../../types';
import { fetchClientsWithSubitems } from '@/lib/crm';
import { CRMBoard } from '@/components/CRMBoard';
import Sidebar, { type SidePanel } from '../../../components/Sidebar';
import TopBar from '../../../components/TopBar';
import type { User } from '@supabase/supabase-js';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import { ReportsPanel } from '@/components/ReportsPanel';
import { RoundRobinAdminPanel } from '@/components/RoundRobinPanel';
import GanttChart from '@/components/Gantt-Chart';
import { fetchClientAssigneeMap } from '@/lib/assignments';
import { fetchAllSubitemAssignees } from '@/components/CRMBoard';
import { TeamPanel } from '@/components/TeamPanel';

export default function Page() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<SidePanel>('crm');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedClientIds, setExpandedClientIds] = useState<string[]>([]);
  const [clientAssignees, setClientAssignees] = useState<ClientAssigneeMap>({});
  const [subitemAssignees, setSubitemAssignees] = useState<SubitemAssigneeMap>({});
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [searchTarget, setSearchTarget] = useState<SearchResult | null>(null);

  const selectSearchResult = useCallback((result: SearchResult) => {
    // currently setting to CRM panel since only CRM panel has search results, change in the future when other panels have search results
    setActivePanel('crm');
    const client = clients.find((item) => item.id === result.clientId);
    if (client && result.subitemId && !expandedClientIds.includes(client.id)) {
      setExpandedClientIds((previous) => [...previous, client.id]);
    }
    setSearchTarget(result);
  }, [clients, expandedClientIds]);

  const reloadClients = useCallback(async () => {
    try {
      const [rows, assigneeMap, subitemAssigneeMap] = await Promise.all([
        fetchClientsWithSubitems(),
        fetchClientAssigneeMap(),
        fetchAllSubitemAssignees(),
      ]);

      setClients(rows);
      setClientAssignees(assigneeMap);
      setSubitemAssignees(subitemAssigneeMap);
    } catch (error) {
      console.error('Failed to load clients', error);
    }
  }, []);

  useEffect(() => {
    void reloadClients();
  }, [reloadClients]);

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

  const renderPanel = () => {
    switch (activePanel) {
      case 'crm':
        return (
          <CRMBoard
            clients={clients}
            expandedIds={expandedClientIds}
            setExpandedIds={setExpandedClientIds}
            setClients={setClients}
            reloadClients={reloadClients}
            search={search}
            currentUserRole={currentUserRole}
            clientAssignees={clientAssignees}
            setClientAssignees={setClientAssignees}
            subitemAssignees={subitemAssignees}
            setSubitemAssignees={setSubitemAssignees}
            searchTarget={searchTarget}
          />
        );

      case 'ganttchart':
        return (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            <div className="flex-1 min-h-[700px] w-[400px] overflow-auto">
              <GanttChart clients={clients} />
            </div>
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
            <RoundRobinAdminPanel />
          </div>
        );

      case 'team':
        return <TeamPanel profiles={profiles} />;

      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc]">
      <Sidebar
        activePanel={activePanel}
        onChangePanel={setActivePanel}
        emailUnread={0}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        user={user}
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