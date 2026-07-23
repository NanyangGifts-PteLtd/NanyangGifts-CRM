'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  Mail,
  BarChart2,
  SquareChartGantt,
  BotMessageSquare,
  PackageSearch,
} from 'lucide-react';
import logo from "./logo.png";
import Image from 'next/image';
import type { User } from "@supabase/supabase-js";

export type SidePanel =
  | 'crm'
  | 'emails'
  | 'reports'
  | 'ganttchart'
  | 'roundrobin'
  | 'shipper';

interface SidebarProps {
  activePanel: SidePanel;
  onChangePanel: (panel: SidePanel) => void;
  emailUnread: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  user: User | null;
}

const navItems: { id: SidePanel; icon: React.ReactNode; label: string; href?: string }[] = [
  { id: 'crm', icon: <LayoutGrid size={16.5} />, label: 'CRM Board' },
  { id: 'emails', icon: <Mail size={16.5} />, label: 'Emails' },
  { id: 'reports', icon: <BarChart2 size={17.5} />, label: 'Reports & KPI' },
  { id: 'ganttchart', icon: <SquareChartGantt size={17.5} />, label: 'Gantt Chart' },
  { id: 'roundrobin', icon: <BotMessageSquare size={17.5} />, label: 'Round Robin' },
  { id: 'shipper', icon: <PackageSearch size={17.5} />, label: 'Shipper', href: '/app/shipper'  },
];

export default function Sidebar({
  activePanel,
  onChangePanel,
  emailUnread,
  collapsed,
  onToggleCollapsed,
  user,
}: SidebarProps) {
  const pathname = usePathname();

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    'User';

  const userEmail = user?.email || 'No email';
  const initial = displayName?.trim()?.charAt(0)?.toUpperCase() || 'U';

  const itemClass = (active: boolean) =>
    `w-full flex items-center gap-3 px-2 py-2 rounded-md text-left group relative transition transform active:scale-95 duration-150 ${active
      ? 'bg-[#a0e2eb] text-white'
      : 'text-gray-500 hover:bg-[#a0e2eb] hover:text-white'
    }`;

  return (
    <div
      className={`${collapsed ? 'w-12' : 'w-52'} bg-[#ffffff] flex flex-col border-r border-[#f2f8ff] flex-shrink-0 h-full transition-[width] duration-200 ease-in-out overflow-hidden`}
    >
      <div className="h-12 flex items-center justify-between px-1 lg:px-4 border-b border-[#f2f8ff]">
        <div className="flex items-center gap-2 min-w-0">
          <Image src={logo} alt="Logo" className="h-6 w-auto object-contain" />
          {!collapsed && (
            <span className="text-sm font-semibold text-black truncate">
              NanyangGifts
            </span>
          )}
        </div>

        <button
          onClick={onToggleCollapsed}
          className="p-1.5 rounded-md text-gray-500 hover:bg-[#a0e2eb] hover:text-white transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {navItems.map((item) => {
          const isRouteItem = !!item.href;
          const isActive = isRouteItem
            ? pathname === item.href
            : activePanel === item.id;

          if (isRouteItem) {
            return (
              <Link
                key={item.id}
                href={item.href!}
                className={itemClass(isActive)}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                <span className="text-xs font-medium hidden lg:block truncate">
                  {item.label}
                </span>
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 lg:hidden">
                  {item.label}
                </div>
              </Link>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => onChangePanel(item.id)}
              className={itemClass(isActive)}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <span className="text-xs font-medium hidden lg:block truncate">
                {item.label}
              </span>
              {item.id === 'emails' && emailUnread > 0 && (
                <span
                  className="ml-auto bg-red-500 text-white rounded-full text-xs px-1.5 py-0.5 hidden lg:flex items-center justify-center min-w-5 leading-none"
                  style={{ fontSize: '10px' }}
                >
                  {emailUnread}
                </span>
              )}
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 lg:hidden">
                {item.label}
              </div>
            </button>
          );
        })}
      </nav>

      <div className="p-2 border-t border-[#f2f8ff]">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
            {initial}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-xs text-black truncate">{userEmail}</p>
              <p className="text-xs text-gray-500 truncate">Online</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}