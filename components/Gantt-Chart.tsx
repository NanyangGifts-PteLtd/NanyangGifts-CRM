"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import "@bitnoi.se/react-scheduler/dist/style.css";
import type { Client, Subitem, TimelineRow } from "../app/types";

type Props = {
    clients: Client[];
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
};

type SchedulerResource = {
    id: string;
    label: {
        title: string;
        subtitle: string;
        icon: string;
    };
    data: SchedulerItem[];
};

function parseDate(value?: string): Date | null {
    if (!value || !value.trim()) return null;

    const direct = new Date(value);
    if (!Number.isNaN(direct.getTime())) return direct;

    const normalized = value.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/, "$3-$2-$1");
    const retried = new Date(normalized);

    return Number.isNaN(retried.getTime()) ? null : retried;
}

function addOneDay(date: Date) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + 1);
    return copy;
}

function getColor(progress?: string) {
    if (progress === "Done") return "#76ffc8";
    if (progress === "Started") return "#b30bf5";
    return "#60a5fa";
}

function buildSchedulerData(clients: Client[]): SchedulerResource[] {
    const safeClients = Array.isArray(clients)
        ? clients.filter((client): client is Client => !!client && typeof client === "object")
        : [];

    return safeClients.map((client) => {
        const subitems = Array.isArray(client.subitems)
            ? client.subitems.filter(
                (subitem): subitem is Subitem => !!subitem && typeof subitem === "object"
            )
            : [];

        const items: SchedulerItem[] = [];

        subitems.forEach((subitem) => {
            const timelineRows = Array.isArray(subitem.timelineRows)
                ? subitem.timelineRows.filter(
                    (row): row is TimelineRow => !!row && typeof row === "object"
                )
                : [];

            timelineRows.forEach((row) => {
                const start = parseDate(row.timelineStart);
                if (!start) return;

                const end = parseDate(row.timelineEnd) ?? addOneDay(start);

                items.push({
                    id: `${client.id}-${subitem.id}-${row.id}`,
                    startDate: start,
                    endDate: end,
                    occupancy: row.subProgress === "Done" ? 100 : row.subProgress === "Started" ? 60 : 20,
                    title: row.name || "Untitled Step",
                    subtitle: subitem.name || "Unnamed Subitem",
                    description:
                        [
                            row.person ? `Owner: ${row.person}` : "",
                            row.remarks ? `Remarks: ${row.remarks}` : "",
                            subitem.status ? `Subitem status: ${subitem.status}` : "",
                        ]
                            .filter(Boolean)
                            .join(" • ") || "No details",
                    bgColor: getColor(row.subProgress),
                });
            });
        });

        return {
            id: client.id,
            label: {
                title: client.name || "Unnamed Client",
                subtitle: client.company || client.people || "",
                icon:"",
            },
            data: items.sort(
                (a, b) => a.startDate.getTime() - b.startDate.getTime()
            ),
        };
    });
}

export default function GanttChart({ clients }: Props) {
    const Scheduler = dynamic(() => import("@bitnoi.se/react-scheduler").then((mod) => mod.Scheduler), {
        ssr: false
    });
    const [isLoading] = useState(false);

    const data = useMemo(() => buildSchedulerData(clients), [clients]);

    return (
        <div className="h-full min-h-[700px] w-full overflow-auto bg-white">
            <Scheduler
                data={data}
                isLoading={isLoading}
                onItemClick={(item) => {
                    console.log("Clicked timeline item:", item);
                }}
                onFilterData={() => { }}
                onClearFilterData={() => { }}
                config={{
                    zoom: 1,
                    lang: "en",
                    maxRecordsPerPage: 20,
                    filterButtonState: 0,
                    showThemeToggle:true,
                }}
            />
        </div>
    );
}