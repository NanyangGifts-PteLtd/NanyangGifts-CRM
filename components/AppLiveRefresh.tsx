"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  boardProtectionDelay,
  isBoardRecordProtected,
} from "@/lib/board-write-coordinator";

type RefreshKind = "records" | "protectedRecords" | "profiles" | "groups" | "notifications" | "boardMetadata" | "labelOptions" | "roundRobin";

type RecordRow = Record<string, unknown>;

export type LiveRecordChange = {
  table: "clients" | "subitems" | "client_assignees" | "subitem_assignees";
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: RecordRow;
  old: RecordRow;
};

export function AppLiveRefresh({
  onRecordsRefresh,
  onGanttRecordsRefresh,
  onProfilesRefresh,
  onGroupsRefresh,
  onNotificationsRefresh,
  onBoardMetadataRefresh,
  onLabelOptionsRefresh,
  onRoundRobinRefresh,
}: {
  onRecordsRefresh: (changes: LiveRecordChange[]) => void | Promise<void>;
  onGanttRecordsRefresh: (changes: LiveRecordChange[]) => void | Promise<void>;
  onProfilesRefresh: () => void | Promise<void>;
  onGroupsRefresh: () => void | Promise<void>;
  onNotificationsRefresh: () => void | Promise<void>;
  onBoardMetadataRefresh: () => void;
  onLabelOptionsRefresh: () => void;
  onRoundRobinRefresh: () => void;
}) {
  const timers = useRef<Partial<Record<RefreshKind, number>>>({});
  const pendingRecordChanges = useRef<LiveRecordChange[]>([]);
  // Realtime does not tell us whether a change originated in this browser.
  // Keep protected echoes out of the active edit, but retain them for one
  // quiet, targeted reconciliation when the write's settle window ends.
  const deferredProtectedRecordChanges = useRef<LiveRecordChange[]>([]);
  // Board callbacks close over frequently changing row/filter state. Keep the
  // active handlers in a ref so those renders do not tear down and recreate
  // the Supabase Realtime channel (including a new auth/session lookup).
  const handlers = useRef({
    onRecordsRefresh,
    onGanttRecordsRefresh,
    onProfilesRefresh,
    onGroupsRefresh,
    onNotificationsRefresh,
    onBoardMetadataRefresh,
    onLabelOptionsRefresh,
    onRoundRobinRefresh,
  });
  handlers.current = {
    onRecordsRefresh,
    onGanttRecordsRefresh,
    onProfilesRefresh,
    onGroupsRefresh,
    onNotificationsRefresh,
    onBoardMetadataRefresh,
    onLabelOptionsRefresh,
    onRoundRobinRefresh,
  };

  useEffect(() => {
    const supabase = createClient();
    let disposed = false;
    let recordsRefreshInFlight = false;
    let recordsRefreshQueued = false;
    const hiddenRefreshKinds = new Set<RefreshKind>();
    const canRefreshNow = () =>
      document.visibilityState === "visible" && document.hasFocus();
    const runRefresh = (kind: RefreshKind) => {
      if (kind === "records") {
        if (recordsRefreshInFlight) {
          recordsRefreshQueued = true;
          return;
        }
        const changes = pendingRecordChanges.current.splice(0);
        if (changes.length) {
          recordsRefreshInFlight = true;
          recordsRefreshQueued = false;
          const currentHandlers = handlers.current;
          void Promise.allSettled([
            currentHandlers.onRecordsRefresh(changes),
            currentHandlers.onGanttRecordsRefresh(changes),
          ]).finally(() => {
            recordsRefreshInFlight = false;
            if (
              !disposed &&
              (recordsRefreshQueued || pendingRecordChanges.current.length)
            ) {
              // Changes received during the active reconciliation remain in
              // the queue. Give them one normal debounce window, then process
              // them with the latest Board state instead of launching an
              // overlapping page/count/hydration request.
              schedule("records");
            }
          });
        } else {
          recordsRefreshQueued = false;
        }
      }
      if (kind === "profiles") void handlers.current.onProfilesRefresh();
      if (kind === "groups") void handlers.current.onGroupsRefresh();
      if (kind === "notifications")
        void handlers.current.onNotificationsRefresh();
      if (kind === "boardMetadata")
        handlers.current.onBoardMetadataRefresh();
      if (kind === "labelOptions") handlers.current.onLabelOptionsRefresh();
      if (kind === "roundRobin") handlers.current.onRoundRobinRefresh();
    };
    const schedule = (kind: RefreshKind) => {
      const current = timers.current[kind];
      if (current !== undefined) window.clearTimeout(current);
      const protectionDelay = kind === "records" ? boardProtectionDelay() : 0;
      // A pending confirmation holds a record with an infinite delay. This
      // means "wait for user resolution", not "schedule a timer with
      // Infinity" (which browsers clamp to an immediate timeout).
      if (kind === "records" && !Number.isFinite(protectionDelay)) {
        delete timers.current[kind];
        return;
      }
      const delay = kind === "records"
        ? Math.max(300, protectionDelay + 100)
        : 300;
      timers.current[kind] = window.setTimeout(() => {
        delete timers.current[kind];
        if (disposed) return;
        // Background tabs still receive Realtime events. Defer their database
        // follow-up work and coalesce it into one refresh per kind when the
        // user returns, instead of letting every open tab query in parallel.
        if (!canRefreshNow()) {
          hiddenRefreshKinds.add(kind);
          return;
        }
        runRefresh(kind);
      }, delay);
    };
    const scheduleDeferredProtectedRecords = () => {
      const current = timers.current.protectedRecords;
      if (current !== undefined) window.clearTimeout(current);
      const protectionDelay = boardProtectionDelay();
      if (!Number.isFinite(protectionDelay)) {
        delete timers.current.protectedRecords;
        return;
      }
      timers.current.protectedRecords = window.setTimeout(() => {
        delete timers.current.protectedRecords;
        if (disposed) return;
        if (boardProtectionDelay() > 0) {
          scheduleDeferredProtectedRecords();
          return;
        }
        pendingRecordChanges.current.push(
          ...deferredProtectedRecordChanges.current.splice(0),
        );
        schedule("records");
      }, Math.max(350, protectionDelay + 100));
    };
    const handleBoardWriteSettled = () => {
      if (deferredProtectedRecordChanges.current.length)
        scheduleDeferredProtectedRecords();
    };
    window.addEventListener("crm:board-write-settled", handleBoardWriteSettled);
    const flushHiddenRefreshes = () => {
      if (!canRefreshNow() || disposed) return;
      const kinds = Array.from(hiddenRefreshKinds);
      hiddenRefreshKinds.clear();
      for (const kind of kinds) schedule(kind);
    };
    document.addEventListener("visibilitychange", flushHiddenRefreshes);
    window.addEventListener("focus", flushHiddenRefreshes);
    const scheduleRecordChange = (
      table: LiveRecordChange["table"],
      payload: {
        eventType: LiveRecordChange["eventType"];
        new: RecordRow;
        old: RecordRow;
      },
    ) => {
      // A local write is already reflected optimistically. Realtime normally
      // echoes it back within the protection window; treating that echo as a
      // fresh remote change schedules a later hydration which replaces the
      // edited row and causes a distracting flicker. Keep the local value
      // authoritative through the settle window instead. This also covers
      // assignment-table echoes caused by a locally protected client/subitem.
      const record = (() => {
        if (table === "clients") {
          const id =
            typeof payload.new.id === "string"
              ? payload.new.id
              : typeof payload.old.id === "string"
                ? payload.old.id
                : null;
          return id ? { kind: "client" as const, id } : null;
        }
        if (table === "subitems") {
          const id =
            typeof payload.new.id === "string"
              ? payload.new.id
              : typeof payload.old.id === "string"
                ? payload.old.id
                : null;
          return id ? { kind: "subitem" as const, id } : null;
        }
        if (table === "client_assignees") {
          const id =
            typeof payload.new.client_id === "string"
              ? payload.new.client_id
              : typeof payload.old.client_id === "string"
                ? payload.old.client_id
                : null;
          return id ? { kind: "client" as const, id } : null;
        }
        const id =
          typeof payload.new.subitem_id === "string"
            ? payload.new.subitem_id
            : typeof payload.old.subitem_id === "string"
              ? payload.old.subitem_id
              : null;
        return id ? { kind: "subitem" as const, id } : null;
      })();
      const change = { table, ...payload } as LiveRecordChange;
      if (record && isBoardRecordProtected(record.kind, record.id)) {
        deferredProtectedRecordChanges.current.push(change);
        scheduleDeferredProtectedRecords();
        return;
      }

      pendingRecordChanges.current.push(change);
      schedule("records");
    };

    let channel: ReturnType<typeof supabase.channel> | null = null;
    const start = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (disposed) return;
      if (session) supabase.realtime.setAuth(session.access_token);
      channel = supabase
        .channel("app-live-refresh")
        .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, (payload) => scheduleRecordChange("clients", payload))
        .on("postgres_changes", { event: "*", schema: "public", table: "subitems" }, (payload) => scheduleRecordChange("subitems", payload))
        // An activity entry accompanies many record writes but does not change
        // Board record data. Reloading here duplicates the clients/subitems
        // refresh and can replay an older snapshot over an active editor.
        .on("postgres_changes", { event: "*", schema: "public", table: "client_assignees" }, (payload) => scheduleRecordChange("client_assignees", payload))
        .on("postgres_changes", { event: "*", schema: "public", table: "subitem_assignees" }, (payload) => scheduleRecordChange("subitem_assignees", payload))
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => schedule("profiles"))
        .on("postgres_changes", { event: "*", schema: "public", table: "crm_groups" }, () => schedule("groups"))
        .on("postgres_changes", { event: "*", schema: "public", table: "option_values" }, () => schedule("labelOptions"))
        .on("postgres_changes", { event: "*", schema: "public", table: "custom_columns" }, () => schedule("boardMetadata"))
        .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => schedule("notifications"))
        .on("postgres_changes", { event: "*", schema: "public", table: "sales_round_robin_pool" }, () => schedule("roundRobin"))
        .subscribe();
    };
    void start();

    return () => {
      disposed = true;
      Object.values(timers.current).forEach((timer) => window.clearTimeout(timer));
      timers.current = {};
      pendingRecordChanges.current = [];
      deferredProtectedRecordChanges.current = [];
      hiddenRefreshKinds.clear();
      window.removeEventListener("crm:board-write-settled", handleBoardWriteSettled);
      document.removeEventListener("visibilitychange", flushHiddenRefreshes);
      window.removeEventListener("focus", flushHiddenRefreshes);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
