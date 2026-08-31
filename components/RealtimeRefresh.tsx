"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ClientsLiveRefresh() {
    const router = useRouter();

    useEffect(() => {
        const supabase = createClient();

        const channel = supabase
            .channel("clients-debug")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "clients" },
                (payload) => {
                    console.log("Realtime INSERT received:", payload);
                    router.refresh();
                }
            )
            .on("postgres_changes", { event: "*", schema: "public", table: "activity_log" }, () => router.refresh())
            .on("postgres_changes", { event: "*", schema: "public", table: "order_confirmations" }, () => router.refresh())
            .subscribe((status) => {
                console.log("Realtime status:", status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [router]);

    return null;
}
