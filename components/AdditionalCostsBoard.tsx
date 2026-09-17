"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  LockKeyhole,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Client, CRMGroup, Profile } from "@/app/types";
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
import { AssigneeMultiSelect } from "@/components/ui/assignee-multiselect";
import {
  StatusBadge,
  type BadgeOptionLayout,
} from "@/components/ui/statusbadge";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

type AdditionalCost = {
  id: string;
  client_id: string;
  date_sent: string | null;
  people_id: string | null;
  people_ids?: string[];
  cost: number | null;
  remarks: string;
  status: string;
  reason: string;
  courier: string;
  trip_id: string;
  items_sent: string;
  qty: string;
  verified: boolean | null;
  discussed: boolean | null;
  created_at: string;
  created_by?: string | null;
};
type LabelOption = {
  id?: string;
  value: string;
  color: string;
  section?: number;
};
type Props = {
  clients: Client[];
  profiles: Profile[];
  groups: CRMGroup[];
  currentUserId?: string | null;
  currentUserRole?: string | null;
  clientAssignees: Record<string, string[]>;
  clientPmAssignees: Record<string, string[]>;
  onOpenProject?: (clientId: string) => void;
};
type Column = { key: string; label: string; width: number };
const initialColumns: Column[] = [
  { key: "project", label: "Project Name", width: 250 },
  { key: "cost", label: "Cost", width: 115 },
  { key: "reason", label: "Reason", width: 155 },
  { key: "trip_id", label: "Reference ID", width: 145 },
  { key: "items_sent", label: "Items Sent", width: 210 },
  { key: "courier", label: "Courier", width: 140 },
  { key: "remarks", label: "Remarks", width: 260 },
  { key: "created", label: "Date Created", width: 140 },
  { key: "actions", label: "", width: 52 },
];
const cellClass =
  "h-10 min-w-0 bg-white px-2 text-sm text-slate-700 outline-none focus:bg-sky-50 focus:ring-1 focus:ring-inset focus:ring-sky-400";
const clientLabel = (client: Client) =>
  `${client.name || "Unnamed client"}${client.displayId ? ` · ${client.displayId}` : ""}`;
// Keep chooser order consistent with the CRM Board's default client sort:
// newest created clients first within each group.
const compareByDefaultClientBoardOrder = (first: Client, second: Client) =>
  new Date(second.createdAt || 0).getTime() -
  new Date(first.createdAt || 0).getTime();

