"use client";
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2 } from 'lucide-react';

const MENU_WIDTH = 250;

export type BadgeOption = {
    value: string;
    color?: string;
};

function normalizeOptions(options: (string | BadgeOption)[]): BadgeOption[] {
    return options.map((o) => (typeof o === 'string' ? { value: o } : o));
}

export function StatusBadge({
    value,
    onChange,
    options: rawOptions,
    small = false,
    onAddOption,
    onDeleteOption,
    canDeleteOption,
    manageLabel = 'option',
}: {
    value: string;
    onChange: (v: string) => void;
    options: (string | BadgeOption)[];
    small?: boolean;
    onAddOption?: (name: string) => void | Promise<void>;
    onDeleteOption?: (name: string) => void | Promise<void>;
    canDeleteOption?: (name: string) => boolean;
    manageLabel?: string;
}) {
    const [open, setOpen] = useState(false);
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
    const [newOption, setNewOption] = useState('');
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const options = normalizeOptions(rawOptions);
    const currentOption = options.find((o) => o.value === value);
    const activeBg = currentOption?.color ?? '#e5e7eb';

    

    useEffect(() => {
        if (!open) return;
        const h = (e: MouseEvent) => {
            const target = e.target as Node;
            if (btnRef.current?.contains(target)) return;
            if (menuRef.current?.contains(target)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [open]);

    const handleOpen = () => {
        if (!btnRef.current) return;
        const rect = btnRef.current.getBoundingClientRect();
        const spaceRight = window.innerWidth - rect.right;
        const menuHeight = Math.min(options.length * 34 + (onAddOption ? 40 : 0) + 2, 320);

        const left =
            spaceRight >= MENU_WIDTH + 50
                ? rect.right + 4
                : Math.max(8, rect.left - MENU_WIDTH - 4);

        const top = Math.min(
            Math.max(8, rect.top),
            window.innerHeight - menuHeight - 8
        );

        setMenuStyle({ position: 'fixed', top, left, width: MENU_WIDTH, zIndex: 9999 });
        setOpen((v) => !v);
    };

    const menu =
        open &&
        createPortal(
            <div
                ref={menuRef}
                style={menuStyle}
                className="bg-white border border-gray-200 rounded-xl shadow-2xl py-1 max-h-80 overflow-y-auto overflow-x-hidden"
            >
                {options.map((opt) => {
                    const allowDelete = canDeleteOption ? canDeleteOption(opt.value) : true;
                    const optColor = opt.color ?? '#e5e7eb';

                    return (
                        <div
                            key={opt.value || '__empty__'}
                            className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50"
                        >
                            <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => { onChange(opt.value); setOpen(false); }}
                                className="flex min-w-0 flex-1 items-center gap-2 text-left px-1 py-1 text-xs font-semibold"
                            >
                                <span
                                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0 border border-gray-200"
                                    style={{ background: optColor }}
                                />
                                <span className="text-gray-700 flex-1 truncate">{opt.value || '–'}</span>
                                {opt.value === value && <span className="text-blue-500 text-xs">✓</span>}
                            </button>

                            {onDeleteOption && allowDelete && (
                                <button
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={async (e) => { e.stopPropagation(); await onDeleteOption(opt.value); }}
                                    className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                    title={`Delete ${manageLabel}`}
                                >
                                    <Trash2 size={12} />
                                </button>
                            )}
                        </div>
                    );
                })}

                {onAddOption && (
                    <div className="mt-1 border-t border-gray-100 pt-2 pr-2 pl-1">
                        <div className="flex items-center gap-2">
                            <input
                                value={newOption}
                                onChange={(e) => setNewOption(e.target.value)}
                                placeholder={`Add ${manageLabel}`}
                                className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 outline-none focus:border-[#7BCBD5] focus:ring-4 focus:ring-[#7BCBD5]/15"
                            />
                            <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={async () => {
                                    const trimmed = newOption.trim();
                                    if (!trimmed) return;
                                    await onAddOption(trimmed);
                                    setNewOption('');
                                }}
                                className="inline-flex items-center rounded-lg bg-[#7BCBD5] px-2 py-1 text-[10px] font-semibold text-white hover:bg-[#6bc0ca]"
                            >
                                <Plus size={10} />
                                Add
                            </button>
                        </div>
                    </div>
                )}
            </div>,
            document.body
        );

    return (
        <>
            <button
                ref={btnRef}
                onClick={handleOpen}
                className={`mx-auto rounded font-medium whitespace-nowrap leading-none ${small ? 'px-1 py-1 text-[10px]' : 'px-1 py-1 text-[10px]'
                    } transition transform active:scale-95 duration-150`}
                style={{ background: activeBg, color: '#ffffff', minWidth: 50 }}
            >
                {value || <span style={{ opacity: 0.5 }}>Set</span>}
            </button>
            {menu}
        </>
    );
}