"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type {
  Client,
  ClientAssigneeMap,
  Subitem,
  SubitemAssigneeMap,
  Profile,
  Notification,
  SearchResult,
  CRMGroup,
} from "../../types";
import {
  fetchClientGroupPage,
  fetchClientGroupCounts,
  fetchCrmBoardQuickFilterCounts,
  fetchGanttResourcePage,
  fetchInitialCrmClientBundle,
  fetchHydratedClientBundle,
  searchCrmClients,
  type CrmBoardQuery,
  type CrmQuickFilterCounts,
  type GanttResourceCursor,
  type GanttServerQuery,
  updateSubitemRow,
} from "@/lib/crm";
import { toast } from "sonner";
import { CRMBoard } from "@/components/CRMBoard";
import Sidebar, { type SidePanel } from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import type { User } from "@supabase/supabase-js";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { ReportsPanel } from "@/components/ReportsPanel";
import { RoundRobinAdminPanel } from "@/components/RoundRobinPanel";
import GanttChart from "@/components/Gantt-Chart";
import { TeamPanel } from "@/components/TeamPanel";
import { UserAdminPanel } from "@/components/UserAdminPanel";
import { CustomerProfilesPanel } from "@/components/CustomerProfilesPanel";
import { SupplierProfilesPanel } from "@/components/SupplierProfilesPanel";
import { AdditionalCostsBoard } from "@/components/AdditionalCostsBoard";
import { EmailReviewPanel } from "@/components/EmailReviewPanel";
import { WorkingCalendarPanel } from "@/components/WorkingCalendarPanel";
import { AppLiveRefresh } from "@/components/AppLiveRefresh";
import {
  boardProtectionDelay,
  getBoardWriteRevision,
  isBoardRecordProtected,
} from "@/lib/board-write-coordinator";

const PANEL_IDS: SidePanel[] = [
  "crm",
  "additionalcosts",
  "emails",
  "emailreview",
  "reports",
  "ganttchart",
  "calendar",
  "roundrobin",
  "team",
  "customerprofiles",
  "supplierprofiles",
  "useradmin",
];

type GroupPageState = Record<
  string,
  {
    total: number;
    hasMore: boolean;
    loading: boolean;
    loaded: boolean;
    // This intentionally counts only rows received through the paged RPC.
    // A client injected for universal-search navigation must not advance the
    // next offset and cause a normal row to be skipped.
    loadedCount: number;
  }
>;

type BoardQuerySnapshot = {
  clients: Client[];
  groupPageState: GroupPageState;
  quickFilterCounts: CrmQuickFilterCounts;
  cachedAt: number;
};

const BOARD_QUERY_CACHE_TTL_MS = 2 * 60 * 1000;
const BOARD_QUERY_CACHE_LIMIT = 12;
const QUICK_FILTER_COUNTS_CACHE_TTL_MS = 60 * 1000;
const EMPTY_GANTT_QUERY: GanttServerQuery = {
  search: "",
  searchScope: "all",
  groupIds: [],
  clientIds: [],
  pmIds: [],
  peopleIds: [],
  processStatuses: [],
  dateFrom: "",
  dateTo: "",
};

type QuickFilterCountsCache = {
  data: CrmQuickFilterCounts;
  cachedAt: number;
};

type ReloadClientsOptions = {
  preservePagination?: boolean;
};

type SearchViewportAnchor = {
  clientId: string;
  top: number;
  scrollTop: number;
};

function panelFromSearchParam(value: string | null): SidePanel | null {
  return PANEL_IDS.includes(value as SidePanel) ? (value as SidePanel) : null;
}

function canViewPanel(panel: SidePanel, role: string | null) {
  const normalizedRole = String(role ?? "").toLowerCase();
  if (panel === "calendar") {
    return ["admin", "director", "dev"].includes(normalizedRole);
  }
  if (panel === "useradmin") {
    return ["director", "dev"].includes(normalizedRole);
  }
  return true;
}

