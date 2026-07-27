"use client";

import { useMemo, useState, useEffect, useRef } from 'react';
import type { Profile } from '../../app/types';
import { Plus, X } from 'lucide-react';

type Props = {
    profiles: Profile[];
    selectedIds: string[];
    onChange: (ids: string[]) => void;
};

const GRADIENTS = [
    'linear-gradient(150deg, #7ae9f0, #ff4dac)',
    'linear-gradient(150deg, #ffb0d6, #7bdeff)',
    'linear-gradient(150deg, #d874ff, #caffd4)',
    'linear-gradient(150deg, #ccffcc, #3c93db)',
    'linear-gradient(150deg, #f9a8d4, #818cf8)',
    'linear-gradient(150deg, #923eff, rgb(151, 177, 255))',
    'linear-gradient(150deg, #8985ce, #a13762)',
];

function gradientForId(id: string): string {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = (hash * 6 + id.charCodeAt(i)) >>> 0;
    }
    return GRADIENTS[hash % GRADIENTS.length];
}

function getLabel(profile: Profile) {
    return profile.full_name || profile.email || 'User';
}

function initials(profile: Profile) {
    const label = getLabel(profile).trim();
    const words = label.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    return label.slice(0, 2).toUpperCase();
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

    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    return (
        <div ref={containerRef} className="relative overflow-visible">
            <div className="relative">
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
                    className="min-h-[25px] w-full rounded-md !text-center hover:bg-gray-50 transition transform active:scale-95 duration-150"
                >
                    {selectedProfiles.length > 0 ? (
                        <div className="flex w-full h-6 items-center justify-center -space-x-2 rounded-full">
                            {selectedProfiles.map((p) => (
                                <div
                                    key={p.id}
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                                    style={{ background: gradientForId(p.id) }}
                                    title={getLabel(p)}
                                >
                                    {initials(p)}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="transition transform active:scale-95 duration-150 w-7 h-7 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center mx-auto hover:border-blue-400">
                            <Plus size={9} className="text-gray-500" />
                        </div>
                    )}
                </button>

                {open && (
                    <div className="fixed left-[500px] right-[200px] z-[9999] w-72 rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search people..."
                            className="mb-2 w-full rounded-md border px-2 py-1.5 text-xs outline-none focus:border-[#7BCBD5]"
                            onClick={(e) => e.stopPropagation()}
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
                                        className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs ${checked ? 'bg-[#e7fdff]' : 'hover:bg-gray-50'}`}
                                    >
                                        <input type="checkbox" checked={checked} readOnly className="h-3.5 w-3.5 flex-shrink-0" />
                                        <div
                                            className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                                            style={{ background: gradientForId(p.id) }}
                                        >
                                            {initials(p)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-gray-500">{p.email || ''}</div>
                                        </div>
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
        </div>
    );
}