import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function currentProfile() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    const { data: profile } = await supabaseAdmin.from("profiles").select("id, full_name, email, role").eq("id", user.id).maybeSingle();
    if (!profile) return { error: NextResponse.json({ error: "Profile not found" }, { status: 403 }) };
    return { user, profile };
}

export async function GET(req: NextRequest) {
    const current = await currentProfile();
    if ("error" in current) return current.error;
    const clientId = new URL(req.url).searchParams.get("clientId");
    if (!clientId) return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    const { data, error } = await supabaseAdmin.from("client_updates").select("id, client_id, author_id, content, mentions, created_at").eq("client_id", clientId).order("created_at", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const authorIds = [...new Set((data ?? []).map((item) => item.author_id))];
    const { data: authors } = authorIds.length ? await supabaseAdmin.from("profiles").select("id, full_name, email, avatar_url").in("id", authorIds) : { data: [] };
    const byId = new Map((authors ?? []).map((author) => [author.id, author]));
    return NextResponse.json((data ?? []).map((item) => ({ ...item, author: byId.get(item.author_id) ?? null })));
}

export async function POST(req: NextRequest) {
    const current = await currentProfile();
    if ("error" in current) return current.error;
    const body = await req.json() as { clientId?: string; content?: string; mentionIds?: string[] };
    const content = body.content?.trim();
    if (!body.clientId || !content) return NextResponse.json({ error: "clientId and content are required" }, { status: 400 });
    if (content.length > 5000) return NextResponse.json({ error: "Updates must be 5,000 characters or less" }, { status: 400 });
    const mentionIds = [...new Set((body.mentionIds ?? []).filter((id) => typeof id === "string" && id && id !== current.user.id))];
    const { data: client } = await supabaseAdmin.from("clients").select("id, name").eq("id", body.clientId).maybeSingle();
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
    const { data: update, error } = await supabaseAdmin.from("client_updates").insert({ client_id: client.id, author_id: current.user.id, content, mentions: mentionIds }).select("id, client_id, author_id, content, mentions, created_at").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (mentionIds.length) {
        const sender = current.profile.full_name?.trim() || current.profile.email || "A user";
        const { error: notificationError } = await supabaseAdmin.from("notifications").insert(mentionIds.map((userId) => ({ user_id: userId, client_id: client.id, type: "info", message: `You have been tagged by ${sender} in an update for ${client.name}`, read: false })));
        if (notificationError) return NextResponse.json({ error: notificationError.message }, { status: 500 });
    }
    return NextResponse.json({ ...update, author: current.profile });
}

export async function DELETE(req: NextRequest) {
    const current = await currentProfile();
    if ("error" in current) return current.error;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const { data: update, error } = await supabaseAdmin.from("client_updates").select("id, author_id").eq("id", id).maybeSingle();
    if (error || !update) return NextResponse.json({ error: error?.message ?? "Update not found" }, { status: 404 });
    if (update.author_id !== current.user.id && !["director", "dev"].includes(current.profile.role ?? "")) return NextResponse.json({ error: "Only the author, a director, or a developer can delete this update" }, { status: 403 });
    const { error: deleteError } = await supabaseAdmin.from("client_updates").delete().eq("id", id);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}
