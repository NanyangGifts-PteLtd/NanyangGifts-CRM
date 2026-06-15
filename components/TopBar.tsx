import React, { useState, useRef, useEffect } from 'react';
import { Bell, Settings, User, Search, ChevronDown, Check, Info, AlertTriangle, CheckCircle, XCircle, X } from 'lucide-react';
import { Notification } from '../app/types';

interface TopBarProps {
  value: string;
  onChange: (value:string)=> void;
  placeholder?: string;
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

interface SearchBarProps {
  value: string;
  onChange: (value:string)=> void;
  placeholder?: string;
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
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (typeof onChange === 'function') {
      onChange(event.target.value);
    }
  };

  return (
    <div className="flex-1 max-w-md relative">
      <Search
        size={13}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
      />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full text-gray text-xs pl-8 pr-3 py-1.5 rounded-md border focus:outline-none focus:border-[#7BCBD5] placeholder-gray-500 bg-[#e7fdff]"
      />
    </div>
  );
};


export function TopBar({ value, onChange, placeholder = 'Search clients, items...', notifications, onMarkRead, onMarkAllRead }: TopBarProps) {
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const notifsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);


  const unreadCount = notifications.filter(n => !n.read).length;
  

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifsRef.current && !notifsRef.current.contains(e.target as Node)) setShowNotifs(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="h-12 bg-[#ffffff] flex items-center px-4 gap-3 border-b border-[#f2f8ff] flex-shrink-0">


    <SearchBar
        value={value}
        onChange={onChange}
        placeholder="Search clients, items..."
      />

      {/* Notifications */}
      <div ref={notifsRef} className="relative">
        <button
          onClick={() => { setShowNotifs(!showNotifs); setShowProfile(false); setShowSettings(false); }}
          className="relative p-2 rounded-md hover:bg-[#7BCBD5] text-black-300 hover:text-white transition-colors"
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white flex items-center justify-center" style={{ fontSize: '9px' }}>
              {unreadCount}
            </span>
          )}
        </button>

        {showNotifs && (
          <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b">
              <span className="text-xs font-semibold text-gray-700">Notifications</span>
              <button onClick={onMarkAllRead} className="text-xs text-blue-500 hover:text-blue-700">Mark all read</button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">No notifications</div>
              ) : (
                notifications.map(n => (
                  <button
                    key={n.id}
                    onClick={() => onMarkRead(n.id)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex gap-2.5 items-start ${!n.read ? 'bg-blue-50/50' : ''}`}
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

      {/* Settings */}
      <div className="relative">
        <button
          onClick={() => { setShowSettings(!showSettings); setShowNotifs(false); setShowProfile(false); }}
          className="p-2 rounded-md hover:bg-[#7BCBD5] text-black-300 hover:text-white transition-colors"
        >
          <Settings size={16} />
        </button>
        {showSettings && (
          <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b">
              <span className="text-xs font-semibold text-gray-700">Settings</span>
            </div>
            {['General', 'Team Members', 'Permissions', 'Integrations', 'Billing', 'Notifications'].map(item => (
              <button key={item} className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 border-b border-gray-50">
                {item}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Profile */}
      <div ref={profileRef} className="relative ml-auto">
        <button
          onClick={() => { setShowProfile(!showProfile); setShowNotifs(false); setShowSettings(false); }}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-[#7BCBD5] transition-colors"
        >
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-semibold">
            A
          </div>
          <span className="text-black text-xs hidden lg:block">Admin</span>
          <ChevronDown size={12} className="text-black hidden lg:block" />
        </button>
        {showProfile && (
          <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b">
              <p className="text-xs font-semibold text-gray-800">Admin User</p>
              <p className="text-xs text-gray-500 mt-0.5">admin@procrm.com</p>
            </div>
            {['My Profile', 'Account Settings', 'My Notifications', 'Keyboard Shortcuts', 'Log Out'].map((item, i) => (
              <button
                key={item}
                className={`w-full text-left px-4 py-2 text-xs hover:bg-[#7BCBD5] border-b border-gray-50 ${i === 4 ? 'text-red-500' : 'text-gray-700'}`}
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
