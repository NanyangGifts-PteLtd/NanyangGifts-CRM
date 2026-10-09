"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import {
  ChevronDown,
  ChevronRight,
  ListFilter,
  LoaderCircle,
  Pin,
  PinOff,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";
import "@bitnoi.se/react-scheduler/dist/style.css";
import { TimelineSection, type OptionEntry } from "./ui/timeline";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import type {
  Client,
  ClientAssigneeMap,
  CRMGroup,
  Profile,
  Subitem,
  SubitemAssigneeMap,
  TimelineGroup,
  TimelineRow,
} from "../app/types";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import {
  fetchGanttClientFilterOptions,
  type GanttServerQuery,
} from "@/lib/crm";

const Scheduler = dynamic(
  () => import("@bitnoi.se/react-scheduler").then((mod) => mod.Scheduler),
  { ssr: false },
);
const RESOURCE_PANEL_WIDTH = 570;
const PROCESS_LEGEND = [
  { label: "Pending / not started", color: "#94a3b8" },
  { label: "Started / shipped out", color: "#eab308" },
  { label: "Done / delivered", color: "#22c55e" },
  { label: "Late", color: "#dc2626" },
] as const;

type Props = {
  clients: Client[];
  groups: CRMGroup[];
  profiles: Profile[];
  clientAssignees: ClientAssigneeMap;
  clientPmAssignees: ClientAssigneeMap;
  subitemAssignees: SubitemAssigneeMap;
  onOpenClientTimeline: (clientId: string, subitemId?: string) => void;
  onUpdateSubitem: (
    clientId: string,
    subitemId: string,
    updates: Partial<Subitem>,
  ) => void | Promise<void>;
  canEditSubitem: (clientId: string, subitemId: string) => boolean;
  isLoading?: boolean;
  resourceIds?: string[];
  totalResourceCount?: number;
  hasMoreResources?: boolean;
  isLoadingMore?: boolean;
  onServerQueryChange?: (query: GanttServerQuery) => void;
  onLoadMoreResources?: () => void;
  loadedQueryKey?: string;
};
type SchedulerItem = {
  id: string;
  startDate: Date;
  endDate: Date;
  occupancy: number;
  title: string;
  subtitle: string;
  description?: string;
  bgColor?: string;
  processStatus: string;
  isOverdue: boolean;
  timelineId?: string;
};
type SchedulerResource = {
  id: string;
  label: { title: string; subtitle: string; icon: string };
  data: SchedulerItem[];
  clientId: string;
  subitemId?: string;
  groupId: string;
  groupName: string;
  clientName: string;
  clientDisplayId: string;
  subitemName: string;
  subitemDisplayId: string;
  timelineIndex: number;
  processNames: string[];
  pmIds: string[];
  peopleIds: string[];
};
type LabelHost = {
  resource: SchedulerResource;
  element: HTMLElement;
  startsVisibleClientGroup: boolean;
  clientSpanHeight: number;
  clientTop: number;
  startsVisibleGroup: boolean;
  groupSpanHeight: number;
  groupTop: number;
};
type TimelinePan = {
  pointerId: number;
  startX: number;
  startY: number;
  startScrollLeft: number;
  startScrollTop: number;
  moved: boolean;
  previousCursor: string;
  previousUserSelect: string;
};
type SearchScope = "all" | "group" | "client" | "subitem";
type SchedulerRange = { startDate: Date; endDate: Date };
type FilterMenu = { kind: "all" | "group" | "client"; x: number; y: number };
type GanttFilters = {
  groupIds: Set<string>;
  clientIds: Set<string>;
  pmIds: Set<string>;
  peopleIds: Set<string>;
  processStatuses: Set<string>;
  dateFrom: string;
  dateTo: string;
};

const EMPTY_FILTERS: GanttFilters = {
  groupIds: new Set(),
  clientIds: new Set(),
  pmIds: new Set(),
  peopleIds: new Set(),
  processStatuses: new Set(),
  dateFrom: "",
  dateTo: "",
};

type FilterOption = { value: string; label: string };

function FilterChecklist({
  options,
  selected,
  onToggle,
  searchable = true,
}: {
  options: FilterOption[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  searchable?: boolean;
}) {
  const [query, setQuery] = useState("");
  const visibleOptions = options.filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <div className="space-y-2">
      {searchable && options.length > 6 && (
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2 top-2.5 text-slate-400"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search options"
            className="h-8 w-full rounded-md border border-slate-200 pl-7 pr-2 text-xs outline-none focus:border-sky-400"
          />
        </div>
      )}
      <div className="max-h-48 space-y-0.5 overflow-y-auto pr-1">
        {visibleOptions.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
          >
            <input
              type="checkbox"
              checked={selected.has(option.value)}
              onChange={() => onToggle(option.value)}
              className="accent-sky-600"
            />
            <span className="truncate" title={option.label}>
              {option.label}
            </span>
          </label>
        ))}
        {!visibleOptions.length && (
          <p className="px-2 py-3 text-center text-xs text-slate-400">
            No matching options
          </p>
        )}
      </div>
    </div>
  );
}

function parseDate(value?: string): Date | null {
  if (!value?.trim()) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;
  const retried = new Date(
    value.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/, "$3-$2-$1"),
  );
  return Number.isNaN(retried.getTime()) ? null : retried;
}

function addOneDay(date: Date) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + 1);
  return copy;
}
function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

// Mirrors the CRM timeline rule: a dependent process begins the day after
// its dependency ends, while retaining its explicitly entered duration.
function resolveTimelineDependencies(previous: TimelineRow[], next: TimelineRow[]) {
  const before = new Map(previous.map((row) => [row.id, row]));
  const directlyEdited = new Set(
    next
      .filter((row) => {
        const old = before.get(row.id);
        return old && (old.timelineStart !== row.timelineStart || old.timelineEnd !== row.timelineEnd || old.dependency !== row.dependency);
      })
      .map((row) => row.id),
  );
  const resolved = next.map((row) => ({ ...row }));
  let updates = 0;
  for (let pass = 0; pass < resolved.length; pass += 1) {
    let changed = false;
    for (const row of resolved) {
      if (directlyEdited.has(row.id) || !row.dependency) continue;
      const dependency = resolved.find((candidate) => candidate.name === row.dependency);
      const dependencyEnd = parseDate(dependency?.timelineEnd);
      if (!dependencyEnd) continue;
      const start = addOneDay(dependencyEnd);
      const nextStart = formatDate(start);
      if (row.timelineStart === nextStart) continue;
      row.timelineStart = nextStart;
      const duration = Number(row.duration);
      if (row.duration.trim() !== "" && Number.isFinite(duration) && duration >= 0) {
        const end = new Date(start);
        end.setDate(end.getDate() + duration);
        row.timelineEnd = formatDate(end);
      }
      updates += 1;
      changed = true;
    }
    if (!changed) break;
  }
  if (updates) toast.success("Timeline dates updated", { description: `${updates} dependent process ${updates === 1 ? "was" : "were"} updated.` });
  return resolved;
}
function getColor(systemKey?: string | null) {
  if (systemKey === "subitem_subprogress_late") return "#dc2626";
  if (
    systemKey === "subitem_subprogress_done" ||
    systemKey === "subitem_subprogress_delivered"
  )
    return "#22c55e";
  if (
    systemKey === "subitem_subprogress_started" ||
    systemKey === "subitem_subprogress_shipped_out"
  )
    return "#eab308";
  return "#94a3b8";
}

