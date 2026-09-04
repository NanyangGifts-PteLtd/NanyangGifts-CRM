"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ClientsLiveRefresh({
  onRefresh,
}: {
  onRefresh: () => void | Promise<void>;
}) {
    const refreshTimeout = useRef<number | null>(null);

    useEffect(() => {
        const supabase = createClient();
        const scheduleRefresh = () => {
            if (refreshTimeout.current !== null) {
                window.clearTimeout(refreshTimeout.current);
            }
            refreshTimeout.current = window.setTimeout(() => {
                refreshTimeout.current = null;
                void onRefresh();
            }, 250);
        };

        const channel = supabase
            .channel("crmboard-activity-log-live")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "activity_log" },
                scheduleRefresh,
            )
            .subscribe();

        return () => {
            if (refreshTimeout.current !== null) {
                window.clearTimeout(refreshTimeout.current);
            }
            supabase.removeChannel(channel);
        };
    }, [onRefresh]);

    return null;
}
