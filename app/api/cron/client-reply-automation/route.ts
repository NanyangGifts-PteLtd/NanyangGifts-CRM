import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(request: NextRequest) {
    const authorization = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authorization !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = Date.now();
    const { data: clients, error } = await supabase
        .from("clients")
        .select("id, name, status, reply_status, waiting_started_at, client_assignees(user_id)")
        .eq("reply_status", "Waiting...")
        .not("waiting_started_at", "is", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let created = 0;
    for (const client of clients ?? []) {
        const elapsed = now - new Date(client.waiting_started_at).getTime();
        const reminderDue = elapsed >= 48 * 60 * 60 * 1000;
        const overdueDue = elapsed >= 72 * 60 * 60 * 1000;
        if (!reminderDue && !overdueDue) continue;

        if (overdueDue && client.status !== "Overdue") {
            await supabase.from("clients").update({ status: "Overdue" }).eq("id", client.id);
        }

        const kind = overdueDue ? "reply_overdue" : "reply_reminder";
        const message = overdueDue
            ? `${client.name} is overdue for a reply. Reply Status has been changed to Overdue.`
            : `${client.name} has been Waiting for a reply for 2 days. Please reply within 1 day before it becomes overdue.`;
        const recipients = (client.client_assignees ?? []).map((assignment: { user_id: string }) => assignment.user_id);
        if (recipients.length === 0) continue;

        const { data: inserted } = await supabase.from("notifications").upsert(
            recipients.map((userId) => ({
                user_id: userId,
                client_id: client.id,
                type: overdueDue ? "warning" : "info",
                message,
                read: false,
                dedupe_key: `${kind}:${client.id}:${new Date(client.waiting_started_at).toISOString().slice(0, 10)}`,
            })),
            { onConflict: "user_id,dedupe_key", ignoreDuplicates: true },
        ).select("id");
        created += inserted?.length ?? 0;
    }

    return NextResponse.json({ ok: true, notificationsCreated: created });
}
