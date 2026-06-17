import React from 'react';
import { LayoutGrid, Mail, BarChart2, Users, SquareChartGantt, Calendar, Star, Building2 } from 'lucide-react';

export type SidePanel = 'crm' | 'emails' | 'reports';

interface SidebarProps {
  activePanel: SidePanel;
  onChangePanel: (panel: SidePanel) => void;
  emailUnread: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;

}

const navItems: { id: SidePanel; icon: React.ReactNode; label: string }[] = [
  { id: 'crm', icon: <LayoutGrid size={18} />, label: 'CRM Board' },
  { id: 'emails', icon: <Mail size={18} />, label: 'Emails' },
  { id: 'reports', icon: <BarChart2 size={18} />, label: 'Reports & KPI' },
];

export function Sidebar({ activePanel, onChangePanel, emailUnread, collapsed, onToggleCollapsed }: SidebarProps) {
  return (
    <div className={`${collapsed ? 'w-12' : 'w-52'} bg-[#ffffff] flex flex-col border-r border-[#f2f8ff] flex-shrink-0 h-fulltransition-[width] duration-200 ease-in-out overflow-hidden 
  `}
>
      {/* Brand area */}
      <div className="h-12 flex items-center justify-center lg:justify-start px-1 lg:px-4 border-b border-[#f2f8ff]">
      <div className="flex items-center gap-2 min-w-0">
    {!collapsed && (
      <span className="text-sm font-semibold text-black truncate">
        NanyangGifts
      </span>
    )}
  </div>

  <button
    onClick={onToggleCollapsed}
    className="p-1.5 rounded-md text-gray-500 hover:bg-[#7BCBD5] hover:text-white transition-colors"
    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
  >
    {collapsed ? '›' : '‹'}
          </button>
        </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 ">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => onChangePanel(item.id)}
            className={`
              w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-all group relative
              ${activePanel === item.id
                ? 'bg-[#7BCBD5] text-white'
                : 'text-gray-500 hover:bg-[#7BCBD5] hover:text-white'
              }
            `}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            <span className="text-xs font-medium hidden lg:block truncate">{item.label}</span>
            {item.id === 'emails' && emailUnread > 0 && (
              <span className="ml-auto bg-red-500 text-white rounded-full text-xs px-1.5 py-0.5 hidden lg:flex items-center justify-center min-w-5 leading-none" style={{ fontSize: '10px' }}>
                {emailUnread}
              </span>
            )}
            {/* Tooltip for collapsed state */}
            <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 lg:hidden">
              {item.label}
            </div>
          </button>
        ))}

        {[
          { icon: <Users size={17.5} />, label: 'Teams' },
          { icon: <Building2 size={17.5} />, label: 'Companies' },
          { icon: <SquareChartGantt size={17.5} />, label: 'Gantt Chart' },
          { icon: <Star size={17.5} />, label: 'Starred' },
        ].map(item => (
          <button
            key={item.label}
            className="w-full flex items-center gap-4.5 px-2 py-1.5 rounded-md text-gray-500 hover:bg-[#7BCBD5] hover:text-white transition-colors group relative"
          >
            <span className="flex-shrink-0 mr-3.5">{item.icon}</span>
            <span className="text-xs font-semibold hidden lg:block">{item.label}</span>
            <div className="absolute left-full bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 lg:hidden">
              {item.label}
            </div>
          </button>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t border-[#f2f8ff]">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
            A
          </div>
          <div className="hidden lg:block min-w-0">
            <p className="text-xs text-black truncate">Admin User</p>
            <p className="text-xs text-gray-500 truncate">Online</p>
          </div>
        </div>
      </div>
    </div>
  );
}
