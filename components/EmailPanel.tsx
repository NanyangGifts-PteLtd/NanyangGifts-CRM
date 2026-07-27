import { useState } from 'react';
import { Mail, Search, Star, Trash2, Reply, Forward, RotateCcw, Send, Paperclip, ChevronLeft, Circle } from 'lucide-react';
import { Email } from '../app/types';

interface EmailPanelProps {
  emails: Email[];
  onMarkRead: (id: string) => void;
  onDeleteEmail: (id: string) => void;
}

const FOLDERS = ['Inbox', 'Sent', 'Drafts', 'Starred', 'Trash'];

export function EmailPanel({ emails, onMarkRead, onDeleteEmail }: EmailPanelProps) {
  const [selected, setSelected] = useState<Email | null>(null);
  const [folder, setFolder] = useState('Inbox');
  const [search, setSearch] = useState('');
  const [composing, setComposing] = useState(false);
  const [compose, setCompose] = useState({ to: '', subject: '', body: '' });

  const filtered = emails.filter(e =>
    (e.from.toLowerCase().includes(search.toLowerCase()) ||
      e.subject.toLowerCase().includes(search.toLowerCase()) ||
      e.preview.toLowerCase().includes(search.toLowerCase()))
  );

  const unread = emails.filter(e => !e.read).length;

  const handleSelect = (email: Email) => {
    setSelected(email);
    onMarkRead(email.id);
    setComposing(false);
  };

  return (
    <div className="flex h-full bg-white overflow-hidden">
      {/* Left sidebar — folders */}
      <div className="w-44 bg-[#f8f9fb] border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="p-3 border-b border-gray-200">
          <button
            onClick={() => { setComposing(true); setSelected(null); }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Send size={12} />
            Compose
          </button>
        </div>
        <nav className="flex-1 py-2 px-2 space-y-0.5">
          {FOLDERS.map(f => (
            <button
              key={f}
              onClick={() => setFolder(f)}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs transition-colors ${folder === f ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <span>{f}</span>
              {f === 'Inbox' && unread > 0 && (
                <span className="bg-blue-500 text-white rounded-full text-xs px-1.5 py-0.5 leading-none">{unread}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Email list */}
      <div className="w-80 flex flex-col border-r border-gray-200 flex-shrink-0">
        <div className="p-3 border-b border-gray-200">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search emails..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md outline-none focus:border-blue-400 bg-gray-50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Mail size={28} className="mb-2 opacity-30" />
              <p className="text-xs">No emails found</p>
            </div>
          ) : (
            filtered.map(email => (
              <button
                key={email.id}
                onClick={() => handleSelect(email)}
                className={`w-full text-left p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${selected?.id === email.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''} ${!email.read ? 'bg-white' : 'bg-gray-50/50'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    {!email.read && <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                    <span className={`text-xs ${!email.read ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
                      {email.from}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{email.date}</span>
                </div>
                <p className={`text-xs truncate mb-0.5 ${!email.read ? 'text-gray-700 font-medium' : 'text-gray-600'}`}>
                  {email.subject}
                </p>
                <p className="text-xs text-gray-400 truncate">{email.preview}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Email body / Compose */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {composing ? (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <span className="text-sm font-semibold text-gray-800">New Message</span>
              <button onClick={() => setComposing(false)} className="text-gray-400 hover:text-gray-600">
                <ChevronLeft size={18} />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-3 flex-1">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-2">
                <label className="text-xs text-gray-500 w-12">To</label>
                <input
                  type="email"
                  value={compose.to}
                  onChange={e => setCompose(c => ({ ...c, to: e.target.value }))}
                  className="flex-1 text-xs border-none outline-none"
                  placeholder="Recipient email..."
                />
              </div>
              <div className="flex items-center gap-3 border-b border-gray-100 pb-2">
                <label className="text-xs text-gray-500 w-12">Subject</label>
                <input
                  value={compose.subject}
                  onChange={e => setCompose(c => ({ ...c, subject: e.target.value }))}
                  className="flex-1 text-xs border-none outline-none"
                  placeholder="Subject..."
                />
              </div>
              <textarea
                value={compose.body}
                onChange={e => setCompose(c => ({ ...c, body: e.target.value }))}
                className="flex-1 text-xs border-none outline-none resize-none"
                placeholder="Write your email here..."
              />
              <div className="flex gap-2">
                <button className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium transition-colors">
                  <Send size={12} />
                  Send
                </button>
                <button className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs transition-colors">
                  <Paperclip size={12} />
                  Attach
                </button>
                <button
                  onClick={() => setComposing(false)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs transition-colors"
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        ) : selected ? (
          <div className="flex flex-col h-full">
            {/* Email header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-start justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-800 leading-tight">{selected.subject}</h2>
                <div className="flex items-center gap-1 ml-4">
                  <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors" title="Reply">
                    <Reply size={14} />
                  </button>
                  <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors" title="Forward">
                    <Forward size={14} />
                  </button>
                  <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors" title="Star">
                    <Star size={14} />
                  </button>
                  <button
                    onClick={() => { onDeleteEmail(selected.id); setSelected(null); }}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {selected.from[0]}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700">{selected.from}</p>
                  <p className="text-xs text-gray-400">{selected.date}</p>
                </div>
              </div>
            </div>

            {/* Email body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="max-w-2xl">
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {selected.body || selected.preview}
                </p>
              </div>
            </div>

            {/* Reply box */}
            <div className="px-6 py-3 border-t border-gray-200">
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                  <Reply size={12} className="text-gray-400" />
                  <span className="text-xs text-gray-500">Reply to {selected.from}</span>
                </div>
                <textarea
                  className="w-full px-3 py-2 text-xs resize-none outline-none"
                  rows={3}
                  placeholder="Write your reply..."
                />
                <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 flex items-center gap-2">
                  <button className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-xs font-medium transition-colors">
                    <Send size={11} />
                    Send Reply
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Mail size={40} className="mb-3 opacity-20" />
            <p className="text-sm">Select an email to read</p>
            <p className="text-xs mt-1 opacity-70">or compose a new message</p>
          </div>
        )}
      </div>
    </div>
  );
}
