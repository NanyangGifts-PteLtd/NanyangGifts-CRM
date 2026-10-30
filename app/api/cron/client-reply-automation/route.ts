import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { queueLeadReassignedMakeEvent } from "@/lib/make-integration";
import { getSystemLabel } from "@/lib/system-labels";
import { addSingaporeWorkingDays } from "@/lib/working-calendar";

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

function isIngestedClient(customFields: unknown) {
    if (!customFields || typeof customFields !== "object" || Array.isArray(customFields)) {
        return false;
    }

    const fields = customFields as Record<string, unknown>;
    // All inbound adapters persist both values. Checking for the metadata,
    // rather than a fixed list of source names, automatically supports future
    // ingestion channels while excluding leads created manually in the CRM.
    return (
        typeof fields.source === "string" &&
        fields.source.trim().length > 0 &&
        typeof fields.external_id === "string" &&
        fields.external_id.trim().length > 0
    );
}

async function singaporeWorkingDayCutoff(value: Date) {
    const date = singaporeDateParts(value);
    // The assignee keeps the whole following Singapore working day. This used
    // to skip weekends only; it now also honours public/company closure days.
    const deadlineDate = await addSingaporeWorkingDays(
        `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`,
        2,
    );
    const [year, month, day] = deadlineDate.split("-").map(Number);

    return singaporeMidnightUtc(year, month, day);
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
    const waitingLabel = await getSystemLabel("reply_status", "reply_status_waiting");
    // Reassignment is a first-response safeguard for fresh leads only.  An
    // ingested client can retain its Waiting reply state after being moved to
    // Unqualified (or another workflow group), but must never be reassigned
    // there.
    const { data: newLeadGroup, error: newLeadGroupError } = await supabase
        .from("crm_groups")
        .select("id")
        .ilike("name", "New Lead")
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();
    if (newLeadGroupError) {
        return NextResponse.json({ error: newLeadGroupError.message }, { status: 500 });
    }
    if (!newLeadGroup) {
        return NextResponse.json({ error: 'CRM group "New Lead" is not configured' }, { status: 500 });
    }
    const { data: clients, error } = await supabase
        .from("clients")
        .select("id, name, reply_status, reply_status_option_id, waiting_started_at, custom_fields, client_assignees(user_id, assignment_type)")
        .eq("reply_status_option_id", waitingLabel.id)
        .eq("group_id", newLeadGroup.id)
        .not("waiting_started_at", "is", null)
        .is("deleted_at", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let reassigned = 0;
    let notificationsCreated = 0;
    for (const client of clients ?? []) {
        if (!isIngestedClient(client.custom_fields)) continue;

        const startedAt = new Date(client.waiting_started_at);
        const reassignmentDueAt = await singaporeWorkingDayCutoff(startedAt);
        if (now < reassignmentDueAt) continue;

        const oldAssigneeIds = (client.client_assignees ?? [])
            .filter(
                (assignment: { user_id: string; assignment_type?: string | null }) =>
                    !assignment.assignment_type || assignment.assignment_type === "people",
            )
            .map((assignment: { user_id: string }) => assignment.user_id)
            .filter(Boolean);
        const oldAssigneeId = oldAssigneeIds[0];
        if (!oldAssigneeId) continue;

        const newAssigneeId = await getNextAssigneeExcluding(oldAssigneeId);
        if (!newAssigneeId) continue;

        const { error: deleteError } = await supabase
            .from("client_assignees")
            .delete()
            .eq("client_id", client.id)
            .eq("user_id", oldAssigneeId);
        if (deleteError) throw deleteError;

        const { error: insertAssigneeError } = await supabase
            .from("client_assignees")
            .insert({
                client_id: client.id,
                user_id: newAssigneeId,
                assignment_type: "people",
                assigned_by: null,
            });
        if (insertAssigneeError) throw insertAssigneeError;

        const { error: resetWaitingError } = await supabase
            .from("clients")
            .update({ waiting_started_at: now.toISOString() })
            .eq("id", client.id)
            .eq("reply_status_option_id", waitingLabel.id);
        if (resetWaitingError) throw resetWaitingError;

        const { error: reassignmentCountError } = await supabase.rpc(
            "increment_client_times_reassigned",
            { p_client_id: client.id },
        );
        if (reassignmentCountError) throw reassignmentCountError;

        const reassignmentKey = `reply_timeout:${client.id}:${client.waiting_started_at}`;
        const { data: existingReassignmentActivity, error: activityReadError } = await supabase
            .from("activity_log")
            .select("id")
            .eq("client_id", client.id)
            .contains("meta", { reassignmentKey })
            .limit(1);
        if (activityReadError) throw activityReadError;
        if (!existingReassignmentActivity?.length) {
            const { data: assignmentProfiles, error: profilesError } = await supabase
                .from("profiles")
                .select("id, full_name, email")
                .in("id", [oldAssigneeId, newAssigneeId]);
            if (profilesError) throw profilesError;
            const oldProfile = (assignmentProfiles ?? []).find((profile) => profile.id === oldAssigneeId);
            const newProfile = (assignmentProfiles ?? []).find((profile) => profile.id === newAssigneeId);
            const oldName = oldProfile?.full_name?.trim() || oldProfile?.email || "Unknown user";
            const newName = newProfile?.full_name?.trim() || newProfile?.email || "Unknown user";
            const { error: activityInsertError } = await supabase.from("activity_log").insert({
                client_id: client.id,
                subitem_id: null,
                actor_name: "Reply automation",
                action: "assignment_changed",
                field_name: "assignee",
                old_value: oldName,
                new_value: newName,
                subitem_name: null,
                link: null,
                title: `reassigned this lead from ${oldName} to ${newName}`,
                description: "The previous assignee did not reply within the configured response window.",
                meta: {
                    assignmentEvent: "reassignment",
                    reason: "reply_timeout",
                    reassignmentKey,
                    previousAssigneeId: oldAssigneeId,
                    previousAssigneeEmail: oldProfile?.email ?? null,
                    assignedUserId: newAssigneeId,
                    assignedUserEmail: newProfile?.email ?? null,
                    waitingStartedAt: client.waiting_started_at,
                    reassignmentDueAt: reassignmentDueAt.toISOString(),
                    reassignedAt: now.toISOString(),
                },
                created_at: now.toISOString(),
            });
            if (activityInsertError) throw activityInsertError;
        }

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

        try {
            await queueLeadReassignedMakeEvent({
                clientId: client.id,
                previousAssigneeId: oldAssigneeId,
                assignedUserId: newAssigneeId,
                reassignedAt: now.toISOString(),
            });
        } catch (makeError) {
            // A Make outage must not roll back the CRM reassignment. The
            // durable outbox will retry any event that was successfully queued.
            console.error("Could not queue Make reassignment event", makeError);
        }

        reassigned += 1;
        notificationsCreated += inserted?.length ?? 0;
    }

    return NextResponse.json({ ok: true, reassigned, notificationsCreated });
}
