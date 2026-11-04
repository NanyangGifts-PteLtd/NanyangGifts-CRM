"use client";

import { ChevronDown, ChevronRight, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type SampleGroup = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  collapsed: boolean;
};

const COLUMNS = [
  { key: "client", label: "Client", width: 245 },
  { key: "people", label: "People", width: 84 },
  { key: "mobile", label: "Mobile", width: 130 },
  { key: "address", label: "Address", width: 230 },
  { key: "dateSent", label: "Date Sent", width: 115 },
  { key: "returnBy", label: "Return By", width: 115 },
  { key: "status", label: "Status", width: 125 },
  { key: "reason", label: "Reason", width: 160 },
  { key: "remarks", label: "Remarks", width: 230 },
  { key: "cost", label: "Cost", width: 110 },
  { key: "photo", label: "Photo", width: 120 },
  { key: "courier", label: "Courier", width: 135 },
  { key: "itemsSent", label: "Items Sent", width: 260 },
  { key: "extend", label: "Extend 7 Days", width: 130 },
  { key: "returned", label: "Returned", width: 115 },
  { key: "dateReturned", label: "Date Returned", width: 125 },
  { key: "referenceId", label: "Reference ID", width: 125 },
  { key: "creationLog", label: "Creation Log", width: 155 },
] as const;

export function SamplesSentBoard() {
  const [groups, setGroups] = useState<SampleGroup[]>([]);
  const [canManageGroups, setCanManageGroups] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [showAddGroupDialog, setShowAddGroupDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<SampleGroup | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const gridTemplateColumns = useMemo(
    () => COLUMNS.map((column) => `${column.width}px`).join(" "),
    [],
  );
  const loadGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const response = await fetch("/api/samples-sent/groups", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Could not load Samples Sent groups.");
      setCanManageGroups(Boolean(data.canManage));
      setGroups(
        (data.groups ?? []).map((group: Omit<SampleGroup, "collapsed">) => ({
          ...group,
          collapsed: false,
        })),
      );
    } catch (error) {
      console.error("Could not load Samples Sent groups", error);
      toast.error("Could not load Samples Sent groups.");
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const addGroup = async () => {
    const name = newGroupName.trim();
    if (!name) {
      toast.error("Enter a group name.");
      return;
    }
    setIsSavingGroup(true);
    try {
      const response = await fetch("/api/samples-sent/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Could not create group.");
      setGroups((current) => [...current, { ...data.group, collapsed: false }]);
      setNewGroupName("");
      setShowAddGroupDialog(false);
      toast.success("Group added", { description: `${name} is ready for samples.` });
    } catch (error) {
      toast.error("Group could not be added", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsSavingGroup(false);
    }
  };

  const deleteGroup = async () => {
    if (!groupToDelete) return;
    setIsDeletingGroup(true);
    try {
      const response = await fetch(
        `/api/samples-sent/groups?id=${encodeURIComponent(groupToDelete.id)}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Could not delete group.");
      setGroups((current) => current.filter((group) => group.id !== groupToDelete.id));
      toast.success("Group deleted", { description: `${groupToDelete.name} was removed.` });
      setGroupToDelete(null);
    } catch (error) {
      toast.error("Group could not be deleted", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsDeletingGroup(false);
    }
  };
  const toggleGroup = (id: string) =>
    setGroups((current) =>
      current.map((group) =>
        group.id === id ? { ...group, collapsed: !group.collapsed } : group,
      ),
    );

  return (
    <section className="min-h-full min-w-max bg-[#f8fafc] py-2 pl-8 pr-3 text-slate-700">
      <div className="mb-2 flex min-w-max items-center gap-2">
        <h1 className="text-[15px] font-medium text-slate-800">Samples Sent (Work In Progress)</h1>
        <button
          type="button"
          onClick={() => setShowAddGroupDialog(true)}
          disabled={!canManageGroups}
          className="inline-flex h-8 items-center gap-1 rounded border border-[#83cbd8] bg-white px-2.5 text-[12px] font-medium text-[#237c8b] transition hover:bg-[#eefbfc]"
        >
          <Plus size={14} /> Add group
        </button>
      </div>

      {loadingGroups ? (
        <div className="flex h-24 items-center justify-center text-sm text-slate-500">
          <LoaderCircle size={17} className="mr-2 animate-spin" /> Loading groups…
        </div>
      ) : (
      <div className="space-y-3">
        {groups.map((group) => (
          <section
            key={group.id}
            className="min-w-max overflow-hidden border-y border-[#d0d4e4] bg-white"
          >
            <div className="flex h-10 border-l-4 bg-white" style={{ borderLeftColor: group.color }}>
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              className="flex min-w-0 flex-1 items-center gap-1.5 px-3 text-left hover:bg-slate-50"
            >
              {group.collapsed ? (
                <ChevronRight size={15} style={{ color: group.color }} />
              ) : (
                <ChevronDown size={15} style={{ color: group.color }} />
              )}
              <span className="text-lg font-medium" style={{ color: group.color }}>{group.name}</span>
              <span className="text-[11px] text-slate-400">0 sample records</span>
            </button>
            {canManageGroups && (
              <button
                type="button"
                onClick={() => setGroupToDelete(group)}
                className="mr-1 flex w-9 items-center justify-center text-slate-400 transition hover:text-red-600"
                aria-label={`Delete ${group.name}`}
                title="Delete group"
              >
                <Trash2 size={15} />
              </button>
            )}
            </div>

            {!group.collapsed && (
              <div className="overflow-x-auto">
                <div
                  className="grid border-t border-l border-[#d0d4e4] bg-[#fbfcff] text-center text-[12px] font-normal text-[#667085]"
                  style={{ gridTemplateColumns }}
                >
                  {COLUMNS.map((column) => (
                    <div
                      key={column.key}
                      className="flex h-[34px] items-center justify-center border-r border-[#d0d4e4] px-2 last:border-r-0"
                    >
                      {column.label}
                    </div>
                  ))}
                </div>
                <div
                  className="grid h-[36px] border-t border-l border-[#d0d4e4] bg-white"
                  style={{ gridTemplateColumns }}
                  aria-label="No Samples Sent entries yet"
                >
                  {COLUMNS.map((column) => (
                    <div
                      key={column.key}
                      className="border-r border-[#e1e5ef] last:border-r-0"
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        ))}
      </div>
      )}

      <AlertDialog
        open={showAddGroupDialog}
        onOpenChange={(open) => {
          if (!isSavingGroup) setShowAddGroupDialog(open);
          if (!open) setNewGroupName("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add Samples Sent group</AlertDialogTitle>
            <AlertDialogDescription>
              Groups organise Samples Sent entries independently from CRM Board groups.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Group name
            <input
              autoFocus
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void addGroup();
              }}
              disabled={isSavingGroup}
              maxLength={80}
              className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSavingGroup}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void addGroup(); }} disabled={isSavingGroup}>
              {isSavingGroup ? "Adding…" : "Add group"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!groupToDelete} onOpenChange={(open) => !open && !isDeletingGroup && setGroupToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {groupToDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the group. Samples cannot be placed in this group afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingGroup}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void deleteGroup(); }} disabled={isDeletingGroup} className="bg-red-600 hover:bg-red-700">
              {isDeletingGroup ? "Deleting…" : "Delete group"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
