"use client";

import {
  ChevronDown,
  ChevronRight,
  FileImage,
  LockKeyhole,
  LoaderCircle,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import type { Client, CRMGroup, Profile } from "@/app/types";
import { fetchProfiles } from "@/lib/assignments";
import { fetchHydratedClientGroupPage } from "@/lib/crm";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { uploadCrmFiles, type StoredCrmFile } from "@/lib/crm-files";
import { FilePreview } from "@/components/ui/file-preview";
import { FileDropTarget } from "@/components/ui/file-drop-target";
import { StatusBadge, type BadgeOption, type BadgeOptionLayout } from "@/components/ui/statusbadge";
import { InlineDatePicker } from "@/components/ui/inline-date-picker";
import { EditableCell } from "@/components/ui/editablecell";
import {
  AssigneeMultiSelect,
  gradientForId,
} from "@/components/ui/assignee-multiselect";
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

type Group = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  collapsed: boolean;
};
type Item = {
  id: string;
  linkedSubitemId: string;
  itemName: string;
  qty: string;
};
type SampleRow = {
  id: string;
  group_id: string | null;
  referenceId: string;
  address: string;
  date_sent: string;
  return_by: string | null;
  cost: number;
  remarks: string;
  status: string;
  status_option_id: string | null;
  reason: string;
  reason_option_id: string | null;
  courier: string;
  courier_option_id: string | null;
  date_returned: string | null;
  photo_files: StoredCrmFile[];
  created_at: string;
  linkedClient: {
    id: string;
    name: string;
    display_id: string;
    phone: string;
    subitems: { id: string; name: string }[];
  } | null;
  people: Profile[];
  createdByProfile: Profile | null;
  items: { linked_subitem_id?: string | null; item_name: string; qty: number }[];
};

const COLUMNS = [
  "Client",
  "People",
  "Mobile",
  "Address",
  "Date Sent",
  "Return By",
  "Status",
  "Reason",
  "Remarks",
  "Cost",
  "Photo",
  "Courier",
  "Items Sent",
  "Extend 7 Days",
  "Returned",
  "Date Returned",
  "Reference ID",
  "Creation Log",
];
const DEFAULT_COLUMN_WIDTHS = [
  245, 84, 130, 230, 115, 115, 125, 160, 230, 110, 120, 135, 260, 130, 115, 125,
  125, 155,
];
const gridForWidths = (widths: number[]) => widths.map((width) => `${width}px`).join(" ");
const dateToday = () => new Date().toISOString().slice(0, 10);
const newItem = (): Item => ({
  id: crypto.randomUUID(),
  linkedSubitemId: "",
  itemName: "",
  qty: "",
});
const profileName = (profile: Profile) =>
  profile.full_name?.trim() || profile.email || "Unknown user";
const profileInitials = (profile: Profile) =>
  profileName(profile)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
const displayDate = (date: string | null) =>
  date ? new Date(`${date}T00:00:00`).toLocaleDateString("en-GB") : "";
const compareByDefaultClientBoardOrder = (first: Client, second: Client) =>
  new Date(second.createdAt || 0).getTime() -
  new Date(first.createdAt || 0).getTime();

