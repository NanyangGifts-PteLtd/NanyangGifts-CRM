"use client";
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

const MENU_WIDTH = 180;

export function StatusBadge({
    value, onChange, options, colorMap, small = false,
}: {
    value: string; onChange: (v: string) => void;
    options: string[]; colorMap: Record<string, string>; small?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const h = (e: MouseEvent) => {
            const target = e.target as Node;
            if (btnRef.current && btnRef.current.contains(target)) return;
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
        const spaceBelow = window.innerHeight - rect.bottom;
        const menuHeight = Math.min(options.length * 30 + 8, 280);

        // Prefer right of button; fall back to left
        const left = spaceRight >= MENU_WIDTH + 8
            ? rect.right + 4
            : rect.left - MENU_WIDTH - 4;

        // Prefer below; fall back to above
        const top = spaceBelow >= menuHeight
            ? rect.top
            : Math.max(4, rect.bottom - menuHeight);

        setMenuStyle({ position: 'fixed', top, left, width: MENU_WIDTH, zIndex: 9999 });
        setOpen(v => !v);
    };

    const bg = colorMap[value] || '#e5e7eb';


    const menu = open && createPortal(
        <div
            ref={menuRef}
            style={menuStyle}
            className="bg-white border font-semibold border-gray-200 rounded-lg shadow-2xl py-1 max-h-96 transition transform active:scale-95 duration-150 overflow-y-auto"
        >
            {options.map(opt => (
                <button
                    key={opt || '__empty__'}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => { console.log('clicked option', opt); onChange(opt); setOpen(false); }}
                    className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors"
                >
                    <span
                        className="w-2.5 h-2.5 rounded-sm flex-shrink-0 border border-gray-200"
                        style={{ background: colorMap[opt] || '#e5e7eb' }}
                    />
                    <span className="text-gray-700 flex-1">{opt || '–'}</span>
                    {opt === value && <span className="text-blue-500 text-xs">✓</span>}
                </button>
            ))}
        </div>,
        document.body,
    );

    return (
        <>
            <button
                ref={btnRef}
                onClick={handleOpen}
                className={`rounded font-medium whitespace-nowrap leading-none ${small ? 'px-2 py-1 text-[10px]' : 'px-2 py-1 text-[10px]'} transition transform active:scale-95 duration-150`}
                style={{ background: bg, color: '#ffffff', minWidth: 50 }}
            >
                {value || <span style={{ opacity: 0.5 }}>Set</span>}
            </button>
            {menu}
        </>
    );
}