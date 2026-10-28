"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Copy,
  ExternalLink,
  MoreHorizontal,
  MoveRight,
  LockKeyhole,
  LockKeyholeOpen,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  copyCrmCellText,
  type CrmRowActionsEventDetail,
} from "@/lib/crm-cell-context";

export function ClientActionsMenu({
  clientId,
  clientName,
  groups,
  canEdit,
  onOpen,
  onDuplicate,
  onMove,
  onDelete,
  canManageSubitemLock = false,
  subitemsLocked = false,
  onToggleSubitemsLock,
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
  canManageSubitemLock?: boolean;
  subitemsLocked?: boolean;
  onToggleSubitemsLock?: () => void;
  className?: string;
  triggerClassName?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [moving, setMoving] = useState(false);
  const [contextCellText, setContextCellText] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
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

  const clampMenuPosition = (left: number, top: number) => ({
    left: Math.max(8, Math.min(left, window.innerWidth - 184)),
    top: Math.max(8, Math.min(top, window.innerHeight - 248)),
  });

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<
        string | CrmRowActionsEventDetail
      >).detail;
      const targetId = typeof detail === "string" ? detail : detail?.id;
      if (targetId !== clientId) return;
      if (
        typeof detail !== "string" &&
        typeof detail.clientX === "number" &&
        typeof detail.clientY === "number"
      ) {
        setMenuPosition(clampMenuPosition(detail.clientX, detail.clientY));
      }
      setContextCellText(
        typeof detail !== "string" && detail.cellText !== undefined
          ? detail.cellText
          : null,
      );
      setOpen(true);
    };
    window.addEventListener("crm:client-actions", handler);
    return () => window.removeEventListener("crm:client-actions", handler);
  }, [clientId]);
  useEffect(() => {
    if (!open) return;

    const closeOnClickAway = (event: PointerEvent) => {
      if (
        !menuRef.current?.contains(event.target as Node) &&
        !triggerRef.current?.contains(event.target as Node)
      ) {
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
      data-client-action-menu
      data-detail-action-menu={!onOpen || undefined}
      className={`relative ${className}`}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setContextCellText(null);
          const rect = event.currentTarget.getBoundingClientRect();
          setOpen((value) => {
            if (!value) {
              setMenuPosition(
                clampMenuPosition(
                  align === "left" ? rect.left : rect.right - 176,
                  rect.bottom + 4,
                ),
              );
            }
            return !value;
          });
        }}
        className={`rounded bg-white/90 p-1 text-slate-400 shadow-sm hover:text-slate-700 ${triggerClassName}`}
        title={`Client actions for ${clientName}`}
      >
        <MoreHorizontal size={15} />
      </button>
      {open && menuPosition &&
        createPortal(
        <div
          ref={menuRef}
          className="fixed z-context-menu w-44 rounded-md border border-slate-200 bg-white p-1 text-left shadow-xl"
          style={menuPosition}
        >
          {contextCellText !== null && (
            <>
              <button
                type="button"
                onClick={() => {
                  const value = contextCellText;
                  setOpen(false);
                  void copyCrmCellText(value)
                    .then(() => toast.success("Cell copied"))
                    .catch(() => toast.error("Could not copy this cell"));
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-2 text-xs text-slate-700 hover:bg-slate-50"
              >
                <Copy size={14} /> Copy cell
              </button>
              <div className="my-1 border-t border-slate-200" />
            </>
          )}
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
          {canManageSubitemLock && onToggleSubitemsLock && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onToggleSubitemsLock();
              }}
              className={`flex w-full items-center gap-2 rounded px-2 py-2 text-xs hover:bg-slate-50 ${
                subitemsLocked ? "text-amber-700" : "text-slate-700"
              }`}
            >
              {subitemsLocked ? (
                <LockKeyholeOpen size={14} />
              ) : (
                <LockKeyhole size={14} />
              )}
              {subitemsLocked
                ? "Unlock Client's Subitems"
                : "Lock Client's Subitems"}
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
        </div>,
        document.body,
      )}
    </div>
  );
}
