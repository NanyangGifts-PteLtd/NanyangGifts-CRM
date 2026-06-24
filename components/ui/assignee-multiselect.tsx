'use client';

import React, { useMemo, useState } from 'react';
import type { Profile } from '../../app/types';
import { Plus, X } from 'lucide-react';

type Props = {
    profiles: Profile[];
    selectedIds: string[];
    onChange: (ids: string[]) => void;
};

function getLabel(profile: Profile) {
    return profile.full_name || profile.email || 'User';
}

function initials(profile: Profile) {
    const label = getLabel(profile).trim();
    return label.charAt(0).toUpperCase();
}

export function AssigneeMultiSelect({ profiles, selectedIds, onChange }: Props) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');

    const selectedProfiles = useMemo(
        () => profiles.filter((p) => selectedIds.includes(p.id)),
        [profiles, selectedIds]
    );

    const filteredProfiles = useMemo(() => {
        const q = query.toLowerCase().trim();
        if (!q) return profiles;
        return profiles.filter((p) => {
            const name = p.full_name?.toLowerCase() ?? '';
            const email = p.email?.toLowerCase() ?? '';
            return name.includes(q) || email.includes(q);
        });
    }, [profiles, query]);

    const toggle = (id: string) => {
        if (selectedIds.includes(id)) {
            onChange(selectedIds.filter((x) => x !== id));
        } else {
            onChange([...selectedIds, id]);
        }
    };

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="min-h-[28px] w-full rounded-md px-1 py-1 text-left hover:bg-gray-50"
            >
                {selectedProfiles.length > 0 ? (
                    <div className="flex gap-0.5 flex-wrap">
                        {selectedProfiles.map((p, i) => (
                            <div
                                key={p.id}
                                className="w-6 h-6 rounded-sm flex items-center justify-center text-white text-xs font-bold"
                                style={{ background: ['#845ec2', '#2c73d2', '#0081cf', '#0089ba'][i % 4] }}
                                title={getLabel(p)}
                            >
                                {initials(p)}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="w-6 h-6 rounded-sm border-2 border-dashed border-gray-300 flex items-center justify-center hover:border-blue-400">
                        <Plus size={9} className="text-gray-400" />
                    </div>
                )}
            </button>

            {open && (
                <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search people..."
                        className="mb-2 w-full rounded-md border px-2 py-1.5 text-xs outline-none focus:border-[#7BCBD5]"
                    />

                    {selectedProfiles.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1">
                            {selectedProfiles.map((p) => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => toggle(p.id)}
                                    className="inline-flex items-center gap-1 rounded-full bg-[#e7fdff] px-2 py-1 text-[11px] text-gray-700"
                                >
                                    <span>{getLabel(p)}</span>
                                    <X size={10} />
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="max-h-56 overflow-auto space-y-1">
                        {filteredProfiles.map((p) => {
                            const checked = selectedIds.includes(p.id);
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => toggle(p.id)}
                                    className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs ${checked ? 'bg-[#e7fdff]' : 'hover:bg-gray-50'
                                        }`}
                                >
                                    <div className="min-w-0">
                                        <div className="truncate font-medium text-gray-800">
                                            {p.full_name || 'Unnamed user'}
                                        </div>
                                        <div className="truncate text-gray-500">
                                            {p.email || ''}
                                        </div>
                                    </div>
                                    <input type="checkbox" checked={checked} readOnly className="h-3.5 w-3.5" />
                                </button>
                            );
                        })}

                        {filteredProfiles.length === 0 && (
                            <div className="px-2 py-3 text-xs text-gray-400">No matching users</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}