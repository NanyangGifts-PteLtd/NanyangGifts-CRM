import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const INTERNAL_ROLES = new Set(["sales", "pm", "admin", "director", "dev"]);

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!INTERNAL_ROLES.has(String(profile?.role ?? "").toLowerCase()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const recordId = request.nextUrl.searchParams.get("recordId")?.trim();
  if (!recordId) return NextResponse.json({ error: "recordId is required" }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from("samples_sent_activity_log")
    .select("id, actor_name, title, field_name, old_value, new_value, meta, created_at")
    .eq("sample_sent_id", recordId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ rows: data ?? [] });
}
