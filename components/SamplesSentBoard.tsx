"use client";

import {
  ChevronDown,
  ChevronRight,
  FileImage,
  Link2,
  LockKeyhole,
  LoaderCircle,
  Filter,
  History,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
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
  AdvancedFilters,
  advancedFilterConditionRequiresValue,
  type AdvancedFilterColumn,
  type AdvancedFilterRule,
} from "@/components/AdvancedFilters";
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
  legacyClientName: string;
  legacyMobile: string;
  mondayItemsSent: string;
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
  "Reference ID",
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
  "Monday Items Sent",
  "Extend 7 Days",
  "Returned",
  "Date Returned",
  "Creation Log",
];
const DEFAULT_COLUMN_WIDTHS = [
  245, 84, 125, 130, 230, 115, 115, 125, 160, 230, 110, 120, 135, 260, 260, 130,
  115, 125, 155,
];
const COLUMN_WIDTHS_SETTING_KEY = "samples_sent_column_widths_v2";
const LEGACY_COLUMN_WIDTHS_ORDER = [
  0, 1, 17, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18,
];
const gridForWidths = (widths: number[]) => widths.map((width) => `${width}px`).join(" ");
const dateToday = () => new Date().toISOString().slice(0, 10);
const dateAfterDays = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
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

const DEFAULT_SEARCH_COLUMNS = new Set([
  "client",
  "mobile",
  "status",
  "items",
]);

function sampleColumnValues(row: SampleRow, key: string): unknown[] {
  switch (key) {
    case "client":
      return [row.linkedClient?.name || row.legacyClientName];
    case "clientId":
      return [row.linkedClient?.display_id ?? ""];
    case "people":
      return row.people.map(profileName);
    case "mobile":
      return [row.linkedClient?.phone || row.legacyMobile];
    case "address":
      return [row.address];
    case "dateSent":
      return [row.date_sent];
    case "returnBy":
      return [row.return_by];
    case "status":
      return [row.status];
    case "reason":
      return [row.reason];
    case "remarks":
      return [row.remarks];
    case "cost":
      return [row.cost];
    case "courier":
      return [row.courier];
    case "items":
      return row.items.map((item) => `${item.item_name} x ${item.qty}`);
    case "mondayItems":
      return [row.mondayItemsSent];
    case "dateReturned":
      return [row.date_returned];
    case "reference":
      return [row.referenceId];
    case "dateCreated":
      return [row.created_at.slice(0, 10)];
    default:
      return [];
  }
}

function uniqueSampleColumnValues(rows: SampleRow[], key: string) {
  return [...new Set(rows.flatMap((row) => sampleColumnValues(row, key))
    .map((value) => String(value ?? "").trim())
    .filter(Boolean))]
    .sort((first, second) => first.localeCompare(second));
}

function advancedLabelOptions(options: BadgeOption[] | undefined) {
  return options?.map((option) => ({
    id: option.id,
    value: option.value,
    color: option.color ?? "#64748b",
    section: option.section,
  }));
}

function includesSampleSearch(value: unknown, query: string) {
  return String(value ?? "").toLowerCase().includes(query.trim().toLowerCase());
}

function sampleLabelOptionId(row: SampleRow, key: string) {
  if (key === "status") return row.status_option_id;
  if (key === "reason") return row.reason_option_id;
  if (key === "courier") return row.courier_option_id;
  return null;
}