function parsePmIds(client: Client): string[] {
  try {
    const value = JSON.parse(client.customFields?.pmAssigneeIds ?? "[]");
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

// Timelines become operational only once their subitem reaches the Awarded
// phase. Keep this in step with the eligibility rule used by the expanded CRM
// subitem view and OCF workflow. A stored draft timeline is not, by itself, a
// reason for an unawarded subitem to appear on the operational Gantt.
const GANTT_ELIGIBLE_SUBITEM_STATUSES = new Set([
  "awarded",
  "verify later",
  "verified",
  "variation cost difference",
]);

function isGanttEligibleSubitem(subitem: Subitem) {
  const normalizedStatus = String(subitem.status ?? "")
    .trim()
    .toLowerCase()
    .replace(/[/_-]+/g, " ")
    .replace(/\s+/g, " ");
  return GANTT_ELIGIBLE_SUBITEM_STATUSES.has(normalizedStatus);
}

function buildSchedulerData(
  clients: Client[],
  groups: CRMGroup[],
  clientAssignees: ClientAssigneeMap,
  clientPmAssignees: ClientAssigneeMap,
  subitemAssignees: SubitemAssigneeMap,
  progressById: Map<
    string,
    {
      value: string;
      systemKey: string | null;
      color: string;
      section?: number;
    }
  >,
  allowedResourceIds?: Set<string>,
): SchedulerResource[] {
  const groupMap = new Map(groups.map((group) => [group.id, group]));
  return clients
    .filter(
      (client): client is Client => !!client && typeof client === "object",
    )
    .flatMap((client) => {
      const group = client.groupId ? groupMap.get(client.groupId) : undefined;
      const groupName = group?.name || "No group";
      const clientName = client.name || "Unnamed Client";
      const clientDisplayId = client.displayId || "";
      const subitems = Array.isArray(client.subitems)
        ? client.subitems.filter(
            (subitem): subitem is Subitem =>
              !!subitem &&
              typeof subitem === "object" &&
              isGanttEligibleSubitem(subitem),
          )
        : [];
      // The Gantt chart represents subitem processes. Clients without a
      // subitem have no schedulable work, so omit them rather than rendering
      // a placeholder "No subitems" resource row.
      return subitems.flatMap((subitem) => {
        const subitemName = subitem.name || "Untitled subitem";
        const subitemDisplayId = subitem.displayId || "";
        const timelines = Array.isArray(subitem.timelineGroups) && subitem.timelineGroups.length
          ? subitem.timelineGroups
          : [{ id: "default", rows: subitem.timelineRows ?? [] }];
        return timelines.flatMap((timeline, timelineIndex) => {
        const timelineRows = (timeline.rows ?? []).filter(
          (row): row is TimelineRow => !!row && typeof row === "object",
        );
        const resourceId = `${client.id}::${subitem.id}::${timeline.id}`;
        const items = timelineRows.flatMap((row): SchedulerItem[] => {
          const progress = progressById.get(row.subProgressOptionId ?? "");
          const start = parseDate(row?.timelineStart);
          const explicitEnd = parseDate(row?.timelineEnd);
          const end = start ? (explicitEnd ?? addOneDay(start)) : null;
          if (!start || !end) return [];
          return [
            {
              id: `${client.id}::${subitem.id}::${timeline.id}::${row.id}`,
              startDate: start,
              endDate: end,
              occupancy:
                progress?.systemKey === "subitem_subprogress_done"
                  ? 100
                  : progress?.systemKey === "subitem_subprogress_started"
                  ? 60
                    : 20,
              title: row.name || "Untitled Process",
              // The scheduler places title and subtitle side-by-side. Use
              // those slots for the process and its optional remarks only;
              // the subitem title and overdue state do not belong in a
              // process block.
              subtitle: row.remarks?.trim() || "",
              description: undefined,
              bgColor: getColor(progress?.systemKey),
              processStatus: row.subProgress || "No status",
              isOverdue: false,
              timelineId: timeline.id,
            },
          ];
        });

        const processNames = timelineRows.map(
          (row) => row.name || "Untitled Process",
        );
        const resource = {
          id: resourceId,
          label: {
            title: `${groupName} ${clientName} ${subitemName} Timeline ${timelineIndex + 1} ${processNames.join(" ")}`,
            subtitle: resourceId,
            icon: "",
          },
          data: items,
          clientId: client.id,
          subitemId: subitem.id,
          groupId: group?.id || "ungrouped",
          groupName,
          clientName,
          clientDisplayId,
          subitemName,
          subitemDisplayId,
          timelineIndex,
          processNames,
          pmIds: clientPmAssignees[client.id] ?? parsePmIds(client),
          peopleIds: Array.from(
            new Set([
              ...(clientAssignees[client.id] ?? []),
              // The People filter represents everyone responsible for the
              // record, including PM assignments (as it does on the Board).
              ...(clientPmAssignees[client.id] ?? parsePmIds(client)),
              ...(subitemAssignees[subitem.id] ?? []),
            ]),
          ),
        };
        return !allowedResourceIds || allowedResourceIds.has(resourceId)
          ? [resource]
          : [];
        });
      });
    });
}

export default function GanttChart({
  clients,
  groups,
  profiles,
  clientAssignees,
  clientPmAssignees,
  subitemAssignees,
  onOpenClientTimeline,
  onUpdateSubitem,
  canEditSubitem,
  isLoading = false,
  resourceIds,
  totalResourceCount,
  hasMoreResources = false,
  isLoadingMore = false,
  onServerQueryChange,
  onLoadMoreResources,
  loadedQueryKey = "",
}: Props) {
  const [progressById, setProgressById] = useState<
    Map<
      string,
      {
        value: string;
        systemKey: string | null;
        color: string;
        section?: number;
      }
    >
  >(new Map());
  const [shipperOptions, setShipperOptions] = useState<OptionEntry[]>([]);
  useEffect(() => {
    const supabase = createSupabaseClient();
    let active = true;
    void (async () => {
      const { data: group } = await supabase
        .from("option_groups")
        .select("id")
        .eq("code", "subitem_subprogress")
        .maybeSingle();
      if (!group) return;
      const { data } = await supabase
        .from("option_values")
        .select("id, value, system_key, color, section_index")
        .eq("group_id", group.id)
        .order("section_index")
        .order("sort_order")
        .order("id");
      if (active)
        setProgressById(
          new Map((data ?? []).map((option) => [option.id, {
            value: option.value,
            systemKey: option.system_key,
            color: option.color ?? "#94a3b8",
            section: option.section_index ?? 0,
          }])),
        );
    })();
    return () => { active = false; };
  }, []);
  const getOptionGroupId = useCallback(async (code: string) => {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("option_groups")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (error || !data) {
      toast.error("Label group could not be found", {
        description: error?.message ?? `No ${code.replaceAll("_", " ")} label group exists.`,
      });
      return null;
    }
    return data.id;
  }, []);

  const addGanttOption = useCallback(
    async (code: "subitem_subprogress" | "shipper", name: string) => {
      const value = name.trim();
      if (!value) return;
      const entries =
        code === "subitem_subprogress"
          ? Array.from(progressById.entries()).map(([id, option]) => ({ id, ...option }))
          : shipperOptions;
      if (entries.some((entry) => entry.value.toLowerCase() === value.toLowerCase())) {
        toast.error("Label already exists");
        return;
      }
      const groupId = await getOptionGroupId(code);
      if (!groupId) return;
      const supabase = createSupabaseClient();
      const { data, error } = await supabase
        .from("option_values")
        .insert({
          group_id: groupId,
          value,
          color: "#d1d5db",
          sort_order: entries.length,
          section_index: 0,
        })
        .select("id, value, system_key, color, section_index")
        .single();
      if (error || !data) {
        toast.error("Label could not be added", { description: error?.message });
        return;
      }
      if (code === "subitem_subprogress") {
        setProgressById((current) =>
          new Map(current).set(data.id, {
            value: data.value,
            systemKey: data.system_key,
            color: data.color ?? "#94a3b8",
            section: data.section_index ?? 0,
          }),
        );
      } else {
        setShipperOptions((current) => [
          ...current,
          {
            id: data.id,
            value: data.value,
            systemKey: data.system_key,
            color: data.color ?? "#94a3b8",
            section: data.section_index ?? 0,
          },
        ]);
      }
      toast.success("Label added");
    },
    [getOptionGroupId, progressById, shipperOptions],
  );

  const updateGanttOptionColor = useCallback(
    async (
      code: "subitem_subprogress" | "shipper",
      name: string,
      color: string,
      optionId?: string,
    ) => {
      const id = optionId ?? (
        code === "subitem_subprogress"
          ? Array.from(progressById.entries()).find(([, option]) => option.value === name)?.[0]
          : shipperOptions.find((option) => option.value === name)?.id
      );
      if (!id) return;
      if (code === "subitem_subprogress") {
        setProgressById((current) => {
          const next = new Map(current);
          const option = next.get(id);
          if (option) next.set(id, { ...option, color });
          return next;
        });
      } else {
        setShipperOptions((current) =>
          current.map((option) => (option.id === id ? { ...option, color } : option)),
        );
      }
      const supabase = createSupabaseClient();
      const { error } = await supabase.from("option_values").update({ color }).eq("id", id);
      if (error) toast.error("Label color could not be saved", { description: error.message });
    },
    [progressById, shipperOptions],
  );

  const renameGanttOption = useCallback(
    async (
      code: "subitem_subprogress" | "shipper",
      oldName: string,
      newName: string,
      optionId?: string,
    ) => {
      const value = newName.trim();
      if (!value || value === oldName) return;
      const id = optionId ?? (
        code === "subitem_subprogress"
          ? Array.from(progressById.entries()).find(([, option]) => option.value === oldName)?.[0]
          : shipperOptions.find((option) => option.value === oldName)?.id
      );
      if (!id) return;
      const supabase = createSupabaseClient();
      const { error } = await supabase.from("option_values").update({ value }).eq("id", id);
      if (error) {
        toast.error("Label could not be renamed", { description: error.message });
        return;
      }
      if (code === "subitem_subprogress") {
        setProgressById((current) => {
          const next = new Map(current);
          const option = next.get(id);
          if (option) next.set(id, { ...option, value });
          return next;
        });
      } else {
        setShipperOptions((current) =>
          current.map((option) => (option.id === id ? { ...option, value } : option)),
        );
      }
      toast.success("Label renamed");
    },
    [progressById, shipperOptions],
  );

  const reorderGanttOptions = useCallback(
    async (
      code: "subitem_subprogress" | "shipper",
      layout: Array<{ id?: string; value: string; section: number }>,
    ) => {
      const response = await fetch("/api/options/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, layout }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error("Label order could not be saved", { description: result.error });
        return;
      }
      const layoutById = new Map(layout.filter((entry) => entry.id).map((entry) => [entry.id!, entry]));
      if (code === "subitem_subprogress") {
        setProgressById((current) =>
          new Map(
            Array.from(current.entries()).map(([id, option]) => [
              id,
              { ...option, section: layoutById.get(id)?.section ?? option.section },
            ]),
          ),
        );
      } else {
        setShipperOptions((current) =>
          current.map((option) => ({
            ...option,
            section: layoutById.get(option.id ?? "")?.section ?? option.section,
          })),
        );
      }
    },
    [],
  );

  const deleteGanttOption = useCallback(
    async (
      code: "subitem_subprogress" | "shipper",
      name: string,
      optionId?: string,
    ) => {
      const preview = await fetch("/api/options/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", code, name, optionId }),
      });
      const previewResult = await preview.json().catch(() => ({}));
      if (!preview.ok || !previewResult.optionId) {
        toast.error("Label could not be deleted", { description: previewResult.error });
        return;
      }
      const count = Number(previewResult.usageCount ?? 0);
      if (
        count > 0 &&
        !window.confirm(
          `Delete “${name}” and clear it from ${count} existing ${count === 1 ? "cell" : "cells"}?`,
        )
      ) {
        return;
      }
      const response = await fetch("/api/options/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", code, name, optionId: previewResult.optionId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error("Label could not be deleted", { description: result.error });
        return;
      }
      if (code === "subitem_subprogress") {
        setProgressById((current) => {
          const next = new Map(current);
          next.delete(previewResult.optionId);
          return next;
        });
      } else {
        setShipperOptions((current) =>
          current.filter((option) => option.id !== previewResult.optionId),
        );
      }
      toast.success("Label deleted");
    },
    [],
  );
  useEffect(() => {
    const supabase = createSupabaseClient();
    let active = true;
    void (async () => {
      const { data: group } = await supabase
        .from("option_groups")
        .select("id")
        .eq("code", "shipper")
        .maybeSingle();
      if (!group) return;
      const { data } = await supabase
        .from("option_values")
        .select("id, value, system_key, color, section_index")
        .eq("group_id", group.id)
        .order("section_index")
        .order("sort_order")
        .order("id");
      if (active)
        setShipperOptions(
          (data ?? []).map((option) => ({
            id: option.id,
            value: option.value,
            systemKey: option.system_key,
            color: option.color ?? "#94a3b8",
            section: option.section_index ?? 0,
          })),
        );
    })();
    return () => {
      active = false;
    };
  }, []);
  const schedulerRootRef = useRef<HTMLDivElement | null>(null);
  const timelinePanRef = useRef<TimelinePan | null>(null);
  const suppressTimelineClickRef = useRef(false);
  const previousPageButtonRef = useRef<HTMLButtonElement | null>(null);
  const [pinnedClientIds, setPinnedClientIds] = useState<Set<string>>(
    new Set(),
  );
  const [labelHosts, setLabelHosts] = useState<LabelHost[]>([]);
  const labelHostKey = useMemo(
    () => labelHosts.map((host) => `${host.resource.id}:${host.element}`).join("|"),
    [labelHosts],
  );
  const [schedulerRootHost, setSchedulerRootHost] =
    useState<HTMLDivElement | null>(null);
  const setSchedulerRootRef = useCallback((node: HTMLDivElement | null) => {
    schedulerRootRef.current = node;
    setSchedulerRootHost(node);
  }, []);
  const [timelineCanvasHost, setTimelineCanvasHost] =
    useState<HTMLElement | null>(null);
  const [timelineCanvasWidth, setTimelineCanvasWidth] = useState(0);
  const [schedulerRange, setSchedulerRange] = useState<SchedulerRange | null>(
    null,
  );
  const [todayPosition, setTodayPosition] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    clientId: string;
    x: number;
    y: number;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchScope, setSearchScope] = useState<SearchScope>("all");
  const [filters, setFilters] = useState<GanttFilters>(EMPTY_FILTERS);
  const [filterMenu, setFilterMenu] = useState<FilterMenu | null>(null);
  const [serverClientOptions, setServerClientOptions] = useState<FilterOption[]>(
    [],
  );
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(
    new Set(),
  );
  const [collapsedClientIds, setCollapsedClientIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedTimeline, setSelectedTimeline] = useState<{
    clientId: string;
    subitemId: string;
    timelineId?: string;
  } | null>(null);
  const [resourcePaneCollapsed, setResourcePaneCollapsed] = useState(false);
  const resourcePanelWidth = resourcePaneCollapsed
    ? 0
    : RESOURCE_PANEL_WIDTH;

  useEffect(() => {
    let active = true;
    void fetch("/api/gantt-pins")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Unable to load pinned clients.");
        if (active) setPinnedClientIds(new Set(result.clientIds ?? []));
      })
      .catch((error) =>
        toast.error(
          error instanceof Error
            ? error.message
            : "Unable to load pinned clients.",
        ),
      );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void fetchGanttClientFilterOptions()
      .then((options) => {
        if (active) setServerClientOptions(options);
      })
      .catch((error) =>
        console.warn("Could not load complete Gantt client filter options", error),
      );
    return () => {
      active = false;
    };
  }, []);

  const orderedGroups = useMemo(() => {
    const boardOrder = groups
      .filter((group) => /^closed leads\b/i.test(group.name.trim()))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((group, boardIndex) => ({ group, boardIndex }));
    const priority = (name: string) => {
      const normalized = name
        .trim()
        .toLowerCase()
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ");
      if (normalized === "shortlisted") return 0;
      if (normalized === "follow up") return 1;
      return 2;
    };
    return boardOrder
      .sort(
        (a, b) =>
          priority(a.group.name) - priority(b.group.name) ||
          a.boardIndex - b.boardIndex,
      )
      .map(({ group }) => group);
  }, [groups]);
  const orderedClients = useMemo(() => {
    const groupOrder = new Map(
      orderedGroups.map((group, index) => [group.id, index]),
    );
    const ungroupedOrder = orderedGroups.length;
    return clients
      .filter((client) => groupOrder.has(client.groupId ?? ""))
      .map((client, index) => ({ client, index }))
      .sort(
        (a, b) =>
          Number(pinnedClientIds.has(b.client.id)) -
            Number(pinnedClientIds.has(a.client.id)) ||
          (groupOrder.get(a.client.groupId ?? "") ?? ungroupedOrder) -
            (groupOrder.get(b.client.groupId ?? "") ?? ungroupedOrder) ||
          a.index - b.index,
      )
      .map(({ client }) => client);
  }, [clients, orderedGroups, pinnedClientIds]);
  const allowedResourceIds = useMemo(
    () => (resourceIds ? new Set(resourceIds) : undefined),
    [resourceIds],
  );
  const unfilteredData = useMemo(
    () =>
      buildSchedulerData(
        orderedClients,
        orderedGroups,
        clientAssignees,
        clientPmAssignees,
        subitemAssignees,
        progressById,
        allowedResourceIds,
      ),
    [orderedClients, orderedGroups, clientAssignees, clientPmAssignees, subitemAssignees, progressById, allowedResourceIds],
  );
  const data = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const from = filters.dateFrom
      ? new Date(`${filters.dateFrom}T00:00:00`)
      : null;
    const to = filters.dateTo
      ? new Date(`${filters.dateTo}T23:59:59.999`)
      : null;
    const hasProcessFilter = filters.processStatuses.size > 0 || !!from || !!to;

    const filteredResources = unfilteredData.flatMap(
      (resource): SchedulerResource[] => {
        if (query) {
          const searchable =
            searchScope === "group"
              ? resource.groupName
              : searchScope === "client"
                ? `${resource.clientName} ${resource.clientDisplayId}`
                : searchScope === "subitem"
                  ? `${resource.subitemName} ${resource.subitemDisplayId}`
                  : `${resource.groupName} ${resource.clientName} ${resource.clientDisplayId} ${resource.subitemName} ${resource.subitemDisplayId} ${resource.processNames.join(" ")}`;
          if (!searchable.toLowerCase().includes(query)) return [];
        }
        if (filters.groupIds.size && !filters.groupIds.has(resource.groupId))
          return [];
        if (filters.clientIds.size && !filters.clientIds.has(resource.clientId))
          return [];
        if (
          filters.pmIds.size &&
          !resource.pmIds.some((id) => filters.pmIds.has(id))
        )
          return [];
        if (
          filters.peopleIds.size &&
          !resource.peopleIds.some((id) => filters.peopleIds.has(id))
        )
          return [];

        const filteredItems = resource.data.filter((item) => {
          if (
            filters.processStatuses.size &&
            !filters.processStatuses.has(item.processStatus)
          )
            return false;
          if (from && item.endDate < from) return false;
          if (to && item.startDate > to) return false;
          return true;
        });
        if (hasProcessFilter && !filteredItems.length) return [];
        return [{ ...resource, data: filteredItems }];
      },
    );

    const seenGroups = new Set<string>();
    const seenClients = new Set<string>();
    return filteredResources.flatMap((resource): SchedulerResource[] => {
      if (collapsedGroupIds.has(resource.groupId)) {
        if (seenGroups.has(resource.groupId)) return [];
        seenGroups.add(resource.groupId);
        return [{ ...resource, data: [] }];
      }
      if (collapsedClientIds.has(resource.clientId)) {
        if (seenClients.has(resource.clientId)) return [];
        seenClients.add(resource.clientId);
        return [{ ...resource, data: [] }];
      }
      return [resource];
    });
  }, [
    collapsedClientIds,
    collapsedGroupIds,
    filters,
    searchQuery,
    searchScope,
    unfilteredData,
  ]);
  const resourceTargets = useMemo(
    () =>
      new Map(
        data.map((resource) => [
          resource.id,
          {
            clientId: resource.clientId,
            subitemId: resource.subitemId,
            groupId: resource.groupId,
          },
        ]),
      ),
    [data],
  );
  const timelineTargets = useMemo(
    () =>
      new Map(
        data.flatMap((resource) =>
          resource.data.map(
            (item) =>
              [
                item.id,
                {
                  clientId: resource.clientId,
                  subitemId: resource.subitemId,
                  timelineId: item.timelineId,
                },
              ] as const,
          ),
        ),
      ),
    [data],
  );
  const selectedTimelineData = useMemo(() => {
    if (!selectedTimeline) return null;
    const client = clients.find(
      (candidate) => candidate.id === selectedTimeline.clientId,
    );
    const subitem = client?.subitems.find(
      (candidate) => candidate.id === selectedTimeline.subitemId,
    );
    if (!client || !subitem) return null;
    const fallbackTimeline: TimelineGroup = {
      id: "default",
      cnTracking: subitem.cnTracking ?? "",
      sgTracking: subitem.sgTracking ?? "",
      rows: subitem.timelineRows ?? [],
      isDefault: true,
    };
    const timelines = subitem.timelineGroups?.length
      ? subitem.timelineGroups
      : [fallbackTimeline];
    const timeline =
      timelines.find(
        (candidate) => candidate.id === selectedTimeline.timelineId,
      ) ?? timelines[0];
    return { client, subitem, timeline, timelineIndex: timelines.indexOf(timeline), timelines };
  }, [clients, selectedTimeline]);
  const timelineProgressOptions = useMemo<OptionEntry[]>(
    () =>
      [...progressById.entries()].map(([id, option]) => ({
        id,
        value: option.value,
        systemKey: option.systemKey,
        color: option.color,
        section: option.section,
      })),
    [progressById],
  );
  const profileLabels = useMemo(
    () =>
      new Map(
        profiles.map((profile) => [
          profile.id,
          profile.full_name || profile.email || "Unnamed user",
        ]),
      ),
    [profiles],
  );
  const groupOptions = useMemo<FilterOption[]>(
    () =>
      orderedGroups.map((group) => ({ value: group.id, label: group.name })),
    [orderedGroups],
  );
  const clientOptions = useMemo<FilterOption[]>(() => {
    if (serverClientOptions.length) return serverClientOptions;
    const seen = new Set<string>();
    return unfilteredData.flatMap((resource) => {
      if (seen.has(resource.clientId)) return [];
      seen.add(resource.clientId);
      return [
        {
          value: resource.clientId,
          label: `${resource.clientName} - ${resource.groupName}`,
        },
      ];
    });
  }, [serverClientOptions, unfilteredData]);
  const pmOptions = useMemo<FilterOption[]>(
    () =>
      profiles
        .filter((profile) => profile.role?.toLowerCase() === "pm")
        .map((profile) => ({
          value: profile.id,
          label: profileLabels.get(profile.id) ?? profile.id,
        })),
    [profileLabels, profiles],
  );
  const peopleOptions = useMemo<FilterOption[]>(
    () =>
      profiles
        .filter((profile) => profile.role?.toLowerCase() !== "shipper")
        .map((profile) => ({
          value: profile.id,
          label: profileLabels.get(profile.id) ?? profile.id,
        })),
    [profileLabels, profiles],
  );
  const processStatusOptions = useMemo<FilterOption[]>(
    () =>
      Array.from(
        new Set(
          [
            ...timelineProgressOptions.map((option) => option.value),
            "No status",
          ],
        ),
      )
        .sort()
        .map((status) => ({ value: status, label: status })),
    [timelineProgressOptions],
  );
  const activeFilterCount =
    filters.groupIds.size +
    filters.clientIds.size +
    filters.pmIds.size +
    filters.peopleIds.size +
    filters.processStatuses.size +
    Number(!!filters.dateFrom) +
    Number(!!filters.dateTo);
  const serverQuery = useMemo<GanttServerQuery>(
    () => ({
      search: searchQuery,
      searchScope,
      groupIds: Array.from(filters.groupIds).sort(),
      clientIds: Array.from(filters.clientIds).sort(),
      pmIds: Array.from(filters.pmIds).sort(),
      peopleIds: Array.from(filters.peopleIds).sort(),
      processStatuses: Array.from(filters.processStatuses).sort(),
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    }),
    [filters, searchQuery, searchScope],
  );
  const serverQueryKey = useMemo(() => JSON.stringify(serverQuery), [serverQuery]);
  const prefetchedPageCountRef = useRef<{ key: string; count: number }>({
    key: "",
    count: 0,
  });

  useEffect(() => {
    if (!onServerQueryChange) return;
    const timer = window.setTimeout(() => onServerQueryChange(serverQuery), 180);
    return () => window.clearTimeout(timer);
  }, [onServerQueryChange, serverQuery, serverQueryKey]);

  useEffect(() => {
    if (loadedQueryKey !== serverQueryKey) return;
    const tracker = prefetchedPageCountRef.current;
    if (tracker.key !== serverQueryKey) {
      tracker.key = serverQueryKey;
      tracker.count = 0;
    }
    if (
      !hasMoreResources ||
      isLoadingMore ||
      !onLoadMoreResources ||
      tracker.count >= 2
    ) {
      return;
    }
    tracker.count += 1;
    onLoadMoreResources();
  }, [
    hasMoreResources,
    isLoadingMore,
    loadedQueryKey,
    onLoadMoreResources,
    serverQueryKey,
  ]);
  const toggleFilter = useCallback(
    (
      key: "groupIds" | "clientIds" | "pmIds" | "peopleIds" | "processStatuses",
      value: string,
    ) => {
      setFilters((current) => {
        const nextValues = new Set(current[key]);
        if (nextValues.has(value)) nextValues.delete(value);
        else nextValues.add(value);
        return { ...current, [key]: nextValues };
      });
    },
    [],
  );

  const openFilterMenu = useCallback(
    (kind: FilterMenu["kind"], element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const menuWidth = kind === "all" ? 360 : 280;
      setFilterMenu({
        kind,
        x: Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8)),
        y: Math.min(rect.bottom + 6, window.innerHeight - 100),
      });
    },
    [],
  );
  const toggleCollapsedId = useCallback(
    (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
      setter((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [],
  );
  const handleRangeChange = useCallback((range: SchedulerRange) => {
    setSchedulerRange((current) =>
      current?.startDate.getTime() === range.startDate.getTime() &&
      current.endDate.getTime() === range.endDate.getTime()
        ? current
        : range,
    );
  }, []);

  useEffect(() => {
    if (!timelineCanvasHost) return;
    const canvas = timelineCanvasHost.querySelector("canvas");
    if (!canvas) return;
    const updateWidth = () =>
      setTimelineCanvasWidth(canvas.getBoundingClientRect().width);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(canvas);
    window.addEventListener("resize", updateWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, [timelineCanvasHost]);

  useEffect(() => {
    if (!hasMoreResources || isLoadingMore || !onLoadMoreResources) return;
    const scroller = schedulerRootRef.current?.querySelector<HTMLElement>(
      "#reactSchedulerOutsideWrapper",
    );
    if (!scroller) return;
    const loadWhenNearBottom = () => {
      if (
        scroller.scrollTop + scroller.clientHeight >=
        scroller.scrollHeight - 520
      ) {
        onLoadMoreResources();
      }
    };
    scroller.addEventListener("scroll", loadWhenNearBottom, { passive: true });
    loadWhenNearBottom();
    return () => scroller.removeEventListener("scroll", loadWhenNearBottom);
  }, [data.length, hasMoreResources, isLoadingMore, onLoadMoreResources]);

  useEffect(() => {
    const root = schedulerRootRef.current;
    const scroller = root?.querySelector<HTMLElement>(
      "#reactSchedulerOutsideWrapper",
    );
    if (!root || !scroller) return;

    // The resource cells are rendered in a portal so the custom column header
    // can remain fixed. Read their actual on-screen positions from the native
    // scheduler rows instead of trying to recreate its scroll calculation.
    // This also accounts for its sticky header and any internal re-layout.
    let frame = 0;
    const syncResourceRowPositions = () => {
      frame = 0;
      const rootTop = root.getBoundingClientRect().top;
      setLabelHosts((current) => {
        const next = current.map((host) => {
          const top = host.element.getBoundingClientRect().top - rootTop;
          return { ...host, clientTop: top, groupTop: top };
        });
        return current.every(
          (host, index) =>
            Math.abs(host.clientTop - next[index].clientTop) < 0.5 &&
            Math.abs(host.groupTop - next[index].groupTop) < 0.5,
        )
          ? current
          : next;
      });
    };
    const handleScroll = () => {
      if (!frame)
        frame = window.requestAnimationFrame(syncResourceRowPositions);
    };
    syncResourceRowPositions();
    scroller.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", handleScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [schedulerRootHost, labelHostKey]);

  useEffect(() => {
    if (!timelineCanvasHost) return;
    const previousCursor = timelineCanvasHost.style.cursor;
    timelineCanvasHost.style.cursor = "grab";
    return () => {
      timelineCanvasHost.style.cursor = previousCursor;
    };
  }, [timelineCanvasHost]);

  useEffect(
    () => () => {
      const pan = timelinePanRef.current;
      if (!pan) return;
      document.body.style.cursor = pan.previousCursor;
      document.body.style.userSelect = pan.previousUserSelect;
      timelinePanRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!timelineCanvasHost || !timelineCanvasWidth) return;
    const canvas = timelineCanvasHost.querySelector("canvas");
    if (!canvas) return;
    const timers: number[] = [];
    const locateHighlightedToday = () => {
      const context = canvas.getContext("2d");
      const cssWidth = canvas.getBoundingClientRect().width;
      if (!context || !cssWidth || !canvas.width || !canvas.height) return;
      const scale = canvas.width / cssWidth;
      const y = Math.max(
        0,
        Math.min(canvas.height - 1, Math.round(10 * scale)),
      );
      try {
        const pixels = context.getImageData(0, y, canvas.width, 1).data;
        let currentStart = -1;
        let bestStart = -1;
        let bestEnd = -1;
        for (let x = 0; x < canvas.width; x += 1) {
          const offset = x * 4;
          const isTodayFill =
            Math.abs(pixels[offset] - 230) <= 2 &&
            Math.abs(pixels[offset + 1] - 243) <= 2 &&
            Math.abs(pixels[offset + 2] - 255) <= 2;
          if (isTodayFill && currentStart < 0) currentStart = x;
          if ((!isTodayFill || x === canvas.width - 1) && currentStart >= 0) {
            const end = isTodayFill && x === canvas.width - 1 ? x : x - 1;
            if (end - currentStart > bestEnd - bestStart) {
              bestStart = currentStart;
              bestEnd = end;
            }
            currentStart = -1;
          }
        }
        setTodayPosition(
          bestStart >= 0 && bestEnd - bestStart >= Math.max(3, scale * 4)
            ? (bestStart + bestEnd) / 2 / scale
            : null,
        );
      } catch {
        setTodayPosition(null);
      }
    };
    locateHighlightedToday();
    timers.push(window.setTimeout(locateHighlightedToday, 80));
    timers.push(window.setTimeout(locateHighlightedToday, 400));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [schedulerRange, timelineCanvasHost, timelineCanvasWidth]);

  useEffect(() => {
    const root = schedulerRootRef.current;
    if (!root) return;
    let frame = 0;
    const refreshTimers: number[] = [];
    const originalStyles = new Map<HTMLElement, string | null>();
    const setStyle = (
      element: HTMLElement,
      property: string,
      value: string,
    ) => {
      if (!originalStyles.has(element))
        originalStyles.set(element, element.getAttribute("style"));
      element.style.setProperty(property, value);
    };
    const refreshHosts = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        // Restore/hide the scheduler's native resource pane before measuring
        // any row. When it changes from display:none to display:block, its
        // row elements briefly report offsetTop = 0. Measuring in that frame
        // was what caused the custom Group/Client/Subitem layer to stack at
        // the top after some pane toggles.
        const nativeSearchInput = Array.from(
          root.querySelectorAll<HTMLInputElement>("input"),
        ).find((input) => input.placeholder.trim().toLowerCase() === "search");
        const nativeSidebar = nativeSearchInput?.parentElement?.parentElement
          ?.parentElement as HTMLElement | null;
        if (nativeSidebar) {
          setStyle(
            nativeSidebar,
            "display",
            resourcePaneCollapsed ? "none" : "block",
          );
          if (!resourcePaneCollapsed) {
            // Force the browser to finish the synchronous part of the native
            // scheduler layout before its resource-row offsets are read.
            void nativeSidebar.offsetHeight;
          }
        }
        const candidates = Array.from(
          root.querySelectorAll<HTMLElement>("[title]"),
        );
        const used = new Set<HTMLElement>();
        const visibleResources = data.flatMap((resource) => {
          const expectedTitle = `${resource.label.title} | ${resource.label.subtitle}`;
          const element = candidates.find(
            (candidate) =>
              !used.has(candidate) &&
              candidate.getAttribute("title") === expectedTitle,
          );
          if (!element) return [];
          used.add(element);
          setStyle(element, "position", "relative");
          setStyle(element, "padding", "0");
          setStyle(element, "overflow", "visible");
          const originalLabel = element.firstElementChild as HTMLElement | null;
          if (originalLabel) setStyle(originalLabel, "display", "none");
          return [{ resource, element }];
        });

        const next: LabelHost[] = visibleResources.map(
          ({ resource, element }, index, visible) => {
            const startsVisibleClientGroup =
              index === 0 ||
              visible[index - 1].resource.clientId !== resource.clientId;
            const startsVisibleGroup =
              index === 0 ||
              visible[index - 1].resource.groupId !== resource.groupId;
            let clientSpanHeight = 0;
            let groupSpanHeight = 0;
            if (startsVisibleClientGroup) {
              for (
                let rowIndex = index;
                rowIndex < visible.length &&
                visible[rowIndex].resource.clientId === resource.clientId;
                rowIndex += 1
              ) {
                clientSpanHeight += visible[rowIndex].element.offsetHeight;
              }
            }
            if (startsVisibleGroup) {
              for (
                let rowIndex = index;
                rowIndex < visible.length &&
                visible[rowIndex].resource.groupId === resource.groupId;
                rowIndex += 1
              ) {
                groupSpanHeight += visible[rowIndex].element.offsetHeight;
              }
            }
            return {
              resource,
              element,
              startsVisibleClientGroup,
              clientSpanHeight,
              clientTop: element.offsetTop,
              startsVisibleGroup,
              groupSpanHeight,
              groupTop: element.offsetTop,
            };
          },
        );

        // With no matching resources react-scheduler removes its row list,
        // so derive its native sidebar from the built-in "Search" input as
        // a fallback. This lets us keep its panel and search control hidden
        // in both the populated and empty states.
        const sidebar =
          (next[0]?.element.parentElement as HTMLElement | null) ??
          nativeSidebar;
        const header = sidebar?.firstElementChild as HTMLElement | null;
        if (sidebar) {
          // The scheduler's resource list is a flex child. Width alone is not
          // enough to reserve its space after it has once been collapsed, so
          // keep its flex basis in sync as well. This is deliberately the
          // base resource layer; our custom headers/cells are layered above it.
          setStyle(sidebar, "display", resourcePaneCollapsed ? "none" : "block");
          setStyle(sidebar, "position", "relative");
          setStyle(sidebar, "flex", `0 0 ${resourcePanelWidth}px`);
          setStyle(sidebar, "min-width", `${resourcePanelWidth}px`);
          setStyle(sidebar, "max-width", `${resourcePanelWidth}px`);
          setStyle(sidebar, "width", `${resourcePanelWidth}px`);
          setStyle(sidebar, "overflow", "visible");
          setStyle(sidebar, "z-index", "10");
          if (resourcePaneCollapsed && sidebar.nextElementSibling instanceof HTMLElement) {
            // The scheduler reserves a fixed left margin for its native
            // resource pane. Once that pane is hidden, remove the leftover
            // gutter so the calendar fills the available width.
            setStyle(sidebar.nextElementSibling, "margin-left", "0");
          }
        }
        if (header) {
          setStyle(header, "width", `${resourcePanelWidth}px`);
          setStyle(header, "overflow", "hidden");
          setStyle(header, "z-index", "11");
          const searchInput = header.querySelector("input");
          const searchContainer = searchInput?.parentElement;
          const previousPageControl =
            searchContainer?.nextElementSibling as HTMLElement | null;
          previousPageButtonRef.current =
            previousPageControl?.querySelector("button") ?? null;
          if (searchContainer) {
            setStyle(searchContainer, "display", "none");
          }
          if (previousPageControl) {
            setStyle(previousPageControl, "position", "absolute");
            setStyle(previousPageControl, "left", "0");
            setStyle(previousPageControl, "top", "54px");
            setStyle(previousPageControl, "z-index", "4");
          }
        }
        const canvasHost = root.querySelector<HTMLElement>(
          "#reactSchedulerCanvasWrapper",
        );
        const canvasHeader = root.querySelector<HTMLElement>(
          "#reactSchedulerCanvasHeaderWrapper",
        );
        const schedulerTopBar =
          canvasHeader?.previousElementSibling instanceof HTMLElement
            ? canvasHeader.previousElementSibling
            : null;
        // react-scheduler gives its navigation bar a fixed left offset for
        // its built-in resource pane. Our pane is wider and can be collapsed,
        // so keep that header in the same coordinate system as the grid.
        if (schedulerTopBar) {
          setStyle(schedulerTopBar, "left", `${resourcePanelWidth}px`);
          setStyle(
            schedulerTopBar,
            "width",
            `calc(100% - ${resourcePanelWidth}px)`,
          );
        }
        // Keep the third-party scheduler grid at the bottom of this local
        // stacking context. The resource pane, controls and menus are then
        // explicitly layered above it instead of relying on DOM order.
        if (canvasHost) {
          setStyle(canvasHost, "position", "relative");
          setStyle(canvasHost, "z-index", "0");
        }
        setTimelineCanvasHost((current) =>
          current === canvasHost ? current : canvasHost,
        );
        setLabelHosts((current) =>
          current.length === next.length &&
          current.every(
            (host, index) =>
              host.resource.id === next[index].resource.id &&
              host.element === next[index].element &&
              host.clientSpanHeight === next[index].clientSpanHeight &&
              host.groupSpanHeight === next[index].groupSpanHeight &&
              host.startsVisibleClientGroup ===
                next[index].startsVisibleClientGroup &&
              host.startsVisibleGroup === next[index].startsVisibleGroup,
          )
            ? current
            : next,
        );
      });
    };
    const observer = new MutationObserver(refreshHosts);
    observer.observe(root, { childList: true, subtree: true });
    refreshHosts();
    // react-scheduler finishes some reflows after its own render frame. Run
    // a small bounded set of follow-up measurements so opening the pane from
    // an empty/filtered/collapsed state cannot retain temporary offsets.
    refreshTimers.push(
      window.setTimeout(refreshHosts, 50),
      window.setTimeout(refreshHosts, 180),
      window.setTimeout(refreshHosts, 360),
    );
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      refreshTimers.forEach((timer) => window.clearTimeout(timer));
      originalStyles.forEach((style, element) =>
        style === null
          ? element.removeAttribute("style")
          : element.setAttribute("style", style),
      );
    };
  }, [data, resourcePanelWidth]);

  useEffect(() => {
    let frame = 0;
    let cancelled = false;
    const returnToFirstPage = () => {
      if (cancelled) return;
      const button = previousPageButtonRef.current;
      if (button && window.getComputedStyle(button).pointerEvents !== "none") {
        button.click();
        frame = window.requestAnimationFrame(returnToFirstPage);
      }
    };
    frame = window.requestAnimationFrame(returnToFirstPage);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [
    collapsedClientIds,
    collapsedGroupIds,
    filters,
    searchQuery,
    searchScope,
  ]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!filterMenu) return;
    const close = () => setFilterMenu(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", close);
    };
  }, [filterMenu]);

  const togglePin = useCallback(
    async (clientId: string) => {
      const wasPinned = pinnedClientIds.has(clientId);
      setPinnedClientIds((current) => {
        const next = new Set(current);
        if (wasPinned) next.delete(clientId);
        else next.add(clientId);
        return next;
      });
      setContextMenu(null);
      try {
        const response = await fetch("/api/gantt-pins", {
          method: wasPinned ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId }),
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Unable to update this pin.");
        toast.success(
          wasPinned ? "Client unpinned" : "Client pinned to the top",
        );
      } catch (error) {
        setPinnedClientIds((current) => {
          const next = new Set(current);
          if (wasPinned) next.add(clientId);
          else next.delete(clientId);
          return next;
        });
        toast.error(
          error instanceof Error ? error.message : "Unable to update this pin.",
        );
      }
    },
    [pinnedClientIds],
  );

  const startTimelinePan = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || timelinePanRef.current) return;
      const root = schedulerRootRef.current;
      const scroller = root?.querySelector<HTMLElement>(
        "#reactSchedulerOutsideWrapper",
      );
      const target = event.target as HTMLElement;
      if (
        !root ||
        !scroller ||
        target.closest("button, input, select, textarea, a")
      )
        return;

      const rootRect = root.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      if (
        event.clientX < rootRect.left + resourcePanelWidth ||
        event.clientY > scrollerRect.bottom - 16
      )
        return;

      timelinePanRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startScrollLeft: scroller.scrollLeft,
        startScrollTop: scroller.scrollTop,
        moved: false,
        previousCursor: document.body.style.cursor,
        previousUserSelect: document.body.style.userSelect,
      };
      document.body.style.userSelect = "none";
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [resourcePanelWidth],
  );

  const scrollTimelineFromResourcePane = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      const scroller = schedulerRootRef.current?.querySelector<HTMLElement>(
        "#reactSchedulerOutsideWrapper",
      );
      if (!scroller) return;

      const multiplier =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? scroller.clientHeight
            : 1;
      const nextTop = Math.max(
        0,
        Math.min(
          scroller.scrollHeight - scroller.clientHeight,
          scroller.scrollTop + event.deltaY * multiplier,
        ),
      );
      const nextLeft = Math.max(
        0,
        Math.min(
          scroller.scrollWidth - scroller.clientWidth,
          scroller.scrollLeft + event.deltaX * multiplier,
        ),
      );
      if (nextTop === scroller.scrollTop && nextLeft === scroller.scrollLeft)
        return;

      scroller.scrollTop = nextTop;
      scroller.scrollLeft = nextLeft;
      event.preventDefault();
    },
    [],
  );

  const moveTimelinePan = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const pan = timelinePanRef.current;
      if (!pan || pan.pointerId !== event.pointerId) return;
      const distanceX = event.clientX - pan.startX;
      const distanceY = event.clientY - pan.startY;
      if (!pan.moved && Math.hypot(distanceX, distanceY) < 4) return;

      pan.moved = true;
      document.body.style.cursor = "grabbing";
      const scroller = schedulerRootRef.current?.querySelector<HTMLElement>(
        "#reactSchedulerOutsideWrapper",
      );
      if (scroller) {
        scroller.scrollLeft = pan.startScrollLeft - distanceX;
        scroller.scrollTop = pan.startScrollTop - distanceY;
      }
      event.preventDefault();
    },
    [],
  );

  const finishTimelinePan = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const pan = timelinePanRef.current;
      if (!pan || pan.pointerId !== event.pointerId) return;
      timelinePanRef.current = null;
      document.body.style.cursor = pan.previousCursor;
      document.body.style.userSelect = pan.previousUserSelect;
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
      if (pan.moved) {
        suppressTimelineClickRef.current = true;
        window.setTimeout(() => {
          suppressTimelineClickRef.current = false;
        }, 0);
      }
    },
    [],
  );
  // react-scheduler removes its resource header when a search has no matches.
  // Keep our controlled toolbar mounted in the chart root in that state so the
  // existing query can always be edited or cleared.
  const toolbarHost = schedulerRootHost;

  if (isLoading) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-500">
        <span className="inline-flex items-center gap-2">
          <LoaderCircle size={18} className="animate-spin text-sky-600" />
          Loading Gantt chart…
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden p-4">
      <div className="mb-2 flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <span className="mr-1 text-xs font-semibold text-slate-700">
          Process legend
        </span>
        {PROCESS_LEGEND.map((entry) => (
          <span
            key={entry.label}
            className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-slate-600"
          >
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            {entry.label}
          </span>
        ))}
      </div>
      <div
        ref={setSchedulerRootRef}
        className="isolate relative min-h-0 w-full max-w-full flex-1 overflow-hidden rounded-xl border bg-white"
        onPointerDown={startTimelinePan}
        onPointerMove={moveTimelinePan}
        onPointerUp={finishTimelinePan}
        onPointerCancel={finishTimelinePan}
        onClickCapture={(event) => {
          if (!suppressTimelineClickRef.current) return;
          event.preventDefault();
          event.stopPropagation();
          suppressTimelineClickRef.current = false;
        }}
        onContextMenu={(event) => {
          const target = event.target as Node;
          const host = labelHosts.find((candidate) =>
            candidate.element.contains(target),
          );
          if (!host) return;
          event.preventDefault();
          setContextMenu({
            clientId: host.resource.clientId,
            x: event.clientX,
            y: event.clientY,
          });
        }}
      >
        <style>{`
          #reactSchedulerCanvasWrapper button[style*="background-color"] {
            text-align: center !important;
            overflow: hidden !important;
          }
          #reactSchedulerCanvasWrapper button[style*="background-color"] > div {
            display: flex !important;
            height: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            align-items: center !important;
            justify-content: center !important;
          }
          #reactSchedulerCanvasWrapper button[style*="background-color"] > div > div {
            /* The scheduler makes this wrapper sticky against the timeline
               viewport. Process labels must instead stay inside their own
               tile so the combined name + remarks can be centered. */
            position: static !important;
            display: flex !important;
            width: 100% !important;
            min-width: 0 !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 0.5rem !important;
            overflow: hidden !important;
          }
          #reactSchedulerCanvasWrapper button[style*="background-color"] p {
            margin: 0 !important;
            font-size: 14px !important;
            line-height: 1.25 !important;
            letter-spacing: 0 !important;
          }
          #reactSchedulerCanvasWrapper button[style*="background-color"] p:first-child {
            font-weight: 700 !important;
            white-space: nowrap !important;
            min-width: 0 !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          #reactSchedulerCanvasWrapper button[style*="background-color"] p:first-child::after {
            content: none !important;
            margin: 0 !important;
          }
          #reactSchedulerCanvasWrapper button[style*="background-color"] p:nth-child(2) {
            flex: 0 1 auto !important;
            min-width: 0 !important;
            max-width: 45% !important;
            opacity: 0.9;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
          }
          #reactSchedulerCanvasWrapper button[style*="background-color"] p:nth-child(3) {
            display: none !important;
          }
        `}</style>
        <Scheduler
          data={data}
          onRangeChange={handleRangeChange}
          onItemClick={(item) => {
            const target = resourceTargets.get(item.id);
            if (
              target &&
              !collapsedGroupIds.has(target.groupId) &&
              !collapsedClientIds.has(target.clientId)
            )
              onOpenClientTimeline(target.clientId, target.subitemId);
          }}
          onTileClick={(item) => {
            const target = timelineTargets.get(item.id);
            if (target?.subitemId)
              setSelectedTimeline({
                clientId: target.clientId,
                subitemId: target.subitemId,
                timelineId: target.timelineId,
              });
          }}
          onFilterData={() => {}}
          onClearFilterData={() => {}}
          config={{
            zoom: 1,
            lang: "en",
            maxRecordsPerPage: 20,
            filterButtonState: -1,
            showThemeToggle: false,
            showTooltip: false,
          }}
        />
        <button
          type="button"
          onClick={() => setResourcePaneCollapsed((collapsed) => !collapsed)}
          className="absolute z-30 flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          style={{
            left: `${resourcePaneCollapsed ? 8 : resourcePanelWidth - 36}px`,
            top: "52px",
          }}
          title={
            resourcePaneCollapsed
              ? "Expand hierarchy pane"
              : "Collapse hierarchy pane"
          }
          aria-label={
            resourcePaneCollapsed
              ? "Expand hierarchy pane"
              : "Collapse hierarchy pane"
          }
        >
          {resourcePaneCollapsed ? (
            <PanelLeftOpen size={17} />
          ) : (
            <PanelLeftClose size={17} />
          )}
        </button>
        {!resourcePaneCollapsed &&
          toolbarHost &&
          createPortal(
            <>
              <div
                className="absolute left-2 top-2 z-board flex h-9 w-[calc(100%-1rem)] max-w-[554px] items-center gap-1.5"
                onWheel={scrollTimelineFromResourcePane}
              >
                <div className="relative min-w-0 flex-1">
                  <Search
                    size={14}
                    className="absolute left-2.5 top-2.5 text-slate-400"
                  />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={`Search ${searchScope === "all" ? "the hierarchy" : searchScope}`}
                    className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-8 text-xs font-normal normal-case tracking-normal text-slate-700 outline-none focus:border-sky-400"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                <select
                  value={searchScope}
                  onChange={(event) =>
                    setSearchScope(event.target.value as SearchScope)
                  }
                  className="h-9 w-[105px] rounded-md border border-slate-200 bg-white px-2 text-xs font-normal normal-case tracking-normal text-slate-700 outline-none focus:border-sky-400"
                  title="Choose which column to search"
                >
                  <option value="all">All columns</option>
                  <option value="group">Group</option>
                  <option value="client">Client</option>
                  <option value="subitem">Subitem</option>
                </select>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openFilterMenu("all", event.currentTarget);
                  }}
                  className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${activeFilterCount ? "border-sky-300 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}
                  title="Gantt filters"
                >
                  <SlidersHorizontal size={16} />
                  {activeFilterCount > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-600 px-1 text-[9px] text-white">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>
              <div
                className="absolute left-0 top-[92px] z-board grid h-8 w-[570px] grid-cols-[140px_210px_220px] border-y border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                onWheel={scrollTimelineFromResourcePane}
              >
                <div className="flex items-center justify-between border-r border-slate-200 px-3">
                  <span>Group</span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openFilterMenu("group", event.currentTarget);
                    }}
                    className={`flex h-6 w-6 items-center justify-center rounded ${filters.groupIds.size ? "bg-sky-100 text-sky-700" : "text-slate-400 hover:bg-slate-200"}`}
                    title="Filter groups"
                  >
                    <ListFilter size={14} />
                  </button>
                </div>
                <div className="flex items-center justify-between border-r border-slate-200 px-3">
                  <span>Client</span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openFilterMenu("client", event.currentTarget);
                    }}
                    className={`flex h-6 w-6 items-center justify-center rounded ${filters.clientIds.size ? "bg-sky-100 text-sky-700" : "text-slate-400 hover:bg-slate-200"}`}
                    title="Filter clients"
                  >
                    <ListFilter size={14} />
                  </button>
                </div>
                <div className="flex items-center px-3">Subitem</div>
              </div>
            </>,
            toolbarHost,
          )}
        {!resourcePaneCollapsed &&
          schedulerRootHost &&
          createPortal(
            <div
              className="pointer-events-auto absolute inset-y-0 left-0 z-sticky w-[570px] overflow-hidden border-r border-slate-200 bg-white shadow-[4px_0_12px_rgba(15,23,42,0.08)]"
              onWheel={scrollTimelineFromResourcePane}
            >
              <div
                className="absolute inset-0"
                style={{ clipPath: "inset(124px 0 0)" }}
              >
              {labelHosts.map(
                ({
                  resource,
                  element,
                  startsVisibleGroup,
                  startsVisibleClientGroup,
                  groupTop,
                  groupSpanHeight,
                  clientTop,
                  clientSpanHeight,
                }) => {
                  const isGroupCollapsed = collapsedGroupIds.has(
                    resource.groupId,
                  );
                  const isClientCollapsed = collapsedClientIds.has(
                    resource.clientId,
                  );
                  return (
                    <div key={resource.id} className="text-xs text-slate-700">
              {startsVisibleGroup && isGroupCollapsed && (
                <div
                  className="absolute left-[140px] w-[430px] border-b border-slate-200 bg-white"
                  style={{ top: groupTop, height: element.offsetHeight }}
                  aria-hidden="true"
                />
              )}
              {startsVisibleClientGroup &&
                !isGroupCollapsed &&
                isClientCollapsed && (
                  <div
                    className="absolute left-[350px] w-[220px] border-b border-slate-200 bg-white"
                    style={{ top: clientTop, height: element.offsetHeight }}
                    aria-hidden="true"
                  />
                )}
              {startsVisibleGroup && (
                <button
                  type="button"
                  onClick={() =>
                    toggleCollapsedId(setCollapsedGroupIds, resource.groupId)
                  }
                  className="absolute left-0 z-10 flex w-[140px] min-w-0 items-center gap-1 border-b border-r border-slate-200 bg-white px-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                  style={{ top: groupTop, height: groupSpanHeight }}
                  title={`${collapsedGroupIds.has(resource.groupId) ? "Expand" : "Collapse"} ${resource.groupName}`}
                >
                  {collapsedGroupIds.has(resource.groupId) ? (
                    <ChevronRight size={14} className="shrink-0" />
                  ) : (
                    <ChevronDown size={14} className="shrink-0" />
                  )}
                  <span className="break-words leading-4">
                    {resource.groupName}
                  </span>
                </button>
              )}
              {startsVisibleClientGroup && !isGroupCollapsed && (
                  <button
                    type="button"
                    onClick={() =>
                      toggleCollapsedId(
                        setCollapsedClientIds,
                        resource.clientId,
                      )
                    }
                    className="absolute left-[140px] z-10 flex w-[210px] min-w-0 items-center gap-1 border-b border-r border-slate-200 bg-white px-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                    style={{ top: clientTop, height: clientSpanHeight }}
                    title={`${collapsedClientIds.has(resource.clientId) ? "Expand" : "Collapse"} ${resource.clientName}`}
                  >
                    {collapsedClientIds.has(resource.clientId) ? (
                      <ChevronRight size={14} className="shrink-0" />
                    ) : (
                      <ChevronDown size={14} className="shrink-0" />
                    )}
                    <span className="min-w-0 break-words text-left font-medium leading-4">
                      {resource.clientName}
                      <span className="mt-0.5 block text-[10px] font-normal text-slate-500">
                        ID: {resource.clientDisplayId || resource.clientId}
                      </span>
                    </span>
                  </button>
                )}
              {!isGroupCollapsed && !isClientCollapsed && (
                  <button
                    type="button"
                    disabled={!resource.subitemId}
                    className={`absolute left-[350px] w-[220px] min-w-0 border-b border-slate-200 px-3 text-left hover:bg-sky-50 disabled:cursor-default disabled:text-slate-400 disabled:hover:bg-transparent ${resource.data.some((item) => item.isOverdue) ? "bg-red-50 font-semibold text-red-700" : ""}`}
                    style={{ top: clientTop, height: element.offsetHeight }}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (resource.subitemId)
                        onOpenClientTimeline(
                          resource.clientId,
                          resource.subitemId,
                        );
                    }}
                    title={`${resource.subitemName} · Subitem ID: ${resource.subitemDisplayId || resource.subitemId} · Timeline ${resource.timelineIndex + 1}`}
                  >
                    <span className="block break-words leading-4">
                      {resource.data.some((item) => item.isOverdue)
                        ? `Overdue process in ${resource.subitemName}`
                        : resource.subitemName}
                    </span>
                    <span className="mt-0.5 block text-[10px] font-normal text-slate-500">
                      ID: {resource.subitemDisplayId || resource.subitemId} · Timeline {resource.timelineIndex + 1} 
                    </span>
                  </button>
                )}
                  </div>
                  );
                },
              )}
              </div>
            </div>,
            schedulerRootHost,
          )}
        {timelineCanvasHost &&
          todayPosition !== null &&
          createPortal(
            <div
              className="pointer-events-none absolute bottom-0 top-0 z-20 w-[3px] bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"
              style={{ left: `${todayPosition}px` }}
            >
              <span className="absolute left-1/2 top-1 -translate-x-1/2 rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow">
                Today
              </span>
            </div>,
            timelineCanvasHost,
          )}
      </div>
      {contextMenu && (
        <div
          className="fixed z-menu w-48 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => void togglePin(contextMenu.clientId)}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-sky-50 hover:text-sky-700"
          >
            {pinnedClientIds.has(contextMenu.clientId) ? (
              <PinOff size={16} />
            ) : (
              <Pin size={16} />
            )}
            {pinnedClientIds.has(contextMenu.clientId)
              ? "Unpin client"
              : "Pin client to top"}
          </button>
        </div>
      )}
      {filterMenu && (
        <div
          className={`fixed z-menu overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl ${filterMenu.kind === "all" ? "w-[360px]" : "w-[280px]"}`}
          style={{
            left: filterMenu.x,
            top: filterMenu.y,
            maxHeight: `calc(100vh - ${filterMenu.y + 8}px)`,
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                {filterMenu.kind === "all"
                  ? "Filter Gantt chart"
                  : filterMenu.kind === "group"
                    ? "Filter by Group"
                    : "Filter by Client"}
              </h3>
              {filterMenu.kind === "all" && (
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Showing {data.length} of {totalResourceCount ?? unfilteredData.length} timeline rows
                  {isLoadingMore ? " · Loading more…" : ""}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setFilters({
                      ...EMPTY_FILTERS,
                      groupIds: new Set(),
                      clientIds: new Set(),
                      pmIds: new Set(),
                      peopleIds: new Set(),
                      processStatuses: new Set(),
                    })
                  }
                  className="rounded px-2 py-1 text-xs text-sky-700 hover:bg-sky-50"
                >
                  Clear all
                </button>
              )}
              <button
                type="button"
                onClick={() => setFilterMenu(null)}
                className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100"
              >
                <X size={15} />
              </button>
            </div>
          </div>
          <div className="max-h-[min(570px,calc(100vh-180px))] overflow-y-auto p-3">
            {filterMenu.kind === "group" && (
              <FilterChecklist
                options={groupOptions}
                selected={filters.groupIds}
                onToggle={(value) => toggleFilter("groupIds", value)}
              />
            )}
            {filterMenu.kind === "client" && (
              <FilterChecklist
                options={clientOptions}
                selected={filters.clientIds}
                onToggle={(value) => toggleFilter("clientIds", value)}
              />
            )}
            {filterMenu.kind === "all" && (
              <div className="space-y-2">
                <details className="rounded-lg border border-slate-200" open>
                  <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-slate-700">
                    Groups
                    {filters.groupIds.size ? ` (${filters.groupIds.size})` : ""}
                  </summary>
                  <div className="border-t border-slate-100 p-2">
                    <FilterChecklist
                      options={groupOptions}
                      selected={filters.groupIds}
                      onToggle={(value) => toggleFilter("groupIds", value)}
                    />
                  </div>
                </details>
                <details className="rounded-lg border border-slate-200">
                  <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-slate-700">
                    Clients
                    {filters.clientIds.size
                      ? ` (${filters.clientIds.size})`
                      : ""}
                  </summary>
                  <div className="border-t border-slate-100 p-2">
                    <FilterChecklist
                      options={clientOptions}
                      selected={filters.clientIds}
                      onToggle={(value) => toggleFilter("clientIds", value)}
                    />
                  </div>
                </details>
                <details className="rounded-lg border border-slate-200">
                  <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-slate-700">
                    PM{filters.pmIds.size ? ` (${filters.pmIds.size})` : ""}
                  </summary>
                  <div className="border-t border-slate-100 p-2">
                    <FilterChecklist
                      options={pmOptions}
                      selected={filters.pmIds}
                      onToggle={(value) => toggleFilter("pmIds", value)}
                    />
                  </div>
                </details>
                <details className="rounded-lg border border-slate-200">
                  <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-slate-700">
                    People
                    {filters.peopleIds.size
                      ? ` (${filters.peopleIds.size})`
                      : ""}
                  </summary>
                  <div className="border-t border-slate-100 p-2">
                    <FilterChecklist
                      options={peopleOptions}
                      selected={filters.peopleIds}
                      onToggle={(value) => toggleFilter("peopleIds", value)}
                    />
                  </div>
                </details>
                <details className="rounded-lg border border-slate-200">
                  <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-slate-700">
                    Process status
                    {filters.processStatuses.size
                      ? ` (${filters.processStatuses.size})`
                      : ""}
                  </summary>
                  <div className="border-t border-slate-100 p-2">
                    <FilterChecklist
                      options={processStatusOptions}
                      selected={filters.processStatuses}
                      onToggle={(value) =>
                        toggleFilter("processStatuses", value)
                      }
                      searchable={false}
                    />
                  </div>
                </details>
                <details className="rounded-lg border border-slate-200">
                  <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-slate-700">
                    Date range
                    {filters.dateFrom || filters.dateTo ? " (Active)" : ""}
                  </summary>
                  <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-3">
                    <label className="space-y-1 text-[11px] text-slate-500">
                      <span>From</span>
                      <input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(event) =>
                          setFilters((current) => ({
                            ...current,
                            dateFrom: event.target.value,
                          }))
                        }
                        className="h-9 w-full rounded-md border border-slate-200 px-2 text-xs text-slate-700 outline-none focus:border-sky-400"
                      />
                    </label>
                    <label className="space-y-1 text-[11px] text-slate-500">
                      <span>To</span>
                      <input
                        type="date"
                        value={filters.dateTo}
                        onChange={(event) =>
                          setFilters((current) => ({
                            ...current,
                            dateTo: event.target.value,
                          }))
                        }
                        className="h-9 w-full rounded-md border border-slate-200 px-2 text-xs text-slate-700 outline-none focus:border-sky-400"
                      />
                    </label>
                  </div>
                </details>
              </div>
            )}
          </div>
        </div>
      )}
      <Dialog
        // Timeline label menus are portalled to document.body. Keeping this
        // dialog non-modal prevents Radix from disabling pointer events on
        // that portal while the editor is open.
        modal={false}
        open={Boolean(selectedTimeline && selectedTimelineData)}
        onOpenChange={(open) => !open && setSelectedTimeline(null)}
      >
        <DialogContent
          className="isolate max-h-[calc(100vh-3rem)] max-w-[calc(100vw-3rem)] overflow-hidden bg-white p-0 opacity-100 shadow-2xl sm:max-w-[1500px]"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          {selectedTimelineData ? (
            <div className="flex max-h-[calc(100vh-3rem)] flex-col bg-white">
              <DialogHeader className="shrink-0 items-center border-b border-slate-200 px-6 py-5 pr-14 text-center">
                <DialogTitle>
                  {selectedTimelineData.subitem.name || "Untitled subitem"}
                </DialogTitle>
                <DialogDescription>
                  {selectedTimelineData.client.name || "Unnamed client"} ·
                  Project Timeline {selectedTimelineData.timelineIndex + 1}
                </DialogDescription>
              </DialogHeader>
              <div className="flex min-h-0 justify-center overflow-auto bg-white px-6 py-5">
                <TimelineSection
                  title={`Project Timeline ${selectedTimelineData.timelineIndex + 1}`}
                  rows={selectedTimelineData.timeline.rows}
                  cnTracking={selectedTimelineData.timeline.cnTracking}
                  sgTracking={selectedTimelineData.timeline.sgTracking}
                  numOfCartons={selectedTimelineData.timeline.numOfCartons ?? ""}
                  shipper={
                    selectedTimelineData.timeline.shipper ??
                    selectedTimelineData.subitem.shipper ??
                    ""
                  }
                  shipperOptionId={
                    selectedTimelineData.timeline.shipperOptionId ??
                    selectedTimelineData.subitem.shipperOptionId ??
                    null
                  }
                  shipperOptions={shipperOptions}
                  timelineProgressOptions={timelineProgressOptions}
                  readOnly={
                    !canEditSubitem(
                      selectedTimelineData.client.id,
                      selectedTimelineData.subitem.id,
                    )
                  }
                  onTrackingChange={(tracking) =>
                    void onUpdateSubitem(
                      selectedTimelineData.client.id,
                      selectedTimelineData.subitem.id,
                      {
                        timelineGroups: selectedTimelineData.timelines.map(
                          (candidate) =>
                            candidate.id === selectedTimelineData.timeline.id
                              ? { ...candidate, ...tracking }
                              : candidate,
                        ),
                      },
                    )
                  }
                  onCartonsChange={(numOfCartons) =>
                    void onUpdateSubitem(
                      selectedTimelineData.client.id,
                      selectedTimelineData.subitem.id,
                      {
                        timelineGroups: selectedTimelineData.timelines.map(
                          (candidate) =>
                            candidate.id === selectedTimelineData.timeline.id
                              ? { ...candidate, numOfCartons }
                              : candidate,
                        ),
                      },
                    )
                  }
                  onShipperChange={(shipper, shipperOptionId) =>
                    void onUpdateSubitem(
                      selectedTimelineData.client.id,
                      selectedTimelineData.subitem.id,
                      {
                        timelineGroups: selectedTimelineData.timelines.map(
                          (candidate) =>
                            candidate.id === selectedTimelineData.timeline.id
                              ? {
                                  ...candidate,
                                  shipper,
                                  shipperOptionId,
                                }
                              : candidate,
                        ),
                      },
                    )
                  }
                  onAddShipper={(name) => addGanttOption("shipper", name)}
                  onDeleteShipper={(name, optionId) =>
                    deleteGanttOption("shipper", name, optionId)
                  }
                  onUpdateShipperColor={(name, color, optionId) =>
                    updateGanttOptionColor("shipper", name, color, optionId)
                  }
                  onRenameShipper={(oldName, newName, optionId) =>
                    renameGanttOption("shipper", oldName, newName, optionId)
                  }
                  onReorderShippers={(layout) =>
                    reorderGanttOptions("shipper", layout)
                  }
                  onUpdate={(rows) =>
                    void onUpdateSubitem(
                      selectedTimelineData.client.id,
                      selectedTimelineData.subitem.id,
                      {
                        timelineGroups: selectedTimelineData.timelines.map(
                          (candidate) =>
                            candidate.id === selectedTimelineData.timeline.id
                              ? {
                                  ...candidate,
                                  rows: resolveTimelineDependencies(
                                    selectedTimelineData.timeline.rows,
                                    rows,
                                  ),
                                }
                              : candidate,
                        ),
                      },
                    )
                  }
                  onAddTimelineProgress={(name) =>
                    addGanttOption("subitem_subprogress", name)
                  }
                  onDeleteTimelineProgress={(name) =>
                    deleteGanttOption("subitem_subprogress", name)
                  }
                  onUpdateOptionColor={(name, color) =>
                    updateGanttOptionColor("subitem_subprogress", name, color)
                  }
                  onRenameOption={(oldName, newName) =>
                    renameGanttOption("subitem_subprogress", oldName, newName)
                  }
                  onReorderOptions={(layout) =>
                    reorderGanttOptions("subitem_subprogress", layout)
                  }
                />
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
