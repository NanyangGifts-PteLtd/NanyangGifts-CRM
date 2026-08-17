import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
        .from("notifications")
        .select("id, message, created_at, read, type, client_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json((data ?? []).map((item) => ({
        id: item.id,
        message: item.message,
        time: new Date(item.created_at).toLocaleString("en-SG"),
        read: item.read,
        type: item.type,
        clientId: item.client_id,
    })));
}

export async function PATCH(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as { id?: string; all?: boolean };
    const query = supabase.from("notifications").update({ read: true }).eq("user_id", user.id);
    const { error } = body.all ? await query : await query.eq("id", body.id ?? "");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as { recipientUserId?: string; clientId?: string; message?: string };
    if (!body.recipientUserId || !body.clientId || !body.message) {
        return NextResponse.json({ error: "recipientUserId, clientId, and message are required" }, { status: 400 });
    }

    const { error } = await supabase.from("notifications").insert({
        user_id: body.recipientUserId,
        client_id: body.clientId,
        type: "info",
        message: body.message,
        read: false,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}
