"use client";

import { useState } from "react";
import { Copy, MoreHorizontal, MoveRight, Trash2 } from "lucide-react";

export function ClientActionsMenu({ clientName, groups, canEdit, onDuplicate, onMove, onDelete, className = "", triggerClassName = "", align = "right" }: {
    clientName: string;
    groups: Array<{ id: string; name: string }>;
    canEdit: boolean;
    onDuplicate: () => void | Promise<void>;
    onMove: (groupId: string) => void | Promise<void>;
    onDelete: () => void;
    className?: string;
    triggerClassName?: string;
    align?: "left" | "right";
}) {
    const [open, setOpen] = useState(false);
    const [moving, setMoving] = useState(false);
    const run = async (action: () => void | Promise<void>) => { setOpen(false); await action(); };
    return <div className={`relative ${className}`}>
        <button type="button" onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }} className={`rounded bg-white/90 p-1 text-slate-400 shadow-sm hover:text-slate-700 ${triggerClassName}`} title={`Client actions for ${clientName}`}><MoreHorizontal size={15} /></button>
        {open && <div className={`absolute top-full z-[120] mt-1 w-44 rounded-md border border-slate-200 bg-white p-1 text-left shadow-xl ${align === "left" ? "left-0" : "right-0"}`}>
            <button type="button" disabled={!canEdit} onClick={() => void run(onDuplicate)} title={!canEdit ? "You can only edit items that are assigned to you" : "Duplicate client"} className="flex w-full items-center gap-2 rounded px-2 py-2 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"><Copy size={14} /> Duplicate</button>
            <div className="relative"><button type="button" disabled={!canEdit} onClick={() => setMoving((value) => !value)} title={!canEdit ? "You can only edit items that are assigned to you" : "Move client"} className="flex w-full items-center gap-2 rounded px-2 py-2 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"><MoveRight size={14} /> Move</button>{moving && <div className="absolute right-full top-0 mr-1 max-h-56 w-48 overflow-auto rounded-md border border-slate-200 bg-white p-1 shadow-xl">{groups.map((group) => <button key={group.id} type="button" onClick={() => void run(() => onMove(group.id))} className="block w-full rounded px-2 py-2 text-left text-xs text-slate-700 hover:bg-sky-50">{group.name}</button>)}</div>}</div>
            <button type="button" disabled={!canEdit} onClick={() => { setOpen(false); onDelete(); }} title={!canEdit ? "You can only edit items that are assigned to you" : "Delete client"} className="flex w-full items-center gap-2 rounded px-2 py-2 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"><Trash2 size={14} /> Delete</button>
        </div>}
    </div>;
}
