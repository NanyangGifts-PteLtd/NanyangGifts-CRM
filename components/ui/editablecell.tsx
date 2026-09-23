"use client";
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';

export function EditableCell({
    value,
    onChange,
    type = 'text',
    placeholder = '',
    className = '',
    readOnly = false,
    multiline = false,
    resizableMultiline = false,
    autoEdit = false,
    onAutoEditStarted,
    onEditingChange,
}: {
    value: string;
    onChange: (v: string) => void;
    type?: string;
    placeholder?: string;
    className?: string;
    readOnly?: boolean;
    multiline?: boolean;
    resizableMultiline?: boolean;
    autoEdit?: boolean;
    onAutoEditStarted?: () => void;
    onEditingChange?: (editing: boolean) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [local, setLocal] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const savedRef = useRef(false);

    useEffect(() => {
        // Realtime snapshots must never replace the user's active draft. Once
        // editing ends, the latest committed prop can safely resynchronise it.
        if (!editing) setLocal(value);
    }, [value, editing]);

    useEffect(() => {
        if (!autoEdit || editing || readOnly) return;
        savedRef.current = false;
        setEditing(true);
        onAutoEditStarted?.();
    }, [autoEdit, editing, readOnly, onAutoEditStarted]);

    useEffect(() => {
        onEditingChange?.(editing);
    }, [editing, onEditingChange]);

    useLayoutEffect(() => {
        if (!editing) return;

        if (multiline && textareaRef.current) {
            textareaRef.current.focus();
            if (!resizableMultiline) {
                textareaRef.current.style.height = 'auto';
                textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
            }
        }

        if (!multiline && inputRef.current) {
            inputRef.current.focus();
            if (autoEdit) inputRef.current.select();
        }
    }, [autoEdit, editing, multiline, resizableMultiline]);

    useEffect(() => {
        if (!editing || !multiline || resizableMultiline || !textareaRef.current) return;

        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }, [local, editing, multiline, resizableMultiline]);

    const save = () => {
        if (readOnly || savedRef.current) return;
        savedRef.current = true;
        onChange(local);
        setEditing(false);
    };

    useEffect(() => {
        if (!editing) return;
        const closeOnPointerAway = (event: PointerEvent) => {
            const target = event.target as Node | null;
            if (
                (target && inputRef.current?.contains(target)) ||
                (target && textareaRef.current?.contains(target))
            ) return;
            save();
        };
        document.addEventListener('pointerdown', closeOnPointerAway, true);
        return () => document.removeEventListener('pointerdown', closeOnPointerAway, true);
    }, [editing, local, onChange, readOnly]);

    if (editing && multiline) {
        const textarea = <textarea
                ref={textareaRef}
                data-inline-editor
                draggable={false}
                value={local}
                rows={resizableMultiline ? 5 : 1}
                onChange={(e) => setLocal(e.target.value)}
                onBlur={save}
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                onDragStart={(event) => event.preventDefault()}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !resizableMultiline) save();
                    if (e.key === 'Escape') {
                        savedRef.current = true;
                        setLocal(value);
                        setEditing(false);
                    }
                }}
                className={`w-full px-2 py-1.5 text-xs border border-blue-400 rounded outline-none bg-white ${resizableMultiline ? "absolute left-0 top-0 z-[1000] h-[260px] min-h-[80px] resize overflow-auto shadow-lg" : "resize-none overflow-hidden"} ${className}`}
                style={{
                    minWidth: 40,
                    width: resizableMultiline
                        ? 'min(620px, calc(100vw - 48px))'
                        : undefined,
                }}
            />;
        return resizableMultiline ? (
            <div className="relative h-[22px] w-full">{textarea}</div>
        ) : textarea;
    }

    if (editing) {
        return (
            <input
                ref={inputRef}
                data-inline-editor
                draggable={false}
                type={type}
                value={local}
                onChange={e => setLocal(e.target.value)}
                onBlur={save}
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                onDragStart={(event) => event.preventDefault()}
                onKeyDown={e => {
                    if (e.key === 'Enter') save();
                    if (e.key === 'Escape') {
                        savedRef.current = true;
                        setLocal(value);
                        setEditing(false);
                    }
                }}
                className={`w-full px-1 py-0.5 text-xs border border-blue-400 rounded outline-none bg-white ${className}`}
                style={{ minWidth: 40 }}
            />
        );
    }

    return (
        <div
            data-editable-cell
            onClick={() => {
                if (readOnly) return;
                savedRef.current = false;
                setEditing(true);
            }}
            title={value}
            className={`flex w-15 justify-center py-0.5 text-xs ${readOnly ? 'cursor-default' : 'cursor-text hover:bg-blue-50'} rounded min-h-[22px] items-center ${multiline ? 'whitespace-nowrap overflow-hidden text-ellipsis' : 'truncate'
                } ${className}`}
        >
            {value || (placeholder && <span className="text-gray-300 select-none">{placeholder}</span>)}
        </div>
    );
}
