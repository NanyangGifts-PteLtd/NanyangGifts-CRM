"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ClientsLiveRefresh() {
    const router = useRouter();

    useEffect(() => {
        const supabase = createClient();

        const clientsChannel = supabase
            .channel("clients-live")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "clients" },
                () => router.refresh()
            )
            .subscribe();

        const assigneesChannel = supabase
            .channel("clients-assignees-live")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "clients_assignees" },
                () => router.refresh()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(clientsChannel);
            supabase.removeChannel(assigneesChannel);
        };
    }, [router]);

    return null;
}