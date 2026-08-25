import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function authenticatedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

function normalizePhone(value: string) {
  return value.trim().replace(/[\s()-]/g, "");
}

export async function GET() {
  const user = await authenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [clientsResult, companiesResult] = await Promise.all([
    supabaseAdmin.from("customer_client_profiles").select("id, phone_number, name, remarks, created_at").order("name"),
    supabaseAdmin.from("customer_company_profiles").select("id, name, payment_term, industry, organization_type, remarks, created_at").order("name"),
  ]);
  if (clientsResult.error) return NextResponse.json({ error: clientsResult.error.message }, { status: 500 });
  if (companiesResult.error) return NextResponse.json({ error: companiesResult.error.message }, { status: 500 });
  return NextResponse.json({ clients: clientsResult.data ?? [], companies: companiesResult.data ?? [] });
}

export async function POST(request: NextRequest) {
  const user = await authenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const type = String(body.type ?? "");

  if (type === "client") {
    const phoneNumber = normalizePhone(String(body.phoneNumber ?? ""));
    const name = String(body.name ?? "").trim();
    if (!phoneNumber || !name) return NextResponse.json({ error: "Name and phone number are required." }, { status: 400 });
    const { data, error } = await supabaseAdmin.from("customer_client_profiles").insert({ phone_number: phoneNumber, name, remarks: String(body.remarks ?? "").trim() || null, created_by: user.id }).select("id, phone_number, name, remarks, created_at").single();
    if (error?.code === "23505") return NextResponse.json({ error: "A client profile with this phone number already exists." }, { status: 409 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ client: data }, { status: 201 });
  }

  if (type === "company") {
    const name = String(body.name ?? "").trim();
    const organizationType = String(body.organizationType ?? "").trim();
    if (!name) return NextResponse.json({ error: "Company name is required." }, { status: 400 });
    if (organizationType && !["Government", "Semi", "Private"].includes(organizationType)) return NextResponse.json({ error: "Invalid organization type." }, { status: 400 });
    const { data, error } = await supabaseAdmin.from("customer_company_profiles").insert({ name, payment_term: String(body.paymentTerm ?? "").trim() || null, industry: String(body.industry ?? "").trim() || null, organization_type: organizationType || null, remarks: String(body.remarks ?? "").trim() || null, created_by: user.id }).select("id, name, payment_term, industry, organization_type, remarks, created_at").single();
    if (error?.code === "23505") return NextResponse.json({ error: "A company profile with this name already exists." }, { status: 409 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ company: data }, { status: 201 });
  }

  return NextResponse.json({ error: "Invalid customer profile type." }, { status: 400 });
}
