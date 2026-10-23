import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const allowedRoles = new Set(["sales", "pm", "admin", "director", "dev"]);
const normalizePhone = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const normalizeCompany = (value: unknown) =>
  String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: actor } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!allowedRoles.has(String(actor?.role ?? "").toLocaleLowerCase()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const type = request.nextUrl.searchParams.get("type");
  const profileId = request.nextUrl.searchParams.get("id");
  if ((type !== "client" && type !== "company") || !profileId)
    return NextResponse.json(
      { error: "A valid profile type and ID are required." },
      { status: 400 },
    );

  const linkColumn =
    type === "client" ? "client_profile_id" : "company_profile_id";
  const { data: links, error: linksError } = await supabaseAdmin
    .from("customer_profile_lead_links")
    .select("client_id")
    .eq(linkColumn, profileId);
  if (linksError)
    return NextResponse.json({ error: linksError.message }, { status: 500 });

  const clientIds = new Set(
    (links ?? []).map((link) => String(link.client_id)).filter(Boolean),
  );
  const columnKey = type === "client" ? "client:phone" : "client:company";
  const { data: indexedValues, error: indexError } = await supabaseAdmin
    .from("crm_board_read_values")
    .select("client_id, text_value")
    .eq("column_key", columnKey);
  if (indexError)
    return NextResponse.json({ error: indexError.message }, { status: 500 });

  if (type === "client") {
    const { data: phones, error } = await supabaseAdmin
      .from("customer_client_profile_phone_numbers")
      .select("phone_number")
      .eq("client_profile_id", profileId);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    const targets = new Set(
      (phones ?? [])
        .map((phone) => normalizePhone(phone.phone_number))
        .filter(Boolean),
    );
    for (const value of indexedValues ?? []) {
      if (targets.has(normalizePhone(value.text_value)))
        clientIds.add(String(value.client_id));
    }
  } else {
    const { data: company, error } = await supabaseAdmin
      .from("customer_company_profiles")
      .select("name")
      .eq("id", profileId)
      .maybeSingle();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    if (!company)
      return NextResponse.json({ error: "Company profile not found." }, { status: 404 });
    const target = normalizeCompany(company.name);
    for (const value of indexedValues ?? []) {
      if (target && normalizeCompany(value.text_value) === target)
        clientIds.add(String(value.client_id));
    }
  }

  return NextResponse.json({ clientIds: [...clientIds] });
}
