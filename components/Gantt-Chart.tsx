"use client";

import { useMemo } from "react";
import { Gantt, Willow } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import type { Client, Subitem, TimelineRow } from "../app/types";

type Props = {
    clients: Client[];
};

type GanttTask = {
    id: number;
    parent: number;
    text: string;
    start: Date;
    duration: number;
    progress: number;
    type: "task" | "summary";
    open?: boolean;
};

function parseDate(value?: string): Date | null {
    if (!value || !value.trim()) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(start: Date, end: Date) {
    const ms = end.getTime() - start.getTime();
    return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function progressToNumber(value?: string) {
    if (value === "Done") return 100;
    if (value === "Started") return 50;
    if (value === "Not Started") return 0;
    return 0;
}

function buildTasks(clients: Client[]): GanttTask[] {
    const tasks: GanttTask[] = [];
    let nextId = 1;

    const safeClients = Array.isArray(clients)
        ? clients.filter((client): client is Client => !!client && typeof client === "object")
        : [];

    safeClients.forEach((client) => {
        const clientId = nextId++;

        tasks.push({
            id: clientId,
            parent: 0,
            text: client.name || "Unnamed Client",
            start: new Date(2026, 0, 1),
            duration: 1,
            progress: 0,
            type: "summary",
            open: true,
        });

        const subitems: Subitem[] = Array.isArray(client.subitems)
            ? client.subitems.filter(
                (subitem): subitem is Subitem => !!subitem && typeof subitem === "object"
            )
            : [];

        subitems.forEach((subitem) => {
            const subitemId = nextId++;

            const timelineRows: TimelineRow[] = Array.isArray(subitem.timelineRows)
                ? subitem.timelineRows.filter(
                    (row): row is TimelineRow => !!row && typeof row === "object"
                )
                : [];

            const validRows = timelineRows
                .map((row) => {
                    const start = parseDate(row.timelineStart);
                    if (!start) return null;

                    const end = parseDate(row.timelineEnd) ?? start;

                    return {
                        row,
                        start,
                        end,
                    };
                })
                .filter(
                    (item): item is { row: TimelineRow; start: Date; end: Date } => item !== null
                );

            const subitemStart =
                validRows.length > 0
                    ? new Date(Math.min(...validRows.map((r) => r.start.getTime())))
                    : new Date(2026, 0, 1);

            const subitemEnd =
                validRows.length > 0
                    ? new Date(Math.max(...validRows.map((r) => r.end.getTime())))
                    : subitemStart;

            tasks.push({
                id: subitemId,
                parent: clientId,
                text: subitem.name || "Unnamed Subitem",
                start: subitemStart,
                duration: daysBetween(subitemStart, subitemEnd),
                progress: 0,
                type: "summary",
                open: true,
            });

            validRows.forEach(({ row, start, end }) => {
                tasks.push({
                    id: nextId++,
                    parent: subitemId,
                    text: row.name || "Untitled Step",
                    start,
                    duration: daysBetween(start, end),
                    progress: progressToNumber(row.subProgress),
                    type: "task",
                });
            });
        });
    });

    return tasks;
}


const SCALES = [
    { unit: "month", step: 1, format: "%M %Y" },
    { unit: "day", step: 1, format: "%d" },
];

export default function GanttChart({ clients }: Props) {
    const tasks = useMemo(() =>  { const built = buildTasks(clients); console.log("final tasks", built); return built;}, [clients]);

    return (
        <div className="flex flex-col"style={{ height: "600px", width: "100%", minHeight: 600}}>
            <Willow>
                <Gantt
                    tasks={tasks}
                    links={[]}
                    scales={SCALES}
                    start={new Date(2026, 0, 1)}
                    end={new Date(2027, 11, 31)}
                />
            </Willow>
        </div>
    );
}