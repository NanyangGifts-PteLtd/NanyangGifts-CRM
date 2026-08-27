import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const PAYMENT_TERMS = ["Net 30", "Net 60", "Net 90", "Due on Receipt", "End of Month (EOM)", "Cash on Delivery (COD)", "Payment in Advance (PIA)"];
const COMPANY_SELECT = "id, name, payment_term, industry, industry_option_id, industry_custom_text, industry_source, organization_type, remarks, created_at, industry_option:industry_options!customer_company_profiles_industry_option_id_fkey(id, code, name, section_code, section_name)";
const CLIENT_SELECT = "id, phone_number, name, remarks, is_blacklisted, blacklisted_at, created_at, phone_numbers:customer_client_profile_phone_numbers(id, phone_number, is_primary)";

async function authenticatedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function resolvePhoneEntries(body: Record<string, unknown>) {
  const supplied = Array.isArray(body.phoneNumbers) ? body.phoneNumbers : [{ phoneNumber: body.phoneNumber, isPrimary: true }];
  const entries = supplied.map((entry) => {
    const value = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    return { phoneNumber: String(value.phoneNumber ?? "").trim(), isPrimary: value.isPrimary === true };
  });
  if (entries.length < 1 || entries.length > 20) return { error: "A client must have between 1 and 20 phone numbers." };
  if (entries.some((entry) => !normalizePhone(entry.phoneNumber))) return { error: "Phone numbers cannot be blank." };
  if (entries.filter((entry) => entry.isPrimary).length !== 1) return { error: "Choose exactly one main phone number." };
  const normalized = entries.map((entry) => normalizePhone(entry.phoneNumber));
  if (new Set(normalized).size !== entries.length) return { error: "The same phone number cannot be added more than once." };
  return { entries, primary: entries.find((entry) => entry.isPrimary)!.phoneNumber };
}

async function loadClientProfile(id: string) {
  return supabaseAdmin.from("customer_client_profiles").select(CLIENT_SELECT).eq("id", id).single();
}

async function resolveIndustry(body: Record<string, unknown>) {
  const industryOptionId = String(body.industryOptionId ?? "").trim();
  const customText = String(body.industryCustomText ?? body.industry ?? "").trim().slice(0, 300);

  if (!industryOptionId) {
    return {
      values: {
        industry: customText || null,
        industry_option_id: null,
        industry_custom_text: customText || null,
        industry_source: customText ? "manual_custom" : null,
      },
    };
  }

  const { data: option, error } = await supabaseAdmin
    .from("industry_options")
    .select("id, name")
    .eq("id", industryOptionId)
    .eq("classification", "SSIC")
    .eq("classification_year", 2025)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!option) return { error: "The selected SSIC industry is no longer available." };
  return {
    values: {
      industry: option.name,
      industry_option_id: option.id,
      industry_custom_text: null,
      industry_source: "manual_ssic",
    },
  };
}

export async function GET() {
  const user = await authenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [clientsResult, companiesResult, linksResult] = await Promise.all([
    supabaseAdmin.from("customer_client_profiles").select(CLIENT_SELECT).order("name"),
    supabaseAdmin.from("customer_company_profiles").select(COMPANY_SELECT).order("name"),
    supabaseAdmin.from("customer_profile_lead_links").select("client_id, client_profile_id, company_profile_id"),
  ]);
  if (clientsResult.error) return NextResponse.json({ error: clientsResult.error.message }, { status: 500 });
  if (companiesResult.error) return NextResponse.json({ error: companiesResult.error.message }, { status: 500 });
  if (linksResult.error) return NextResponse.json({ error: linksResult.error.message }, { status: 500 });
  return NextResponse.json({ clients: clientsResult.data ?? [], companies: companiesResult.data ?? [], links: linksResult.data ?? [] });
}

