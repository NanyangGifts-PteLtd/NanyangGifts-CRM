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
                {
                    event: "INSERT",
                    schema: "public",
                    table: "clients",
                },
                (payload) => {
                    console.log("Realtime INSERT received:", payload);
                    router.refresh();
                }
            )
            .subscribe((status) => {
                console.log("Realtime status:", status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [router]);

    return null;
}