export function AdditionalCostsBoard({
  clients,
  profiles,
  groups,
  currentUserId,
  currentUserRole,
  clientAssignees,
  clientPmAssignees,
  onOpenProject,
}: Props) {
  const [rows, setRows] = useState<AdditionalCost[]>([]);
  const [collapsedVoucherGroups, setCollapsedVoucherGroups] = useState({
    courier: false,
    other: false,
  });
  const [labelOptions, setLabelOptions] = useState<
    Record<string, LabelOption[]>
  >({});
  const [columns, setColumns] = useState(initialColumns);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [expandedPickerGroups, setExpandedPickerGroups] = useState<Set<string>>(
    new Set(),
  );
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [selectedVoucherClientId, setSelectedVoucherClientId] = useState<
    string | null
  >(null);
  const [voucherDraft, setVoucherDraft] = useState({
    cost: "",
    reason: "",
    items_sent: "",
    courier: "",
    remarks: "",
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdditionalCost | null>(
    null,
  );
  const rowRevisions = useRef(new Map<string, number>());
  const gridTemplateColumns = columns
    .map((column) => `${column.width}px`)
    .join(" ");
  const clientsById = useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients],
  );
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/additional-costs");
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Could not load Additional Costs.");
      setRows(result.rows ?? []);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load Additional Costs.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const supabase = createSupabaseClient();
    let disposed = false;
    let timer: number | undefined;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const scheduleReload = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = undefined;
        if (!disposed) void load();
      }, 300);
    };
    const start = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (disposed) return;
      if (session) supabase.realtime.setAuth(session.access_token);
      channel = supabase
        .channel("payment-voucher-live-refresh")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "additional_costs" },
          scheduleReload,
        )
        .subscribe();
    };
    void start();
    return () => {
      disposed = true;
      if (timer !== undefined) window.clearTimeout(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [load]);
  const loadLabelOptions = useCallback(async () => {
    const response = await fetch("/api/additional-costs/options");
    const result = await response.json();
    if (!response.ok) return;
    const groupIdToCode = new Map<string, string>(
      (result.groups ?? []).map((group: { id: string; code: string }) => [
        group.id,
        group.code,
      ]),
    );
    const next: Record<string, LabelOption[]> = {};
    for (const option of result.values ?? []) {
      const code = groupIdToCode.get(option.group_id);
      if (!code) continue;
      (next[code] ??= []).push({
        id: option.id,
        value: option.value,
        color: option.color,
        section: option.section_index ?? 0,
      });
    }
    setLabelOptions(next);
  }, []);
  useEffect(() => {
    void loadLabelOptions();
  }, [loadLabelOptions]);
  const manageLabel = async (
    code: string,
    action: "add" | "color" | "rename",
    value: string,
    extra?: string,
  ) => {
    const response = await fetch("/api/additional-costs/options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "add"
          ? { code, action, value }
          : action === "color"
            ? { code, action, value, color: extra }
            : { code, action, value, nextValue: extra },
      ),
    });
    const result = await response.json();
    if (!response.ok) {
      toast.error("Label could not be updated", { description: result.error });
      return;
    }
    await loadLabelOptions();
  };
  const deleteLabel = async (code: string, value: string) => {
    const response = await fetch("/api/options/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", code, name: value }),
    });
    const result = await response.json();
    if (!response.ok) {
      toast.error("Label could not be deleted", { description: result.error });
      return;
    }
    setRows((current) =>
      current.map((row) =>
        code === "additional_cost_status" && row.status === value
          ? { ...row, status: "" }
          : code === "additional_cost_reason" && row.reason === value
            ? { ...row, reason: "" }
            : code === "additional_cost_courier" && row.courier === value
              ? { ...row, courier: "" }
              : row,
      ),
    );
    await loadLabelOptions();
  };
  const reorderLabels = async (code: string, layout: BadgeOptionLayout[]) => {
    const response = await fetch("/api/options/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, layout }),
    });
    const result = await response.json();
    if (!response.ok) {
      toast.error("Label order could not be saved", {
        description: result.error,
      });
      return;
    }
    await loadLabelOptions();
  };
  const resize = (index: number, startX: number, startWidth: number) => {
    const onMove = (event: PointerEvent) =>
      setColumns((current) =>
        current.map((column, columnIndex) =>
          columnIndex === index
            ? {
                ...column,
                width: Math.max(72, startWidth + event.clientX - startX),
              }
            : column,
        ),
      );
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const update = useCallback(
    async (id: string, values: Record<string, unknown>) => {
      const previous = rows.find((row) => row.id === id);
      if (!previous) return;
      const revision = (rowRevisions.current.get(id) ?? 0) + 1;
      rowRevisions.current.set(id, revision);
      const rollback = Object.fromEntries(
        Object.keys(values).map((field) => [
          field,
          previous[field as keyof AdditionalCost],
        ]),
      );
      setRows((current) =>
        current.map((row) => (row.id === id ? { ...row, ...values } : row)),
      );
      try {
        const response = await fetch("/api/additional-costs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, values }),
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.error ?? "Could not save the change.",
          ); /* Keep the newest optimistic row: an older PATCH response contains an older row snapshot. */
      } catch (updateError) {
        if (rowRevisions.current.get(id) === revision)
          setRows((current) =>
            current.map((row) =>
              row.id === id ? { ...row, ...rollback } : row,
            ),
          );
        toast.error("Additional cost could not be saved", {
          description:
            updateError instanceof Error
              ? updateError.message
              : "Please try again.",
        });
      }
    },
    [rows],
  );
  const create = async (clientId: string) => {
    setCreatingFor(clientId);
    try {
      const response = await fetch("/api/additional-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, values: voucherDraft }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ?? "Could not create the additional cost.",
        );
      setRows((current) => [result.row, ...current]);
      setPickerOpen(false);
      setPickerQuery("");
      setSelectedVoucherClientId(null);
      setVoucherDraft({
        cost: "",
        reason: "",
        items_sent: "",
        courier: "",
        remarks: "",
      });
      toast.success("Payment voucher added");
    } catch (createError) {
      toast.error("Additional cost could not be created", {
        description:
          createError instanceof Error
            ? createError.message
            : "Please try again.",
      });
    } finally {
      setCreatingFor(null);
    }
  };
  const canDelete = (row: AdditionalCost) => {
    const role = String(currentUserRole ?? "").toLowerCase();
    return (
      ["admin", "director"].includes(role) ||
      (!!currentUserId &&
        ((clientAssignees[row.client_id] ?? []).includes(currentUserId) ||
          (clientPmAssignees[row.client_id] ?? []).includes(currentUserId)))
    );
  };
  const creationRestriction = (client: Client) => {
    if (client.customFields?.subitemsLocked === "true") {
      return "This client is locked. Unlock its subitems on the CRM Board before adding an additional cost.";
    }
    const role = String(currentUserRole ?? "").toLowerCase();
    const isAssigned =
      !!currentUserId &&
      ((clientAssignees[client.id] ?? []).includes(currentUserId) ||
        (clientPmAssignees[client.id] ?? []).includes(currentUserId));
    if (!["admin", "director"].includes(role) && !isAssigned) {
      return "You can only link an additional cost to a client assigned to you as People or PM.";
    }
    return null;
  };
  const remove = async (row: AdditionalCost) => {
    setDeletingId(row.id);
    try {
      const response = await fetch(
        `/api/additional-costs?id=${encodeURIComponent(row.id)}`,
        { method: "DELETE" },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ?? "Could not delete the additional cost.",
        );
      setRows((current) =>
        current.filter((candidate) => candidate.id !== row.id),
      );
      setPendingDelete(null);
      toast.success("Additional cost deleted");
    } catch (deleteError) {
      toast.error("Additional cost could not be deleted", {
        description:
          deleteError instanceof Error
            ? deleteError.message
            : "Please try again.",
      });
    } finally {
      setDeletingId(null);
    }
  };
  const filteredClients = clients.filter((client) =>
    clientLabel(client)
      .toLowerCase()
      .includes(pickerQuery.trim().toLowerCase()),
  );
  const clientSections = useMemo(() => {
    const sections = [...groups]
      .sort((first, second) => first.sort_order - second.sort_order)
      .map((group) => ({
        id: group.id,
        label: group.name,
        clients: filteredClients
          .filter((client) => client.groupId === group.id)
          .sort(compareByDefaultClientBoardOrder),
      }))
      .filter((section) => section.clients.length);
    const ungrouped = filteredClients
      .filter(
        (client) =>
          !client.groupId ||
          !groups.some((group) => group.id === client.groupId),
      )
      .sort(compareByDefaultClientBoardOrder);
    if (ungrouped.length)
      sections.push({
        id: "ungrouped",
        label: "Ungrouped",
        clients: ungrouped,
      });
    return sections;
  }, [filteredClients, groups]);
  const cell = (content: React.ReactNode, key: string) => (
    <div key={key} className="min-w-0 border-b border-r border-slate-200">
      {content}
    </div>
  );
  const voucherGroups = [
    {
      id: "courier" as const,
      name: "Lalamove/Easyparcel",
      rows: rows.filter((row) => /lalamove|easyparcel/i.test(row.courier)),
      accent: "#16a5c4",
    },
    {
      id: "other" as const,
      name: "Manpower/UPS Charges/Other payments",
      rows: rows.filter((row) => !/lalamove|easyparcel/i.test(row.courier)),
      accent: "#8b5cf6",
    },
  ];
  const renderVoucherGroup = (group: (typeof voucherGroups)[number]) => (
    <section
      key={group.id}
      className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
    >
      <button
        type="button"
        onClick={() =>
          setCollapsedVoucherGroups((current) => ({
            ...current,
            [group.id]: !current[group.id],
          }))
        }
        className="flex w-full items-center gap-2 border-l-4 px-4 py-3 text-left hover:bg-slate-50"
        style={{ borderLeftColor: group.accent }}
      >
        {collapsedVoucherGroups[group.id] ? (
          <ChevronRight size={18} style={{ color: group.accent }} />
        ) : (
          <ChevronDown size={18} style={{ color: group.accent }} />
        )}
        <span className="text-lg font-semibold text-slate-800">
          {group.name}
        </span>
        <span className="text-sm text-slate-500">
          {group.rows.length} vouchers
        </span>
      </button>
      {!collapsedVoucherGroups[group.id] && (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <tr>
                {initialColumns.map((column) => (
                  <th
                    key={column.key}
                    className="whitespace-nowrap border-b border-r border-slate-200 px-3 py-3 last:border-r-0"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!group.rows.length ? (
                <tr>
                  <td
                    colSpan={initialColumns.length}
                    className="px-3 py-8 text-center text-sm text-slate-400"
                  >
                    No payment vouchers in this group yet.
                  </td>
                </tr>
              ) : (
                group.rows.map((row) => {
                  const client = clientsById.get(row.client_id);
                  return (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="border-b border-r border-slate-200 px-3 py-2 font-medium text-slate-700">
                        {client ? (
                          <button
                            type="button"
                            onClick={() => onOpenProject?.(client.id)}
                            className="max-w-full truncate text-left text-sky-700 hover:underline"
                            title={`Open ${clientLabel(client)} on the CRM Board`}
                          >
                            {clientLabel(client)}
                          </button>
                        ) : (
                          "Deleted client"
                        )}
                      </td>
                      <td className="border-b border-r border-slate-200 p-0">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          defaultValue={row.cost ?? ""}
                          disabled={!canDelete(row)}
                          onBlur={(event) =>
                            event.target.value !== String(row.cost ?? "") &&
                            void update(row.id, { cost: event.target.value })
                          }
                          className="h-10 w-full bg-transparent px-3 text-right outline-none focus:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </td>
                      <td className="h-10 border-b border-r border-slate-200 p-0">
                        <StatusBadge
                          value={row.reason}
                          onChange={(reason) => void update(row.id, { reason })}
                          options={labelOptions.additional_cost_reason ?? []}
                          onAddOption={(value) =>
                            manageLabel("additional_cost_reason", "add", value)
                          }
                          onDeleteOption={(value) =>
                            deleteLabel("additional_cost_reason", value)
                          }
                          onUpdateOptionColor={(value, color) =>
                            manageLabel(
                              "additional_cost_reason",
                              "color",
                              value,
                              color,
                            )
                          }
                          onRenameOption={(value, nextValue) =>
                            manageLabel(
                              "additional_cost_reason",
                              "rename",
                              value,
                              nextValue,
                            )
                          }
                          onReorderOptions={(layout) =>
                            reorderLabels("additional_cost_reason", layout)
                          }
                          manageLabel="reason"
                          readOnly={!canDelete(row)}
                        />
                      </td>
                      <td className="border-b border-r border-slate-200 px-3 py-2">
                        {row.trip_id}
                      </td>
                      <td className="border-b border-r border-slate-200 p-0">
                        <input
                          defaultValue={row.items_sent}
                          disabled={!canDelete(row)}
                          onBlur={(event) =>
                            event.target.value !== row.items_sent &&
                            void update(row.id, { items_sent: event.target.value })
                          }
                          className="h-10 w-full bg-transparent px-3 outline-none focus:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </td>
                      <td className="h-10 border-b border-r border-slate-200 p-0">
                        <StatusBadge
                          value={row.courier}
                          onChange={(courier) => void update(row.id, { courier })}
                          options={(labelOptions.additional_cost_courier ?? []).filter(
                            (option) =>
                              group.id === "courier"
                                ? ["Lalamove", "Easyparcel"].includes(option.value)
                                : !["", "Lalamove", "Easyparcel"].includes(
                                    option.value,
                                  ),
                          )}
                          includeBlankOption={false}
                          readOnly={!canDelete(row)}
                        />
                      </td>
                      <td className="border-b border-slate-200 p-0">
                        <input
                          defaultValue={row.remarks}
                          disabled={!canDelete(row)}
                          onBlur={(event) =>
                            event.target.value !== row.remarks &&
                            void update(row.id, { remarks: event.target.value })
                          }
                          className="h-10 w-full bg-transparent px-3 outline-none focus:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </td>
                      <td
                        title={`${new Date(row.created_at).toLocaleString("en-SG")}${row.created_by ? ` · Created by ${profiles.find((profile) => profile.id === row.created_by)?.full_name || profiles.find((profile) => profile.id === row.created_by)?.email || "Unknown user"}` : ""}`}
                        className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-xs text-slate-500"
                      >
                        {new Date(row.created_at).toLocaleDateString("en-SG")}
                      </td>
                      <td className="border-b border-slate-200 p-0 text-center">
                        <button
                          type="button"
                          disabled={!canDelete(row) || deletingId === row.id}
                          onClick={() => setPendingDelete(row)}
                          title={
                            canDelete(row)
                              ? "Delete payment voucher and linked subitem"
                              : "You can only edit payment vouchers for clients assigned to you"
                          }
                          className="inline-flex h-10 w-full items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
      {group.id === "courier" && !collapsedVoucherGroups[group.id] && (
        <div className="border-t border-slate-200 px-3 py-2">
          <button
            type="button"
            onClick={() => {
              setExpandedPickerGroups(
                new Set(clientSections.map((section) => section.id)),
              );
              setPickerOpen(true);
            }}
            className="text-sm font-medium text-sky-700 hover:text-sky-800"
          >
            + Add payment voucher
          </button>
        </div>
      )}
    </section>
  );
  return (
    <section className="crm-board min-h-full bg-slate-50 p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            Payment Voucher
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review payment vouchers grouped by courier and other payments.
          </p>
        </div>
      </div>
      <div className="space-y-4">
        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-10 text-center text-sm text-slate-400">
            Loading payment vouchers…
          </div>
        ) : (
          voucherGroups.map(renderVoucherGroup)
        )}
      </div>
      <div className="hidden w-max min-w-full rounded-lg border border-slate-200 bg-white shadow-sm">
        <div>
          <div
            className="grid bg-slate-50 text-xs font-semibold text-slate-500"
            style={{ gridTemplateColumns }}
          >
            {columns.map((column, index) => (
              <div
                key={column.key}
                className="relative h-11 whitespace-nowrap border-b border-r border-slate-200 px-2 leading-[44px]"
              >
                {column.label}
                <button
                  aria-label={`Resize ${column.label || "actions"} column`}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    resize(index, event.clientX, column.width);
                  }}
                  className="absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize"
                />
              </div>
            ))}
          </div>
          {loading ? (
            <div className="px-3 py-10 text-center text-sm text-slate-400">
              Loading Additional Costs…
            </div>
          ) : null}
          {!loading && !rows.length ? (
            <div className="px-3 py-10 text-center text-sm text-slate-400">
              No additional costs yet. Add one by choosing a client.
            </div>
          ) : null}
          {rows.map((row) => {
            const client = clientsById.get(row.client_id);
            return (
              <div
                key={row.id}
                className="grid hover:bg-slate-50"
                style={{ gridTemplateColumns }}
              >
                {cell(
                  <div className="flex h-10 items-center truncate px-2 text-sm font-medium text-slate-700">
                    {client ? clientLabel(client) : "Deleted client"}
                  </div>,
                  "project",
                )}
                {cell(
                  <input
                    type="date"
                    value={row.date_sent ?? ""}
                    onChange={(event) =>
                      void update(row.id, {
                        date_sent: event.target.value || null,
                      })
                    }
                    className={`${cellClass} w-full`}
                  />,
                  "date_sent",
                )}
                {cell(
                  <div className="flex h-10 w-full items-center justify-center [&>div]:w-full">
                    <AssigneeMultiSelect
                      profiles={profiles.filter(
                        (profile) => profile.role?.toLowerCase() !== "shipper",
                      )}
                      selectedIds={
                        row.people_ids ?? (row.people_id ? [row.people_id] : [])
                      }
                      onChange={(people_ids) =>
                        void update(row.id, { people_ids })
                      }
                    />
                  </div>,
                  "people",
                )}
                {cell(
                  <input
                    inputMode="decimal"
                    value={row.cost ?? ""}
                    onBlur={(event) =>
                      void update(row.id, {
                        cost:
                          event.target.value !== "" &&
                          Number.isFinite(Number(event.target.value))
                            ? event.target.value
                            : null,
                      })
                    }
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((candidate) =>
                          candidate.id === row.id
                            ? {
                                ...candidate,
                                cost: Number.isFinite(
                                  Number(event.target.value),
                                )
                                  ? Number(event.target.value)
                                  : null,
                              }
                            : candidate,
                        ),
                      )
                    }
                    className={`${cellClass} w-full text-right`}
                  />,
                  "cost",
                )}
                {cell(
                  <input
                    defaultValue={row.remarks}
                    onBlur={(event) =>
                      event.target.value !== row.remarks &&
                      void update(row.id, { remarks: event.target.value })
                    }
                    className={`${cellClass} w-full`}
                  />,
                  "remarks",
                )}
                {cell(
                  <StatusBadge
                    value={row.status}
                    onChange={(status) => void update(row.id, { status })}
                    options={labelOptions.additional_cost_status ?? []}
                    onAddOption={(value) =>
                      manageLabel("additional_cost_status", "add", value)
                    }
                    onDeleteOption={(value) =>
                      deleteLabel("additional_cost_status", value)
                    }
                    onUpdateOptionColor={(value, color) =>
                      manageLabel(
                        "additional_cost_status",
                        "color",
                        value,
                        color,
                      )
                    }
                    onRenameOption={(value, nextValue) =>
                      manageLabel(
                        "additional_cost_status",
                        "rename",
                        value,
                        nextValue,
                      )
                    }
                    onReorderOptions={(layout) =>
                      reorderLabels("additional_cost_status", layout)
                    }
                    manageLabel="status"
                  />,
                  "status",
                )}
                {cell(
                  <StatusBadge
                    value={row.reason}
                    onChange={(reason) => void update(row.id, { reason })}
                    options={labelOptions.additional_cost_reason ?? []}
                    onAddOption={(value) =>
                      manageLabel("additional_cost_reason", "add", value)
                    }
                    onDeleteOption={(value) =>
                      deleteLabel("additional_cost_reason", value)
                    }
                    onUpdateOptionColor={(value, color) =>
                      manageLabel(
                        "additional_cost_reason",
                        "color",
                        value,
                        color,
                      )
                    }
                    onRenameOption={(value, nextValue) =>
                      manageLabel(
                        "additional_cost_reason",
                        "rename",
                        value,
                        nextValue,
                      )
                    }
                    onReorderOptions={(layout) =>
                      reorderLabels("additional_cost_reason", layout)
                    }
                    manageLabel="reason"
                  />,
                  "reason",
                )}
                {cell(
                  <StatusBadge
                    value={row.courier}
                    onChange={(courier) => void update(row.id, { courier })}
                    options={labelOptions.additional_cost_courier ?? []}
                    onAddOption={(value) =>
                      manageLabel("additional_cost_courier", "add", value)
                    }
                    onDeleteOption={(value) =>
                      deleteLabel("additional_cost_courier", value)
                    }
                    onUpdateOptionColor={(value, color) =>
                      manageLabel(
                        "additional_cost_courier",
                        "color",
                        value,
                        color,
                      )
                    }
                    onRenameOption={(value, nextValue) =>
                      manageLabel(
                        "additional_cost_courier",
                        "rename",
                        value,
                        nextValue,
                      )
                    }
                    onReorderOptions={(layout) =>
                      reorderLabels("additional_cost_courier", layout)
                    }
                    manageLabel="courier"
                  />,
                  "courier",
                )}
                {(["trip_id", "items_sent", "qty"] as const).map((field) =>
                  cell(
                    <input
                      defaultValue={row[field]}
                      onBlur={(event) =>
                        event.target.value !== row[field] &&
                        void update(row.id, { [field]: event.target.value })
                      }
                      className={`${cellClass} w-full`}
                    />,
                    field,
                  ),
                )}
                {cell(
                  <div
                    title={`${new Date(row.created_at).toLocaleString("en-SG")}${row.created_by ? ` · Created by ${profiles.find((profile) => profile.id === row.created_by)?.full_name || profiles.find((profile) => profile.id === row.created_by)?.email || "Unknown user"}` : ""}`}
                    className="flex h-10 items-center whitespace-nowrap px-2 text-xs text-slate-500"
                  >
                    {new Date(row.created_at).toLocaleDateString("en-SG")}
                  </div>,
                  "created",
                )}
                {(["verified", "discussed"] as const).map((field) =>
                  cell(
                    <button
                      aria-label={field}
                      onClick={() =>
                        void update(row.id, { [field]: !row[field] })
                      }
                      className="mx-auto flex h-10 w-full items-center justify-center"
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded border ${row[field] ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white text-transparent"}`}
                      >
                        <Check size={13} />
                      </span>
                    </button>,
                    field,
                  ),
                )}
                {cell(
                  <button
                    disabled={deletingId === row.id || !canDelete(row)}
                    title={
                      canDelete(row)
                        ? "Delete additional cost"
                        : "Only users assigned to this client can delete it"
                    }
                    onClick={() => setPendingDelete(row)}
                    className="flex h-10 w-full items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label="Delete additional cost"
                  >
                    <Trash2 size={15} />
                  </button>,
                  "actions",
                )}
              </div>
            );
          })}
        </div>
      </div>
      {error ? <p className="m-3 text-sm text-red-600">{error}</p> : null}
      {pickerOpen ? (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/35 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-[min(40rem,calc(100vh-2rem))] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-800">
                  {selectedVoucherClientId
                    ? "Payment voucher details"
                    : "Choose a client"}
                </h2>
                {selectedVoucherClientId ? (
                  <p className="mt-0.5 text-sm text-slate-500">
                    Complete the required payment voucher information.
                  </p>
                ) : null}
                <p
                  className={`mt-0.5 text-sm text-slate-500 ${selectedVoucherClientId ? "hidden" : ""}`}
                >
                  The client becomes this record’s Project Name.
                </p>
              </div>
              <button
                onClick={() => setPickerOpen(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={19} />
              </button>
            </div>
            {selectedVoucherClientId ? (
              <div className="space-y-3 p-4">
                <button
                  type="button"
                  onClick={() => setSelectedVoucherClientId(null)}
                  className="text-sm text-sky-700 hover:underline"
                >
                  Change project
                </button>
                <p className="text-sm font-medium text-slate-700">
                  Project:{" "}
                  {clientLabel(clientsById.get(selectedVoucherClientId)!)}
                </p>
                <div className="border-t border-slate-200 pt-3">
                  <p className="text-sm font-semibold text-slate-700">
                    Voucher information
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700">
                    Cost *
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={voucherDraft.cost}
                      onChange={(event) =>
                        setVoucherDraft((draft) => ({
                          ...draft,
                          cost: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal"
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Reason *
                    <div className="mt-1 h-10 overflow-hidden rounded border border-slate-300">
                      <StatusBadge
                        value={voucherDraft.reason}
                        onChange={(reason) =>
                          setVoucherDraft((draft) => ({
                            ...draft,
                            reason,
                          }))
                        }
                        options={labelOptions.additional_cost_reason ?? []}
                      />
                    </div>
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Items Sent *
                    <input
                      value={voucherDraft.items_sent}
                      onChange={(event) =>
                        setVoucherDraft((draft) => ({
                          ...draft,
                          items_sent: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal"
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Courier *
                    <div className="mt-1 h-10 overflow-hidden rounded border border-slate-300">
                      <StatusBadge
                        value={voucherDraft.courier}
                        onChange={(courier) =>
                          setVoucherDraft((draft) => ({
                            ...draft,
                            courier,
                          }))
                        }
                        options={(labelOptions.additional_cost_courier ?? []).filter(
                          (option) =>
                            !option.value ||
                            ["Lalamove", "Easyparcel"].includes(option.value),
                        )}
                      />
                    </div>
                  </label>
                </div>
                <label className="block text-sm font-medium text-slate-700">
                  Remarks{" "}
                  <textarea
                    value={voucherDraft.remarks}
                    onChange={(event) =>
                      setVoucherDraft((draft) => ({
                        ...draft,
                        remarks: event.target.value,
                      }))
                    }
                    className="mt-1 min-h-20 w-full rounded border border-slate-300 px-3 py-2 font-normal"
                  />
                </label>
                <button
                  type="button"
                  disabled={
                    creatingFor !== null ||
                    Number(voucherDraft.cost) <= 0 ||
                    !voucherDraft.reason ||
                    !voucherDraft.items_sent.trim() ||
                    !voucherDraft.courier
                  }
                  onClick={() => void create(selectedVoucherClientId)}
                  className="rounded bg-[#16a5c4] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {creatingFor ? "Creating…" : "Create payment voucher"}
                </button>
              </div>
            ) : (
              <>
                <label className="relative m-4 block">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    autoFocus
                    value={pickerQuery}
                    onChange={(event) => setPickerQuery(event.target.value)}
                    placeholder="Search client name or Client ID…"
                    className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-sky-500"
                  />
                </label>
                <div className="min-h-0 overflow-y-auto border-t border-slate-100 px-2 pb-2">
                  {clientSections.map((section) => {
                    const expanded = expandedPickerGroups.has(section.id);
                    return (
                      <div key={section.id}>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedPickerGroups((current) => {
                              const next = new Set(current);
                              if (next.has(section.id)) next.delete(section.id);
                              else next.add(section.id);
                              return next;
                            })
                          }
                          className="sticky top-0 flex w-full items-center justify-between border-y border-slate-100 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-500 hover:bg-slate-100"
                        >
                          <span>{section.label}</span>
                          {expanded ? (
                            <ChevronDown size={16} />
                          ) : (
                            <ChevronRight size={16} />
                          )}
                        </button>
                        {expanded
                          ? section.clients.map((client) => {
                              const restriction = creationRestriction(client);
                              const isLocked =
                                client.customFields?.subitemsLocked === "true";
                              return (
                                <div
                                  key={client.id}
                                  title={restriction ?? undefined}
                                >
                                  <button
                                    disabled={
                                      creatingFor !== null ||
                                      Boolean(restriction)
                                    }
                                    onClick={() =>
                                      setSelectedVoucherClientId(client.id)
                                    }
                                    className="flex w-full items-center rounded-md px-3 py-3 text-left text-sm hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <span className="flex min-w-0 items-center font-medium text-slate-700">
                                      {isLocked ? (
                                        <LockKeyhole
                                          size={17}
                                          aria-label="Locked client"
                                          className="mr-2 shrink-0 text-amber-500"
                                        />
                                      ) : null}
                                      <span className="truncate">
                                        {client.name || "Unnamed client"}
                                      </span>
                                      <span className="ml-2 shrink-0 font-mono text-xs text-slate-400">
                                        {client.displayId}
                                      </span>
                                    </span>
                                    {creatingFor === client.id ? (
                                      <span className="ml-auto text-xs text-slate-400">
                                        Creating…
                                      </span>
                                    ) : null}
                                  </button>
                                </div>
                              );
                            })
                          : null}
                      </div>
                    );
                  })}
                  {!clientSections.length ? (
                    <p className="px-3 py-8 text-center text-sm text-slate-400">
                      No matching clients.
                    </p>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete payment voucher?</AlertDialogTitle>
            <AlertDialogDescription>
              This payment voucher and its linked CRM subitem will both be
              deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingId)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(deletingId)}
              onClick={(event) => {
                event.preventDefault();
                if (pendingDelete) void remove(pendingDelete);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingId ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
