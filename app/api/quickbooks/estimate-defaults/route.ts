import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const normalizeCompany = (value: string) =>
  value.trim().toLocaleLowerCase().replace(/\s+/g, " ");

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // The normal client query observes the CRM RLS policy before the service
  // role reads profile metadata that is intentionally not browser-readable.
  const { data: client } = await supabase
    .from("clients")
    .select("id, company")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const [{ data: profile }, { data: link }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle(),
    supabaseAdmin
      .from("customer_profile_lead_links")
      .select("company_profile_id")
      .eq("client_id", clientId)
      .maybeSingle(),
  ]);

  let companyProfile: { payment_term: string | null } | null = null;
  if (link?.company_profile_id) {
    const { data } = await supabaseAdmin
      .from("customer_company_profiles")
      .select("payment_term")
      .eq("id", link.company_profile_id)
      .maybeSingle();
    companyProfile = data;
  } else if (client.company?.trim()) {
    const { data } = await supabaseAdmin
      .from("customer_company_profiles")
      .select("name, payment_term");
    companyProfile =
      data?.find(
        (candidate) =>
          normalizeCompany(candidate.name) === normalizeCompany(client.company),
      ) ?? null;
  }

  return NextResponse.json({
    salesperson: profile?.full_name?.trim() || profile?.email || user.email || "CRM user",
    paymentTerm: companyProfile?.payment_term?.trim() || "",
    paymentTermSource: companyProfile?.payment_term?.trim()
      ? "Company Profile"
      : null,
  });
}