function matchesSampleRule(
  row: SampleRow,
  rule: AdvancedFilterRule,
  columns: AdvancedFilterColumn[],
) {
  const column = columns.find((entry) => entry.key === rule.column);
  if (!column || !rule.condition) return true;
  const values = sampleColumnValues(row, rule.column);
  const valuesAreEmpty = values.length === 0 || values.every((value) => !String(value ?? "").trim());
  if (rule.condition === "is empty") return valuesAreEmpty;
  if (rule.condition === "is not empty") return !valuesAreEmpty;
  if (rule.valueOptionId) {
    const optionId = sampleLabelOptionId(row, rule.column);
    return rule.condition === "is not"
      ? optionId !== rule.valueOptionId
      : optionId === rule.valueOptionId;
  }
  const target = rule.value.trim();
  const targetLower = target.toLowerCase();
  const compare = (value: unknown) => {
    const source = String(value ?? "").trim();
    const sourceLower = source.toLowerCase();
    if (column.valueType === "number") {
      const left = Number(source);
      const right = Number(target);
      if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
      if (rule.condition === "is") return left === right;
      if (rule.condition === "is not") return left !== right;
      if (rule.condition === "is greater than") return left > right;
      if (rule.condition === "is greater than or equal to") return left >= right;
      if (rule.condition === "is less than") return left < right;
      if (rule.condition === "is less than or equal to") return left <= right;
      return false;
    }
    if (column.valueType === "date") {
      if (rule.condition === "is") return source === target;
      if (rule.condition === "is not") return source !== target;
      if (rule.condition === "is before") return source < target;
      if (rule.condition === "is on or before") return source <= target;
      if (rule.condition === "is after") return source > target;
      if (rule.condition === "is on or after") return source >= target;
      return false;
    }
    if (rule.condition === "is" || rule.condition === "text is") return sourceLower === targetLower;
    if (rule.condition === "is not" || rule.condition === "text is not") return sourceLower !== targetLower;
    if (rule.condition === "contains") return sourceLower.includes(targetLower);
    if (rule.condition === "does not contain") return !sourceLower.includes(targetLower);
    if (rule.condition === "starts with") return sourceLower.startsWith(targetLower);
    if (rule.condition === "ends with") return sourceLower.endsWith(targetLower);
    return false;
  };
  const negative = rule.condition === "is not" || rule.condition === "text is not" || rule.condition === "does not contain";
  return negative ? values.every(compare) : values.some(compare);
}

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
  const [pendingFocusedRecordId, setPendingFocusedRecordId] = useState<string | null>(null);
  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS);
  const [labelOptions, setLabelOptions] = useState<Record<string, BadgeOption[]>>({});
  const [canDeleteLabels, setCanDeleteLabels] = useState(false);
  const [itemsEditorRow, setItemsEditorRow] = useState<SampleRow | null>(null);
  const [linkingClientRow, setLinkingClientRow] = useState<SampleRow | null>(null);
  const [failedReturn, setFailedReturn] = useState<{ row: SampleRow; optionId: string } | null>(null);
  const [failedReturnRemarks, setFailedReturnRemarks] = useState("");
  const [activityRecord, setActivityRecord] = useState<SampleRow | null>(null);
  const [activityRows, setActivityRows] = useState<Array<{ id: string; actor_name: string; title: string; created_at: string }>>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const openActivity = async (record: SampleRow) => {
    setActivityRecord(record); setActivityRows([]); setActivityLoading(true);
    try {
      const response = await fetch(`/api/samples-sent/activity?recordId=${encodeURIComponent(record.id)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Activity history could not be loaded");
      setActivityRows(result.rows ?? []);
    } catch (error) { toast.error("Activity history could not be loaded", { description: error instanceof Error ? error.message : undefined }); }
    finally { setActivityLoading(false); }
  };
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearchColumns, setShowSearchColumns] = useState(false);
  const [searchAllColumns, setSearchAllColumns] = useState(false);
  const [searchColumns, setSearchColumns] = useState<Set<string>>(
    () => new Set(DEFAULT_SEARCH_COLUMNS),
  );
  const [searchColumnQuery, setSearchColumnQuery] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [advancedRules, setAdvancedRules] = useState<AdvancedFilterRule[]>([
    { id: "initial", column: "", condition: "", value: "" },
  ]);
  const [advancedJoin, setAdvancedJoin] = useState<"and" | "or">("and");
  const searchCollapseSnapshotRef = useRef<Map<string, boolean> | null>(null);
  const toolbarFiltersRef = useRef<HTMLDivElement>(null!);

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
      setGroups((current) =>
        (groupData.groups ?? []).map((group: Omit<Group, "collapsed">) => ({
          ...group,
          // A second in-flight board load must not re-collapse a group which
          // was opened to focus a record from the CRM summary.
          collapsed: current.find((existing) => existing.id === group.id)?.collapsed ?? true,
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
    const normalizeWidths = (value: unknown, order = COLUMNS.map((_, index) => index)) => {
      if (!Array.isArray(value) || value.length !== COLUMNS.length) return null;
      return order.map((sourceIndex, index) =>
        Number.isFinite(Number(value[sourceIndex]))
          ? Math.max(72, Number(value[sourceIndex]))
          : DEFAULT_COLUMN_WIDTHS[index],
      );
    };
    void fetch(`/api/user-settings?key=${COLUMN_WIDTHS_SETTING_KEY}`)
      .then((response) => response.json())
      .then((data) => {
        const currentWidths = normalizeWidths(data.value);
        if (currentWidths) {
          setColumnWidths(currentWidths);
          return;
        }
        return fetch("/api/user-settings?key=samples_sent_column_widths")
          .then((response) => response.json())
          .then((legacy) => {
            const migratedWidths = normalizeWidths(legacy.value, LEGACY_COLUMN_WIDTHS_ORDER);
            if (!migratedWidths) return;
            setColumnWidths(migratedWidths);
            void fetch("/api/user-settings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key: COLUMN_WIDTHS_SETTING_KEY, value: migratedWidths }),
            });
          });
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
        void fetch("/api/user-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: COLUMN_WIDTHS_SETTING_KEY, value: current }) });
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
  useEffect(() => {
    if (!showSearch && !showSearchColumns && !showFilter) return;
    const closeOnClickAway = (event: MouseEvent) => {
      if (toolbarFiltersRef.current?.contains(event.target as Node)) return;
      // Match the CRM Board: an active search remains visible so its term is
      // clear, while an unused search control collapses back to "Search".
      if (!searchTerm.trim()) setShowSearch(false);
      setShowSearchColumns(false);
      setShowFilter(false);
    };
    document.addEventListener("mousedown", closeOnClickAway);
    return () => document.removeEventListener("mousedown", closeOnClickAway);
  }, [searchTerm, showFilter, showSearch, showSearchColumns]);
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
    setPendingFocusedRecordId(recordId);
  }, [rows]);

  useEffect(() => {
    if (!pendingFocusedRecordId) return;
    const record = rows.find((row) => row.id === pendingFocusedRecordId);
    if (!record) return;
    const group = groups.find((entry) => entry.id === record.group_id);
    if (group?.collapsed) return;
    const scrollTimer = window.setTimeout(() => {
      document
        .querySelector<HTMLElement>(
          `[data-samples-sent-record-id="${pendingFocusedRecordId}"]`,
        )
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
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
  }, [groups, pendingFocusedRecordId, rows]);

  const searchColumnsConfig = useMemo<AdvancedFilterColumn[]>(() => {
    const columns: AdvancedFilterColumn[] = [
    { key: "client", label: "Client", category: "Sample", values: [], valueType: "text" },
    { key: "clientId", label: "Client ID", category: "Sample", values: [], valueType: "text" },
    { key: "people", label: "People", category: "Sample", values: [], valueType: "text" },
    { key: "mobile", label: "Mobile", category: "Sample", values: [], valueType: "text" },
    { key: "address", label: "Address", category: "Sample", values: [], valueType: "text" },
    { key: "dateSent", label: "Date Sent", category: "Sample", values: [], valueType: "date" },
    { key: "returnBy", label: "Return By", category: "Sample", values: [], valueType: "date" },
    { key: "status", label: "Status", category: "Sample", values: [], labelOptions: advancedLabelOptions(labelOptions.samples_sent_status), valueType: "text" },
    { key: "reason", label: "Reason", category: "Sample", values: [], labelOptions: advancedLabelOptions(labelOptions.samples_sent_reason), valueType: "text" },
    { key: "remarks", label: "Remarks", category: "Sample", values: [], valueType: "text" },
    { key: "cost", label: "Cost", category: "Sample", values: [], valueType: "number" },
    { key: "courier", label: "Courier", category: "Sample", values: [], labelOptions: advancedLabelOptions(labelOptions.samples_sent_courier), valueType: "text" },
    { key: "items", label: "Items Sent", category: "Sample", values: [], valueType: "text" },
    { key: "mondayItems", label: "Monday Items Sent", category: "Sample", values: [], valueType: "text" },
    { key: "dateReturned", label: "Date Returned", category: "Sample", values: [], valueType: "date" },
    { key: "reference", label: "Reference ID", category: "Sample", values: [], valueType: "text" },
    { key: "dateCreated", label: "Date Created", category: "Sample", values: [], valueType: "date" },
    ];
    return columns.map((column) => ({
      ...column,
      values: uniqueSampleColumnValues(rows, column.key),
    }));
  }, [labelOptions, rows]);
  const activeAdvancedRules = useMemo(
    () => advancedRules.filter((rule) =>
      rule.column && rule.condition &&
      (!advancedFilterConditionRequiresValue(rule.condition) || rule.value || rule.valueOptionId),
    ),
    [advancedRules],
  );
  const activeSearchColumns = useMemo(
    () => searchAllColumns
      ? new Set(searchColumnsConfig.map((column) => column.key))
      : searchColumns,
    [searchAllColumns, searchColumns, searchColumnsConfig],
  );
  const visibleRows = useMemo(() => rows.filter((row) => {
    const searchMatches = !searchTerm.trim() || (
      activeSearchColumns.size > 0 && [...activeSearchColumns].some((key) =>
        sampleColumnValues(row, key).some((value) => includesSampleSearch(value, searchTerm)),
      )
    );
    if (!searchMatches) return false;
    if (!activeAdvancedRules.length) return true;
    const outcomes = activeAdvancedRules.map((rule) =>
      matchesSampleRule(row, rule, searchColumnsConfig),
    );
    return advancedJoin === "and" ? outcomes.every(Boolean) : outcomes.some(Boolean);
  }), [activeAdvancedRules, activeSearchColumns, advancedJoin, rows, searchColumnsConfig, searchTerm]);
  const queryActive = Boolean(searchTerm.trim()) || activeAdvancedRules.length > 0;
  const selectedSearchColumnCount = searchAllColumns
    ? searchColumnsConfig.length
    : searchColumns.size;
  const visibleGroups = useMemo(
    () => queryActive
      ? groups.filter((group) => visibleRows.some((row) => row.group_id === group.id))
      : groups,
    [groups, queryActive, visibleRows],
  );
  useEffect(() => {
    if (queryActive) {
      if (!searchCollapseSnapshotRef.current) {
        searchCollapseSnapshotRef.current = new Map(
          groups.map((group) => [group.id, group.collapsed]),
        );
      }
      setGroups((current) => {
        let changed = false;
        const next = current.map((group) => {
          if (!group.collapsed || !visibleRows.some((row) => row.group_id === group.id)) {
            return group;
          }
          changed = true;
          return { ...group, collapsed: false };
        });
        return changed ? next : current;
      });
      return;
    }
    if (!queryActive && searchCollapseSnapshotRef.current) {
      const saved = searchCollapseSnapshotRef.current;
      searchCollapseSnapshotRef.current = null;
      setGroups((current) => current.map((group) => ({
        ...group,
        collapsed: saved.get(group.id) ?? group.collapsed,
      })));
    }
  }, [groups, queryActive, visibleRows]);

  return (
    <section className="crm-board min-h-full min-w-max bg-[#f8fafc] p-4 text-slate-700 sm:p-6">
      <SamplesToolbar
        toolbarFiltersRef={toolbarFiltersRef}
        onNewRecord={() => setShowCreator(true)}
        searchTerm={searchTerm}
        showSearch={showSearch}
        showSearchColumns={showSearchColumns}
        searchAllColumns={searchAllColumns}
        searchColumns={searchColumns}
        searchColumnQuery={searchColumnQuery}
        searchColumnsConfig={searchColumnsConfig}
        selectedSearchColumnCount={selectedSearchColumnCount}
        onShowSearchChange={setShowSearch}
        onSearchTermChange={setSearchTerm}
        onShowSearchColumnsChange={setShowSearchColumns}
        onSearchAllColumnsChange={setSearchAllColumns}
        onSearchColumnsChange={setSearchColumns}
        onSearchColumnQueryChange={setSearchColumnQuery}
        showFilter={showFilter}
        activeFilterCount={activeAdvancedRules.length}
        onShowFilterChange={setShowFilter}
        advancedRules={advancedRules}
        advancedJoin={advancedJoin}
        onAdvancedRulesChange={setAdvancedRules}
        onAdvancedJoinChange={setAdvancedJoin}
      />
      {loading ? (
        <LoadingState />
      ) : (
        <div className="space-y-3">
          {visibleGroups.map((group) => (
            <SamplesGroup
              key={group.id}
              group={group}
              rows={visibleRows.filter((row) => row.group_id === group.id)}
              focusedRecordId={focusedRecordId}
              grid={gridForWidths(columnWidths)}
              onResizeColumn={resizeColumn}
              profiles={profiles}
              labelOptions={labelOptions}
              canDeleteLabels={canDeleteLabels}
              onManageLabel={manageLabel}
              onUpdate={updateRecord}
              onLinkClient={setLinkingClientRow}
              onUpdateStatus={updateStatus}
              onEditItems={setItemsEditorRow}
              onOpenActivity={openActivity}
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
          {queryActive && visibleGroups.length === 0 && (
            <div className="rounded border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-500">
              No Samples Sent records match the current search or filter.
            </div>
          )}
          {canManageGroups && (
            <button
              type="button"
              onClick={() => setShowAddGroup(true)}
              className="inline-flex h-8 items-center gap-1 rounded border border-[#83cbd8] bg-white px-2.5 text-[12px] text-[#237c8b]"
            >
              <Plus size={14} /> Add group
            </button>
          )}
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
      <LinkSampleClientDialog
        row={linkingClientRow}
        onOpenChange={(open) => !open && setLinkingClientRow(null)}
        onLink={(clientId) => {
          if (linkingClientRow) void updateRecord(linkingClientRow.id, { clientId });
          setLinkingClientRow(null);
        }}
      />
      {activityRecord && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4" onMouseDown={() => setActivityRecord(null)}><div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="text-lg font-semibold">Samples Sent Activity Log</h2><p className="text-sm text-slate-500">Reference ID: {activityRecord.referenceId}</p></div><button type="button" onClick={() => setActivityRecord(null)}><X size={20} /></button></div><div className="max-h-[65vh] overflow-y-auto p-5">{activityLoading ? <p className="text-sm text-slate-500">Loading activity history…</p> : !activityRows.length ? <p className="text-sm text-slate-500">No activity recorded yet.</p> : <div className="space-y-3">{activityRows.map((entry) => <div key={entry.id} className="rounded-lg border p-3"><div className="flex justify-between gap-4"><p className="font-medium text-slate-800">{entry.title}</p><time className="shrink-0 text-xs text-slate-500">{new Date(entry.created_at).toLocaleString("en-SG")}</time></div><p className="mt-1 text-xs text-slate-500">{entry.actor_name}</p></div>)}</div>}</div></div></div>}
    </section>
  );
}

function SamplesToolbar({
  toolbarFiltersRef,
  onNewRecord,
  searchTerm,
  showSearch,
  showSearchColumns,
  searchAllColumns,
  searchColumns,
  searchColumnQuery,
  searchColumnsConfig,
  selectedSearchColumnCount,
  onShowSearchChange,
  onSearchTermChange,
  onShowSearchColumnsChange,
  onSearchAllColumnsChange,
  onSearchColumnsChange,
  onSearchColumnQueryChange,
  showFilter,
  activeFilterCount,
  onShowFilterChange,
  advancedRules,
  advancedJoin,
  onAdvancedRulesChange,
  onAdvancedJoinChange,
}: {
  toolbarFiltersRef: RefObject<HTMLDivElement>;
  onNewRecord: () => void;
  searchTerm: string;
  showSearch: boolean;
  showSearchColumns: boolean;
  searchAllColumns: boolean;
  searchColumns: Set<string>;
  searchColumnQuery: string;
  searchColumnsConfig: AdvancedFilterColumn[];
  selectedSearchColumnCount: number;
  onShowSearchChange: (show: boolean) => void;
  onSearchTermChange: (value: string) => void;
  onShowSearchColumnsChange: (show: boolean) => void;
  onSearchAllColumnsChange: (selected: boolean) => void;
  onSearchColumnsChange: (columns: Set<string>) => void;
  onSearchColumnQueryChange: (value: string) => void;
  showFilter: boolean;
  activeFilterCount: number;
  onShowFilterChange: (show: boolean) => void;
  advancedRules: AdvancedFilterRule[];
  advancedJoin: "and" | "or";
  onAdvancedRulesChange: (rules: AdvancedFilterRule[]) => void;
  onAdvancedJoinChange: (join: "and" | "or") => void;
}) {
  const displayedColumns = searchColumnsConfig.filter((column) =>
    `${column.label} ${column.category}`.toLowerCase().includes(searchColumnQuery.toLowerCase()),
  );
  return (
    <div ref={toolbarFiltersRef} className="relative z-30 mb-4 flex items-center gap-2">
      <h1 className="text-xl text-slate-800">Samples Sent</h1>
      <button
        type="button"
        onClick={onNewRecord}
        className="inline-flex h-8 items-center gap-1 rounded bg-[#1595ae] px-2.5 text-[12px] font-medium text-white"
      >
        <Plus size={14} /> New Samples Sent record
      </button>
      <div className="relative">
        {showSearch || searchTerm ? (
          <div className="flex h-8 w-72 items-center rounded border border-sky-500 bg-white">
            <Search size={16} className="ml-2 shrink-0 text-slate-500" />
            <input
              autoFocus
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder="Search this board"
              className="min-w-0 flex-1 px-2 text-sm outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => onSearchTermChange("")}
                className="px-1 text-slate-400 hover:text-slate-700"
                aria-label="Clear Samples Sent search"
              >
                <X size={15} />
              </button>
            )}
            <span
              className="ml-0.5 inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600"
              title={`${selectedSearchColumnCount} search ${selectedSearchColumnCount === 1 ? "column" : "columns"} selected`}
            >
              {selectedSearchColumnCount}
            </span>
            <button
              type="button"
              onClick={() => onShowSearchColumnsChange(!showSearchColumns)}
              className="mr-1 rounded p-1 text-slate-500 hover:bg-slate-100"
              title="Search options"
            >
              <SlidersHorizontal size={15} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onShowSearchChange(true)}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            <Search size={16} /> Search
          </button>
        )}
        {showSearchColumns && (
          <div className="absolute left-0 top-full z-[100] mt-1 w-[min(720px,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
            <div className="mb-2 text-sm font-medium text-slate-700">Choose columns to search</div>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchColumnQuery}
                onChange={(event) => onSearchColumnQueryChange(event.target.value)}
                placeholder="Find a column"
                className="h-8 w-full rounded border border-slate-300 pl-7 pr-2 text-sm outline-none focus:border-sky-400"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 border-b border-slate-100 py-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={searchAllColumns}
                onChange={(event) => {
                  onSearchAllColumnsChange(event.target.checked);
                  if (event.target.checked) onSearchColumnsChange(new Set());
                }}
                className="h-4 w-4 accent-[#0f8da8]"
              />
              All columns
            </label>
            <div className="grid max-h-[min(68vh,680px)] grid-cols-1 gap-x-3 overflow-y-auto pt-2 sm:grid-cols-2">
              {displayedColumns.map((column) => (
                <label
                  key={column.key}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={searchAllColumns || searchColumns.has(column.key)}
                    onChange={(event) => {
                      const next = searchAllColumns
                        ? new Set(searchColumnsConfig.map((entry) => entry.key))
                        : new Set(searchColumns);
                      if (event.target.checked) next.add(column.key);
                      else next.delete(column.key);
                      onSearchAllColumnsChange(false);
                      onSearchColumnsChange(next);
                    }}
                    className="h-4 w-4 accent-[#0f8da8]"
                  />
                  <span className="truncate">{column.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => onShowFilterChange(!showFilter)}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${showFilter || activeFilterCount ? "bg-[#dff5f7] text-slate-700" : "text-slate-700 hover:bg-slate-100"}`}
        >
          <Filter size={16} /> Filter
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-sky-100 px-1.5 text-[11px] text-sky-700">{activeFilterCount}</span>
          )}
        </button>
        {showFilter && (
          <div className="absolute left-0 top-full z-[100] mt-1">
            <AdvancedFilters
              columns={searchColumnsConfig}
              rules={advancedRules}
              join={advancedJoin}
              onRulesChange={onAdvancedRulesChange}
              onJoinChange={onAdvancedJoinChange}
              onClear={() => onAdvancedRulesChange([{ id: crypto.randomUUID(), column: "", condition: "", value: "" }])}
            />
          </div>
        )}
      </div>
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
  onLinkClient,
  onUpdateStatus,
  onEditItems,
  onOpenActivity,
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
  onLinkClient: (row: SampleRow) => void;
  onUpdateStatus: (row: SampleRow, optionId: string) => void;
  onEditItems: (row: SampleRow) => void;
  onOpenActivity: (row: SampleRow) => void;
  canManage: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <section className="relative min-w-max overflow-visible border-y border-[#d0d4e4] bg-white">
      <div
        className={`flex border-l-4 ${group.collapsed ? "min-h-[60px] items-start py-1" : "h-[34px] items-center"}`}
        style={{ borderLeftColor: group.color }}
      >
        <button
          type="button"
          onClick={onToggle}
          className={`flex flex-1 gap-1.5 px-3 text-left ${group.collapsed ? "items-start" : "items-center"}`}
        >
          {group.collapsed ? (
            <ChevronRight size={15} style={{ color: group.color }} />
          ) : (
            <ChevronDown size={15} style={{ color: group.color }} />
          )}
          <span className={group.collapsed ? "flex flex-col" : "flex items-center gap-2"}>
            <span className="crm-group-name" style={{ color: group.color }}>{group.name}</span>
            <span className="text-[13px] text-slate-400">{rows.length} sample record{rows.length === 1 ? "" : "s"}</span>
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
              groupName={group.name}
              focused={row.id === focusedRecordId}
              grid={grid}
              profiles={profiles}
              labelOptions={labelOptions}
              canDeleteLabels={canDeleteLabels}
              onManageLabel={onManageLabel}
              onUpdate={onUpdate}
              onLinkClient={onLinkClient}
              onUpdateStatus={onUpdateStatus}
              onEditItems={onEditItems}
              onOpenActivity={onOpenActivity}
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
  groupName,
  focused = false,
  grid,
  profiles,
  labelOptions,
  canDeleteLabels,
  onManageLabel,
  onUpdate,
  onLinkClient,
  onUpdateStatus,
  onEditItems,
  onOpenActivity,
}: {
  row: SampleRow;
  groupName: string;
  focused?: boolean;
  grid: string;
  profiles: Profile[];
  labelOptions: Record<string, BadgeOption[]>;
  canDeleteLabels: boolean;
  onManageLabel: (code: string, action: "add" | "rename" | "color" | "delete" | "reorder", payload: Record<string, unknown>) => Promise<void>;
  onUpdate: (id: string, values: Record<string, unknown>) => void;
  onLinkClient: (row: SampleRow) => void;
  onUpdateStatus: (row: SampleRow, optionId: string) => void;
  onEditItems: (row: SampleRow) => void;
  onOpenActivity: (row: SampleRow) => void;
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
        row.linkedClient ? (
          <span className="truncate">
            {row.linkedClient.name}{" "}
            <small className="text-slate-400">{row.linkedClient.display_id}</small>
          </span>
        ) : (
          <div className="flex w-full min-w-0 items-center justify-between gap-2">
            <span className="truncate" title={row.legacyClientName}>
              {row.legacyClientName || "Unlinked migration record"}
            </span>
            <button
              type="button"
              onClick={() => onLinkClient(row)}
              className="inline-flex shrink-0 items-center gap-1 text-sky-700 hover:text-sky-900"
            >
              <Link2 size={13} /> Link to client
            </button>
          </div>
        ),
      )}
      {cell("people", <AssigneeMultiSelect
        profiles={profiles}
        selectedIds={row.people.map((person) => person.id)}
        onChange={(peopleIds) => onUpdate(row.id, { peopleIds })}
      />, "justify-center")}
      {cell("reference", <span className="w-full text-center">{row.referenceId}</span>, "justify-center")}
      {cell("mobile", <span className="w-full truncate text-center" title={row.linkedClient?.phone ?? row.legacyMobile}>
        {row.linkedClient?.phone || row.legacyMobile}
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
      {cell("mondayItemsSent", <EditableCell
        value={row.mondayItemsSent}
        onChange={(mondayItemsSent) => onUpdate(row.id, { mondayItemsSent })}
        multiline
        resizableMultiline
        className="!justify-start"
      />)}
      {cell("extend", <ExtendButton row={row} onUpdate={onUpdate} />, "justify-center")}
      {cell("returned", <ReturnedButton
        row={row}
        groupName={groupName}
        options={labelOptions.samples_sent_status ?? []}
        onUpdateStatus={onUpdateStatus}
      />, "justify-center")}
      {cell("dateReturned", <InlineDatePicker value={row.date_returned ?? ""} onChange={(dateReturned) => onUpdate(row.id, { dateReturned })} label="Date Returned" />)}
      {cell(
        "creation",
        <span title={creationTitle} className="flex items-center gap-1">
          <button type="button" onClick={() => onOpenActivity(row)} title="View Samples Sent activity log" className="text-slate-500 hover:text-sky-700"><History size={15} /></button>
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
  groupName,
  options,
  onUpdateStatus,
}: {
  row: SampleRow;
  groupName: string;
  options: BadgeOption[];
  onUpdateStatus: (row: SampleRow, optionId: string) => void;
}) {
  const returnedOption = options.find(
    (option) => option.systemKey === "samples_sent_status_returned",
  );
  const isAlreadyReturned = row.status_option_id === returnedOption?.id
    && groupName === "Returned";
  return (
    <button
      type="button"
      disabled={!returnedOption || isAlreadyReturned}
      title={isAlreadyReturned ? "This sample is already Returned" : returnedOption ? "Mark this sample as Returned" : "Returned label is not configured"}
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

function LinkSampleClientDialog({
  row,
  onOpenChange,
  onLink,
}: {
  row: SampleRow | null;
  onOpenChange: (open: boolean) => void;
  onLink: (clientId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!row) return;
    setQuery(row.legacyClientName || row.legacyMobile || "");
  }, [row]);

  useEffect(() => {
    if (!row) return;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void fetchHydratedClientGroupPage(null, 0, 30, {
        search: query.trim() || undefined,
        sortCategory: "client",
        sortColumn: "dateCreated",
        sortValueType: "date",
        sortDirection: "desc",
      })
        .then((page) => setClients(page.clients))
        .catch(() => setClients([]))
        .finally(() => setLoading(false));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query, row]);

  if (!row) return null;
  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Link Samples Sent record to a client</AlertDialogTitle>
          <AlertDialogDescription>
            The migrated name and Mobile remain available here to help identify the CRM client. Once linked, the CRM Mobile value becomes the managed value.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-1 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <span><b>Migrated name:</b> {row.legacyClientName || "—"}</span>
          <span><b>Migrated Mobile:</b> {row.legacyMobile || "—"}</span>
        </div>
        <label className="relative block">
          <Search className="absolute left-2 top-2.5 text-slate-400" size={16} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search CRM clients"
            className="h-10 w-full rounded border border-slate-300 pl-8 pr-2 text-sm"
          />
        </label>
        <div className="max-h-[46vh] overflow-y-auto rounded border border-slate-200">
          {loading ? (
            <div className="p-4 text-center text-sm text-slate-500">Searching clients…</div>
          ) : clients.length ? clients.map((client) => (
            <button
              key={client.id}
              type="button"
              onClick={() => onLink(client.id)}
              className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-sky-50"
            >
              <span className="min-w-0 truncate">{client.name || "Unnamed client"}</span>
              <span className="ml-3 shrink-0 text-slate-500">{client.displayId} · {client.phone || "No phone"}</span>
            </button>
          )) : (
            <div className="p-4 text-center text-sm text-slate-500">No CRM clients found.</div>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PhotoUploadBlock({
  files,
  clientId,
  uploadPath,
  onChange,
}: {
  files: StoredCrmFile[];
  clientId: string;
  uploadPath: string;
  onChange: (files: StoredCrmFile[]) => void;
}) {
  const upload = async (incoming: File[]) => {
    if (!incoming.length) return;
    try {
      const uploaded = await uploadCrmFiles(incoming, uploadPath, { clientId });
      onChange([...files, ...uploaded]);
    } catch (error) {
      toast.error("Photo could not be uploaded", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 text-sm font-medium text-slate-700">Photo</div>
      <FileDropTarget onFiles={upload} className="min-h-24 w-full">
        <label className="flex min-h-24 w-full cursor-pointer items-center justify-center gap-2 rounded border border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-500">
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
          {files.length ? (
            <span className="flex flex-wrap items-center justify-center gap-2">
              {files.map((file) => (
                <span key={file.storagePath} className="group relative">
                  <FilePreview url={file.url} name={file.name} mimeType={file.mimeType} />
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onChange(files.filter((entry) => entry.storagePath !== file.storagePath));
                    }}
                    className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-red-500 p-0 text-[10px] leading-none text-white group-hover:flex"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </span>
          ) : (
            <>
              <FileImage size={18} className="text-slate-400" />
              <span>Drop photos here or click to upload</span>
            </>
          )}
        </label>
      </FileDropTarget>
    </div>
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
      const uploaded = await Promise.all(files.map(async (file) => {
        const formData = new FormData();
        formData.set("recordId", row.id);
        formData.set("file", file);
        const response = await fetch("/api/samples-sent/upload-photo", { method: "POST", body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result?.error || `Could not upload ${file.name}`);
        return result.file as StoredCrmFile;
      }));
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
  const [returnBy, setReturnBy] = useState(() => dateAfterDays(10));
  const [cost, setCost] = useState("");
  const [remarks, setRemarks] = useState("");
  const [items, setItems] = useState<Item[]>([newItem()]);
  const [photoFiles, setPhotoFiles] = useState<StoredCrmFile[]>([]);
  const photoUploadIdRef = useRef("");
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
    setReturnBy(dateAfterDays(10));
    setCost("");
    setRemarks("");
    setItems([newItem()]);
    setPhotoFiles([]);
    photoUploadIdRef.current = crypto.randomUUID();
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
          photoFiles,
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
              <PhotoUploadBlock
                files={photoFiles}
                clientId={client.id}
                uploadPath={`samples-sent/drafts/${photoUploadIdRef.current}/photos`}
                onChange={setPhotoFiles}
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
          Address*
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
      onCreated({ ...data.group, collapsed: true });
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
