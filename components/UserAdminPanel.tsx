'use client';

import { useState } from 'react';
import { MailPlus, Send } from 'lucide-react';
import type { Profile } from '../app/types';

type AllowedRole = 'sales' | 'pm' | 'admin' | 'dev' | 'shipper';

const roles: AllowedRole[] = ['sales', 'pm', 'admin', 'dev', 'shipper'];

interface UserAdminPanelProps {
  profiles: Profile[];
}

export function UserAdminPanel({ profiles }: UserAdminPanelProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AllowedRole>('sales');
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSending(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      const result = await response.json() as { error?: string; email?: string; role?: string };
      if (!response.ok) throw new Error(result.error || 'The invitation could not be sent.');

      setMessage(`Invitation sent to ${result.email} with the ${result.role} role.`);
      setEmail('');
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'The invitation could not be sent.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 bg-[#f8fafc] p-4">
      <div className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e7fdff] text-[#16a5c4]">
            <MailPlus size={18} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">User Admin</h2>
            <p className="text-sm text-slate-500">Invite a new team member and assign their initial role.</p>
          </div>
        </div>

        <form onSubmit={sendInvite} className="grid gap-4 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end">
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            Email address
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              className="h-10 rounded-md border border-slate-200 px-3 text-sm font-normal text-slate-900 outline-none focus:border-[#16a5c4] focus:ring-2 focus:ring-[#16a5c4]/20"
            />
          </label>

          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            Initial role
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as AllowedRole)}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none focus:border-[#16a5c4] focus:ring-2 focus:ring-[#16a5c4]/20"
            >
              {roles.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>

          <button
            type="submit"
            disabled={isSending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#16a5c4] px-4 text-sm font-medium text-white hover:bg-[#0f8da8] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send size={15} />
            {isSending ? 'Sending...' : 'Send invite'}
          </button>
        </form>

        {message && <p className="mx-5 mb-5 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
        {error && <p className="mx-5 mb-5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>

      <div className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Current team</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="border-b border-slate-200 px-5 py-3">Email</th>
                <th className="border-b border-slate-200 px-5 py-3">Role</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-5 py-3 text-slate-700">{profile.email || '-'}</td>
                  <td className="px-5 py-3 text-slate-700">{profile.role || 'unassigned'}</td>
                </tr>
              ))}
              {profiles.length === 0 && <tr><td colSpan={2} className="px-5 py-8 text-center text-sm text-slate-500">No team members found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
