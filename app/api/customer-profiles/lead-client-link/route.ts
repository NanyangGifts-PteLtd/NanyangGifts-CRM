import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const normalizePhone = (value: string) => value.replace(/\D/g, "");
const normalizeEmail = (value: string) => value.trim().toLocaleLowerCase();
const isValidEmail = (value: string) =>
  value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

async function authorizedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: actor } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return ["sales", "pm", "admin", "director", "dev"].includes(
    String(actor?.role ?? "").toLowerCase(),
  )
    ? user
    : null;
}

export async function POST(request: NextRequest) {
  const user = await authorizedUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json() as Record<string, unknown>;
  const clientId = String(body.clientId ?? "").trim();
  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const email = normalizeEmail(String(body.email ?? ""));
  const normalizedPhone = normalizePhone(phone);
  if (!clientId || !name || (!normalizedPhone && !email)) {
    return NextResponse.json(
      { error: "A contact name and either a phone number or email address are required." },
      { status: 400 },
    );
  }
  if (email && !isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const { data: lead } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  const [phoneResult, emailResult] = await Promise.all([
    normalizedPhone
      ? supabaseAdmin
          .from("customer_client_profile_phone_numbers")
          .select("client_profile_id")
          .eq("normalized_phone", normalizedPhone)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    email
      ? supabaseAdmin
          .from("customer_client_profiles")
          .select("id")
          .ilike("email", email)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (phoneResult.error || emailResult.error) {
    return NextResponse.json(
      { error: phoneResult.error?.message ?? emailResult.error?.message },
      { status: 500 },
    );
  }
  const phoneProfileId = phoneResult.data?.client_profile_id ?? null;
  const emailProfileId = emailResult.data?.id ?? null;
  if (phoneProfileId && emailProfileId && phoneProfileId !== emailProfileId) {
    return NextResponse.json(
      { error: "The phone number and email address belong to different customer profiles." },
      { status: 409 },
    );
  }
  let profileId = phoneProfileId ?? emailProfileId;
  if (profileId) {
    // A duplicate submission must not enrich an already-linked profile before
    // reporting that the relationship already exists.
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("customer_profile_lead_links")
      .select("id")
      .eq("client_id", clientId)
      .eq("client_profile_id", profileId)
      .maybeSingle();
    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }
    if (existing) {
      return NextResponse.json(
        { error: "This client profile is already linked to this lead." },
        { status: 409 },
      );
    }
  }
  if (!profileId) {
    const { data: created, error } = await supabaseAdmin
      .from("customer_client_profiles")
      .insert({
        name,
        phone_number: normalizedPhone ? phone : null,
        email: email || null,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "That email address already belongs to another client profile." },
        { status: 409 },
      );
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    profileId = created.id;
    if (normalizedPhone) {
      const { error: phoneError } = await supabaseAdmin.rpc(
        "replace_customer_client_profile_phone_numbers",
        { target_profile_id: profileId, phone_entries: [{ phoneNumber: phone, isPrimary: true }] },
      );
      if (phoneError) return NextResponse.json({ error: phoneError.message }, { status: 409 });
    }
  } else if (phoneProfileId && email && !emailProfileId) {
    const { data: profile, error } = await supabaseAdmin
      .from("customer_client_profiles")
      .select("email")
      .eq("id", profileId)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const currentEmail = normalizeEmail(profile.email ?? "");
    if (currentEmail && currentEmail !== email) {
      return NextResponse.json(
        {
          error:
            "This phone number is already linked to a client profile with a different email address. Update that profile first or link the correct contact.",
        },
        { status: 409 },
      );
    }
    if (!currentEmail) {
      const { error: updateError } = await supabaseAdmin
        .from("customer_client_profiles")
        .update({ email })
        .eq("id", profileId);
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 409 });
      }
    }
  } else if (emailProfileId && normalizedPhone && !phoneProfileId) {
    const { data: phones, error } = await supabaseAdmin
      .from("customer_client_profile_phone_numbers")
      .select("phone_number, is_primary")
      .eq("client_profile_id", profileId)
      .order("created_at");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const entries = [
      ...(phones ?? []).map((item) => ({
        phoneNumber: item.phone_number,
        isPrimary: item.is_primary,
      })),
      { phoneNumber: phone, isPrimary: !(phones?.length) },
    ];
    const { error: phoneError } = await supabaseAdmin.rpc(
      "replace_customer_client_profile_phone_numbers",
      { target_profile_id: profileId, phone_entries: entries },
    );
    if (phoneError) {
      return NextResponse.json({ error: phoneError.message }, { status: 409 });
    }
  }
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("customer_profile_lead_links")
    .select("id")
    .eq("client_id", clientId)
    .eq("client_profile_id", profileId)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  if (existing) return NextResponse.json({ error: "This client profile is already linked to this lead." }, { status: 409 });
  const { error } = await supabaseAdmin
    .from("customer_profile_lead_links")
    .insert({ client_id: clientId, client_profile_id: profileId, is_primary_client: false, updated_by: user.id, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, profileId });
}

export async function DELETE(request: NextRequest) {
  const user = await authorizedUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json() as Record<string, unknown>;
  const clientId = String(body.clientId ?? "").trim();
  const profileId = String(body.profileId ?? "").trim();
  if (!clientId || !profileId) return NextResponse.json({ error: "A lead and client profile are required." }, { status: 400 });
  const { data: link, error: findError } = await supabaseAdmin.from("customer_profile_lead_links").select("id, is_primary_client, company_profile_id").eq("client_id", clientId).eq("client_profile_id", profileId).maybeSingle();
  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });
  if (!link) return NextResponse.json({ error: "This client profile is not linked to the lead." }, { status: 404 });
  if (link.is_primary_client) return NextResponse.json({ error: "The primary client profile cannot be removed here." }, { status: 400 });
  const { error } = link.company_profile_id
    ? await supabaseAdmin.from("customer_profile_lead_links").update({ client_profile_id: null, is_primary_client: false, updated_by: user.id, updated_at: new Date().toISOString() }).eq("id", link.id)
    : await supabaseAdmin.from("customer_profile_lead_links").delete().eq("id", link.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
