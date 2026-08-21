import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const SINGAPORE_TIME_ZONE = "Asia/Singapore";

function singaporeDateParts(value: Date) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: SINGAPORE_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(value);

    return {
        year: Number(parts.find((part) => part.type === "year")?.value),
        month: Number(parts.find((part) => part.type === "month")?.value),
        day: Number(parts.find((part) => part.type === "day")?.value),
    };
}

function singaporeMidnightUtc(year: number, month: number, day: number) {
    return new Date(Date.UTC(year, month - 1, day) - 8 * 60 * 60 * 1000);
}

function singaporeWorkingDayCutoff(value: Date) {
    const date = singaporeDateParts(value);
    const nextWorkingDay = new Date(Date.UTC(date.year, date.month - 1, date.day));

    do {
        nextWorkingDay.setUTCDate(nextWorkingDay.getUTCDate() + 1);
    } while (nextWorkingDay.getUTCDay() === 0 || nextWorkingDay.getUTCDay() === 6);

    // The assignee keeps the whole following working day; reassign at its midnight.
    nextWorkingDay.setUTCDate(nextWorkingDay.getUTCDate() + 1);

    return singaporeMidnightUtc(
        nextWorkingDay.getUTCFullYear(),
        nextWorkingDay.getUTCMonth() + 1,
        nextWorkingDay.getUTCDate(),
    );
}

async function getNextAssigneeExcluding(currentUserId: string) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const { data, error } = await supabase.rpc("get_next_sales_assignee");
        if (error) throw error;

        const nextAssignee = Array.isArray(data) ? data[0] : data;
        const nextUserId = nextAssignee?.user_id as string | undefined;
        if (nextUserId && nextUserId !== currentUserId) return nextUserId;
    }

    return null;
}

export async function GET(request: NextRequest) {
    const authorization = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authorization !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const { data: clients, error } = await supabase
        .from("clients")
        .select("id, name, reply_status, waiting_started_at, client_assignees(user_id)")
        .eq("reply_status", "Waiting...")
        .not("waiting_started_at", "is", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let reassigned = 0;
    let notificationsCreated = 0;
    for (const client of clients ?? []) {
        const startedAt = new Date(client.waiting_started_at);
        const reassignmentDueAt = singaporeWorkingDayCutoff(startedAt);
        if (now < reassignmentDueAt) continue;

        const oldAssigneeIds = (client.client_assignees ?? [])
            .map((assignment: { user_id: string }) => assignment.user_id)
            .filter(Boolean);
        const oldAssigneeId = oldAssigneeIds[0];
        if (!oldAssigneeId) continue;

        const newAssigneeId = await getNextAssigneeExcluding(oldAssigneeId);
        if (!newAssigneeId) continue;

        const { error: deleteError } = await supabase
            .from("client_assignees")
            .delete()
            .eq("client_id", client.id);
        if (deleteError) throw deleteError;

        const { error: insertAssigneeError } = await supabase
            .from("client_assignees")
            .insert({ client_id: client.id, user_id: newAssigneeId, assigned_by: null });
        if (insertAssigneeError) throw insertAssigneeError;

        const { error: resetWaitingError } = await supabase
            .from("clients")
            .update({ waiting_started_at: now.toISOString() })
            .eq("id", client.id)
            .eq("reply_status", "Waiting...");
        if (resetWaitingError) throw resetWaitingError;

        const recipients = [...new Set([...oldAssigneeIds, newAssigneeId])];
        const dedupeKey = `reply_reassigned:${client.id}:${now.toISOString().slice(0, 10)}`;
        const notificationRows = recipients.map((userId) => ({
            user_id: userId,
            client_id: client.id,
            type: "info",
            message: userId === newAssigneeId
                ? `${client.name} was assigned to you after waiting for a reply.`
                : `${client.name} was reassigned to another sales user after waiting for a reply.`,
            read: false,
            dedupe_key: `${dedupeKey}:${userId}`,
        }));
        const { data: existingNotifications, error: existingNotificationError } = await supabase
            .from("notifications")
            .select("dedupe_key")
            .in("dedupe_key", notificationRows.map((row) => row.dedupe_key));
        if (existingNotificationError) throw existingNotificationError;

        const existingDedupeKeys = new Set((existingNotifications ?? []).map((notification) => notification.dedupe_key));
        const notificationsToInsert = notificationRows.filter((row) => !existingDedupeKeys.has(row.dedupe_key));
        const { data: inserted, error: notificationError } = notificationsToInsert.length
            ? await supabase.from("notifications").insert(notificationsToInsert).select("id")
            : { data: [], error: null };
        if (notificationError) throw notificationError;

        reassigned += 1;
        notificationsCreated += inserted?.length ?? 0;
    }

    return NextResponse.json({ ok: true, reassigned, notificationsCreated });
}
