import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ROLES = ["pm", "director", "dev"];
async function authorized() { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return null; const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(); return data?.role && ROLES.includes(data.role) ? user : null; }

export async function POST(request: NextRequest) {
  const user = await authorized(); if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json() as { action?: "create" | "update" | "delete"; id?: string; shipperId?: string; values?: Record<string, string> };
  if (body.action === "create" && body.shipperId) { const { data, error } = await supabaseAdmin.from("shipper_staging_rows").insert({ shipper_id: body.shipperId, values: body.values ?? {}, created_by: user.id }).select().single(); return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json(data); }
  if (body.action === "update" && body.id) { const { data: current, error: readError } = await supabaseAdmin.from("shipper_staging_rows").select("values").eq("id", body.id).single(); if (readError) return NextResponse.json({ error: readError.message }, { status: 500 }); const { data, error } = await supabaseAdmin.from("shipper_staging_rows").update({ values: { ...(current.values ?? {}), ...(body.values ?? {}) }, updated_at: new Date().toISOString() }).eq("id", body.id).select().single(); return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json(data); }
  if (body.action === "delete" && body.id) { const { error } = await supabaseAdmin.from("shipper_staging_rows").delete().eq("id", body.id); return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true }); }
  return NextResponse.json({ error: "Invalid staging action" }, { status: 400 });
}
