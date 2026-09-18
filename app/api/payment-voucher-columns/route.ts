import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const KEY = "payment_voucher_columns";
const INTERNAL_ROLES = new Set(["sales", "pm", "admin", "director", "dev"]);

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("app_settings").select("value").eq("key", KEY).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  try {
    return NextResponse.json({ value: data?.value ? JSON.parse(data.value) : null });
  } catch {
    return NextResponse.json({ value: null });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!INTERNAL_ROLES.has(String(profile?.role ?? "").toLowerCase())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { value } = await request.json();
  if (!value || !["courier", "other"].every((group) => Array.isArray(value[group]?.order) && typeof value[group]?.widths === "object"))
    return NextResponse.json({ error: "Invalid Payment Voucher column layout." }, { status: 400 });
  const { error } = await supabase.from("app_settings").upsert({ key: KEY, value: JSON.stringify(value) }, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, value });
}
