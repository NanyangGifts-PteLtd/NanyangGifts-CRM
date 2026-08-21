import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "director" && profile?.role !== "dev") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { data, error } = await supabaseAdmin.from("shippers").select("id, name, token").order("name");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ shippers: data ?? [] });
}
