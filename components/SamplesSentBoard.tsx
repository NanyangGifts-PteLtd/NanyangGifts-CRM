"use client";

import {
  ChevronDown,
  ChevronRight,
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
  created_at: string;
  linkedClient: {
    id: string;
    name: string;
    display_id: string;
    phone: string;
  } | null;
  people: Profile[];
  createdByProfile: Profile | null;
  items: { item_name: string; qty: number }[];
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
const GRID = [
  245, 84, 130, 230, 115, 115, 125, 160, 230, 110, 120, 135, 260, 130, 115, 125,
  125, 155,
]
  .map((width) => `${width}px`)
  .join(" ");
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
  canManage,
  onToggle,
  onDelete,
}: {
  group: Group;
  rows: SampleRow[];
  canManage: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <section className="min-w-max overflow-hidden border-y border-[#d0d4e4] bg-white">
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
        <div className="overflow-x-auto">
          <BoardHeader />
          {rows.map((row) => (
            <SampleRecordLine key={row.id} row={row} />
          ))}
          {!rows.length && <EmptyRecordLine />}
        </div>
      )}
    </section>
  );
}

function BoardHeader() {
  return (
    <div
      className="grid border-t border-l border-[#d0d4e4] bg-[#fbfcff] text-center text-[12px] text-[#667085]"
      style={{ gridTemplateColumns: GRID }}
    >
      {COLUMNS.map((label) => (
        <div
          key={label}
          className="flex h-[34px] items-center justify-center border-r border-[#d0d4e4] px-2"
        >
          {label}
        </div>
      ))}
    </div>
  );
}
function EmptyRecordLine() {
  return (
    <div
      className="grid h-[36px] border-t border-l border-[#d0d4e4]"
      style={{ gridTemplateColumns: GRID }}
    >
      {COLUMNS.map((label) => (
        <div key={label} className="border-r border-[#e1e5ef]" />
      ))}
    </div>
  );
}

function SampleRecordLine({ row }: { row: SampleRow }) {
  const creator = row.createdByProfile;
  const creationTitle = `Created by ${creator ? profileName(creator) : "System"} on ${new Date(row.created_at).toLocaleDateString("en-GB")} at ${new Date(row.created_at).toLocaleTimeString("en-GB")}`;
  const cell = (key: string, value: ReactNode) => (
    <div
      key={key}
      className="flex min-w-0 items-center border-r border-[#e1e5ef] px-2 py-1"
    >
      {value}
    </div>
  );
  return (
    <div
      className="grid min-h-[36px] border-t border-l border-[#d0d4e4] bg-white text-[12px]"
      style={{ gridTemplateColumns: GRID }}
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
      {cell("people", <AvatarStack profiles={row.people} />)}
      {cell("mobile", row.linkedClient?.phone)}
      {cell("address", <span className="truncate">{row.address}</span>)}
      {cell("dateSent", displayDate(row.date_sent))}
      {cell("returnBy", displayDate(row.return_by))}
      {cell("status", "")}
      {cell("reason", "")}
      {cell("remarks", <span className="truncate">{row.remarks}</span>)}
      {cell("cost", Number(row.cost).toFixed(2))}
      {cell("photo", "")}
      {cell("courier", "")}
      {cell(
        "items",
        <span className="whitespace-pre-line">
          {row.items
            .map((item) => `${item.item_name} x ${item.qty}`)
            .join("\n")}
        </span>,
      )}
      {cell("extend", "")}
      {cell("returned", "")}
      {cell("dateReturned", "")}
      {cell("reference", row.referenceId)}
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
      <div className="flex h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white text-slate-800 shadow-2xl">
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
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
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
              setAddress(next.billingAddress || "");
            }}
          />
        ) : (
          <>
            <div className="flex items-center justify-between rounded-md border border-sky-200 bg-sky-50 px-3 py-2">
              <span className="text-sm text-slate-700">
                Creating Samples Sent record for <strong>{client.name}</strong>{" "}
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
            <div className="grid gap-5 p-5 lg:grid-cols-2">
              <SampleDetails
            client={client}
            profiles={profiles}
            peopleIds={peopleIds}
            groupId={groupId}
            groups={groups}
            address={address}
            dateSent={dateSent}
            returnBy={returnBy}
            cost={cost}
            remarks={remarks}
            onPeopleChange={setPeopleIds}
            onGroupChange={setGroupId}
            onAddressChange={setAddress}
            onDateSentChange={setDateSent}
            onReturnByChange={setReturnBy}
            onCostChange={setCost}
            onRemarksChange={setRemarks}
              />
              <ItemsEditor
          client={client}
          items={items}
          onChange={setItems}
          updateItem={updateItem}
              />
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
  client: Client | null;
  profiles: Profile[];
  peopleIds: string[];
  groupId: string;
  groups: Group[];
  address: string;
  dateSent: string;
  returnBy: string;
  cost: string;
  remarks: string;
  onPeopleChange: (value: string[]) => void;
  onGroupChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onDateSentChange: (value: string) => void;
  onReturnByChange: (value: string) => void;
  onCostChange: (value: string) => void;
  onRemarksChange: (value: string) => void;
};
function SampleDetails(props: DetailsProps) {
  return (
    <section className="space-y-3">
      <p className="rounded border bg-slate-50 p-2 text-sm">
        {props.client ? (
          <>
            <b>{props.client.name}</b>{" "}
            <span className="text-slate-500">{props.client.displayId}</span>
          </>
        ) : (
          "Choose a client"
        )}
      </p>
      <label className="grid gap-1 text-sm font-medium">
        Group
        <select
          value={props.groupId}
          onChange={(event) => props.onGroupChange(event.target.value)}
          className="h-9 rounded border border-slate-300 px-2 text-sm"
        >
          {props.groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </label>
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
      <label className="grid gap-1 text-sm font-medium">
        Cost
        <input
          type="number"
          min="0"
          step="0.01"
          value={props.cost}
          onChange={(event) => props.onCostChange(event.target.value)}
          className="h-9 rounded border border-slate-300 px-2"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Remarks
        <textarea
          rows={2}
          value={props.remarks}
          onChange={(event) => props.onRemarksChange(event.target.value)}
          className="rounded border border-slate-300 px-2 py-1"
        />
      </label>
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
                const subitem = client?.subitems.find(
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
              {client?.subitems.map((subitem) => (
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
