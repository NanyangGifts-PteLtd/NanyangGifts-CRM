'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
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

    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [open]);

    return (
    <div ref={containerRef} className="relative overflow-visible">
        <div className="relative">
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    setOpen((v) => !v)}}
                className="min-h-[25px] w-full rounded-md !text-center hover:bg-gray-50 transition transform active:scale-95 duration-150"
            >
                {selectedProfiles.length > 0 ? (
                    <div className="flex w-full h-6 items-center justify-center -space-x-2 rounded-full">
                        {selectedProfiles.map((p, i) => (
                            <div
                                key={p.id}
                                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                style={{ background: ['#8babeb', '#b0fff1', '#ba9ef7', '#f776aa'][i % 4] }}
                                title={getLabel(p)}
                            >
                                {initials(p)}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className=" transition transform active:scale-95 duration-150 w-7 h-7 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center mx-auto hover:border-blue-400">
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
                        className="mb-2 w-full rounded-md border px-2 py-1.5 text-xs outline-none u focus:border-[#7BCBD5]"
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
                                    className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs ${checked ? 'bg-[#e7fdff]' : 'hover:bg-gray-50'
                                        }`}
                                >
                                    <input type="checkbox" checked={checked} readOnly className="h-3.5 w-3.5" />
                                    <div className="min-w-0 px-2 flex-1">
                                        <div className="truncate text-gray-500">
                                            {p.email || ''}
                                        </div>
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