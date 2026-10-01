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
import { fetchClientsWithSubitems, updateSubitemRow } from "@/lib/crm";
import { toast } from "sonner";
import { CRMBoard } from "@/components/CRMBoard";
import Sidebar, { type SidePanel } from "../../../components/Sidebar";
import TopBar from "../../../components/TopBar";
import type { User } from "@supabase/supabase-js";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { ReportsPanel } from "@/components/ReportsPanel";
import { RoundRobinAdminPanel } from "@/components/RoundRobinPanel";
import GanttChart from "@/components/Gantt-Chart";
import { fetchClientAssignmentMaps } from "@/lib/assignments";
import { fetchAllSubitemAssignees } from "@/components/CRMBoard";
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
  const [search, setSearch] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [clientsLoaded, setClientsLoaded] = useState(false);
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
  const reconciliationTimer = useRef<number | null>(null);
  const recordsRefreshSequence = useRef(0);

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
    (result: SearchResult) => {
      // currently setting to CRM panel since only CRM panel has search results, change in the future when other panels have search results
      openCrmRecord(result.clientId, result.subitemId);
      const client = clients.find((item) => item.id === result.clientId);
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

  const openGanttClientTimeline = useCallback(
    (clientId: string, subitemId?: string) => {
      openCrmRecord(clientId, subitemId);
      setExpandedClientIds((current) =>
        current.includes(clientId) ? current : [...current, clientId],
      );
      setClients((current) =>
        current.map((client) =>
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
        ),
      );
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
    [openCrmRecord],
  );
  const canEditGanttSubitem = useCallback(
    (clientId: string, subitemId: string) => {
      if (!user?.id) return false;
      const role = String(currentUserRole ?? "").trim().toLowerCase();
      if (["admin", "director", "dev"].includes(role)) return true;
      const client = clients.find((candidate) => candidate.id === clientId);
      return Boolean(
        client &&
          ((clientAssignees[clientId] ?? []).includes(user.id) ||
            (clientPmAssignees[clientId] ?? []).includes(user.id) ||
            (subitemAssignees[subitemId] ?? []).includes(user.id)),
      );
    },
    [
      clientAssignees,
      clientPmAssignees,
      clients,
      currentUserRole,
      subitemAssignees,
      user?.id,
    ],
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

  const reloadClients = useCallback(async () => {
    const refreshSequence = ++recordsRefreshSequence.current;
    const writeRevisionAtStart = getBoardWriteRevision();
    try {
      const [rows, clientAssignmentMaps, subitemAssigneeMap] =
        await Promise.all([
          fetchClientsWithSubitems(),
          fetchClientAssignmentMaps(),
          fetchAllSubitemAssignees(),
        ]);

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
            void reloadClients();
          }, 100);
        }
        return;
      }

      const protectionDelay = boardProtectionDelay();
      setClients((current) => {
        const currentClients = new Map(
          current.map((client) => [client.id, client]),
        );
        return rows.map((incomingClient) => {
          const localClient = currentClients.get(incomingClient.id);
          if (!localClient) return incomingClient;

          const localSubitems = new Map(
            localClient.subitems.map((item) => [item.id, item]),
          );
          const mergedSubitems = incomingClient.subitems.map(
            (incomingSubitem) => {
              if (!isBoardRecordProtected("subitem", incomingSubitem.id))
                return incomingSubitem;
              const localSubitem = localSubitems.get(incomingSubitem.id);
              if (!localSubitem) return incomingSubitem;
              return localSubitem;
            },
          );

          if (isBoardRecordProtected("client", incomingClient.id)) {
            return { ...localClient, subitems: mergedSubitems };
          }
          return { ...incomingClient, subitems: mergedSubitems };
        });
      });
      setClientAssignees((current) => {
        const next = { ...clientAssignmentMaps.people };
        for (const [clientId, ids] of Object.entries(current)) {
          if (isBoardRecordProtected("client", clientId)) next[clientId] = ids;
        }
        return next;
      });
      setClientPmAssignees((current) => {
        const next = { ...clientAssignmentMaps.pm };
        for (const [clientId, ids] of Object.entries(current)) {
          if (isBoardRecordProtected("client", clientId)) next[clientId] = ids;
        }
        return next;
      });
      setSubitemAssignees((current) => {
        const next = { ...subitemAssigneeMap };
        for (const [subitemId, ids] of Object.entries(current)) {
          if (isBoardRecordProtected("subitem", subitemId))
            next[subitemId] = ids;
        }
        return next;
      });
      setClientsLoaded(true);
      if (protectionDelay > 0) {
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
      console.error("Failed to load clients", error);
    }
  }, []);

  const updateGanttSubitem = useCallback(
    async (clientId: string, subitemId: string, updates: Partial<Subitem>) => {
      if (!canEditGanttSubitem(clientId, subitemId)) {
        toast.error("You can only edit items that are assigned to you");
        return;
      }
      const client = clients.find((candidate) => candidate.id === clientId);
      if (client?.customFields?.subitemsLocked === "true") {
        toast.error(
          "This client's subitems are locked. Check with the director if there are any changes",
        );
        return;
      }
      setClients((current) =>
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
        ),
      );
      try {
        await updateSubitemRow(subitemId, updates);
      } catch (error) {
        await reloadClients();
        toast.error("Could not save the timeline update", {
          description:
            error instanceof Error ? error.message : "Please try again.",
        });
      }
    },
    [canEditGanttSubitem, clients, reloadClients],
  );

  useEffect(() => {
    void reloadClients();
  }, [reloadClients]);

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
            clientsLoaded={clientsLoaded}
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
              clients={clients}
              groups={groups}
              profiles={profiles}
              clientAssignees={clientAssignees}
              clientPmAssignees={clientPmAssignees}
              subitemAssignees={subitemAssignees}
              onOpenClientTimeline={openGanttClientTimeline}
              onUpdateSubitem={updateGanttSubitem}
              canEditSubitem={canEditGanttSubitem}
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
        onRecordsRefresh={reloadClients}
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
          onSelectSearchResult={selectSearchResult}
        />

        <main className="min-h-0 flex-1 overflow-auto pl-10">
          {renderPanel()}
        </main>
      </div>
    </div>
  );
}
