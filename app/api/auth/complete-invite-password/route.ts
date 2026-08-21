import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { password, fullName } = await request.json() as { password?: string; fullName?: string };
    if (!password || password.length < 8) {
        return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    const normalizedName = fullName?.trim();
    if (!normalizedName) {
        return NextResponse.json({ error: "Please enter your full name." }, { status: 400 });
    }

    const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({ full_name: normalizedName })
        .eq("id", user.id);
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password,
        app_metadata: { ...(user.app_metadata ?? {}), must_change_password: false },
        user_metadata: { ...(user.user_metadata ?? {}), full_name: normalizedName },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
}
