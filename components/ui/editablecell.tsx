"use client";
import React, { useState, useRef, useEffect } from 'react';

export function EditableCell({
    value,
    onChange,
    type = 'text',
    placeholder = '–',
    className = '',
    multiline = false,
}: {
    value: string;
    onChange: (v: string) => void;
    type?: string;
    placeholder?: string;
    className?: string;
    readOnly?: boolean;
    multiline?: boolean;
}) {
    const [editing, setEditing] = useState(false);
    const [local, setLocal] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setLocal(value);
    }, [value]);

    useEffect(() => {
        if (!editing) return;

        if (multiline && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }

        if (!multiline && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editing, multiline]);

    useEffect(() => {
        if (!editing || !multiline || !textareaRef.current) return;

        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }, [local, editing, multiline]);

    const save = () => {
        onChange(local);
        setEditing(false);
    };

    if (editing && multiline) {
        return (
            <textarea
                ref={textareaRef}
                value={local}
                rows={1}
                onChange={(e) => setLocal(e.target.value)}
                onBlur={save}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') save();
                    if (e.key === 'Escape') {
                        setLocal(value);
                        setEditing(false);
                    }
                }}
                className={`w-full px-1 py-0.5 text-xs border border-blue-400 rounded outline-none bg-white resize-none overflow-hidden ${className}`}
                style={{ minWidth: 40 }}
            />
        );
    }

    if (editing) {
        return (
            <input
                ref={inputRef}
                type={type}
                value={local}
                onChange={e => setLocal(e.target.value)}
                onBlur={save}
                onKeyDown={e => {
                    if (e.key === 'Enter') save();
                    if (e.key === 'Escape') {
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
            onClick={() => setEditing(true)}
            title={value}
            className={`flex w-15 px-1 py-0.5 text-xs cursor-text hover:bg-blue-50 rounded min-h-[22px] items-left ${multiline ? 'whitespace-nowrap overflow-hidden text-ellipsis' : 'truncate'
                } ${className}`}
        >
            {value || <span className="text-gray-300 select-none">{placeholder}</span>}
        </div>
    );
}