export default function Page() {
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  // The CRM Board intentionally retains only its loaded pages. The Gantt
  // chart, however, must be able to draw every timeline in its visible
  // groups, so it owns a separate, panel-scoped hydrated snapshot.
  const [ganttClients, setGanttClients] = useState<Client[]>([]);
  const [ganttClientAssignees, setGanttClientAssignees] =
    useState<ClientAssigneeMap>({});
  const [ganttClientPmAssignees, setGanttClientPmAssignees] =
    useState<ClientAssigneeMap>({});
  const [ganttSubitemAssignees, setGanttSubitemAssignees] =
    useState<SubitemAssigneeMap>({});
  const [ganttClientsLoading, setGanttClientsLoading] = useState(false);
  const [ganttResourcesLoadingMore, setGanttResourcesLoadingMore] =
    useState(false);
  const [ganttResourceIds, setGanttResourceIds] = useState<string[]>([]);
  const [ganttResourceTotal, setGanttResourceTotal] = useState(0);
  const [ganttHasMoreResources, setGanttHasMoreResources] = useState(false);
  const [ganttResourceCursor, setGanttResourceCursor] =
    useState<GanttResourceCursor | null>(null);
  const [ganttQuery, setGanttQuery] = useState<GanttServerQuery>(
    EMPTY_GANTT_QUERY,
  );
  const [ganttLoadedQueryKey, setGanttLoadedQueryKey] = useState("");
  const [search, setSearch] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  const [hasLoadedInitialClients, setHasLoadedInitialClients] =
    useState(false);
  const [boardQuery, setBoardQuery] = useState<CrmBoardQuery>({});
  const [groupPageState, setGroupPageState] = useState<GroupPageState>({});
  const [quickFilterCounts, setQuickFilterCounts] =
    useState<CrmQuickFilterCounts>({});
  const [quickFilterCountsLoading, setQuickFilterCountsLoading] =
    useState(false);
  const [activePanel, setActivePanel] = useState<SidePanel>("crm");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedClientIds, setExpandedClientIds] = useState<string[]>([]);
  const [clientAssignees, setClientAssignees] = useState<ClientAssigneeMap>({});
  const [clientPmAssignees, setClientPmAssignees] = useState<ClientAssigneeMap>(
    {},
  );
  const [subitemAssignees, setSubitemAssignees] = useState<SubitemAssigneeMap>(
    {},
  );
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [groups, setGroups] = useState<CRMGroup[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [searchTarget, setSearchTarget] = useState<SearchResult | null>(null);
  const [crmMetadataVersion, setCrmMetadataVersion] = useState(0);
  const [labelOptionsVersion, setLabelOptionsVersion] = useState(0);
  const [groupVersion, setGroupVersion] = useState(0);
  const [roundRobinVersion, setRoundRobinVersion] = useState(0);
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const searchViewportAnchorClientIdRef = useRef<string | null>(null);
  const reconciliationTimer = useRef<number | null>(null);
  const recordsRefreshSequence = useRef(0);
  const ganttRefreshSequence = useRef(0);
  const ganttPageLoadInFlightRef = useRef(false);
  const boardQueryKeyRef = useRef(JSON.stringify({}));
  // The requested query can change while rows from the previous query remain
  // visible. Track their ownership separately so an in-flight transition can
  // never cache those rows under the newly requested filter key.
  const displayedBoardQueryKeyRef = useRef(JSON.stringify({}));
  const boardQueryCacheRef = useRef(new Map<string, BoardQuerySnapshot>());
  const skipBoardReloadForQueryKeyRef = useRef<string | null>(null);
  // Quick-filter totals deliberately describe the whole board, not the
  // current query. Keep their cache independent from the per-query board
  // snapshots so changing a filter neither clears nor re-fetches them.
  const quickFilterCountsCacheRef = useRef<QuickFilterCountsCache | null>(null);
  const quickFilterCountsRequestRef = useRef<Promise<CrmQuickFilterCounts> | null>(
    null,
  );

  const captureSearchViewportAnchor = useCallback((): SearchViewportAnchor | null => {
    const clientId = searchViewportAnchorClientIdRef.current;
    const scrollContainer = mainScrollRef.current;
    if (!clientId || !scrollContainer) return null;

    const target = document.querySelector<HTMLElement>(
      `[data-client-id="${clientId}"]`,
    );
    if (!target) return null;

    const targetRect = target.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    // Do not pull a user back to a result they deliberately scrolled away
    // from. Anchoring is only active while the result remains on screen.
    if (
      targetRect.bottom <= containerRect.top ||
      targetRect.top >= containerRect.bottom
    ) {
      return null;
    }

    return {
      clientId,
      top: targetRect.top,
      scrollTop: scrollContainer.scrollTop,
    };
  }, []);

  const restoreSearchViewportAnchor = useCallback(
    (anchor: SearchViewportAnchor | null) => {
      if (!anchor) return;
      window.requestAnimationFrame(() => {
        const scrollContainer = mainScrollRef.current;
        if (
          !scrollContainer ||
          searchViewportAnchorClientIdRef.current !== anchor.clientId ||
          // A user scroll during the render window always wins over automatic
          // viewport compensation.
          Math.abs(scrollContainer.scrollTop - anchor.scrollTop) > 2
        ) {
          return;
        }
        const target = document.querySelector<HTMLElement>(
          `[data-client-id="${anchor.clientId}"]`,
        );
        if (!target) return;
        const displacement = target.getBoundingClientRect().top - anchor.top;
        if (Math.abs(displacement) > 0.5) {
          scrollContainer.scrollTop += displacement;
        }
      });
    },
    [],
  );

  const cacheBoardQuerySnapshot = useCallback(
    (queryKey: string, snapshot: Omit<BoardQuerySnapshot, "cachedAt">) => {
      const cache = boardQueryCacheRef.current;
      const settledGroupPageState = Object.fromEntries(
        Object.entries(snapshot.groupPageState).map(([groupId, state]) => [
          groupId,
          { ...state, loading: false },
        ]),
      );
      cache.delete(queryKey);
      cache.set(queryKey, {
        ...snapshot,
        groupPageState: settledGroupPageState,
        cachedAt: Date.now(),
      });
      while (cache.size > BOARD_QUERY_CACHE_LIMIT) {
        const oldestKey = cache.keys().next().value as string | undefined;
        if (!oldestKey) break;
        cache.delete(oldestKey);
      }
    },
    [],
  );

  const pushAppUrl = useCallback((params: URLSearchParams) => {
    const query = params.toString();
    window.history.pushState(null, "", query ? `/app?${query}` : "/app");
  }, []);

  const replaceAppUrl = useCallback((params: URLSearchParams) => {
    const query = params.toString();
    window.history.replaceState(null, "", query ? `/app?${query}` : "/app");
  }, []);

  const customerProfileTarget = useMemo<{
    type: "client" | "company";
    id: string;
  } | null>(() => {
    if (searchParams.get("panel") !== "customerprofiles") return null;
    const type = searchParams.get("profileType");
    const id = searchParams.get("profile");
    if ((type !== "client" && type !== "company") || !id) return null;
    return { type, id };
  }, [searchParams]);

  const supplierProfileId = useMemo(() => {
    if (searchParams.get("panel") !== "supplierprofiles") return null;
    return searchParams.get("supplier");
  }, [searchParams]);

  const crmDetailTarget = useMemo(() => {
    if (searchParams.get("panel") !== "crm") return null;
    const clientId = searchParams.get("client");
    const view = searchParams.get("view");
    if (!clientId || (view !== "client" && view !== "subitem")) return null;
    const subitemId = searchParams.get("subitem");
    if (view === "subitem" && !subitemId) return null;
    return view === "subitem"
      ? { clientId, subitemId: subitemId! }
      : { clientId };
  }, [searchParams]);

  const changePanel = useCallback(
    (panel: SidePanel) => {
      if (!canViewPanel(panel, currentUserRole)) return;

      setActivePanel(panel);
      const nextParams = new URLSearchParams(window.location.search);
      [
        "client",
        "subitem",
        "view",
        "profileType",
        "profile",
        "supplier",
      ].forEach((key) => nextParams.delete(key));
      nextParams.set("panel", panel);
      if (nextParams.toString() === window.location.search.slice(1)) return;
      pushAppUrl(nextParams);
    },
    [currentUserRole, pushAppUrl],
  );

  useEffect(() => {
    const requestedPanel = panelFromSearchParam(searchParams.get("panel"));
    const nextPanel = requestedPanel ?? "crm";

    // Wait for the role lookup before rejecting a restricted panel URL.
    if (!roleLoaded) {
      setActivePanel(nextPanel);
      return;
    }

    if (requestedPanel && canViewPanel(requestedPanel, currentUserRole)) {
      setActivePanel(requestedPanel);
      return;
    }

    setActivePanel("crm");
    if (requestedPanel) {
      const nextParams = new URLSearchParams(window.location.search);
      nextParams.set("panel", "crm");
      replaceAppUrl(nextParams);
    }
  }, [currentUserRole, replaceAppUrl, roleLoaded, searchParams]);

  const openCustomerProfile = useCallback(
    (type: "client" | "company", id: string) => {
      setActivePanel("customerprofiles");
      const nextParams = new URLSearchParams(window.location.search);
      nextParams.set("panel", "customerprofiles");
      nextParams.delete("client");
      nextParams.delete("subitem");
      nextParams.delete("supplier");
      nextParams.delete("view");
      nextParams.set("profileType", type);
      nextParams.set("profile", id);
      pushAppUrl(nextParams);
    },
    [pushAppUrl],
  );

  const updateCustomerProfileLink = useCallback(
    (target: { type: "client" | "company"; id: string } | null) => {
      const currentParams = new URLSearchParams(window.location.search);
      const currentType = currentParams.get("profileType");
      const currentId = currentParams.get("profile");
      if (
        (target === null && !currentType && !currentId) ||
        (target?.type === currentType && target.id === currentId)
      ) {
        return;
      }

      const nextParams = new URLSearchParams(window.location.search);
      nextParams.set("panel", "customerprofiles");
      if (target) {
        nextParams.set("profileType", target.type);
        nextParams.set("profile", target.id);
      } else {
        nextParams.delete("profileType");
        nextParams.delete("profile");
      }
      pushAppUrl(nextParams);
    },
    [pushAppUrl],
  );

  const updateSupplierProfileLink = useCallback(
    (supplierId: string | null) => {
      const currentSupplierId = new URLSearchParams(window.location.search).get(
        "supplier",
      );
      if (supplierId === currentSupplierId) return;

      const nextParams = new URLSearchParams(window.location.search);
      nextParams.set("panel", "supplierprofiles");
      nextParams.delete("client");
      nextParams.delete("subitem");
      nextParams.delete("view");
      nextParams.delete("profileType");
      nextParams.delete("profile");
      if (supplierId) nextParams.set("supplier", supplierId);
      else nextParams.delete("supplier");
      pushAppUrl(nextParams);
    },
    [pushAppUrl],
  );

  const openCrmRecord = useCallback(
    (clientId: string, subitemId?: string) => {
      setActivePanel("crm");
      const nextParams = new URLSearchParams(window.location.search);
      nextParams.set("panel", "crm");
      nextParams.set("client", clientId);
      if (subitemId) nextParams.set("subitem", subitemId);
      else nextParams.delete("subitem");
      nextParams.delete("view");
      nextParams.delete("profileType");
      nextParams.delete("profile");
      nextParams.delete("supplier");
      pushAppUrl(nextParams);
    },
    [pushAppUrl],
  );

  const updateCrmDetailLink = useCallback(
    (target: { clientId: string; subitemId?: string } | null) => {
      const currentParams = new URLSearchParams(window.location.search);
      const currentView = currentParams.get("view");
      const currentClientId = currentParams.get("client");
      const currentSubitemId = currentParams.get("subitem");
      const nextView = target?.subitemId ? "subitem" : target ? "client" : null;
      if (
        currentView === nextView &&
        currentClientId === (target?.clientId ?? null) &&
        currentSubitemId === (target?.subitemId ?? null)
      ) {
        return;
      }

      const nextParams = new URLSearchParams(window.location.search);
      nextParams.set("panel", "crm");
      nextParams.delete("profileType");
      nextParams.delete("profile");
      nextParams.delete("supplier");
      if (target) {
        nextParams.set("client", target.clientId);
        if (target.subitemId) nextParams.set("subitem", target.subitemId);
        else nextParams.delete("subitem");
        nextParams.set("view", nextView!);
      } else {
        nextParams.delete("client");
        nextParams.delete("subitem");
        nextParams.delete("view");
      }
      pushAppUrl(nextParams);
    },
    [pushAppUrl],
  );

  const selectSearchResult = useCallback(
    async (result: SearchResult) => {
      // currently setting to CRM panel since only CRM panel has search results, change in the future when other panels have search results
      // Retain this independently from the brief highlight state. It lets
      // paged rows insert in their real order without moving a visible search
      // result out from under a person who is editing it.
      searchViewportAnchorClientIdRef.current = result.clientId;
      openCrmRecord(result.clientId, result.subitemId);
      let client = clients.find((item) => item.id === result.clientId);
      if (!client) {
        try {
          const hydration = await fetchHydratedClientBundle([result.clientId]);
          const [hydratedClient] = hydration.clients;
          if (hydratedClient) {
            client = hydratedClient;
            setClients((current) =>
              current.some((item) => item.id === hydratedClient.id)
                ? current
                : [...current, hydratedClient],
            );
            setClientAssignees((current) => ({
              ...current,
              ...hydration.clientAssignees,
            }));
            setClientPmAssignees((current) => ({
              ...current,
              ...hydration.clientPmAssignees,
            }));
            setSubitemAssignees((current) => ({
              ...current,
              ...hydration.subitemAssignees,
            }));
          }
        } catch (error) {
          console.error("Failed to load universal-search result", error);
          toast.error("Could not load the selected search result");
          return;
        }
      }
      if (
        client &&
        result.subitemId &&
        !expandedClientIds.includes(client.id)
      ) {
        setExpandedClientIds((previous) => [...previous, client.id]);
      }
      setSearchTarget(result);
    },
    [clients, expandedClientIds, openCrmRecord],
  );

  const searchAllCrmRecords = useCallback(
    (query: string) => searchCrmClients(query),
    [],
  );

  const openGanttClientTimeline = useCallback(
    (clientId: string, subitemId?: string) => {
      openCrmRecord(clientId, subitemId);
      setExpandedClientIds((current) =>
        current.includes(clientId) ? current : [...current, clientId],
      );
      const ganttClient = ganttClients.find((client) => client.id === clientId);
      setClients((current) => {
        const source =
          current.some((client) => client.id === clientId) || !ganttClient
            ? current
            : [...current, ganttClient];
        return source.map((client) =>
          client.id !== clientId
            ? client
            : {
                ...client,
                subitems: client.subitems.map((subitem) =>
                  subitemId && subitem.id !== subitemId
                    ? subitem
                    : {
                        ...subitem,
                        showTimeline: true,
                        showPayments: false,
                        showSample: false,
                      },
                ),
              },
        );
      });
      setSearchTarget({
        id: `gantt-timeline-${clientId}-${subitemId ?? "all"}-${Date.now()}`,
        clientId,
        subitemId,
        kind: "timeline",
        label: "Timeline",
        context: "Opened from Gantt Chart",
        field: "Timeline",
        value: "",
        query: "",
      });
    },
    [ganttClients, openCrmRecord],
  );
  const canEditGanttSubitem = useCallback(
    (clientId: string, subitemId: string) => {
      if (!user?.id) return false;
      const role = String(currentUserRole ?? "").trim().toLowerCase();
      if (["admin", "director", "dev"].includes(role)) return true;
      const client = ganttClients.find((candidate) => candidate.id === clientId);
      return Boolean(
        client &&
          ((ganttClientAssignees[clientId] ?? []).includes(user.id) ||
            (ganttClientPmAssignees[clientId] ?? []).includes(user.id) ||
            (ganttSubitemAssignees[subitemId] ?? []).includes(user.id)),
      );
    },
    [
      currentUserRole,
      ganttClientAssignees,
      ganttClientPmAssignees,
      ganttClients,
      ganttSubitemAssignees,
      user?.id,
    ],
  );
  const loadGanttResourcePage = useCallback(
    async (
      query: GanttServerQuery,
      cursor: GanttResourceCursor | null = null,
      append = false,
    ) => {
      if (append && ganttPageLoadInFlightRef.current) return;
      const refreshSequence = append
        ? ganttRefreshSequence.current
        : ++ganttRefreshSequence.current;
      ganttPageLoadInFlightRef.current = true;
      if (append) setGanttResourcesLoadingMore(true);
      else setGanttClientsLoading(true);
      try {
        const page = await fetchGanttResourcePage(query, cursor, 30);
        if (refreshSequence !== ganttRefreshSequence.current) return;

        setGanttClients((current) => {
          if (!append) return page.clients;
          const next = new Map(current.map((client) => [client.id, client]));
          for (const client of page.clients) next.set(client.id, client);
          return Array.from(next.values());
        });
        setGanttResourceIds((current) =>
          append
            ? Array.from(new Set([...current, ...page.resourceIds]))
            : page.resourceIds,
        );
        setGanttResourceTotal(page.total);
        setGanttHasMoreResources(page.hasMore);
        setGanttResourceCursor(page.nextCursor);
        if (!append) setGanttLoadedQueryKey(JSON.stringify(query));
        setGanttClientAssignees((current) =>
          append ? { ...current, ...page.clientAssignees } : page.clientAssignees,
        );
        setGanttClientPmAssignees((current) =>
          append
            ? { ...current, ...page.clientPmAssignees }
            : page.clientPmAssignees,
        );
        setGanttSubitemAssignees((current) =>
          append
            ? { ...current, ...page.subitemAssignees }
            : page.subitemAssignees,
        );
      } catch (error) {
        if (refreshSequence === ganttRefreshSequence.current) {
          console.error("Failed to load Gantt chart resources", error);
          toast.error("Could not load the Gantt chart", {
            description: "Please try again.",
          });
        }
      } finally {
        if (refreshSequence === ganttRefreshSequence.current) {
          setGanttClientsLoading(false);
          setGanttResourcesLoadingMore(false);
          ganttPageLoadInFlightRef.current = false;
        }
      }
    },
    [],
  );
  const handleGanttQueryChange = useCallback(
    (query: GanttServerQuery) => {
      setGanttQuery(query);
      void loadGanttResourcePage(query);
    },
    [loadGanttResourcePage],
  );
  const loadMoreGanttResources = useCallback(() => {
    if (
      ganttClientsLoading ||
      ganttResourcesLoadingMore ||
      !ganttHasMoreResources ||
      !ganttResourceCursor
    ) {
      return;
    }
    void loadGanttResourcePage(ganttQuery, ganttResourceCursor, true);
  }, [
    ganttClientsLoading,
    ganttHasMoreResources,
    ganttQuery,
    ganttResourceCursor,
    ganttResourcesLoadingMore,
    loadGanttResourcePage,
  ]);
  const reloadGanttClients = useCallback(
    () => loadGanttResourcePage(ganttQuery),
    [ganttQuery, loadGanttResourcePage],
  );
  const openPaymentVoucherProject = useCallback(
    (clientId: string) => {
      openCrmRecord(clientId);
      setSearchTarget({
        id: `payment-voucher-project-${clientId}-${Date.now()}`,
        clientId,
        kind: "client",
        label: "Project Name",
        context: "Opened from Payment Voucher",
        field: "Project Name",
        value: "",
        query: "",
      });
    },
    [openCrmRecord],
  );

  const reloadClients = useCallback(async (options: ReloadClientsOptions = {}) => {
    const preservePagination = options.preservePagination === true;
    const refreshSequence = ++recordsRefreshSequence.current;
    const writeRevisionAtStart = getBoardWriteRevision();
    try {
      // Quick-filter badges are intentionally global reference totals. They
      // do not change with the active search/filter context.
      const cachedQuickFilterCounts = quickFilterCountsCacheRef.current;
      const hasFreshQuickFilterCounts =
        cachedQuickFilterCounts !== null &&
        Date.now() - cachedQuickFilterCounts.cachedAt <
          QUICK_FILTER_COUNTS_CACHE_TTL_MS;
      const quickFilterCountsForSnapshot = cachedQuickFilterCounts?.data ?? {};

      if (cachedQuickFilterCounts) {
        setQuickFilterCounts(cachedQuickFilterCounts.data);
      }
      // Keep existing totals visible while a background refresh is underway.
      // The indicator is only useful before the first global result exists.
      setQuickFilterCountsLoading(!cachedQuickFilterCounts);

      const quickFilterCountsPromise = hasFreshQuickFilterCounts
        ? Promise.resolve(cachedQuickFilterCounts.data)
        : (quickFilterCountsRequestRef.current ??
          (() => {
            const request = fetchCrmBoardQuickFilterCounts()
              .then((counts) => {
                quickFilterCountsCacheRef.current = {
                  data: counts,
                  cachedAt: Date.now(),
                };
                return counts;
              })
              .catch((error) => {
                console.warn("Could not load full CRM quick-filter counts", error);
                return quickFilterCountsCacheRef.current?.data ?? {};
              })
              .finally(() => {
                quickFilterCountsRequestRef.current = null;
              });
            quickFilterCountsRequestRef.current = request;
            return request;
          })());
      const [initialPage, groupCounts] = await Promise.all([
          Object.keys(boardQuery).length
            ? fetchClientGroupPage(null, 0, 30, boardQuery)
            : fetchInitialCrmClientBundle({
                limit: 30,
                excludeGroupNames: ["Failed", "Unqualified Lead", "To Delete"],
              }).then((hydration) => ({
                clients: hydration.clients,
                clientAssignees: hydration.clientAssignees,
                clientPmAssignees: hydration.clientPmAssignees,
                subitemAssignees: hydration.subitemAssignees,
              })),
          fetchClientGroupCounts(boardQuery),
        ]);
      const rows = initialPage.clients;
      const clientAssignmentMaps = {
        people: initialPage.clientAssignees,
        pm: initialPage.clientPmAssignees,
      };
      const subitemAssigneeMap = initialPage.subitemAssignees;

      // Never allow an older or edit-stale request to install its snapshot.
      // A fresh reconciliation will pick up both the latest local write and
      // any concurrent remote changes.
      if (
        refreshSequence !== recordsRefreshSequence.current ||
        writeRevisionAtStart !== getBoardWriteRevision()
      ) {
        if (refreshSequence === recordsRefreshSequence.current) {
          if (reconciliationTimer.current !== null)
            window.clearTimeout(reconciliationTimer.current);
          reconciliationTimer.current = window.setTimeout(() => {
            reconciliationTimer.current = null;
            void reloadClients({ preservePagination: true });
          }, 100);
        }
        return;
      }

      const protectionDelay = boardProtectionDelay();
      setClients((current) => {
        const currentClients = new Map(
          current.map((client) => [client.id, client]),
        );
        if (preservePagination) {
          // A live refresh should reconcile rows already on screen without
          // replacing the loaded page set. Replacing it with only the first
          // page makes every open group flash its loading state.
          const incomingClients = new Map(rows.map((client) => [client.id, client]));
          return current.map((client) => incomingClients.get(client.id) ?? client);
        }
        const incomingClientIds = new Set(rows.map((client) => client.id));
        const reconciledClients = rows.flatMap((incomingClient) => {
          const localClient = currentClients.get(incomingClient.id);
          // A stale snapshot can contain a record that was just removed from
          // local state. Do not resurrect it while its delete is settling.
          if (!localClient && isBoardRecordProtected("client", incomingClient.id)) {
            return [];
          }
          if (!localClient) return [incomingClient];

          const localSubitems = new Map(
            localClient.subitems.map((item) => [item.id, item]),
          );
          const mergedSubitems = incomingClient.subitems.flatMap(
            (incomingSubitem) => {
              if (!isBoardRecordProtected("subitem", incomingSubitem.id))
                return [incomingSubitem];
              const localSubitem = localSubitems.get(incomingSubitem.id);
              // This is the subitem equivalent of the client guard above.
              if (!localSubitem) return [];
              return [localSubitem];
            },
          );

          if (isBoardRecordProtected("client", incomingClient.id)) {
            return [{ ...localClient, subitems: mergedSubitems }];
          }
          return [{ ...incomingClient, subitems: mergedSubitems }];
        });
        // New rows can be visible locally before a fetch which started just
        // before their insert completes. Retain those protected local rows
        // until the next settled reconciliation observes them remotely.
        const protectedLocalOnly = current.filter(
          (client) =>
            !incomingClientIds.has(client.id) &&
            isBoardRecordProtected("client", client.id),
        );
        return [...reconciledClients, ...protectedLocalOnly];
      });
      setClientAssignees((current) => {
        const next = { ...current, ...clientAssignmentMaps.people };
        const loadedClientIds = new Set(rows.map((client) => client.id));
        for (const clientId of loadedClientIds) {
          if (clientAssignmentMaps.people[clientId])
            next[clientId] = clientAssignmentMaps.people[clientId];
          else delete next[clientId];
        }
        for (const [clientId, ids] of Object.entries(current)) {
          if (isBoardRecordProtected("client", clientId)) next[clientId] = ids;
        }
        return next;
      });
      setClientPmAssignees((current) => {
        const next = { ...current, ...clientAssignmentMaps.pm };
        const loadedClientIds = new Set(rows.map((client) => client.id));
        for (const clientId of loadedClientIds) {
          if (clientAssignmentMaps.pm[clientId])
            next[clientId] = clientAssignmentMaps.pm[clientId];
          else delete next[clientId];
        }
        for (const [clientId, ids] of Object.entries(current)) {
          if (isBoardRecordProtected("client", clientId)) next[clientId] = ids;
        }
        return next;
      });
      setSubitemAssignees((current) => {
        const next = { ...current, ...subitemAssigneeMap };
        const loadedSubitemIds = new Set(
          rows.flatMap((client) => client.subitems.map((subitem) => subitem.id)),
        );
        for (const subitemId of loadedSubitemIds) {
          if (subitemAssigneeMap[subitemId])
            next[subitemId] = subitemAssigneeMap[subitemId];
          else delete next[subitemId];
        }
        for (const [subitemId, ids] of Object.entries(current)) {
          if (isBoardRecordProtected("subitem", subitemId))
            next[subitemId] = ids;
        }
        return next;
      });
      const nextGroupPageState: GroupPageState = Object.fromEntries(
        Object.entries(groupCounts).map(([groupId, total]) => [
          groupId,
          {
            total,
            hasMore:
              rows.filter((client) => client.groupId === groupId).length <
              total,
            loading: false,
            loaded: false,
            loadedCount: 0,
          },
        ]),
      );
      setClientsLoaded(true);
      setHasLoadedInitialClients(true);
      if (!preservePagination) setGroupPageState(nextGroupPageState);
      const resolvedQueryKey = JSON.stringify(boardQuery);
      displayedBoardQueryKeyRef.current = resolvedQueryKey;
      if (!preservePagination) {
        cacheBoardQuerySnapshot(resolvedQueryKey, {
          clients: rows,
          groupPageState: nextGroupPageState,
          quickFilterCounts: quickFilterCountsForSnapshot,
        });
      }
      void quickFilterCountsPromise.then((nextQuickFilterCounts) => {
        if (
          refreshSequence !== recordsRefreshSequence.current ||
          displayedBoardQueryKeyRef.current !== resolvedQueryKey
        )
          return;
        setQuickFilterCounts(nextQuickFilterCounts);
        setQuickFilterCountsLoading(false);
        if (!preservePagination) {
          cacheBoardQuerySnapshot(resolvedQueryKey, {
            clients: rows,
            groupPageState: nextGroupPageState,
            quickFilterCounts: nextQuickFilterCounts,
          });
        }
      });
      // A staged company/phone confirmation deliberately holds its record
      // protection indefinitely until the user confirms or cancels. Do not
      // pass Infinity to setTimeout: browsers clamp that value and turn the
      // intended delayed reconciliation into a rapid full-refresh loop.
      if (!preservePagination && !Number.isFinite(protectionDelay)) {
        if (reconciliationTimer.current !== null) {
          window.clearTimeout(reconciliationTimer.current);
          reconciliationTimer.current = null;
        }
      } else if (!preservePagination && protectionDelay > 0) {
        if (reconciliationTimer.current !== null)
          window.clearTimeout(reconciliationTimer.current);
        reconciliationTimer.current = window.setTimeout(
          () => {
            reconciliationTimer.current = null;
            void reloadClients();
          },
          Math.max(350, protectionDelay + 100),
        );
      }
    } catch (error) {
      setQuickFilterCountsLoading(false);
      console.error("Failed to load clients", error);
    }
  }, [boardQuery, cacheBoardQuerySnapshot]);

  const refreshRecordsInPlace = useCallback(
    () => reloadClients({ preservePagination: true }),
    [reloadClients],
  );

  const handleServerQueryChange = useCallback(
    (query: CrmBoardQuery) => {
      const queryKey = JSON.stringify(query);
      if (boardQueryKeyRef.current === queryKey) return;

      if (clientsLoaded) {
        cacheBoardQuerySnapshot(displayedBoardQueryKeyRef.current, {
          clients,
          groupPageState,
          quickFilterCounts,
        });
      }

      const cached = boardQueryCacheRef.current.get(queryKey);
      const cacheIsFresh =
        cached && Date.now() - cached.cachedAt < BOARD_QUERY_CACHE_TTL_MS;
      boardQueryKeyRef.current = queryKey;
      if (cacheIsFresh) {
        skipBoardReloadForQueryKeyRef.current = queryKey;
        displayedBoardQueryKeyRef.current = queryKey;
        setClients(cached.clients);
        setGroupPageState(cached.groupPageState);
        // Per-query snapshots created before the first facet response may
        // contain an empty placeholder. Prefer the independent global cache
        // when restoring a board context so these totals never flicker to 0.
        setQuickFilterCounts(
          quickFilterCountsCacheRef.current?.data ?? cached.quickFilterCounts,
        );
        setQuickFilterCountsLoading(false);
        setClientsLoaded(true);
      } else {
        setClientsLoaded(false);
        // Keep the current snapshot visible while the first request for this
        // query runs. Clearing this state made every group count flash to zero.
      }
      setExpandedClientIds([]);
      setBoardQuery(query);
    },
    [
      cacheBoardQuerySnapshot,
      clients,
      clientsLoaded,
      groupPageState,
      quickFilterCounts,
    ],
  );

  const mergeAssignmentDataForClients = useCallback(
    (
      rows: Client[],
      assignmentMaps: {
        people: ClientAssigneeMap;
        pm: ClientAssigneeMap;
      },
      nextSubitemAssignees: SubitemAssigneeMap,
    ) => {
      setClientAssignees((current) => {
        const next = { ...current };
        for (const client of rows) {
          if (assignmentMaps.people[client.id])
            next[client.id] = assignmentMaps.people[client.id];
          else delete next[client.id];
        }
        return next;
      });
      setClientPmAssignees((current) => {
        const next = { ...current };
        for (const client of rows) {
          if (assignmentMaps.pm[client.id])
            next[client.id] = assignmentMaps.pm[client.id];
          else delete next[client.id];
        }
        return next;
      });
      setSubitemAssignees((current) => {
        const next = { ...current };
        for (const client of rows) {
          for (const subitem of client.subitems) {
            if (nextSubitemAssignees[subitem.id])
              next[subitem.id] = nextSubitemAssignees[subitem.id];
            else delete next[subitem.id];
          }
        }
        return next;
      });
    },
    [],
  );

  const loadMoreClientsForGroup = useCallback(async (groupId: string) => {
    if (groupPageState[groupId]?.loading || groupPageState[groupId]?.hasMore === false)
      return;
    const offset = groupPageState[groupId]?.loaded
      ? groupPageState[groupId]?.loadedCount ?? 0
      : 0;
    setGroupPageState((current) => ({
      ...current,
      [groupId]: {
        total: current[groupId]?.total ?? 0,
        hasMore: current[groupId]?.hasMore ?? true,
        loading: true,
        loaded: current[groupId]?.loaded ?? false,
        loadedCount: current[groupId]?.loadedCount ?? 0,
      },
    }));
    try {
      const page = await fetchClientGroupPage(groupId, offset, 30, boardQuery);
      mergeAssignmentDataForClients(
        page.clients,
        { people: page.clientAssignees, pm: page.clientPmAssignees },
        page.subitemAssignees,
      );
      const viewportAnchor = captureSearchViewportAnchor();
      setClients((current) => {
        const knownIds = new Set(current.map((client) => client.id));
        return [...current, ...page.clients.filter((client) => !knownIds.has(client.id))];
      });
      restoreSearchViewportAnchor(viewportAnchor);
      setGroupPageState((current) => ({
        ...current,
        [groupId]: {
          total: page.total,
          hasMore: page.hasMore,
          loading: false,
          loaded: true,
          loadedCount: page.nextOffset,
        },
      }));
    } catch (error) {
      console.error("Failed to load more CRM clients", error);
      setGroupPageState((current) => ({
        ...current,
        [groupId]: { ...current[groupId], loading: false },
      }));
    }
  }, [
    boardQuery,
    captureSearchViewportAnchor,
    groupPageState,
    mergeAssignmentDataForClients,
    restoreSearchViewportAnchor,
  ]);

  const primeClientPagesForGroup = useCallback(async (groupId: string) => {
    if (groupPageState[groupId]?.loading || groupPageState[groupId]?.hasMore === false)
      return;
    let offset = groupPageState[groupId]?.loaded
      ? groupPageState[groupId]?.loadedCount ?? 0
      : 0;
    setGroupPageState((current) => ({
      ...current,
      [groupId]: {
        total: current[groupId]?.total ?? 0,
        hasMore: current[groupId]?.hasMore ?? true,
        loading: true,
        loaded: current[groupId]?.loaded ?? false,
        loadedCount: current[groupId]?.loadedCount ?? 0,
      },
    }));
    try {
      // On first expansion load the visible page plus two pages ahead. Once
      // a group is already active, replenish two pages ahead of the scroll
      // position whenever its sentinel becomes visible.
      const pagesToFetch = groupPageState[groupId]?.loaded ? 2 : 3;
      for (let pageNumber = 0; pageNumber < pagesToFetch; pageNumber += 1) {
        const page = await fetchClientGroupPage(groupId, offset, 30, boardQuery);
        mergeAssignmentDataForClients(
          page.clients,
          { people: page.clientAssignees, pm: page.clientPmAssignees },
          page.subitemAssignees,
        );
        const viewportAnchor = captureSearchViewportAnchor();
        setClients((current) => {
          const knownIds = new Set(current.map((client) => client.id));
          return [...current, ...page.clients.filter((client) => !knownIds.has(client.id))];
        });
        restoreSearchViewportAnchor(viewportAnchor);
        offset = page.nextOffset;
        setGroupPageState((current) => ({
          ...current,
          [groupId]: {
            total: page.total,
            hasMore: page.hasMore,
            loading: page.hasMore && pageNumber < pagesToFetch - 1,
            loaded: true,
            loadedCount: page.nextOffset,
          },
        }));
        if (!page.hasMore) break;
      }
    } catch (error) {
      console.error("Failed to prefetch CRM group pages", error);
    } finally {
      setGroupPageState((current) => ({
        ...current,
        [groupId]: { ...current[groupId], loading: false },
      }));
    }
  }, [
    boardQuery,
    captureSearchViewportAnchor,
    groupPageState,
    mergeAssignmentDataForClients,
    restoreSearchViewportAnchor,
  ]);

  const updateGanttSubitem = useCallback(
    async (clientId: string, subitemId: string, updates: Partial<Subitem>) => {
      if (!canEditGanttSubitem(clientId, subitemId)) {
        toast.error("You can only edit items that are assigned to you");
        return;
      }
      const client = ganttClients.find((candidate) => candidate.id === clientId);
      if (client?.customFields?.subitemsLocked === "true") {
        toast.error(
          "This client's subitems are locked. Check with the director if there are any changes",
        );
        return;
      }
      const applySubitemUpdate = (current: Client[]) =>
        current.map((candidate) =>
          candidate.id !== clientId
            ? candidate
            : {
                ...candidate,
                subitems: candidate.subitems.map((subitem) =>
                  subitem.id === subitemId
                    ? { ...subitem, ...updates }
                    : subitem,
                ),
              },
        );
      // Keep both panel snapshots consistent when the same client happens
      // to be loaded by the CRM Board as well.
      setGanttClients(applySubitemUpdate);
      setClients(applySubitemUpdate);
      try {
        await updateSubitemRow(subitemId, updates);
      } catch (error) {
        await reloadGanttClients();
        toast.error("Could not save the timeline update", {
          description:
            error instanceof Error ? error.message : "Please try again.",
        });
      }
    },
    [canEditGanttSubitem, ganttClients, reloadGanttClients],
  );

  useEffect(() => {
    const queryKey = JSON.stringify(boardQuery);
    if (skipBoardReloadForQueryKeyRef.current === queryKey) {
      skipBoardReloadForQueryKeyRef.current = null;
      return;
    }
    void reloadClients();
  }, [boardQuery, reloadClients]);

  useEffect(() => {
    if (searchParams.get("panel") !== "crm" || !clientsLoaded) return;

    const clientId = searchParams.get("client");
    const subitemId = searchParams.get("subitem");
    if (!clientId) return;

    const client = clients.find((item) => item.id === clientId);
    if (!client) {
      const nextParams = new URLSearchParams(window.location.search);
      nextParams.delete("client");
      nextParams.delete("subitem");
      nextParams.delete("view");
      replaceAppUrl(nextParams);
      return;
    }

    const subitem = subitemId
      ? client.subitems.find((item) => item.id === subitemId)
      : undefined;
    if (subitemId && !subitem) {
      const nextParams = new URLSearchParams(window.location.search);
      nextParams.delete("subitem");
      nextParams.delete("view");
      replaceAppUrl(nextParams);
    }

    setExpandedClientIds((current) =>
      current.includes(client.id) ? current : [...current, client.id],
    );
    const targetId = `url-crm-${client.id}-${subitem?.id ?? "client"}`;
    setSearchTarget((current) =>
      current?.id === targetId
        ? current
        : {
            id: targetId,
            clientId: client.id,
            subitemId: subitem?.id,
            kind: subitem ? "subitem" : "client",
            label: subitem?.name ?? client.name,
            context: "Opened from a direct link",
            field: subitem ? "Subitem" : "Client",
            value: subitem?.name ?? client.name,
            query: "",
          },
    );
  }, [clients, clientsLoaded, replaceAppUrl, searchParams]);

  useEffect(() => {
    if (activePanel !== "crm" && searchTarget) {
      setSearchTarget(null);
    }
  }, [activePanel, searchTarget]);

  useEffect(() => {
    const openCrmBoardBin = () => {
      changePanel("crm");
      window.setTimeout(
        () => window.dispatchEvent(new Event("crm:open-bin")),
        0,
      );
    };
    window.addEventListener("crm:open-bin-request", openCrmBoardBin);
    return () =>
      window.removeEventListener("crm:open-bin-request", openCrmBoardBin);
  }, [changePanel]);

  useEffect(() => {
    if (!searchTarget) return;

    const timeout = window.setTimeout(() => {
      setSearchTarget(null);
    }, 2500);

    return () => window.clearTimeout(timeout);
  }, [searchTarget]);

  useEffect(() => {
    const loadUserAndRole = async () => {
      const supabase = createSupabaseClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user ?? null);

      if (!user) {
        setCurrentUserRole(null);
        setRoleLoaded(true);
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (error) {
        console.error("Failed to load profile role", error);
        setCurrentUserRole(null);
        setRoleLoaded(true);
        return;
      }

      setCurrentUserRole(profile?.role ?? null);
      setRoleLoaded(true);
    };

    void loadUserAndRole();
  }, []);

  const loadNotifications = useCallback(async () => {
    const response = await fetch("/api/notifications");
    if (!response.ok) return;
    setNotifications((await response.json()) as Notification[]);
  }, []);

  useEffect(() => {
    void loadNotifications();
    const interval = window.setInterval(() => void loadNotifications(), 60_000);
    return () => window.clearInterval(interval);
  }, [loadNotifications]);

  const markNotificationRead = useCallback(async (id: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications((previous) =>
      previous.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification,
      ),
    );
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setNotifications((previous) =>
      previous.map((notification) => ({ ...notification, read: true })),
    );
  }, []);

  useEffect(() => {
    const loadProfiles = async () => {
      const supabase = createSupabaseClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, avatar_url")
        .order("full_name", { ascending: true, nullsFirst: true });

      if (error) {
        console.error("Failed to load profiles", error);
        return;
      }

      setProfiles((data ?? []) as Profile[]);
    };

    void loadProfiles();
  }, []);

  useEffect(
    () => () => {
      if (reconciliationTimer.current !== null)
        window.clearTimeout(reconciliationTimer.current);
    },
    [],
  );

  const reloadProfiles = useCallback(async () => {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, avatar_url")
      .order("full_name", { ascending: true, nullsFirst: true });
    if (error) {
      console.error("Failed to refresh profiles", error);
      return;
    }
    setProfiles((data ?? []) as Profile[]);
  }, []);

  const reloadGroups = useCallback(async () => {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("crm_groups")
      .select("id, name, color, sort_order")
      .order("sort_order", { ascending: true });
    if (error) {
      console.error("Failed to refresh CRM groups", error);
      return;
    }
    setGroups((data ?? []) as CRMGroup[]);
  }, []);

  const refreshBoardMetadata = useCallback(() => {
    setCrmMetadataVersion((version) => version + 1);
  }, []);

  const refreshLabelOptions = useCallback(() => {
    setLabelOptionsVersion((version) => version + 1);
  }, []);

  const refreshGroupsInPlace = useCallback(() => {
    void reloadGroups();
    setGroupVersion((version) => version + 1);
  }, [reloadGroups]);

  const refreshRoundRobin = useCallback(() => {
    setRoundRobinVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    const loadGroups = async () => {
      const supabase = createSupabaseClient();
      const { data, error } = await supabase
        .from("crm_groups")
        .select("id, name, color, sort_order")
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("Failed to load CRM groups for the Gantt chart", error);
        return;
      }

      setGroups((data ?? []) as CRMGroup[]);
    };

    void loadGroups();
  }, []);

  const renderPanel = () => {
    switch (activePanel) {
      case "crm":
        return (
          <CRMBoard
            key={crmMetadataVersion}
            clients={clients}
            expandedIds={expandedClientIds}
            setExpandedIds={setExpandedClientIds}
            setClients={setClients}
            reloadClients={reloadClients}
            // Group headers should only show their large loading treatment on
            // the first-ever board load. Subsequent filter/search queries use
            // the compact search-control indicator instead.
            clientsLoaded={clientsLoaded || hasLoadedInitialClients}
            boardQueryLoading={!clientsLoaded}
            hasMoreBoardQueryResults={Object.values(groupPageState).some(
              (state) => state.hasMore || state.loading,
            )}
            groupPageState={groupPageState}
            quickFilterCounts={quickFilterCounts}
            quickFilterCountsLoading={quickFilterCountsLoading}
            onLoadMoreGroup={loadMoreClientsForGroup}
            onPrimeGroup={primeClientPagesForGroup}
            onServerQueryChange={handleServerQueryChange}
            search={search}
            currentUserRole={currentUserRole}
            clientAssignees={clientAssignees}
            setClientAssignees={setClientAssignees}
            clientPmAssignees={clientPmAssignees}
            setClientPmAssignees={setClientPmAssignees}
            subitemAssignees={subitemAssignees}
            setSubitemAssignees={setSubitemAssignees}
            searchTarget={searchTarget}
            detailViewTarget={crmDetailTarget}
            onDetailViewTargetChange={updateCrmDetailLink}
            labelOptionsVersion={labelOptionsVersion}
            groupVersion={groupVersion}
            onOpenCustomerProfile={openCustomerProfile}
          />
        );

      case "ganttchart":
        return (
          <div className="h-full min-h-0 w-full text-sm text-gray-500">
            <GanttChart
              clients={ganttClients}
              groups={groups}
              profiles={profiles}
              clientAssignees={ganttClientAssignees}
              clientPmAssignees={ganttClientPmAssignees}
              subitemAssignees={ganttSubitemAssignees}
              onOpenClientTimeline={openGanttClientTimeline}
              onUpdateSubitem={updateGanttSubitem}
              canEditSubitem={canEditGanttSubitem}
              isLoading={ganttClientsLoading || groups.length === 0}
              resourceIds={ganttResourceIds}
              totalResourceCount={ganttResourceTotal}
              hasMoreResources={ganttHasMoreResources}
              isLoadingMore={ganttResourcesLoadingMore}
              onServerQueryChange={handleGanttQueryChange}
              onLoadMoreResources={loadMoreGanttResources}
              loadedQueryKey={ganttLoadedQueryKey}
            />
          </div>
        );

      case "calendar":
        return ["admin", "director", "dev"].includes(
          String(currentUserRole ?? "").toLowerCase(),
        ) ? (
          <WorkingCalendarPanel currentUserRole={currentUserRole} />
        ) : null;

      case "additionalcosts":
        return (
          <AdditionalCostsBoard
            clients={clients}
            profiles={profiles}
            groups={groups}
            currentUserId={user?.id}
            currentUserRole={currentUserRole}
            clientAssignees={clientAssignees}
            clientPmAssignees={clientPmAssignees}
            onOpenProject={openPaymentVoucherProject}
          />
        );

      case "emails":
        return (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            Outlook goes here
          </div>
        );

      case "emailreview":
        return <EmailReviewPanel currentUserRole={currentUserRole} />;

      case "reports":
        return (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            <ReportsPanel clients={clients} />
          </div>
        );

      case "roundrobin":
        return (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            <RoundRobinAdminPanel
              profiles={profiles}
              currentUserRole={currentUserRole}
              refreshVersion={roundRobinVersion}
            />
          </div>
        );

      case "team":
        return <TeamPanel profiles={profiles} />;

      case "customerprofiles":
        return (
          <CustomerProfilesPanel
            currentUserRole={currentUserRole}
            boardClients={clients}
            initialProfile={customerProfileTarget}
            onProfileChange={updateCustomerProfileLink}
            onOpenLead={(clientId) => {
              const client = clients.find((item) => item.id === clientId);
              if (!client) return;
              selectSearchResult({
                id: `customer-profile-lead-${clientId}-${Date.now()}`,
                clientId,
                kind: "client",
                label: "Client",
                context: "Opened from Customer Profile",
                field: "Client",
                value: client.name,
                query: "",
              });
            }}
          />
        );

      case "supplierprofiles":
        return (
          <SupplierProfilesPanel
            initialSupplierId={supplierProfileId}
            onSupplierChange={updateSupplierProfileLink}
          />
        );

      case "useradmin":
        return currentUserRole === "director" || currentUserRole === "dev" ? (
          <UserAdminPanel profiles={profiles} />
        ) : null;

      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc]">
      <AppLiveRefresh
        onRecordsRefresh={refreshRecordsInPlace}
        onProfilesRefresh={reloadProfiles}
        onGroupsRefresh={refreshGroupsInPlace}
        onNotificationsRefresh={loadNotifications}
        onBoardMetadataRefresh={refreshBoardMetadata}
        onLabelOptionsRefresh={refreshLabelOptions}
        onRoundRobinRefresh={refreshRoundRobin}
      />
      <Sidebar
        activePanel={activePanel}
        onChangePanel={changePanel}
        emailUnread={0}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        currentUserRole={currentUserRole}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          value={search}
          onChange={setSearch}
          onMarkAllRead={markAllNotificationsRead}
          onMarkRead={markNotificationRead}
          notifications={notifications}
          user={user}
          currentUserRole={currentUserRole}
          clients={clients}
          clientAssignees={clientAssignees}
          clientPmAssignees={clientPmAssignees}
          subitemAssignees={subitemAssignees}
          profiles={profiles}
          searchClients={searchAllCrmRecords}
          onSelectSearchResult={selectSearchResult}
        />

        <main ref={mainScrollRef} className="min-h-0 flex-1 overflow-auto">
          {renderPanel()}
        </main>
      </div>
    </div>
  );
}
