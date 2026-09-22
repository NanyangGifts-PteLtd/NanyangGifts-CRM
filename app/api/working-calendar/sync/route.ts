import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DATASET_ID = "d_8ef23381f9417e4d4254ee8b4dcdb176";
const MANAGERS = new Set(["admin", "director", "dev"]);

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!MANAGERS.has(String(profile?.role ?? "").toLowerCase())) throw new Error("Forbidden");

    let url: string | null = `https://api-production.data.gov.sg/v2/public/api/datasets/${DATASET_ID}/list-rows`;
    const entries: Array<{ date: string; name: string }> = [];
    while (url && entries.length < 500) {
      const response: Response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error(`Official holiday source returned ${response.status}.`);
      const result: any = await response.json();
      const rows = result?.data?.rows ?? [];
      for (const raw of rows) {
        const row = raw?.row ?? raw;
        const date = String(row?.date ?? row?.Date ?? "");
        const name = String(row?.holiday ?? row?.Holiday ?? "").trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(date) && name) entries.push({ date, name });
      }
      url = typeof result?.data?.links?.next === "string" && result.data.links.next ? result.data.links.next : null;
    }
    if (!entries.length) throw new Error("The official holiday dataset returned no usable dates.");
    const dates = [...new Set(entries.map((entry) => entry.date))];
    const { data: existing, error: readError } = await supabase.from("working_calendar_days")
      .select("date, source").eq("calendar_code", "sg").in("date", dates);
    if (readError) throw readError;
    const existingSource = new Map((existing ?? []).map((row) => [String(row.date), String(row.source)]));
    const sourceUpdatedAt = new Date().toISOString();
    const officialRows = entries.filter((entry) => !existingSource.has(entry.date) || existingSource.get(entry.date) === "mom_data_gov_sg")
      .map((entry) => ({ calendar_code: "sg", date: entry.date, name: entry.name, kind: "public_holiday", is_non_working: true, source: "mom_data_gov_sg", source_updated_at: sourceUpdatedAt }));
    if (officialRows.length) {
      const { error: writeError } = await supabase.from("working_calendar_days").upsert(officialRows, { onConflict: "calendar_code,date" });
      if (writeError) throw writeError;
    }
    return NextResponse.json({ ok: true, imported: officialRows.length, skippedManual: entries.length - officialRows.length, sourceUpdatedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not refresh official holidays.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400 });
  }
}
