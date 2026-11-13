import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

const normalizePhone = (value: string) => value.replace(/\D/g, "");
const normalizeCompany = (value: string) =>
  value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
const normalizeEmail = (value: string) => value.trim().toLocaleLowerCase();
const isValidEmail = (value: string) =>
  value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export async function ensureCustomerProfilesForLead(input: {
  clientId: string;
  clientName: string;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  createdBy?: string | null;
}) {
  const linked: { client_profile_id?: string; company_profile_id?: string } = {};
  const phone = String(input.phone ?? "").trim();
  const email = normalizeEmail(String(input.email ?? ""));
  const company = String(input.company ?? "").trim();
  const normalizedPhone = normalizePhone(phone);
  const validEmail = isValidEmail(email);

  const [phoneResult, emailResult] = await Promise.all([
    normalizedPhone
      ? supabaseAdmin
          .from("customer_client_profile_phone_numbers")
          .select("client_profile_id")
          .eq("normalized_phone", normalizedPhone)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    validEmail
      ? supabaseAdmin
          .from("customer_client_profiles")
          .select("id")
          .ilike("email", email)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (phoneResult.error) throw phoneResult.error;
  if (emailResult.error) throw emailResult.error;

  const phoneProfileId = phoneResult.data?.client_profile_id ?? null;
  const emailProfileId = emailResult.data?.id ?? null;
  if (phoneProfileId && emailProfileId && phoneProfileId !== emailProfileId) {
    // Automated ingestion must never merge two established identities.
    throw new Error(
      "The supplied phone number and email address belong to different customer profiles.",
    );
  }

  const existingProfileId = phoneProfileId ?? emailProfileId;
  if (existingProfileId) {
    linked.client_profile_id = existingProfileId;
    if (validEmail && phoneProfileId && !emailProfileId) {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("customer_client_profiles")
        .select("email")
        .eq("id", existingProfileId)
        .single();
      if (profileError) throw profileError;
      const currentEmail = normalizeEmail(profile.email ?? "");
      if (currentEmail && currentEmail !== email) {
        throw new Error(
          "The supplied phone number belongs to a customer profile with a different email address.",
        );
      }
      if (!currentEmail) {
        // Inbound data may enrich a blank profile email, but never replace one
        // that was deliberately set through the customer-profile flow.
        const { error } = await supabaseAdmin
          .from("customer_client_profiles")
          .update({ email })
          .eq("id", existingProfileId);
        if (error) throw error;
      }
    }
    if (normalizedPhone && emailProfileId && !phoneProfileId) {
      const { data: phones, error } = await supabaseAdmin
        .from("customer_client_profile_phone_numbers")
        .select("phone_number, is_primary")
        .eq("client_profile_id", existingProfileId)
        .order("created_at");
      if (error) throw error;
      const entries = [
        ...(phones ?? []).map((item) => ({
          phoneNumber: item.phone_number,
          isPrimary: item.is_primary,
        })),
        { phoneNumber: phone, isPrimary: !(phones?.length) },
      ];
      const uniqueEntries = Array.from(
        new Map(
          entries.map((entry) => [normalizePhone(entry.phoneNumber), entry]),
        ).values(),
      );
      const { error: phoneError } = await supabaseAdmin.rpc(
        "replace_customer_client_profile_phone_numbers",
        { target_profile_id: existingProfileId, phone_entries: uniqueEntries },
      );
      if (phoneError) throw phoneError;
    }
  } else if (normalizedPhone || validEmail) {
    const { data: profile, error } = await supabaseAdmin
      .from("customer_client_profiles")
      .insert({
        name: input.clientName.trim() || "Unnamed client",
        phone_number: normalizedPhone ? phone : null,
        email: validEmail ? email : null,
        created_by: input.createdBy ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    if (normalizedPhone) {
      const { error: numbersError } = await supabaseAdmin.rpc(
        "replace_customer_client_profile_phone_numbers",
        {
          target_profile_id: profile.id,
          phone_entries: [{ phoneNumber: phone, isPrimary: true }],
        },
      );
      if (numbersError) {
        await supabaseAdmin
          .from("customer_client_profiles")
          .delete()
          .eq("id", profile.id);
        throw numbersError;
      }
    }
    linked.client_profile_id = profile.id;
  }

  if (company) {
    const { data: profiles, error: lookupError } = await supabaseAdmin
      .from("customer_company_profiles")
      .select("id, name");
    if (lookupError) throw lookupError;
    const existing = profiles?.find(
      (profile) => normalizeCompany(profile.name) === normalizeCompany(company),
    );
    if (existing) linked.company_profile_id = existing.id;
    else {
      const { data: profile, error } = await supabaseAdmin
        .from("customer_company_profiles")
        .insert({ name: company, created_by: input.createdBy ?? null })
        .select("id")
        .single();
      if (error) throw error;
      linked.company_profile_id = profile.id;
    }
  }
  if (!linked.client_profile_id && !linked.company_profile_id) return;
  const { error } = await supabaseAdmin
    .from("customer_profile_lead_links")
    .upsert(
      {
        client_id: input.clientId,
        ...linked,
        updated_by: input.createdBy ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id" },
    );
  if (error) throw error;
}
