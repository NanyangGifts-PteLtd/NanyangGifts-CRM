import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

const normalizePhone = (value: string) => value.replace(/\D/g, "");
const normalizeCompany = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
const normalizeEmail = (value: string) => value.trim();
const isValidEmail = (value: string) =>
  value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export async function ensureCustomerProfilesForLead(input: { clientId: string; clientName: string; phone?: string | null; email?: string | null; company?: string | null; createdBy?: string | null }) {
  const linked: { client_profile_id?: string; company_profile_id?: string } = {};
  const phone = String(input.phone ?? "").trim();
  const email = normalizeEmail(String(input.email ?? ""));
  const company = String(input.company ?? "").trim();
  if (normalizePhone(phone)) {
    const { data: existing, error: lookupError } = await supabaseAdmin.from("customer_client_profile_phone_numbers").select("client_profile_id").eq("normalized_phone", normalizePhone(phone)).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing?.client_profile_id) {
      linked.client_profile_id = existing.client_profile_id;
      if (isValidEmail(email)) {
        // Fill only: inbound data must never replace a profile email that was
        // explicitly set on the Customer Profiles page.
        const { error: emailError } = await supabaseAdmin
          .from("customer_client_profiles")
          .update({ email })
          .eq("id", existing.client_profile_id)
          .is("email", null);
        if (emailError) throw emailError;
      }
    }
    else {
      const { data: profile, error } = await supabaseAdmin.from("customer_client_profiles").insert({ name: input.clientName.trim() || "Unnamed client", phone_number: phone, email: isValidEmail(email) ? email : null, created_by: input.createdBy ?? null }).select("id").single();
      if (error) throw error;
      const { error: numbersError } = await supabaseAdmin.rpc("replace_customer_client_profile_phone_numbers", { target_profile_id: profile.id, phone_entries: [{ phoneNumber: phone, isPrimary: true }] });
      if (numbersError) { await supabaseAdmin.from("customer_client_profiles").delete().eq("id", profile.id); throw numbersError; }
      linked.client_profile_id = profile.id;
    }
  }
  if (company) {
    const { data: profiles, error: lookupError } = await supabaseAdmin.from("customer_company_profiles").select("id, name");
    if (lookupError) throw lookupError;
    const existing = profiles?.find((profile) => normalizeCompany(profile.name) === normalizeCompany(company));
    if (existing) linked.company_profile_id = existing.id;
    else {
      const { data: profile, error } = await supabaseAdmin.from("customer_company_profiles").insert({ name: company, created_by: input.createdBy ?? null }).select("id").single();
      if (error) throw error;
      linked.company_profile_id = profile.id;
    }
  }
  if (!linked.client_profile_id && !linked.company_profile_id) return;
  const { error } = await supabaseAdmin.from("customer_profile_lead_links").upsert({ client_id: input.clientId, ...linked, updated_by: input.createdBy ?? null, updated_at: new Date().toISOString() }, { onConflict: "client_id" });
  if (error) throw error;
}
