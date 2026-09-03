"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { toast } from "sonner";
import type { Profile } from "@/app/types";
import {
  getSalesRoundRobinPointer,
  getSalesRoundRobinQueue,
  saveSalesRoundRobinLayout,
  setSalesRoundRobinPointer,
  type RoundRobinQueueRow,
} from "@/lib/crm";

type ListName = "sales" | "whatsapp" | "out";
const lists: Array<{ id: ListName; title: string; help: string }> = [
  {
    id: "sales",
    title: "Sales round robin",
    help: `Used for automatic lead assignment. (Drag arrow to manually reposition)`,
  },
  { id: "whatsapp", title: "Whatsapp", help: "Whatsapp lead duty." },
  {
    id: "out",
    title: "Out of Rotation",
    help: "Not assigned by the sales round robin.",
  },
];

function PointerArrow({ ghost = false }: { ghost?: boolean }) {
  return (
    <span
      className={`pointer-events-none flex h-11 w-[116px] select-none items-center pl-3 pr-5 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm ${ghost ? "bg-sky-400/35 shadow-none" : "bg-sky-600"}`}
      style={{
        clipPath:
          "polygon(0 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 0 100%)",
      }}
    >
      {ghost ? null : "Next in line"}
    </span>
  );
}

export function RoundRobinAdminPanel({
  profiles,
  currentUserRole,
}: {
  profiles: Profile[];
  currentUserRole?: string | null;
}) {
  const [rows, setRows] = useState<RoundRobinQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedUser, setDraggedUser] = useState<string | null>(null);
  const [draggingPointer, setDraggingPointer] = useState(false);
  const [pointer, setPointer] = useState(0);
  const [over, setOver] = useState<{ list: ListName; id?: string } | null>(
    null,
  );
  const editable = ["director", "admin", "dev"].includes(
    (currentUserRole ?? "").toLowerCase(),
  );
  const users = useMemo(
    () =>
      profiles
        .filter((p) => p.role?.toLowerCase() === "sales")
        .map((p, index) => ({
          user_id: p.id,
          full_name: p.full_name,
          email: p.email,
          position: index + 10000,
          is_active: false,
          is_current: false,
          list_name: "out" as ListName,
          ...rows.find((row) => row.user_id === p.id),
        }))
        .sort((a, b) => a.position - b.position),
    [profiles, rows],
  );

  const load = async () => {
    setLoading(true);
    try {
      const [queue, position] = await Promise.all([
        getSalesRoundRobinQueue(),
        getSalesRoundRobinPointer(),
      ]);
      setRows(queue);
      setPointer(position);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const saveRows = (next: RoundRobinQueueRow[]) => {
    if (!editable) return;
    const ordered = next.map((row, position) => ({ ...row, position }));
    setRows(ordered);
    void saveSalesRoundRobinLayout(
      ordered.map((row) => ({
        user_id: row.user_id,
        list_name: (row.list_name ?? "out") as ListName,
        position: row.position,
      })),
    ).catch(() => void load());
  };
  const setPointerPosition = (position: number) => {
    if (!editable) return;
    setPointer(position);
    setDraggingPointer(false);
    void setSalesRoundRobinPointer(position)
      .then(() => toast.success("Round robin pointer moved"))
      .catch(() => void load());
  };
  const place = (list: ListName, before?: string) => {
    if (!editable) return;
    if (!draggedUser) return;
    const moved = users.find((user) => user.user_id === draggedUser);
    if (!moved) return;
    const sales = users.filter((user) => user.list_name === "sales");
    if (moved.list_name === "sales" && list !== "sales" && sales.length === 1) {
      toast.warning("Sales round robin needs a participant", {
        description: "Keep at least one user in Sales round robin.",
      });
      return;
    }
    const next = users.filter((user) => user.user_id !== draggedUser);
    const at = before
      ? next.findIndex((user) => user.user_id === before)
      : next.length;
    next.splice(at < 0 ? next.length : at, 0, { ...moved, list_name: list });
    const count = next.filter((user) => user.list_name === "sales").length;
    if (pointer >= count) setPointerPosition(count - 1);
    saveRows(next);
    setDraggedUser(null);
    setOver(null);
  };
  const nudge = (row: RoundRobinQueueRow, direction: -1 | 1) => {
    if (!editable) return;
    const same = users.filter((user) => user.list_name === row.list_name);
    const index = same.findIndex((user) => user.user_id === row.user_id);
    const target = same[index + direction];
    if (!target) return;
    const next = [...users],
      a = next.findIndex((user) => user.user_id === row.user_id),
      b = next.findIndex((user) => user.user_id === target.user_id);
    [next[a], next[b]] = [next[b], next[a]];
    saveRows(next);
  };

  if (loading)
    return (
      <div className="text-sm text-gray-500">Loading round robin lists...</div>
    );
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {!editable && (
        <p className="lg:col-span-3 text-sm text-gray-500">
          View only. Only admins, directors, and developers can edit the Round Robin.
        </p>
      )}
      {lists.map((list) => {
        const entries = users.filter((user) => user.list_name === list.id);
        return (
          <section
            key={list.id}
            onDragOver={(event) => editable && event.preventDefault()}
            onDrop={() => editable && place(list.id, over?.list === list.id ? over.id : undefined)}
            className="min-h-[420px] rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-base font-semibold">{list.title}</h2>
            <p className="mb-5 text-sm text-gray-500">{list.help}</p>
            <div className="space-y-2">
              {entries.map((row, index) => (
                <div
                  key={row.user_id}
                  className="relative"
                  onDragOver={(event) => editable && event.preventDefault()}
                  onDrop={(event) => {
                    event.stopPropagation();
                    if (draggingPointer && list.id === "sales")
                      setPointerPosition(index);
                    else place(list.id, row.user_id);
                  }}
                >
                  {editable && list.id === "sales" && index === pointer && (
                    <button
                      type="button"
                      draggable
                      onDragStart={(event) => {
                        event.stopPropagation();
                        event.dataTransfer.setData(
                          "text/plain",
                          "round-robin-pointer",
                        );
                        event.dataTransfer.effectAllowed = "move";
                        setDraggingPointer(true);
                      }}
                      onDragEnd={() => setDraggingPointer(false)}
                      className="absolute -left-[120px] top-1/2 z-10 h-11 w-[116px] -translate-y-1/2 cursor-grab rounded-sm outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-sky-300"
                      title="Drag to change the next assignment"
                      aria-label="Next in line. Drag to change the next assignment"
                    >
                      <PointerArrow />
                    </button>
                  )}
                  {editable && draggingPointer &&
                    list.id === "sales" &&
                    index !== pointer && (
                      <button
                        type="button"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.stopPropagation();
                          setPointerPosition(index);
                        }}
                        onClick={() => setPointerPosition(index)}
                        className="absolute -left-[120px] top-1/2 z-10 h-11 w-[116px] -translate-y-1/2 cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                        title="Move pointer here"
                        aria-label={`Move next-in-line pointer to position ${index + 1}`}
                      >
                        <PointerArrow ghost />
                      </button>
                    )}
                  <div
                    draggable={editable && !draggingPointer}
                    onDragStart={() => editable && setDraggedUser(row.user_id)}
                    className={`flex items-center gap-2 rounded-lg border bg-white px-3 py-3 text-sm shadow-sm ${editable ? "cursor-grab" : ""}`}
                  >
                    <GripVertical size={16} className="text-gray-400" />
                    <span className="flex-1">
                      {row.full_name || row.email || "Unknown user"}
                    </span>
                    <button
                      disabled={!editable || index === 0}
                      onClick={() => nudge(row, -1)}
                      className="rounded border p-1 disabled:opacity-30"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      disabled={!editable || index === entries.length - 1}
                      onClick={() => nudge(row, 1)}
                      className="rounded border p-1 disabled:opacity-30"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {!entries.length && (
                <div className="rounded-lg border-2 border-dashed p-8 text-center text-sm text-gray-400">
                  Drop sales users here
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
