import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const INTERNAL_ROLES = new Set(["sales", "pm", "admin", "director", "dev"]);

function currentClosedLeadsGroupName(closingDate?: string) {
  const source = closingDate ? new Date(closingDate) : new Date();
  if (Number.isNaN(source.getTime())) throw new Error("Invalid closing date");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(source);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const periodMonth = new Date(value("year"), value("month") - 1, 1);
  if (value("day") >= 26) periodMonth.setMonth(periodMonth.getMonth() + 1);
  return `Closed Leads - ${new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Singapore",
  }).format(periodMonth)}`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !INTERNAL_ROLES.has(String(profile?.role ?? "").toLowerCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  let name: string;
  try {
    name = currentClosedLeadsGroupName(
      typeof body?.closingDate === "string" ? body.closingDate : undefined,
    );
  } catch {
    return NextResponse.json({ error: "Invalid closing date" }, { status: 400 });
  }
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("crm_groups")
    .select("id, name, color, sort_order")
    .ilike("name", name)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  if (existing) return NextResponse.json(existing);

  const { data: latestGroup, error: latestGroupError } = await supabaseAdmin
    .from("crm_groups")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestGroupError) return NextResponse.json({ error: latestGroupError.message }, { status: 500 });

  const { data, error } = await supabaseAdmin
    .from("crm_groups")
    .insert({
      name,
      color: "#7BCBD5",
      sort_order: Number(latestGroup?.sort_order ?? -1) + 1,
      created_by: user.id,
    })
    .select("id, name, color, sort_order")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
