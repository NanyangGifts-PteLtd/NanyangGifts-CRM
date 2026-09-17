"use client";

import { useEffect, useRef, useState } from "react";
import {
  Copy,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  MoreHorizontal,
  MoveRight,
  Search,
  Trash2,
} from "lucide-react";

export function SubitemActionsMenu({
  subitemId,
  subitemName,
  targetGroups,
  canEdit,
  onOpen,
  onDuplicate,
  onMove,
  onDelete,
  hideMoveAndDuplicate = false,
  alwaysVisible = false,
  triggerOffsetPx = -28,
}: {
  subitemId: string;
  subitemName: string;
  targetGroups: Array<{
    name: string;
    clients: Array<{
      id: string;
      name: string;
      displayId?: string;
      company?: string;
      email?: string;
      subitems?: string[];
      canMoveHere?: boolean;
    }>;
  }>;
  canEdit: boolean;
  onOpen?: () => void;
  onDuplicate: () => void | Promise<void>;
  onMove: (clientId: string) => void | Promise<void>;
  onDelete: () => void;
  hideMoveAndDuplicate?: boolean;
  alwaysVisible?: boolean;
  triggerOffsetPx?: number;
}) {
  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
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
      if ((event as CustomEvent<string>).detail === subitemId) setOpen(true);
    };
    window.addEventListener("crm:subitem-actions", handler);
    return () => window.removeEventListener("crm:subitem-actions", handler);
  }, [subitemId]);
  useEffect(() => {
    if (!open) return;

    const closeOnClickAway = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMoving(false);
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnClickAway);
    return () => document.removeEventListener("pointerdown", closeOnClickAway);
  }, [open]);
  return (
    <div
      ref={menuRef}
      data-subitem-action-menu
      data-detail-action-menu={!onOpen || undefined}
      className={`${onOpen ? "absolute top-1/2 -translate-y-1/2" : "relative"} ${open ? "z-[200]" : "z-30"}`}
      style={onOpen ? { left: triggerOffsetPx } : undefined}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className={`rounded bg-white/90 p-1 text-slate-400 shadow-sm transition-opacity hover:text-slate-700 ${alwaysVisible || !onOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        title={`Subitem actions for ${subitemName}`}
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-[120] mt-1 w-44 rounded-md border border-slate-200 bg-white p-1 text-left shadow-xl">
          {onOpen && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpen();
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-2 text-xs text-slate-700 hover:bg-slate-50"
            >
              <ExternalLink size={14} /> Open Subitem
            </button>
          )}
          {!hideMoveAndDuplicate && (
            <button
              type="button"
              disabled={!canEdit || !!processing}
              onClick={() => void run("duplicate", onDuplicate)}
              className="flex w-full items-center gap-2 rounded px-2 py-2 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
              title={
                !canEdit
                  ? "You can only edit items that are assigned to you"
                  : "Duplicate subitem"
              }
            >
              <Copy size={14} />{" "}
              {processing === "duplicate" ? "Duplicating…" : "Duplicate"}
            </button>
          )}
          {!hideMoveAndDuplicate && (
            <div className="relative">
              <button
                type="button"
                disabled={!canEdit || !!processing}
                onClick={() =>
                  setMoving((value) => {
                    if (!value)
                      setExpandedGroups(
                        new Set(targetGroups.map((group) => group.name)),
                      );
                    return !value;
                  })
                }
                className="flex w-full items-center gap-2 rounded px-2 py-2 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                title={
                  !canEdit
                    ? "You can only edit items that are assigned to you"
                    : "Move subitem"
                }
              >
                <MoveRight size={14} />{" "}
                {processing === "move" ? "Moving…" : "Move"}
              </button>
              {moving && (
                <div className="absolute left-full top-0 ml-1 max-h-72 w-80 overflow-auto rounded-xl border border-slate-200 bg-white p-3 shadow-2xl">
                  <div className="mb-3 text-sm font-medium text-slate-800">
                    Choose a new parent
                  </div>
                  <div className="relative mb-3">
                    <Search
                      size={14}
                      className="absolute left-2.5 top-2.5 text-slate-400"
                    />
                    <input
                      autoFocus
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search clients"
                      className="h-9 w-full rounded border border-slate-200 pl-8 pr-2 text-xs outline-none focus:border-sky-400"
                    />
                  </div>
                  {targetGroups.map((group) => {
                    const clients = group.clients.filter((client) =>
                      `${client.name} ${client.displayId ?? ""} ${client.company ?? ""} ${client.email ?? ""}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    );
                    return clients.length ? (
                      <div key={group.name} className="mb-2">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedGroups((current) => {
                              const next = new Set(current);
                              if (next.has(group.name)) next.delete(group.name);
                              else next.add(group.name);
                              return next;
                            })
                          }
                          className="flex w-full items-center justify-between rounded px-1 py-1 text-xs font-medium text-sky-600 hover:bg-sky-50"
                        >
                          <span>{group.name}</span>
                          {expandedGroups.has(group.name) ? (
                            <ChevronDown size={14} />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                        </button>
                        {expandedGroups.has(group.name) && clients.map((client) => (
                          <button
                            disabled={!!processing || client.canMoveHere === false}
                            key={client.id}
                            type="button"
                            onClick={() =>
                              void run("move", () => onMove(client.id))
                            }
                            title={
                              client.canMoveHere === false
                                ? "You can only move subitems into clients assigned to you"
                                : "Move subitem here"
                            }
                            className="block w-full rounded px-2 py-2 text-left text-sm text-slate-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {client.name}
                            {client.displayId ? (
                              <span className="ml-1 font-mono text-xs text-slate-400">
                                · {client.displayId}
                              </span>
                            ) : null}
                            <span className="mt-0.5 block truncate text-xs text-slate-500">
                              Company: {client.company || "—"} · Email: {client.email || "—"}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-slate-400">
                              Subitems ({client.subitems?.length ?? 0}): {client.subitems?.length
                                ? client.subitems.slice(0, 3).join(", ") +
                                  (client.subitems.length > 3 ? "…" : "")
                                : "None"}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null;
                  })}
                  {!targetGroups.some((group) =>
                    group.clients.some((client) =>
                      `${client.name} ${client.displayId ?? ""} ${client.company ?? ""} ${client.email ?? ""}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    ),
                  ) && (
                    <p className="px-2 py-4 text-center text-xs text-slate-400">
                      No clients found.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            disabled={!canEdit || !!processing}
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-2 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
            title={
              !canEdit
                ? "You can only edit items that are assigned to you"
                : "Delete subitem"
            }
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
