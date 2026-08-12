'use client';

import { Users } from 'lucide-react';
import type { Profile } from '../app/types';

interface TeamPanelProps {
  profiles: Profile[];
}

export function TeamPanel({ profiles }: TeamPanelProps) {
  const roleOrder = ['director', 'admin', 'pm', 'sales', 'dev'] as const;

  const sortedProfiles = [...profiles].sort((a, b) => {
    const roleA = (a.role || '').toLowerCase();
    const roleB = (b.role || '').toLowerCase();

    const rankA = roleOrder.indexOf(roleA as typeof roleOrder[number]);
    const rankB = roleOrder.indexOf(roleB as typeof roleOrder[number]);

    const safeRankA = rankA === -1 ? roleOrder.length : rankA;
    const safeRankB = rankB === -1 ? roleOrder.length : rankB;

    if (safeRankA !== safeRankB) {
      return safeRankA - safeRankB;
    }

    const nameA = (a.full_name || a.email || '').toLowerCase();
    const nameB = (b.full_name || b.email || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

  return (
    <div className="flex h-full flex-col bg-[#f8fafc] p-4">
      <div className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e7fdff] text-[#16a5c4]">
            <Users size={18} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Team</h2>
            <p className="text-sm text-slate-500">All users in the workspace and their roles.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="border-b border-slate-200 px-5 py-3">User</th>
                <th className="border-b border-slate-200 px-5 py-3">Email</th>
                <th className="border-b border-slate-200 px-5 py-3">Role</th>
              </tr>
            </thead>
            <tbody>
              {sortedProfiles.length > 0 ? (
                sortedProfiles.map((profile) => (
                  <tr key={profile.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-5 py-4 align-top text-slate-900">
                      <div className="font-medium">{profile.full_name || 'Unnamed user'}</div>
                    </td>
                    <td className="px-5 py-4 align-top text-slate-700">
                      {profile.email || '-'}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <span className="inline-flex rounded-full bg-[#eef8fb] px-3 py-1 text-xs font-medium text-[#0f7f95]">
                        {profile.role || 'unassigned'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-5 py-12 text-center text-sm text-slate-500">
                    No team members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