export function SamplesSentBoard() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [rows, setRows] = useState<SampleRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [canManageGroups, setCanManageGroups] = useState(false);
  const [showCreator, setShowCreator] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const [focusedRecordId, setFocusedRecordId] = useState<string | null>(null);
  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS);
  const [labelOptions, setLabelOptions] = useState<Record<string, BadgeOption[]>>({});
  const [canDeleteLabels, setCanDeleteLabels] = useState(false);
  const [itemsEditorRow, setItemsEditorRow] = useState<SampleRow | null>(null);
  const [failedReturn, setFailedReturn] = useState<{ row: SampleRow; optionId: string } | null>(null);
  const [failedReturnRemarks, setFailedReturnRemarks] = useState("");

  const loadBoard = useCallback(async () => {
    setLoading(true);
    try {
      const [groupsResponse, recordsResponse, fetchedProfiles, auth] =
        await Promise.all([
          fetch("/api/samples-sent/groups", { cache: "no-store" }),
          fetch("/api/samples-sent", { cache: "no-store" }),
          fetchProfiles(),
          createSupabaseClient().auth.getUser(),
        ]);
      const groupData = await groupsResponse.json();
      const recordData = await recordsResponse.json();
      if (!groupsResponse.ok || !recordsResponse.ok)
        throw new Error(groupData.error || recordData.error);
      setGroups(
        (groupData.groups ?? []).map((group: Omit<Group, "collapsed">) => ({
          ...group,
          collapsed: false,
        })),
      );
      setRows(recordData.rows ?? []);
      setProfiles(fetchedProfiles);
      setCurrentUserId(auth.data.user?.id ?? "");
      setCanManageGroups(Boolean(groupData.canManage));
    } catch (error) {
      console.error("Could not load Samples Sent board", error);
      toast.error("Could not load Samples Sent board.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);
  useEffect(() => {
    void fetch("/api/user-settings?key=samples_sent_column_widths")
      .then((response) => response.json())
      .then((data) => {
        if (!Array.isArray(data.value) || data.value.length !== COLUMNS.length) return;
        setColumnWidths(data.value.map((width: unknown, index: number) =>
          Number.isFinite(Number(width)) ? Math.max(72, Number(width)) : DEFAULT_COLUMN_WIDTHS[index],
        ));
      })
      .catch(() => undefined);
  }, []);
  const resizeColumn = useCallback((index: number, startX: number) => {
    const startWidth = columnWidths[index];
    const onMove = (event: PointerEvent) => setColumnWidths((current) =>
      current.map((width, widthIndex) => widthIndex === index ? Math.max(72, startWidth + event.clientX - startX) : width),
    );
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setColumnWidths((current) => {
        void fetch("/api/user-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "samples_sent_column_widths", value: current }) });
        return current;
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [columnWidths]);
  const loadLabelOptions = useCallback(async () => {
    const response = await fetch("/api/samples-sent/options", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load Samples Sent labels.");
    const codes = new Map<string, string>(
      (data.groups ?? []).map((group: { id: string; code: string }) => [group.id, group.code]),
    );
    const next: Record<string, BadgeOption[]> = {};
    for (const value of data.values ?? []) {
      const code = codes.get(value.group_id);
      if (!code) continue;
      (next[code] ??= []).push({ id: value.id, value: value.value, color: value.color, section: value.section_index, systemKey: value.system_key });
    }
    setLabelOptions(next);
    setCanDeleteLabels(Boolean(data.canDelete));
  }, []);
  useEffect(() => {
    void loadLabelOptions()
      .catch(() => undefined);
  }, [loadLabelOptions]);
  const manageLabel = useCallback(async (code: string, action: "add" | "rename" | "color" | "delete" | "reorder", payload: Record<string, unknown>) => {
    const response = await fetch("/api/samples-sent/options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, action, ...payload }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not update Samples Sent labels.");
    await loadLabelOptions();
  }, [loadLabelOptions]);
  const updateRecord = useCallback(async (id: string, values: Record<string, unknown>) => {
    const previous = rows.find((row) => row.id === id);
    if (!previous) return;
    const response = await fetch("/api/samples-sent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, values }),
    });
    const data = await response.json();
    if (!response.ok) {
      toast.error("Samples Sent record could not be updated", { description: data.error });
      return false;
    }
    setRows((current) => current.map((row) => row.id === id ? data.row : row));
    window.dispatchEvent(new Event("samples-sent:changed"));
    return true;
  }, [rows]);
  const updateStatus = useCallback((row: SampleRow, optionId: string) => {
    const option = (labelOptions.samples_sent_status ?? []).find((entry) => entry.id === optionId);
    if (option?.systemKey === "samples_sent_status_fail_to_return_remarks") {
      setFailedReturn({ row, optionId });
      setFailedReturnRemarks(row.remarks ?? "");
      return;
    }
    void updateRecord(row.id, { status: optionId });
  }, [labelOptions.samples_sent_status, updateRecord]);
  useEffect(() => {
    const recordId = new URLSearchParams(window.location.search).get("sample");
    const record = rows.find((row) => row.id === recordId);
    if (!record) return;
    if (record.group_id) {
      setGroups((current) =>
        current.map((group) =>
          group.id === record.group_id ? { ...group, collapsed: false } : group,
        ),
      );
    }
    setFocusedRecordId(recordId);
    const scrollTimer = window.setTimeout(() => {
      document
        .querySelector<HTMLElement>(
          `[data-samples-sent-record-id="${recordId}"]`,
        )
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
    const clearTimer = window.setTimeout(() => setFocusedRecordId(null), 2600);
    const params = new URLSearchParams(window.location.search);
    params.delete("sample");
    window.history.replaceState(
      null,
      "",
      params.toString() ? `/app?${params.toString()}` : "/app",
    );
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [rows]);

  return (
    <section className="crm-board min-h-full min-w-max bg-[#f8fafc] py-2 pl-8 pr-3 text-slate-700">
      <SamplesToolbar
        canManageGroups={canManageGroups}
        onNewRecord={() => setShowCreator(true)}
        onAddGroup={() => setShowAddGroup(true)}
      />
      {loading ? (
        <LoadingState />
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <SamplesGroup
              key={group.id}
              group={group}
              rows={rows.filter((row) => row.group_id === group.id)}
              focusedRecordId={focusedRecordId}
              grid={gridForWidths(columnWidths)}
              onResizeColumn={resizeColumn}
              profiles={profiles}
              labelOptions={labelOptions}
              canDeleteLabels={canDeleteLabels}
              onManageLabel={manageLabel}
              onUpdate={updateRecord}
              onUpdateStatus={updateStatus}
              onEditItems={setItemsEditorRow}
              canManage={canManageGroups}
              onToggle={() =>
                setGroups((all) =>
                  all.map((entry) =>
                    entry.id === group.id
                      ? { ...entry, collapsed: !entry.collapsed }
                      : entry,
                  ),
                )
              }
              onDelete={() => setGroupToDelete(group)}
            />
          ))}
        </div>
      )}
      <CreateSampleDialog
        open={showCreator}
        onOpenChange={setShowCreator}
        groups={groups}
        profiles={profiles}
        currentUserId={currentUserId}
        onCreated={(row) => setRows((current) => [row, ...current])}
      />
      <AddGroupDialog
        open={showAddGroup}
        onOpenChange={setShowAddGroup}
        onCreated={(group) => setGroups((current) => [...current, group])}
      />
      <DeleteGroupDialog
        group={groupToDelete}
        onOpenChange={(open) => !open && setGroupToDelete(null)}
        onDeleted={(id) =>
          setGroups((current) => current.filter((group) => group.id !== id))
        }
      />
      <EditSampleItemsDialog
        row={itemsEditorRow}
        onOpenChange={(open) => !open && setItemsEditorRow(null)}
        onSave={(items) => itemsEditorRow && updateRecord(itemsEditorRow.id, { items })}
      />
      <FailedReturnDialog
        pending={failedReturn}
        remarks={failedReturnRemarks}
        onRemarksChange={setFailedReturnRemarks}
        onOpenChange={(open) => !open && setFailedReturn(null)}
        onConfirm={async () => {
          if (!failedReturn) return;
          const saved = await updateRecord(failedReturn.row.id, {
            status: failedReturn.optionId,
            remarks: failedReturnRemarks,
            confirmFailure: true,
          });
          if (saved) setFailedReturn(null);
        }}
      />
    </section>
  );
}

function SamplesToolbar({
  canManageGroups,
  onNewRecord,
  onAddGroup,
}: {
  canManageGroups: boolean;
  onNewRecord: () => void;
  onAddGroup: () => void;
}) {
  return (
    <div className="mb-2 flex gap-2">
      <h1 className="text-xl text-slate-800">Samples Sent</h1>
      <button
        type="button"
        onClick={onNewRecord}
        className="inline-flex h-8 items-center gap-1 rounded bg-[#1595ae] px-2.5 text-[12px] font-medium text-white"
      >
        <Plus size={14} /> New Samples Sent record
      </button>
      <button
        type="button"
        disabled={!canManageGroups}
        onClick={onAddGroup}
        className="inline-flex h-8 items-center gap-1 rounded border border-[#83cbd8] bg-white px-2.5 text-[12px] text-[#237c8b] disabled:opacity-40"
      >
        <Plus size={14} /> Add group
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex h-24 items-center justify-center text-sm text-slate-500">
      <LoaderCircle size={17} className="mr-2 animate-spin" /> Loading records…
    </div>
  );
}

function SamplesGroup({
  group,
  rows,
  focusedRecordId,
  grid,
  onResizeColumn,
  profiles,
  labelOptions,
  canDeleteLabels,
  onManageLabel,
  onUpdate,
  onUpdateStatus,
  onEditItems,
  canManage,
  onToggle,
  onDelete,
}: {
  group: Group;
  rows: SampleRow[];
  focusedRecordId: string | null;
  grid: string;
  onResizeColumn: (index: number, startX: number) => void;
  profiles: Profile[];
  labelOptions: Record<string, BadgeOption[]>;
  canDeleteLabels: boolean;
  onManageLabel: (code: string, action: "add" | "rename" | "color" | "delete" | "reorder", payload: Record<string, unknown>) => Promise<void>;
  onUpdate: (id: string, values: Record<string, unknown>) => void;
  onUpdateStatus: (row: SampleRow, optionId: string) => void;
  onEditItems: (row: SampleRow) => void;
  canManage: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <section className="relative min-w-max overflow-visible border-y border-[#d0d4e4] bg-white">
      <div
        className="flex h-10 border-l-4"
        style={{ borderLeftColor: group.color }}
      >
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-center gap-1.5 px-3 text-left"
        >
          {group.collapsed ? (
            <ChevronRight size={15} style={{ color: group.color }} />
          ) : (
            <ChevronDown size={15} style={{ color: group.color }} />
          )}
          <span
            className="crm-group-name"
            style={{ color: group.color }}
          >
            {group.name}
          </span>
          <span className="text-[11px] text-slate-400">
            {rows.length} sample record{rows.length === 1 ? "" : "s"}
          </span>
        </button>
        {canManage && (
          <button
            type="button"
            onClick={onDelete}
            className="w-9 text-slate-400 hover:text-red-600"
          >
            <Trash2 size={15} className="mx-auto" />
          </button>
        )}
      </div>
      {!group.collapsed && (
        <div className="overflow-visible">
          <BoardHeader grid={grid} onResizeColumn={onResizeColumn} />
          {rows.map((row) => (
            <SampleRecordLine
              key={row.id}
              row={row}
              focused={row.id === focusedRecordId}
              grid={grid}
              profiles={profiles}
              labelOptions={labelOptions}
              canDeleteLabels={canDeleteLabels}
              onManageLabel={onManageLabel}
              onUpdate={onUpdate}
              onUpdateStatus={onUpdateStatus}
              onEditItems={onEditItems}
            />
          ))}
          {!rows.length && <EmptyRecordLine grid={grid} />}
        </div>
      )}
    </section>
  );
}

function BoardHeader({ grid, onResizeColumn }: { grid: string; onResizeColumn: (index: number, startX: number) => void }) {
  return (
    <div
      className="grid border-t border-l border-[#d0d4e4] text-center text-[12px] text-[#667085]"
      style={{ gridTemplateColumns: grid }}
    >
      {COLUMNS.map((label, index) => (
        <div
          key={label}
          className="relative flex h-[34px] items-center justify-center border-r border-[#d0d4e4] px-2"
        >
          {label}
          <button
            type="button"
            aria-label={`Resize ${label} column`}
            onPointerDown={(event) => {
              event.preventDefault();
              onResizeColumn(index, event.clientX);
            }}
            className="absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize"
          />
        </div>
      ))}
    </div>
  );
}
function EmptyRecordLine({ grid }: { grid: string }) {
  return (
    <div
      className="grid h-[36px] border-t border-l border-[#d0d4e4]"
      style={{ gridTemplateColumns: grid }}
    >
      {COLUMNS.map((label) => (
        <div key={label} className="border-r border-[#e1e5ef]" />
      ))}
    </div>
  );
}

function SampleRecordLine({
  row,
  focused = false,
  grid,
  profiles,
  labelOptions,
  canDeleteLabels,
  onManageLabel,
  onUpdate,
  onUpdateStatus,
  onEditItems,
}: {
  row: SampleRow;
  focused?: boolean;
  grid: string;
  profiles: Profile[];
  labelOptions: Record<string, BadgeOption[]>;
  canDeleteLabels: boolean;
  onManageLabel: (code: string, action: "add" | "rename" | "color" | "delete" | "reorder", payload: Record<string, unknown>) => Promise<void>;
  onUpdate: (id: string, values: Record<string, unknown>) => void;
  onUpdateStatus: (row: SampleRow, optionId: string) => void;
  onEditItems: (row: SampleRow) => void;
}) {
  const creator = row.createdByProfile;
  const creationTitle = `Created by ${creator ? profileName(creator) : "System"} on ${new Date(row.created_at).toLocaleDateString("en-GB")} at ${new Date(row.created_at).toLocaleTimeString("en-GB")}`;
  const cell = (key: string, value: ReactNode, className = "") => (
    <div
      key={key}
      className={`flex min-w-0 items-center border-r border-[#e1e5ef] px-2 py-1 ${className}`}
    >
      {value}
    </div>
  );
  return (
    <div
      data-samples-sent-record-id={row.id}
      className={`grid min-h-[36px] border-t border-l border-[#d0d4e4] text-[12px] transition-colors ${
        focused ? "bg-sky-100 ring-2 ring-inset ring-sky-400" : "bg-white"
      }`}
      style={{ gridTemplateColumns: grid }}
    >
      {cell(
        "client",
        <span className="truncate">
          {row.linkedClient?.name}{" "}
          <small className="text-slate-400">
            {row.linkedClient?.display_id}
          </small>
        </span>,
      )}
      {cell("people", <AssigneeMultiSelect
        profiles={profiles}
        selectedIds={row.people.map((person) => person.id)}
        onChange={(peopleIds) => onUpdate(row.id, { peopleIds })}
      />, "justify-center")}
      {cell("mobile", <span className="w-full truncate text-center" title={row.linkedClient?.phone ?? ""}>
        {row.linkedClient?.phone}
      </span>, "justify-center")}
      {cell("address", <EditableCell
        value={row.address}
        onChange={(address) => onUpdate(row.id, { address })}
        multiline
        resizableMultiline
        className="!justify-start"
      />)}
      {cell("dateSent", <InlineDatePicker
        value={row.date_sent}
        onChange={(dateSent) => onUpdate(row.id, { dateSent })}
        label="Date Sent"
      />)}
      {cell("returnBy", <InlineDatePicker
        value={row.return_by ?? ""}
        onChange={(returnBy) => onUpdate(row.id, { returnBy })}
        label="Return By"
      />)}
      {cell("status", <SampleLabelBadge
        code="samples_sent_status"
        label="Status"
        value={row.status}
        options={labelOptions.samples_sent_status ?? []}
        canDelete={canDeleteLabels}
        onChange={(optionId) => onUpdateStatus(row, optionId)}
        onManage={onManageLabel}
      />)}
      {cell("reason", <SampleLabelBadge
        code="samples_sent_reason"
        label="Reason"
        value={row.reason}
        options={labelOptions.samples_sent_reason ?? []}
        canDelete={canDeleteLabels}
        onChange={(optionId) => onUpdate(row.id, { reason: optionId })}
        onManage={onManageLabel}
      />)}
      {cell("remarks", <EditableCell
        value={row.remarks}
        onChange={(remarks) => onUpdate(row.id, { remarks })}
        multiline
        resizableMultiline
        className="!justify-start"
      />)}
      {cell("cost", <input
        type="number"
        min="0"
        step="0.01"
        defaultValue={row.cost}
        onBlur={(event) => {
          if (event.target.value !== String(row.cost)) {
            onUpdate(row.id, { cost: event.target.value });
          }
        }}
        className="w-full bg-transparent text-right outline-none"
      />)}
      {cell("photo", <PhotoCell row={row} onUpdate={onUpdate} />)}
      {cell("courier", <SampleLabelBadge
        code="samples_sent_courier"
        label="Courier"
        value={row.courier}
        options={labelOptions.samples_sent_courier ?? []}
        canDelete={canDeleteLabels}
        onChange={(optionId) => onUpdate(row.id, { courier: optionId })}
        onManage={onManageLabel}
      />)}
      {cell(
        "items",
        <button
          type="button"
          onClick={() => onEditItems(row)}
          title={row.items.map((item) => `${item.item_name} x ${item.qty}`).join("\n")}
          className="flex w-full items-center justify-between gap-2 text-left hover:text-sky-700"
        >
        <span className="truncate">
          {row.items
            .map((item) => `${item.item_name} x ${item.qty}`)
            .join(", ")}
        </span>
        <span className="shrink-0 text-sky-700">Edit</span>
        </button>,
      )}
      {cell("extend", <ExtendButton row={row} onUpdate={onUpdate} />, "justify-center")}
      {cell("returned", <ReturnedButton
        row={row}
        options={labelOptions.samples_sent_status ?? []}
        onUpdateStatus={onUpdateStatus}
      />, "justify-center")}
      {cell("dateReturned", <InlineDatePicker value={row.date_returned ?? ""} onChange={(dateReturned) => onUpdate(row.id, { dateReturned })} label="Date Returned" />)}
      {cell("reference", <span className="w-full text-center">{row.referenceId}</span>, "justify-center")}
      {cell(
        "creation",
        <span title={creationTitle} className="flex items-center gap-1">
          {creator && <Avatar profile={creator} />}
          {new Date(row.created_at).toLocaleDateString("en-GB")}
        </span>,
      )}
    </div>
  );
}

function SampleLabelBadge({
  code, label, value, options, canDelete, onChange, onManage,
}: {
  code: string;
  label: string;
  value: string;
  options: BadgeOption[];
  canDelete: boolean;
  onChange: (optionId: string) => void;
  onManage: (code: string, action: "add" | "rename" | "color" | "delete" | "reorder", payload: Record<string, unknown>) => Promise<void>;
}) {
  const attempt = async (operation: () => Promise<void>) => {
    try {
      await operation();
    } catch (error) {
      toast.error(`Could not update ${label} labels`, { description: error instanceof Error ? error.message : undefined });
    }
  };
  return <StatusBadge
    value={value}
    onChange={(_, option) => onChange(option?.id ?? "")}
    options={options}
    manageLabel={label}
    onAddOption={(name) => attempt(() => onManage(code, "add", { value: name }))}
    onDeleteOption={(_, optionId) => attempt(() => onManage(code, "delete", { optionId }))}
    canDeleteOption={() => canDelete}
    onUpdateOptionColor={(_, color, optionId) => attempt(() => onManage(code, "color", { optionId, color }))}
    onRenameOption={(_, nextValue, optionId) => attempt(() => onManage(code, "rename", { optionId, value: nextValue }))}
    onReorderOptions={(layout: BadgeOptionLayout[]) => attempt(() => onManage(code, "reorder", { layout }))}
  />;
}

function ExtendButton({
  row,
  onUpdate,
}: {
  row: SampleRow;
  onUpdate: (id: string, values: Record<string, unknown>) => void;
}) {
  const extend = () => {
    if (!row.return_by) return;
    const date = new Date(`${row.return_by}T12:00:00`);
    date.setDate(date.getDate() + 7);
    onUpdate(row.id, { returnBy: date.toISOString().slice(0, 10) });
  };
  return (
    <button
      type="button"
      disabled={!row.return_by}
      onClick={extend}
      title={row.return_by ? "Extend Return By by 7 days" : "Set Return By before extending"}
      className="rounded border border-sky-200 px-2 py-1 text-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      +7 Days
    </button>
  );
}

function ReturnedButton({
  row,
  options,
  onUpdateStatus,
}: {
  row: SampleRow;
  options: BadgeOption[];
  onUpdateStatus: (row: SampleRow, optionId: string) => void;
}) {
  const returnedOption = options.find(
    (option) => option.systemKey === "samples_sent_status_returned",
  );
  return (
    <button
      type="button"
      disabled={!returnedOption}
      title={returnedOption ? "Mark this sample as Returned" : "Returned label is not configured"}
      onClick={() => returnedOption?.id && onUpdateStatus(row, returnedOption.id)}
      className="rounded border border-emerald-200 px-2 py-1 text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      Returned
    </button>
  );
}

function FailedReturnDialog({
  pending,
  remarks,
  onRemarksChange,
  onOpenChange,
  onConfirm,
}: {
  pending: { row: SampleRow; optionId: string } | null;
  remarks: string;
  onRemarksChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <AlertDialog open={Boolean(pending)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm failed return</AlertDialogTitle>
          <AlertDialogDescription>
            Add the reason for the failed return. This will move the Samples Sent record to Failed to return.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <textarea
          value={remarks}
          onChange={(event) => onRemarksChange(event.target.value)}
          placeholder="Reason for failed return"
          className="min-h-28 w-full resize-y rounded border border-slate-300 bg-white p-2 text-sm outline-none focus:border-sky-500"
        />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={!remarks.trim()} onClick={onConfirm}>
            Confirm failed return
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PhotoCell({
  row,
  onUpdate,
}: {
  row: SampleRow;
  onUpdate: (id: string, values: Record<string, unknown>) => void;
}) {
  const upload = async (files: File[]) => {
    if (!files.length) return;
    try {
      const uploaded = await uploadCrmFiles(files, `samples-sent/${row.id}/photos`, { clientId: row.linkedClient?.id ?? "" });
      onUpdate(row.id, { photoFiles: [...(row.photo_files ?? []), ...uploaded] });
    } catch (error) {
      toast.error("Photo could not be uploaded", { description: error instanceof Error ? error.message : undefined });
    }
  };
  const remove = (storagePath: string) =>
    onUpdate(row.id, {
      photoFiles: (row.photo_files ?? []).filter((file) => file.storagePath !== storagePath),
    });
  return (
    <FileDropTarget onFiles={upload} className="min-h-9 w-full">
      <label className="flex min-h-9 w-full cursor-pointer items-center justify-center gap-1">
        <input
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(event) => {
            void upload(Array.from(event.target.files ?? []));
            event.currentTarget.value = "";
          }}
        />
        {row.photo_files?.length ? row.photo_files.map((file) => (
          <span key={file.storagePath} className="group relative">
            <a
              href={file.url}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              <FilePreview url={file.url} name={file.name} mimeType={file.mimeType} />
            </a>
            <button
              type="button"
              aria-label={`Remove ${file.name}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                remove(file.storagePath);
              }}
              className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-red-500 p-0 text-[10px] leading-none text-white group-hover:flex"
            >
              &times;
            </button>
          </span>
        )) : <FileImage size={16} className="text-slate-400" />}
      </label>
    </FileDropTarget>
  );
}

function EditSampleItemsDialog({
  row,
  onOpenChange,
  onSave,
}: {
  row: SampleRow | null;
  onOpenChange: (open: boolean) => void;
  onSave: (items: Item[]) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    setItems(row ? row.items.map((item) => ({
      id: crypto.randomUUID(),
      linkedSubitemId: item.linked_subitem_id ?? "",
      itemName: item.item_name,
      qty: String(item.qty),
    })) : []);
  }, [row]);
  if (!row) return null;
  const valid = items.length > 0 && items.every((item) => item.itemName.trim() && Number(item.qty) > 0);
  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-4xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Edit Items Sent</AlertDialogTitle>
          <AlertDialogDescription>
            Update the items and quantities sent in this sample record.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ItemsEditor
          client={row.linkedClient as unknown as Client}
          items={items}
          onChange={setItems}
          updateItem={(id, update) => setItems((all) => all.map((item) =>
            item.id === id ? { ...item, ...update } : item,
          ))}
        />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!valid}
            onClick={() => {
              onSave(items);
              onOpenChange(false);
            }}
          >
            Save Items Sent
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Avatar({ profile }: { profile: Profile }) {
  return (
    <span
      title={profileName(profile)}
      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white"
      style={{ background: gradientForId(profile.id, profile.avatar_color) }}
    >
      {profileInitials(profile)}
    </span>
  );
}
function AvatarStack({ profiles }: { profiles: Profile[] }) {
  return (
    <span className="flex -space-x-1">
      {profiles.map((profile) => (
        <span key={profile.id} className="ring-1 ring-white">
          <Avatar profile={profile} />
        </span>
      ))}
    </span>
  );
}

function CreateSampleDialog({
  open,
  onOpenChange,
  groups,
  profiles,
  currentUserId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: Group[];
  profiles: Profile[];
  currentUserId: string;
  onCreated: (row: SampleRow) => void;
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientAssignees, setClientAssignees] = useState<
    Record<string, string[]>
  >({});
  const [clientPmAssignees, setClientPmAssignees] = useState<
    Record<string, string[]>
  >({});
  const [crmGroups, setCrmGroups] = useState<CRMGroup[]>([]);
  const [search, setSearch] = useState("");
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingMoreClients, setLoadingMoreClients] = useState(false);
  const [clientOffset, setClientOffset] = useState(0);
  const [clientTotal, setClientTotal] = useState(0);
  const clientRequest = useRef(0);
  const [creating, setCreating] = useState(false);
  const [client, setClient] = useState<Client | null>(null);
  const [groupId, setGroupId] = useState("");
  const [peopleIds, setPeopleIds] = useState<string[]>([]);
  const [address, setAddress] = useState("");
  const [dateSent, setDateSent] = useState(dateToday);
  const [returnBy, setReturnBy] = useState("");
  const [cost, setCost] = useState("");
  const [remarks, setRemarks] = useState("");
  const [items, setItems] = useState<Item[]>([newItem()]);
  const reset = useCallback(() => {
    const defaultGroup =
      groups.find((group) => group.name.toLowerCase() === "new group") ??
      groups[0];
    setClient(null);
    setSearch("");
    setGroupId(defaultGroup?.id ?? "");
    setPeopleIds(currentUserId ? [currentUserId] : []);
    setAddress("");
    setDateSent(dateToday());
    setReturnBy("");
    setCost("");
    setRemarks("");
    setItems([newItem()]);
  }, [currentUserId, groups]);
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    void createSupabaseClient()
      .from("crm_groups")
      .select("id, name, color, sort_order")
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (!active || error) return;
        setCrmGroups((data ?? []) as CRMGroup[]);
      });
    return () => {
      active = false;
    };
  }, [open]);
  const loadClientPage = useCallback(
    async (offset: number, append: boolean, query: string) => {
      const request = append ? clientRequest.current : ++clientRequest.current;
      if (append) setLoadingMoreClients(true);
      else {
        setLoadingClients(true);
        setClients([]);
        setClientOffset(0);
        setClientTotal(0);
      }
      try {
        const page = await fetchHydratedClientGroupPage(null, offset, 30, {
          search: query.trim() || undefined,
          sortCategory: "client",
          sortColumn: "dateCreated",
          sortValueType: "date",
          sortDirection: "desc",
        });
        if (request !== clientRequest.current) return;
        setClients((current) => {
          if (!append) return page.clients;
          const unique = new Map(current.map((entry) => [entry.id, entry]));
          page.clients.forEach((entry) => unique.set(entry.id, entry));
          return Array.from(unique.values());
        });
        setClientAssignees((current) =>
          append ? { ...current, ...page.clientAssignees } : page.clientAssignees,
        );
        setClientPmAssignees((current) =>
          append
            ? { ...current, ...page.clientPmAssignees }
            : page.clientPmAssignees,
        );
        setClientOffset(page.nextOffset);
        setClientTotal(page.total);
      } catch (error) {
        if (request === clientRequest.current) {
          console.error("Could not load Samples Sent clients", error);
          toast.error("Could not load clients.");
        }
      } finally {
        if (request === clientRequest.current) {
          setLoadingClients(false);
          setLoadingMoreClients(false);
        }
      }
    },
    [],
  );
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(
      () => void loadClientPage(0, false, search),
      180,
    );
    return () => window.clearTimeout(timer);
  }, [loadClientPage, open, search]);
  const updateItem = (id: string, update: Partial<Item>) =>
    setItems((all) =>
      all.map((item) => (item.id === id ? { ...item, ...update } : item)),
    );
  const currentUserRole = String(
    profiles.find((profile) => profile.id === currentUserId)?.role ?? "",
  ).toLowerCase();
  const clientRestriction = useCallback(
    (candidate: Client) => {
      if (candidate.customFields?.subitemsLocked === "true") {
        return "This client is locked. Unlock its subitems on the CRM Board before creating a Samples Sent record.";
      }
      const isAssigned =
        !!currentUserId &&
        ((clientAssignees[candidate.id] ?? []).includes(currentUserId) ||
          (clientPmAssignees[candidate.id] ?? []).includes(currentUserId));
      if (!['admin', 'director', 'dev'].includes(currentUserRole) && !isAssigned) {
        return "You can only create Samples Sent records for clients assigned to you as People or PM.";
      }
      return null;
    },
    [clientAssignees, clientPmAssignees, currentUserId, currentUserRole],
  );
  const submit = async () => {
    if (!client) return toast.error("Choose a client.");
    if (!address.trim()) return toast.error("Address is required.");
    if (
      !items.length ||
      items.some((item) => !item.itemName.trim() || !(Number(item.qty) > 0))
    )
      return toast.error("Every item row needs an item name and quantity.");
    setCreating(true);
    try {
      const response = await fetch("/api/samples-sent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          groupId,
          peopleIds,
          address,
          dateSent,
          returnBy,
          cost,
          remarks,
          items,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onCreated(data.row);
      onOpenChange(false);
      toast.success("Samples Sent record created", {
        description: data.row.referenceId,
      });
      window.dispatchEvent(new Event("samples-sent:changed"));
    } catch (error) {
      toast.error("Could not create Samples Sent record", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setCreating(false);
    }
  };
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-slate-950/35 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="samples-sent-create-title"
    >
      <div
        className={`flex w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white text-slate-800 shadow-2xl ${
          client
            ? "max-h-[calc(100vh-2rem)]"
            : "h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)]"
        }`}
      >
        <header className="flex shrink-0 items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2
              id="samples-sent-create-title"
              className="text-lg font-semibold text-slate-800"
            >
              Create Samples Sent record
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Choose a CRM client and enter the samples being sent.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            disabled={creating}
            onClick={() => onOpenChange(false)}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </header>
        <div
          className={`flex min-h-0 flex-col overflow-y-auto ${
            client ? "" : "flex-1"
          }`}
        >
        {!client ? (
          <ClientPicker
            clients={clients}
            groups={crmGroups}
            clientRestriction={clientRestriction}
            loading={loadingClients}
            loadingMore={loadingMoreClients}
            offset={clientOffset}
            total={clientTotal}
            search={search}
            selectedClientId={undefined}
            onSearch={setSearch}
            onLoadMore={() => void loadClientPage(clientOffset, true, search)}
            onSelect={(next) => {
              setClient(next);
              setAddress("");
            }}
          />
        ) : (
          <>
            <div className="flex items-center justify-between rounded-md border border-sky-200 bg-sky-50 px-3 py-2">
              <span className="text-sm text-slate-700">
                {client.name}{" "}
                <span className="text-slate-500">{client.displayId}</span>
              </span>
              <button
                type="button"
                disabled={creating}
                onClick={() => setClient(null)}
                className="text-sm text-sky-700 hover:underline disabled:opacity-50"
              >
                Change client
              </button>
            </div>
            <div className="space-y-5 p-5">
              <SampleDetails
                profiles={profiles}
                peopleIds={peopleIds}
                address={address}
                dateSent={dateSent}
                returnBy={returnBy}
                onPeopleChange={setPeopleIds}
                onAddressChange={setAddress}
                onDateSentChange={setDateSent}
                onReturnByChange={setReturnBy}
              />
              <ItemsEditor
                client={client}
                items={items}
                onChange={setItems}
                updateItem={updateItem}
              />
              <div className="grid gap-3 lg:grid-cols-[minmax(180px,1fr)_minmax(0,3fr)]">
                <label className="grid gap-1 text-sm font-medium">
                  Cost
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cost}
                    onChange={(event) => setCost(event.target.value)}
                    className="h-9 rounded border border-slate-300 px-2"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Remarks
                  <textarea
                    rows={2}
                    value={remarks}
                    onChange={(event) => setRemarks(event.target.value)}
                    className="rounded border border-slate-300 px-2 py-1"
                  />
                </label>
              </div>
            </div>
          </>
        )}
        </div>
        <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 rounded border px-3 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!client || creating}
            onClick={() => void submit()}
            className="h-9 rounded bg-[#1595ae] px-3 text-sm text-white disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create Samples Sent record"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function ClientPicker({
  clients,
  groups,
  loading,
  loadingMore,
  offset,
  total,
  search,
  selectedClientId,
  clientRestriction,
  onSearch,
  onLoadMore,
  onSelect,
}: {
  clients: Client[];
  groups: CRMGroup[];
  loading: boolean;
  loadingMore: boolean;
  offset: number;
  total: number;
  search: string;
  selectedClientId?: string;
  clientRestriction: (client: Client) => string | null;
  onSearch: (value: string) => void;
  onLoadMore: () => void;
  onSelect: (client: Client) => void;
}) {
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(
    new Set(),
  );
  useEffect(() => {
    setExpandedGroupIds(
      new Set([...groups.map((group) => group.id), "ungrouped"]),
    );
  }, [groups]);
  const sections = useMemo(() => {
    const ordered = [...groups].sort(
      (left, right) => left.sort_order - right.sort_order,
    );
    const result = ordered
      .map((group) => ({
        id: group.id,
        name: group.name,
        color: group.color ?? "#7BCBD5",
        clients: clients
          .filter((client) => client.groupId === group.id)
          .sort(compareByDefaultClientBoardOrder),
      }))
      .filter((section) => section.clients.length);
    const ungrouped = clients
      .filter(
        (client) =>
          !client.groupId ||
          !groups.some((group) => group.id === client.groupId),
      )
      .sort(compareByDefaultClientBoardOrder);
    if (ungrouped.length) {
      result.push({ id: "ungrouped", name: "Ungrouped", color: "#94a3b8", clients: ungrouped });
    }
    return result;
  }, [clients, groups]);
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <label className="relative m-4 block shrink-0">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          autoFocus
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search clients…"
          className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-sky-500"
        />
      </label>
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-slate-100 px-2 pb-2">
        {loading ? (
          <p className="p-4 text-center text-sm text-slate-500">Loading…</p>
        ) : (
          sections.map((section) => {
            const expanded = expandedGroupIds.has(section.id);
            return (
              <div key={section.id}>
                <button
                  type="button"
                  onClick={(event) => {
                    const header = event.currentTarget;
                    const collapsing = expandedGroupIds.has(section.id);
                    setExpandedGroupIds((current) => {
                      const next = new Set(current);
                      if (next.has(section.id)) next.delete(section.id);
                      else next.add(section.id);
                      return next;
                    });
                    if (collapsing) {
                      requestAnimationFrame(() =>
                        header.scrollIntoView({ block: "start" }),
                      );
                    }
                  }}
                  className="sticky top-0 z-10 flex w-full items-center justify-between border-y border-slate-100 bg-slate-50 px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-100"
                >
                  <span>{section.name}</span>
                  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                {expanded && section.clients.map((client) => {
                  const restriction = clientRestriction(client);
                  const isLocked = client.customFields?.subitemsLocked === "true";
                  return (
                  <div key={client.id} title={restriction ?? undefined}>
                  <button
                    key={client.id}
                    type="button"
                    disabled={Boolean(restriction)}
                    onClick={() => onSelect(client)}
                    className={`flex w-full items-start rounded-md px-3 py-3 text-left text-sm hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 ${selectedClientId === client.id ? "bg-sky-50" : ""}`}
                  >
              <span className="min-w-0 flex-1">
              <span className="flex items-center font-medium text-slate-700">
                {isLocked ? (
                  <LockKeyhole
                    size={17}
                    aria-label="Locked client"
                    className="mr-2 shrink-0 text-amber-500"
                  />
                ) : null}
                {client.name || "Unnamed client"}
              </span>{" "}
              <span className="ml-2 shrink-0 font-mono text-xs text-slate-400">{client.displayId}</span>
              <span className="block truncate text-xs text-slate-500">
                {client.company || "No company"} · {client.phone || "No mobile"}
              </span>
              <span className="mt-1 block truncate text-xs text-slate-400">
                Subitems ({client.subitems.length}): {client.subitems.length
                  ? client.subitems.slice(0, 3).map((subitem) => subitem.name || "Unnamed subitem").join(", ") + (client.subitems.length > 3 ? "…" : "")
                  : "None"}
              </span>
              </span>
                  </button>
                  </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
      {offset < total && (
        <div className="mt-3 text-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={onLoadMore}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {loadingMore
              ? "Loading…"
              : `Load more (${clients.length} of ${total})`}
          </button>
        </div>
      )}
    </section>
  );
}

type DetailsProps = {
  profiles: Profile[];
  peopleIds: string[];
  address: string;
  dateSent: string;
  returnBy: string;
  onPeopleChange: (value: string[]) => void;
  onAddressChange: (value: string) => void;
  onDateSentChange: (value: string) => void;
  onReturnByChange: (value: string) => void;
};
function SampleDetails(props: DetailsProps) {
  return (
    <section className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(180px,1fr)_minmax(0,3fr)]">
        <label className="grid gap-1 text-sm font-medium">
          People
          <AssigneeMultiSelect
            profiles={props.profiles}
            selectedIds={props.peopleIds}
            onChange={props.onPeopleChange}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Address
          <textarea
            rows={2}
            value={props.address}
            onChange={(event) => props.onAddressChange(event.target.value)}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-sm font-medium">
          Date Sent
          <input
            type="date"
            value={props.dateSent}
            onChange={(event) => props.onDateSentChange(event.target.value)}
            className="h-9 rounded border border-slate-300 px-2"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Return By
          <input
            type="date"
            value={props.returnBy}
            onChange={(event) => props.onReturnByChange(event.target.value)}
            className="h-9 rounded border border-slate-300 px-2"
          />
        </label>
      </div>
    </section>
  );
}

function ItemsEditor({
  client,
  items,
  onChange,
  updateItem,
}: {
  client: Client | null;
  items: Item[];
  onChange: (items: Item[]) => void;
  updateItem: (id: string, update: Partial<Item>) => void;
}) {
  const clientSubitems = client?.subitems ?? [];
  return (
    <section>
      <div className="mb-2 flex justify-between">
        <b className="text-sm">Items Sent</b>
        <button
          type="button"
          onClick={() => onChange([...items, newItem()])}
          className="text-sm text-sky-700"
        >
          + Add item
        </button>
      </div>
      <div className="overflow-hidden rounded border">
        <div className="grid grid-cols-[1fr_1fr_90px_38px] bg-slate-50 text-xs text-slate-500">
          <div className="p-2">Linked Item</div>
          <div className="border-l p-2">Item Name</div>
          <div className="border-l p-2">Qty</div>
          <div className="border-l" />
        </div>
        {items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[1fr_1fr_90px_38px] border-t"
          >
            <select
              value={item.linkedSubitemId}
              onChange={(event) => {
                const subitem = clientSubitems.find(
                  (entry) => entry.id === event.target.value,
                );
                updateItem(item.id, {
                  linkedSubitemId: event.target.value,
                  itemName: subitem?.name ?? "",
                });
              }}
              className="h-9 min-w-0 px-2 text-sm"
            >
              <option value="">Other</option>
              {clientSubitems.map((subitem) => (
                <option key={subitem.id} value={subitem.id}>
                  {subitem.name || "Unnamed subitem"}
                </option>
              ))}
            </select>
            <input
              value={item.itemName}
              onChange={(event) =>
                updateItem(item.id, { itemName: event.target.value })
              }
              className="min-w-0 border-l px-2 text-sm"
            />
            <input
              type="number"
              min="0.001"
              step="0.001"
              value={item.qty}
              onChange={(event) =>
                updateItem(item.id, { qty: event.target.value })
              }
              className="border-l px-2 text-sm"
            />
            <button
              type="button"
              disabled={items.length === 1}
              onClick={() =>
                onChange(items.filter((entry) => entry.id !== item.id))
              }
              className="border-l text-slate-400 hover:text-red-600"
            >
              <X size={15} className="mx-auto" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function AddGroupDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (group: Group) => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const add = async () => {
    if (!name.trim()) return toast.error("Enter a group name.");
    setSaving(true);
    try {
      const response = await fetch("/api/samples-sent/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onCreated({ ...data.group, collapsed: false });
      setName("");
      onOpenChange(false);
    } catch (error) {
      toast.error("Group could not be added", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Add Samples Sent group</AlertDialogTitle>
          <AlertDialogDescription>
            Groups organise Samples Sent entries.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-9 rounded border border-slate-300 px-2"
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={saving}
            onClick={(event) => {
              event.preventDefault();
              void add();
            }}
          >
            Add group
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteGroupDialog({
  group,
  onOpenChange,
  onDeleted,
}: {
  group: Group | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (id: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const remove = async () => {
    if (!group) return;
    setSaving(true);
    try {
      const response = await fetch(
        `/api/samples-sent/groups?id=${encodeURIComponent(group.id)}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onDeleted(group.id);
      onOpenChange(false);
    } catch (error) {
      toast.error("Group could not be deleted", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <AlertDialog open={!!group} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {group?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Groups with records must be emptied or deactivated first.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={saving}
            onClick={(event) => {
              event.preventDefault();
              void remove();
            }}
            className="bg-red-600 hover:bg-red-700"
          >
            Delete group
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
