"use client";
import React, { useEffect, useRef, useState } from "react";
import { FolderPlus, X } from "lucide-react";

type AddGroupModalProps = {
    open: boolean;
    onClose: () => void;
    onSubmit: (name: string) => void;
};

export function AddGroupModal({ open, onClose, onSubmit }: AddGroupModalProps) {
    const [name, setName] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setName("");
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    }, [open]);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (!open) return;
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && name.trim()) {
                onSubmit(name.trim());
                onClose();
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, name, onClose, onSubmit]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-[2px] px-4">
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7BCBD5]/15 text-[#5bb8c3]">
                            <FolderPlus size={18} />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-gray-900">Add group</h2>
                            <p className="text-xs text-gray-500">Create a new client group.</p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        aria-label="Close add group modal"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="px-5 py-4">
                    <label className="mb-2 block text-xs font-medium text-gray-600">
                        Group name
                    </label>
                    <input
                        ref={inputRef}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Corporate clients"
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-[#7BCBD5] focus:ring-4 focus:ring-[#7BCBD5]/15"
                    />
                    <p className="mt-2 text-xs text-gray-400">
                        Keep it short and easy to scan.
                    </p>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
                    <button
                        onClick={onClose}
                        className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            if (!name.trim()) return;
                            onSubmit(name.trim());
                            onClose();
                        }}
                        disabled={!name.trim()}
                        className="rounded-xl bg-[#7BCBD5] px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#6bc0ca] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Create group
                    </button>
                </div>
            </div>
        </div>
    );
}