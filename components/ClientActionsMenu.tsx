"use client";

import { useEffect, useState } from "react";
import {
  Copy,
  ExternalLink,
  MoreHorizontal,
  MoveRight,
  Search,
  Trash2,
} from "lucide-react";

export function ClientActionsMenu({
  clientId,
  clientName,
  groups,
  canEdit,
  onOpen,
  onDuplicate,
  onMove,
  onDelete,
  className = "",
  triggerClassName = "",
  align = "right",
}: {
  clientId: string;
  clientName: string;
  groups: Array<{ id: string; name: string }>;
  canEdit: boolean;
  onOpen?: () => void;
  onDuplicate: () => void | Promise<void>;
  onMove: (groupId: string) => void | Promise<void>;
  onDelete: () => void;
  className?: string;
  triggerClassName?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [search, setSearch] = useState("");
  const [processing, setProcessing] = useState<"duplicate" | "move" | null>(
    null,
  );
  const run = async (
    kind: "duplicate" | "move",
    action: () => void | Promise<void>,
  ) => {
    setProcessing(kind);
    try {
      await action();
    } finally {
      setProcessing(null);
      setMoving(false);
      setOpen(false);
    }
  };
  useEffect(() => {
    const handler = (event: Event) => {
      if ((event as CustomEvent<string>).detail === clientId) setOpen(true);
    };
    window.addEventListener("crm:client-actions", handler);
    return () => window.removeEventListener("crm:client-actions", handler);
  }, [clientId]);
  return (
    <div
      data-client-action-menu
      data-detail-action-menu={!onOpen || undefined}
      className={`relative ${className} ${open ? "z-[200]" : ""}`}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className={`rounded bg-white/90 p-1 text-slate-400 shadow-sm hover:text-slate-700 ${triggerClassName}`}
        title={`Client actions for ${clientName}`}
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <div
          className={`absolute top-full z-[120] mt-1 w-44 rounded-md border border-slate-200 bg-white p-1 text-left shadow-xl ${align === "left" ? "left-0" : "right-0"}`}
        >
          {onOpen && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpen();
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-2 text-xs text-slate-700 hover:bg-slate-50"
            >
              <ExternalLink size={14} /> Open Client
            </button>
          )}
          <button
            type="button"
            disabled={!canEdit || !!processing}
            onClick={() => void run("duplicate", onDuplicate)}
            title={
              !canEdit
                ? "You can only edit items that are assigned to you"
                : "Duplicate client"
            }
            className="flex w-full items-center gap-2 rounded px-2 py-2 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            <Copy size={14} />{" "}
            {processing === "duplicate" ? "Duplicating…" : "Duplicate"}
          </button>
          <div className="relative">
            <button
              type="button"
              disabled={!canEdit || !!processing}
              onClick={() => setMoving((value) => !value)}
              title={
                !canEdit
                  ? "You can only edit items that are assigned to you"
                  : "Move client"
              }
              className="flex w-full items-center gap-2 rounded px-2 py-2 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              <MoveRight size={14} />{" "}
              {processing === "move" ? "Moving…" : "Move"}
            </button>
            {moving && (
              <div className="absolute left-full top-0 ml-1 max-h-72 w-72 overflow-auto rounded-xl border border-slate-200 bg-white p-3 shadow-2xl">
                <div className="mb-3 text-sm font-medium text-slate-800">
                  Choose a new group
                </div>
                <div className="relative mb-2">
                  <Search
                    size={14}
                    className="absolute left-2.5 top-2.5 text-slate-400"
                  />
                  <input
                    autoFocus
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search groups"
                    className="h-9 w-full rounded border border-slate-200 pl-8 pr-2 text-xs outline-none focus:border-sky-400"
                  />
                </div>
                {groups
                  .filter((group) =>
                    group.name.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((group) => (
                    <button
                      disabled={!!processing}
                      key={group.id}
                      type="button"
                      onClick={() => void run("move", () => onMove(group.id))}
                      className="block w-full rounded px-2 py-2 text-left text-sm text-slate-700 hover:bg-sky-50 disabled:opacity-50"
                    >
                      {group.name}
                    </button>
                  ))}
                {!groups.some((group) =>
                  group.name.toLowerCase().includes(search.toLowerCase()),
                ) && (
                  <p className="px-2 py-4 text-center text-xs text-slate-400">
                    No groups found.
                  </p>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={!canEdit || !!processing}
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            title={
              !canEdit
                ? "You can only edit items that are assigned to you"
                : "Delete client"
            }
            className="flex w-full items-center gap-2 rounded px-2 py-2 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
