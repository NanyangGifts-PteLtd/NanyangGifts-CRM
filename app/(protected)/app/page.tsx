'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { Client } from '../../types';
import { fetchClientsWithSubitems } from '@/lib/crm';
import { CRMBoard } from '@/components/CRMBoard';
import Sidebar, { type SidePanel } from '../../../components/Sidebar';
import TopBar from '../../../components/TopBar';
import type { User } from '@supabase/supabase-js';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import { ReportsPanel } from '@/components/ReportsPanel';
import { RoundRobinAdminPanel } from '@/components/RoundRobinPanel';
import GanttChart from '@/components/Gantt-Chart';

export default function Page() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [activePanel, setActivePanel] = useState<SidePanel>('crm');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const reloadClients = useCallback(async () => {
    try {
      const rows = await fetchClientsWithSubitems();
      console.log('Fetched clients:', rows);
      setClients(rows);
    } catch (error) {
      console.error('Failed to load clients', error);
    }
  }, []);

  

  useEffect(() => {
    void reloadClients();
  }, [reloadClients]);

  useEffect(() => {
    const loadUser = async () => {
      const supabase = createSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user ?? null);
    };

    void loadUser();
  }, []);

  const renderPanel = () => {
    switch (activePanel) {
      case 'crm':
        return (
          <CRMBoard
            clients={clients}
            setClients = {setClients}
            reloadClients={reloadClients}
            search={search}
          />
        );

      case 'ganttchart':
        return (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            {
              <div className="flex-1 min-h-[700px] width-[400px] overflow-auto">
                <GanttChart clients={clients} />
              </div>
            }
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

        )

      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-[#f8fafc]">
      <Sidebar
        activePanel={activePanel}
        onChangePanel={setActivePanel}
        emailUnread={0}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        user={user}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          value={search}
          onChange={setSearch}
          onMarkAllRead={() => { }}
          notifications={[]}
          user={user}
        />

        <main className="min-h-0 flex-1">
          {renderPanel()}
        </main>
      </div>
    </div>
  );
}