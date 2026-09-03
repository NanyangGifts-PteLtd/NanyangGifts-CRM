"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import {
  ChevronDown,
  ChevronRight,
  ListFilter,
  Pin,
  PinOff,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";
import "@bitnoi.se/react-scheduler/dist/style.css";
import type {
  Client,
  ClientAssigneeMap,
  CRMGroup,
  Profile,
  Subitem,
  SubitemAssigneeMap,
  TimelineRow,
} from "../app/types";

const Scheduler = dynamic(
  () => import("@bitnoi.se/react-scheduler").then((mod) => mod.Scheduler),
  { ssr: false },
);
const RESOURCE_PANEL_WIDTH = 570;
const PROCESS_LEGEND = [
  { label: "Done", color: "#6cbaa2" },
  { label: "Started", color: "#ff8e71" },
  { label: "Pending", color: "#aba6dd" },
  { label: "Late", color: "#aa0015" },
  { label: "Delivered", color: "#0090c8" },
  { label: "Shipped out", color: "#ff5ea1" },
  { label: "Other / no status", color: "#60a5fa" },
  { label: "Overdue", color: "#dc2626" },
] as const;

type Props = {
  clients: Client[];
  groups: CRMGroup[];
  profiles: Profile[];
  clientAssignees: ClientAssigneeMap;
  subitemAssignees: SubitemAssigneeMap;
  onOpenClientTimeline: (clientId: string, subitemId?: string) => void;
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
  subitemName: string;
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
function getColor(progress?: string) {
  if (progress === "Done") return "#6cbaa2";
  if (progress === "Started") return "#ff8e71";
  if (progress === "Pending") return "#aba6dd";
  if (progress === "Late") return "#aa0015";
  if (progress === "Delivered") return "#0090c8";
  if (progress === "Shipped out") return "#ff5ea1";
  return "#60a5fa";
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

function buildSchedulerData(
  clients: Client[],
  groups: CRMGroup[],
  clientAssignees: ClientAssigneeMap,
  subitemAssignees: SubitemAssigneeMap,
): SchedulerResource[] {
  const groupMap = new Map(groups.map((group) => [group.id, group]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const completedStatuses = new Set(["done", "delivered", "shipped out"]);
  return clients
    .filter(
      (client): client is Client => !!client && typeof client === "object",
    )
    .flatMap((client) => {
      const group = client.groupId ? groupMap.get(client.groupId) : undefined;
      const groupName = group?.name || "No group";
      const clientName = client.name || "Unnamed Client";
      const subitems = Array.isArray(client.subitems)
        ? client.subitems.filter(
            (subitem): subitem is Subitem =>
              !!subitem && typeof subitem === "object",
          )
        : [];
      const rows: Array<Subitem | null> = subitems.length ? subitems : [null];

      return rows.map((subitem) => {
        const subitemName = subitem?.name || "No subitems";
        const timelineRows = Array.isArray(subitem?.timelineRows)
          ? subitem.timelineRows.filter(
              (row): row is TimelineRow => !!row && typeof row === "object",
            )
          : [];
        const resourceId = `${client.id}::${subitem?.id ?? "empty"}`;
        const items = timelineRows.flatMap((row): SchedulerItem[] => {
          const start = parseDate(row?.timelineStart);
          const explicitEnd = parseDate(row?.timelineEnd);
          const end = start ? (explicitEnd ?? addOneDay(start)) : null;
          const isOverdue = Boolean(
            explicitEnd &&
            explicitEnd < today &&
            !completedStatuses.has(
              (row?.subProgress || "").trim().toLowerCase(),
            ),
          );
          if (!start || !end || !subitem) return [];
          return [
            {
              id: `${client.id}::${subitem.id}::${row.id}`,
              startDate: start,
              endDate: end,
              occupancy:
                row.subProgress === "Done"
                  ? 100
                  : row.subProgress === "Started"
                    ? 60
                    : 20,
              title: row.name || "Untitled Process",
              subtitle: isOverdue ? `Overdue - ${subitemName}` : subitemName,
              description:
                [
                  isOverdue ? "Overdue" : "",
                  row.person ? `Owner: ${row.person}` : "",
                  row.remarks ? `Remarks: ${row.remarks}` : "",
                  subitem.status ? `Subitem status: ${subitem.status}` : "",
                ]
                  .filter(Boolean)
                  .join(" - ") || "No details",
              bgColor: isOverdue ? "#dc2626" : getColor(row.subProgress),
              processStatus: row.subProgress || "No status",
              isOverdue,
            },
          ];
        });

        const processNames = timelineRows.map(
          (row) => row.name || "Untitled Process",
        );
        return {
          id: resourceId,
          label: {
            title: `${groupName} ${clientName} ${subitemName} ${processNames.join(" ")}`,
            subtitle: resourceId,
            icon: "",
          },
          data: items,
          clientId: client.id,
          subitemId: subitem?.id,
          groupId: group?.id || "ungrouped",
          groupName,
          clientName,
          subitemName,
          processNames,
          pmIds: parsePmIds(client),
          peopleIds: Array.from(
            new Set([
              ...(clientAssignees[client.id] ?? []),
              ...(subitem ? (subitemAssignees[subitem.id] ?? []) : []),
            ]),
          ),
        };
      });
    });
}

export default function GanttChart({
  clients,
  groups,
  profiles,
  clientAssignees,
  subitemAssignees,
  onOpenClientTimeline,
}: Props) {
  const schedulerRootRef = useRef<HTMLDivElement>(null);
  const timelinePanRef = useRef<TimelinePan | null>(null);
  const suppressTimelineClickRef = useRef(false);
  const previousPageButtonRef = useRef<HTMLButtonElement | null>(null);
  const [pinnedClientIds, setPinnedClientIds] = useState<Set<string>>(
    new Set(),
  );
  const [labelHosts, setLabelHosts] = useState<LabelHost[]>([]);
  const [sidebarHost, setSidebarHost] = useState<HTMLElement | null>(null);
  const [headerHost, setHeaderHost] = useState<HTMLElement | null>(null);
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
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(
    new Set(),
  );
  const [collapsedClientIds, setCollapsedClientIds] = useState<Set<string>>(
    new Set(),
  );

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

  const orderedGroups = useMemo(() => {
    const boardOrder = [...groups]
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
  const unfilteredData = useMemo(
    () =>
      buildSchedulerData(
        orderedClients,
        orderedGroups,
        clientAssignees,
        subitemAssignees,
      ),
    [orderedClients, orderedGroups, clientAssignees, subitemAssignees],
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
                ? resource.clientName
                : searchScope === "subitem"
                  ? resource.subitemName
                  : `${resource.groupName} ${resource.clientName} ${resource.subitemName} ${resource.processNames.join(" ")}`;
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
                { clientId: resource.clientId, subitemId: resource.subitemId },
              ] as const,
          ),
        ),
      ),
    [data],
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
  }, [unfilteredData]);
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
          unfilteredData.flatMap((resource) =>
            resource.data.map((item) => item.processStatus),
          ),
        ),
      )
        .sort()
        .map((status) => ({ value: status, label: status })),
    [unfilteredData],
  );
  const activeFilterCount =
    filters.groupIds.size +
    filters.clientIds.size +
    filters.pmIds.size +
    filters.peopleIds.size +
    filters.processStatuses.size +
    Number(!!filters.dateFrom) +
    Number(!!filters.dateTo);
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

        const sidebar = next[0]?.element.parentElement as HTMLElement | null;
        const header = sidebar?.firstElementChild as HTMLElement | null;
        if (sidebar) {
          setStyle(sidebar, "min-width", `${RESOURCE_PANEL_WIDTH}px`);
          setStyle(sidebar, "max-width", `${RESOURCE_PANEL_WIDTH}px`);
          setStyle(sidebar, "width", `${RESOURCE_PANEL_WIDTH}px`);
        }
        if (header) {
          setStyle(header, "width", `${RESOURCE_PANEL_WIDTH}px`);
          setStyle(header, "overflow", "hidden");
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
        setSidebarHost((current) => (current === sidebar ? current : sidebar));
        setHeaderHost((current) => (current === header ? current : header));
        const canvasHost = root.querySelector<HTMLElement>(
          "#reactSchedulerCanvasWrapper",
        );
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
              host.clientTop === next[index].clientTop &&
              host.groupSpanHeight === next[index].groupSpanHeight &&
              host.groupTop === next[index].groupTop,
          )
            ? current
            : next,
        );
      });
    };
    const observer = new MutationObserver(refreshHosts);
    observer.observe(root, { childList: true, subtree: true });
    refreshHosts();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      originalStyles.forEach((style, element) =>
        style === null
          ? element.removeAttribute("style")
          : element.setAttribute("style", style),
      );
    };
  }, [data]);

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
        event.clientX < rootRect.left + RESOURCE_PANEL_WIDTH ||
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
        ref={schedulerRootRef}
        className="relative min-h-0 w-full max-w-full flex-1 overflow-hidden rounded-xl border bg-white"
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
            if (target) onOpenClientTimeline(target.clientId, target.subitemId);
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
        {headerHost &&
          createPortal(
            <>
              <div className="absolute inset-x-2 top-2 z-[5] flex h-9 items-center gap-1.5">
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
              <div className="absolute inset-x-0 bottom-0 grid h-8 grid-cols-[140px_210px_220px] border-t border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
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
            headerHost,
          )}
        {labelHosts.map(({ resource, element }) =>
          createPortal(
            <div
              key={resource.id}
              className="pointer-events-none absolute inset-0 text-xs text-slate-700"
            >
              {!collapsedGroupIds.has(resource.groupId) &&
                !collapsedClientIds.has(resource.clientId) && (
                  <button
                    type="button"
                    disabled={!resource.subitemId}
                    className={`pointer-events-auto absolute inset-y-0 left-[350px] right-0 min-w-0 truncate px-3 text-left hover:bg-sky-50 disabled:cursor-default disabled:text-slate-400 disabled:hover:bg-transparent ${resource.data.some((item) => item.isOverdue) ? "bg-red-50 font-semibold text-red-700" : ""}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (resource.subitemId)
                        onOpenClientTimeline(
                          resource.clientId,
                          resource.subitemId,
                        );
                    }}
                    title={resource.subitemName}
                  >
                    {resource.data.some((item) => item.isOverdue)
                      ? `Overdue process in ${resource.subitemName}`
                      : resource.subitemName}
                  </button>
                )}
            </div>,
            element,
          ),
        )}
        {sidebarHost &&
          labelHosts
            .filter((host) => host.startsVisibleGroup)
            .map(({ resource, groupSpanHeight, groupTop }) =>
              createPortal(
                <button
                  key={`group-${resource.id}`}
                  type="button"
                  onClick={() =>
                    toggleCollapsedId(setCollapsedGroupIds, resource.groupId)
                  }
                  className="absolute left-0 z-[2] flex w-[140px] min-w-0 items-center gap-1 border-b border-r border-slate-200 bg-white px-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                  style={{ top: groupTop, height: groupSpanHeight }}
                  title={`${collapsedGroupIds.has(resource.groupId) ? "Expand" : "Collapse"} ${resource.groupName}`}
                >
                  {collapsedGroupIds.has(resource.groupId) ? (
                    <ChevronRight size={14} className="shrink-0" />
                  ) : (
                    <ChevronDown size={14} className="shrink-0" />
                  )}
                  <span className="truncate">{resource.groupName}</span>
                </button>,
                sidebarHost,
              ),
            )}
        {sidebarHost &&
          labelHosts
            .filter(
              (host) =>
                host.startsVisibleClientGroup &&
                !collapsedGroupIds.has(host.resource.groupId),
            )
            .map(({ resource, clientSpanHeight, clientTop }) =>
              createPortal(
                <div
                  key={`client-${resource.id}`}
                  className="absolute left-[140px] z-[2] flex w-[210px] min-w-0 items-center gap-1 border-b border-r border-slate-200 bg-white px-2 text-xs"
                  style={{ top: clientTop, height: clientSpanHeight }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setContextMenu({
                      clientId: resource.clientId,
                      x: event.clientX,
                      y: event.clientY,
                    });
                  }}
                  title={resource.clientName}
                >
                  <button
                    type="button"
                    onClick={() =>
                      toggleCollapsedId(
                        setCollapsedClientIds,
                        resource.clientId,
                      )
                    }
                    className="flex h-7 w-5 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
                    title={
                      collapsedClientIds.has(resource.clientId)
                        ? "Expand client"
                        : "Collapse client"
                    }
                  >
                    {collapsedClientIds.has(resource.clientId) ? (
                      <ChevronRight size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                  </button>
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left font-medium text-slate-800 hover:text-sky-700"
                    onClick={() => onOpenClientTimeline(resource.clientId)}
                  >
                    {resource.clientName}
                  </button>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      void togglePin(resource.clientId);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        void togglePin(resource.clientId);
                      }
                    }}
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition ${pinnedClientIds.has(resource.clientId) ? "bg-sky-100 text-sky-700 hover:bg-sky-200" : "text-slate-400 hover:bg-slate-100 hover:text-sky-600"}`}
                    title={
                      pinnedClientIds.has(resource.clientId)
                        ? "Unpin client"
                        : "Pin client to top"
                    }
                    aria-label={
                      pinnedClientIds.has(resource.clientId)
                        ? "Unpin client"
                        : "Pin client to top"
                    }
                  >
                    {pinnedClientIds.has(resource.clientId) ? (
                      <PinOff size={15} />
                    ) : (
                      <Pin size={15} />
                    )}
                  </span>
                </div>,
                sidebarHost,
              ),
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
          className="fixed z-[300] w-48 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl"
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
          className={`fixed z-[320] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl ${filterMenu.kind === "all" ? "w-[360px]" : "w-[280px]"}`}
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
                  Showing {data.length} of {unfilteredData.length} subitem rows
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
    </div>
  );
}
