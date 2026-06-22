'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { TopBar } from '../../../components/TopBar';
import { Sidebar, SidePanel } from '../../../components/Sidebar';
import { CRMBoard } from '../../../components/CRMBoard';
import { EmailPanel } from '../../../components/EmailPanel';
import { ReportsPanel } from '../../../components/ReportsPanel';
import { Client, Email, Notification } from '../../types';
import { initialClients, initialEmails, initialNotifications } from '../../mockData';
import dynamic from "next/dynamic";

const GanttChart = dynamic(() => import("../../../components/Gantt-Chart"),{
    ssr:false,
});

const STORAGE_KEYS = {
  clients: 'procrm_clients_v2',
  emails: 'procrm_emails_v1',
  notifications: 'procrm_notifications_v1',
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored) as T;
  } catch {}
  return fallback;
}

export default function App() {
  const [activePanel, setActivePanel] = useState<SidePanel>('crm');
  const [clients, setClients] = useState<Client[]>(() =>
    loadFromStorage(STORAGE_KEYS.clients, initialClients)
  );
  const [emails, setEmails] = useState<Email[]>(() =>
    loadFromStorage(STORAGE_KEYS.emails, initialEmails)
  );
  const [notifications, setNotifications] = useState<Notification[]>(() =>
    loadFromStorage(STORAGE_KEYS.notifications, initialNotifications)
  );

  // Persist to localStorage on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.clients, JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.emails, JSON.stringify(emails));
  }, [emails]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.notifications, JSON.stringify(notifications));
  }, [notifications]);

  const markNotifRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllNotifsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const markEmailRead = useCallback((id: string) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, read: true } : e));
  }, []);

  const deleteEmail = useCallback((id: string) => {
    setEmails(prev => prev.filter(e => e.id !== id));
  }, []);

  const emailUnread = emails.filter(e => !e.read).length;
  const [search, setSearch] = useState('');

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: '#f5f6f8' }}>
      <Sidebar
        activePanel={activePanel}
        onChangePanel={setActivePanel}
        emailUnread={emailUnread}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed(prev => !prev)}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar
          notifications={notifications}
          onMarkRead={markNotifRead}
          onMarkAllRead={markAllNotifsRead}
          value={search} 
          onChange={setSearch} 
        />

        <main className="flex flex-col h-screen overflow-hidden">
          {activePanel === 'crm' && (
            <CRMBoard
              clients={clients}
              onUpdateClients={setClients}
              search={search}
            />
          )}
          {activePanel === 'emails' && (
            <EmailPanel
              emails={emails}
              onMarkRead={markEmailRead}
              onDeleteEmail={deleteEmail}
            />
          )}
          {activePanel === 'reports' && (
            <ReportsPanel clients={clients} />
          )}
          {activePanel === 'ganttchart' && (
            <div className="flex-1 min-h-0 overflow-auto">
            <GanttChart clients={clients} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
