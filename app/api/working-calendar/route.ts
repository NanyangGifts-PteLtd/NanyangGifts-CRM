import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MANAGERS = new Set(["admin", "director", "dev"]);

async function authorised() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!MANAGERS.has(String(profile?.role ?? "").toLowerCase())) throw new Error("Forbidden");
  return { supabase, user };
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "Calendar request failed.";
  return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400 });
}

export async function GET() {
  try {
    const { supabase } = await authorised();
    const { data, error } = await supabase.from("working_calendar_days")
      .select("id, calendar_code, date, name, kind, is_non_working, source")
      .eq("calendar_code", "sg").order("date");
    if (error) throw error;
    return NextResponse.json({ days: data ?? [] });
  } catch (error) { return fail(error); }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await authorised();
    const body = await request.json() as { id?: string; date?: string; name?: string; kind?: string; isNonWorking?: boolean };
    const date = String(body.date ?? "");
    const name = String(body.name ?? "").trim();
    const kind = ["public_holiday", "company_closure", "manual_override"].includes(String(body.kind)) ? String(body.kind) : "manual_override";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !name) throw new Error("Date and name are required.");
    const values = { calendar_code: "sg", date, name, kind, is_non_working: body.isNonWorking !== false, source: "manual", created_by: user.id };
    const query = body.id
      ? supabase.from("working_calendar_days").update(values).eq("id", body.id).select().single()
      : supabase.from("working_calendar_days").upsert(values, { onConflict: "calendar_code,date" }).select().single();
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ day: data });
  } catch (error) { return fail(error); }
}

export async function DELETE(request: NextRequest) {
  try {
    const { supabase } = await authorised();
    const id = request.nextUrl.searchParams.get("id");
    if (!id) throw new Error("Calendar day is required.");
    const { data: existing, error: existingError } = await supabase
      .from("working_calendar_days").select("source").eq("id", id).maybeSingle();
    if (existingError || !existing) throw new Error("Calendar day was not found.");
    if (existing.source === "mom_data_gov_sg") throw new Error("Official MOM public holidays cannot be deleted.");
    const { error } = await supabase.from("working_calendar_days").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) { return fail(error); }
}