export async function POST(request: NextRequest) {
  const user = await authenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const type = String(body.type ?? "");

  if (type === "client") {
    const phones = resolvePhoneEntries(body);
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (phones.error || !phones.entries || !phones.primary) return NextResponse.json({ error: phones.error }, { status: 400 });
    const { data: created, error } = await supabaseAdmin.from("customer_client_profiles").insert({ phone_number: phones.primary, name, created_by: user.id }).select("id").single();
    if (error?.code === "23505") return NextResponse.json({ error: "A client profile with this phone number already exists." }, { status: 409 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { error: phoneError } = await supabaseAdmin.rpc("replace_customer_client_profile_phone_numbers", { target_profile_id: created.id, phone_entries: phones.entries });
    if (phoneError) {
      await supabaseAdmin.from("customer_client_profiles").delete().eq("id", created.id);
      const duplicate = phoneError.code === "23505" || phoneError.message.toLowerCase().includes("unique");
      return NextResponse.json({ error: duplicate ? "One of these phone numbers already belongs to another client profile." : phoneError.message }, { status: duplicate ? 409 : 500 });
    }
    const { data, error: loadError } = await loadClientProfile(created.id);
    if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
    return NextResponse.json({ client: data }, { status: 201 });
  }

  if (type === "company") {
    const name = String(body.name ?? "").trim();
    const organizationType = String(body.organizationType ?? "").trim();
    const paymentTerm = String(body.paymentTerm ?? "").trim();
    if (!name) return NextResponse.json({ error: "Company name is required." }, { status: 400 });
    if (organizationType && !["Government", "Semi", "Private"].includes(organizationType)) return NextResponse.json({ error: "Invalid organization type." }, { status: 400 });
    if (paymentTerm && !PAYMENT_TERMS.includes(paymentTerm)) return NextResponse.json({ error: "Invalid payment term." }, { status: 400 });
    const industry = await resolveIndustry(body);
    if (industry.error) return NextResponse.json({ error: industry.error }, { status: 400 });
    const { data, error } = await supabaseAdmin.from("customer_company_profiles").insert({ name, payment_term: paymentTerm || null, ...industry.values, organization_type: organizationType || null, created_by: user.id }).select(COMPANY_SELECT).single();
    if (error?.code === "23505") return NextResponse.json({ error: "A company profile with this name already exists." }, { status: 409 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ company: data }, { status: 201 });
  }

  return NextResponse.json({ error: "Invalid customer profile type." }, { status: 400 });
}

export async function PATCH(request: NextRequest) {
  const user = await authenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const type = String(body.type ?? "");
  const id = String(body.id ?? "");
  if (!id || !["client", "company"].includes(type)) return NextResponse.json({ error: "A valid profile type and ID are required." }, { status: 400 });

  if (typeof body.isBlacklisted === "boolean") {
    const { data: actor } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (type !== "client" || !actor?.role || !["director", "dev"].includes(actor.role.toLowerCase())) return NextResponse.json({ error: "Only directors and developers can change blacklist status." }, { status: 403 });
    const { data, error } = await supabaseAdmin.from("customer_client_profiles").update({ is_blacklisted: body.isBlacklisted, blacklisted_at: body.isBlacklisted ? new Date().toISOString() : null, blacklisted_by: body.isBlacklisted ? user.id : null }).eq("id", id).select(CLIENT_SELECT).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ client: data });
  }

  if (type === "client") {
    const name = String(body.name ?? "").trim();
    const phones = resolvePhoneEntries(body);
    if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (phones.error || !phones.entries) return NextResponse.json({ error: phones.error }, { status: 400 });
    const { error: phoneError } = await supabaseAdmin.rpc("replace_customer_client_profile_phone_numbers", { target_profile_id: id, phone_entries: phones.entries });
    if (phoneError) {
      const duplicate = phoneError.code === "23505" || phoneError.message.toLowerCase().includes("unique");
      return NextResponse.json({ error: duplicate ? "One of these phone numbers already belongs to another client profile." : phoneError.message }, { status: duplicate ? 409 : 500 });
    }
    const { error: updateError } = await supabaseAdmin.from("customer_client_profiles").update({ name }).eq("id", id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    const { data, error } = await loadClientProfile(id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ client: data });
  }

  const name = String(body.name ?? "").trim();
  const paymentTerm = String(body.paymentTerm ?? "").trim();
  const organizationType = String(body.organizationType ?? "").trim();
  if (!name) return NextResponse.json({ error: "Company name is required." }, { status: 400 });
  if (paymentTerm && !PAYMENT_TERMS.includes(paymentTerm)) return NextResponse.json({ error: "Invalid payment term." }, { status: 400 });
  if (organizationType && !["Government", "Semi", "Private"].includes(organizationType)) return NextResponse.json({ error: "Invalid organization type." }, { status: 400 });
  const industry = await resolveIndustry(body);
  if (industry.error) return NextResponse.json({ error: industry.error }, { status: 400 });
  const { data, error } = await supabaseAdmin.from("customer_company_profiles").update({ name, payment_term: paymentTerm || null, ...industry.values, organization_type: organizationType || null }).eq("id", id).select(COMPANY_SELECT).single();
  if (error?.code === "23505") return NextResponse.json({ error: "A company profile with this name already exists." }, { status: 409 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ company: data });
}

export async function DELETE(request: NextRequest) {
  const user = await authenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile?.role || !["admin", "director", "dev"].includes(profile.role.toLowerCase())) return NextResponse.json({ error: "Only admins, directors, and developers can delete customer profiles." }, { status: 403 });

  const body = await request.json() as { type?: string; id?: string };
  if (!body.id || !["client", "company"].includes(body.type ?? "")) return NextResponse.json({ error: "A valid profile type and ID are required." }, { status: 400 });
  const table = body.type === "client" ? "customer_client_profiles" : "customer_company_profiles";
  const { error } = await supabaseAdmin.from(table).delete().eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
