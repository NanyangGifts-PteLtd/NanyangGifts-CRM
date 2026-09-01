"use client";

import { FilePlus2, Files, X } from "lucide-react";
import type { Client } from "@/app/types";

export function OcfChooserModal({ open, client, canGenerate, onClose, onView, onGenerate }: {
    open: boolean;
    client: Client | null;
    canGenerate: boolean;
    onClose: () => void;
    onView: () => void;
    onGenerate: () => void;
}) {
    if (!open || !client) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="ocf-chooser-title">
            <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                        <h2 id="ocf-chooser-title" className="text-base font-semibold text-slate-900">Order Confirmation Form</h2>
                        <p className="mt-1 text-sm text-slate-500">{client.name || "Unnamed client"}</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Close"><X size={18} /></button>
                </div>
                <div className="grid gap-3 p-5 sm:grid-cols-2">
                    <button type="button" onClick={onView} className="min-h-36 rounded-xl border-2 border-sky-200 bg-sky-50 p-5 text-left transition hover:border-sky-400 hover:bg-sky-100">
                        <Files size={22} className="mb-3 text-sky-600" />
                        <strong className="block text-sm text-sky-900">View OCFs</strong>
                        <span className="mt-1 block text-xs leading-5 text-sky-800">Open this client&apos;s Files tab and browse their OCFs.</span>
                    </button>
                    <span title={canGenerate ? undefined : "Generating OCF is for Sales"} className="block">
                        <button type="button" onClick={onGenerate} disabled={!canGenerate} className="min-h-36 w-full rounded-xl border-2 border-teal-200 bg-teal-50 p-5 text-left transition hover:border-teal-400 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-teal-200 disabled:hover:bg-teal-50">
                            <FilePlus2 size={22} className="mb-3 text-teal-600" />
                            <strong className="block text-sm text-teal-900">Generate OCF</strong>
                            <span className="mt-1 block text-xs leading-5 text-teal-800">Create a new Order Confirmation Form for this client.</span>
                        </button>
                    </span>
                </div>
            </div>
        </div>
    );
}
