"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type RefreshKind = "records" | "profiles" | "groups" | "notifications" | "boardMetadata" | "roundRobin";

export function AppLiveRefresh({
  onRecordsRefresh,
  onProfilesRefresh,
  onGroupsRefresh,
  onNotificationsRefresh,
  onBoardMetadataRefresh,
  onRoundRobinRefresh,
}: {
  onRecordsRefresh: () => void | Promise<void>;
  onProfilesRefresh: () => void | Promise<void>;
  onGroupsRefresh: () => void | Promise<void>;
  onNotificationsRefresh: () => void | Promise<void>;
  onBoardMetadataRefresh: () => void;
  onRoundRobinRefresh: () => void;
}) {
  const timers = useRef<Partial<Record<RefreshKind, number>>>({});

  useEffect(() => {
    const supabase = createClient();
    let disposed = false;
    const schedule = (kind: RefreshKind) => {
      const current = timers.current[kind];
      if (current !== undefined) window.clearTimeout(current);
      timers.current[kind] = window.setTimeout(() => {
        delete timers.current[kind];
        if (disposed) return;
        if (kind === "records") void onRecordsRefresh();
        if (kind === "profiles") void onProfilesRefresh();
        if (kind === "groups") void onGroupsRefresh();
        if (kind === "notifications") void onNotificationsRefresh();
        if (kind === "boardMetadata") onBoardMetadataRefresh();
        if (kind === "roundRobin") onRoundRobinRefresh();
      }, 300);
    };

    let channel: ReturnType<typeof supabase.channel> | null = null;
    const start = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (disposed) return;
      if (session) supabase.realtime.setAuth(session.access_token);
      channel = supabase
        .channel("app-live-refresh")
        .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => schedule("records"))
        .on("postgres_changes", { event: "*", schema: "public", table: "subitems" }, () => schedule("records"))
        .on("postgres_changes", { event: "*", schema: "public", table: "activity_log" }, () => schedule("records"))
        .on("postgres_changes", { event: "*", schema: "public", table: "client_assignees" }, () => schedule("records"))
        .on("postgres_changes", { event: "*", schema: "public", table: "subitem_assignees" }, () => schedule("records"))
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => schedule("profiles"))
        .on("postgres_changes", { event: "*", schema: "public", table: "crm_groups" }, () => { schedule("groups"); schedule("boardMetadata"); })
        .on("postgres_changes", { event: "*", schema: "public", table: "option_values" }, () => schedule("boardMetadata"))
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
      if (channel) supabase.removeChannel(channel);
    };
  }, [onBoardMetadataRefresh, onGroupsRefresh, onNotificationsRefresh, onProfilesRefresh, onRecordsRefresh, onRoundRobinRefresh]);

  return null;
}
