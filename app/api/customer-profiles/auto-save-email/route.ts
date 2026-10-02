import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const normalizePhone = (value: string) => value.replace(/\D/g, "");
const isValidEmail = (value: string) =>
  value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Record<string, unknown>;
  const clientId = String(body.clientId ?? "").trim();
  if (!clientId)
    return NextResponse.json({ error: "A client is required." }, { status: 400 });

  const { data: actor, error: actorError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (actorError)
    return NextResponse.json({ error: actorError.message }, { status: 500 });
  const role = String(actor?.role ?? "").toLowerCase();
  const isPrivileged = ["admin", "director", "dev"].includes(role);
  if (!isPrivileged) {
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from("client_assignees")
      .select("client_id")
      .eq("client_id", clientId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (assignmentError)
      return NextResponse.json({ error: assignmentError.message }, { status: 500 });
    if (!assignment) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Read the current lead state rather than trusting a browser-supplied email.
  // This makes concurrent edits settle on the latest saved email.
  const { data: lead, error: leadError } = await supabaseAdmin
    .from("clients")
    .select("phone, email")
    .eq("id", clientId)
    .maybeSingle();
  if (leadError)
    return NextResponse.json({ error: leadError.message }, { status: 500 });
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  const phone = normalizePhone(String(lead.phone ?? ""));
  const email = String(lead.email ?? "").trim();
  if (!phone || !email || !isValidEmail(email))
    return NextResponse.json({ updated: false, reason: "no-valid-email-or-phone" });

  const { data: phoneMatch, error: matchError } = await supabaseAdmin
    .from("customer_client_profile_phone_numbers")
    .select("client_profile_id")
    .eq("normalized_phone", phone)
    .maybeSingle();
  if (matchError)
    return NextResponse.json({ error: matchError.message }, { status: 500 });
  if (!phoneMatch?.client_profile_id)
    return NextResponse.json({ updated: false, reason: "no-profile-for-phone" });

  // Fill only: a manually supplied profile email is never overwritten.
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("customer_client_profiles")
    .update({ email })
    .eq("id", phoneMatch.client_profile_id)
    .is("email", null)
    .select("id")
    .maybeSingle();
  if (updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ updated: Boolean(updated) });
}
