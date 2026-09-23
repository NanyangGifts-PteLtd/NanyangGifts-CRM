import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const normalizePhone = (value: string) => value.replace(/\D/g, "");

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: actor } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!["sales", "pm", "admin", "director", "dev"].includes(String(actor?.role ?? "").toLowerCase())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json() as Record<string, unknown>;
  const clientId = String(body.clientId ?? "").trim();
  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  if (!clientId || !name || !normalizePhone(phone)) return NextResponse.json({ error: "A contact name and phone number are required." }, { status: 400 });
  const { data: lead } = await supabaseAdmin.from("clients").select("id").eq("id", clientId).maybeSingle();
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  let { data: match } = await supabaseAdmin.from("customer_client_profile_phone_numbers").select("client_profile_id").eq("normalized_phone", normalizePhone(phone)).maybeSingle();
  let profileId = match?.client_profile_id;
  if (!profileId) {
    const { data: created, error } = await supabaseAdmin.from("customer_client_profiles").insert({ name, phone_number: phone, created_by: user.id }).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    profileId = created.id;
    const { error: phoneError } = await supabaseAdmin.rpc("replace_customer_client_profile_phone_numbers", { target_profile_id: profileId, phone_entries: [{ phoneNumber: phone, isPrimary: true }] });
    if (phoneError) return NextResponse.json({ error: phoneError.message }, { status: 409 });
  }
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("customer_profile_lead_links")
    .select("id")
    .eq("client_id", clientId)
    .eq("client_profile_id", profileId)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  if (existing) {
    return NextResponse.json(
      { error: "This client profile is already linked to this lead." },
      { status: 409 },
    );
  }
  const { error } = await supabaseAdmin.from("customer_profile_lead_links").insert({ client_id: clientId, client_profile_id: profileId, is_primary_client: false, updated_by: user.id, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, profileId });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: actor } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!["sales", "pm", "admin", "director", "dev"].includes(String(actor?.role ?? "").toLowerCase())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json() as Record<string, unknown>;
  const clientId = String(body.clientId ?? "").trim();
  const profileId = String(body.profileId ?? "").trim();
  if (!clientId || !profileId) return NextResponse.json({ error: "A lead and client profile are required." }, { status: 400 });
  const { data: link, error: findError } = await supabaseAdmin
    .from("customer_profile_lead_links")
    .select("id, is_primary_client, company_profile_id")
    .eq("client_id", clientId)
    .eq("client_profile_id", profileId)
    .maybeSingle();
  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });
  if (!link) return NextResponse.json({ error: "This client profile is not linked to the lead." }, { status: 404 });
  if (link.is_primary_client) return NextResponse.json({ error: "The primary client profile cannot be removed here." }, { status: 400 });
  const { error } = link.company_profile_id
    ? await supabaseAdmin.from("customer_profile_lead_links").update({ client_profile_id: null, is_primary_client: false, updated_by: user.id, updated_at: new Date().toISOString() }).eq("id", link.id)
    : await supabaseAdmin.from("customer_profile_lead_links").delete().eq("id", link.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
