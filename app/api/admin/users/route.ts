import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function requireUserAdmin() {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profileError || (profile?.role !== "director" && profile?.role !== "dev")) {
        return { error: NextResponse.json({ error: "Only directors and dev users can manage accounts." }, { status: 403 }) };
    }
    return { user };
}

export async function GET() {
    const permission = await requireUserAdmin();
    if (permission.error) return permission.error;
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ users: data.users.map((user) => ({ id: user.id, suspended: user.app_metadata?.suspended === true })) });
}

export async function PATCH(request: Request) {
    const permission = await requireUserAdmin();
    if (permission.error) return permission.error;
    const { userId, suspended } = await request.json() as { userId?: string; suspended?: boolean };
    if (!userId || typeof suspended !== "boolean") return NextResponse.json({ error: "A user and suspension status are required." }, { status: 400 });

    const { data: targetProfile, error: targetError } = await supabaseAdmin.from("profiles").select("role").eq("id", userId).single();
    if (targetError) return NextResponse.json({ error: targetError.message }, { status: 400 });
    if (targetProfile?.role === "director") return NextResponse.json({ error: "Director accounts cannot be suspended." }, { status: 403 });

    const { data: targetUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userError || !targetUser.user) return NextResponse.json({ error: userError?.message ?? "User not found." }, { status: 404 });
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        app_metadata: { ...(targetUser.user.app_metadata ?? {}), suspended },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, userId, suspended });
}
