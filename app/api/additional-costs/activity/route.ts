import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const voucherId = request.nextUrl.searchParams.get("voucherId");
  if (!voucherId) return NextResponse.json({ error: "voucherId is required" }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from("additional_cost_activity_log")
    .select("*")
    .eq("additional_cost_id", voucherId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ rows: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as { voucherId?: string; action?: string; title?: string; meta?: Record<string, unknown> };
  if (!body.voucherId || !body.action || !body.title)
    return NextResponse.json({ error: "Voucher activity details are required" }, { status: 400 });
  const { data: voucher, error: voucherError } = await supabaseAdmin
    .from("additional_costs")
    .select("id, deactivated_at")
    .eq("id", body.voucherId)
    .maybeSingle();
  if (voucherError || !voucher)
    return NextResponse.json({ error: "Payment Voucher not found" }, { status: 404 });
  if (voucher.deactivated_at)
    return NextResponse.json({ error: "A deactivated Payment Voucher cannot receive new activity." }, { status: 400 });
  const { data: profile } = await supabaseAdmin.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();
  const { error } = await supabaseAdmin.from("additional_cost_activity_log").insert({
    additional_cost_id: body.voucherId,
    actor_id: user.id,
    actor_name: profile?.full_name?.trim() || profile?.email || "Unknown user",
    action: body.action,
    title: body.title,
    meta: body.meta ?? {},
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
