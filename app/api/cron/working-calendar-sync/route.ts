import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const DATASET_ID = "d_8ef23381f9417e4d4254ee8b4dcdb176";

function authorized(request: NextRequest) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const left = Buffer.from(supplied);
  const right = Buffer.from(secret);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    let url: string | null = `https://api-production.data.gov.sg/v2/public/api/datasets/${DATASET_ID}/list-rows`;
    const entries: Array<{ date: string; name: string }> = [];
    while (url && entries.length < 500) {
      const response: Response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error(`Official holiday source returned ${response.status}.`);
      const result: any = await response.json();
      for (const raw of result?.data?.rows ?? []) {
        const row = raw?.row ?? raw;
        const date = String(row?.date ?? row?.Date ?? "");
        const name = String(row?.holiday ?? row?.Holiday ?? "").trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(date) && name) entries.push({ date, name });
      }
      url = typeof result?.data?.links?.next === "string" && result.data.links.next ? result.data.links.next : null;
    }
    if (!entries.length) throw new Error("The official holiday dataset returned no usable dates.");

    const dates = [...new Set(entries.map((entry) => entry.date))];
    const { data: existing, error: readError } = await supabaseAdmin.from("working_calendar_days")
      .select("date, source").eq("calendar_code", "sg").in("date", dates);
    if (readError) throw readError;
    const sources = new Map((existing ?? []).map((row) => [String(row.date), String(row.source)]));
    const sourceUpdatedAt = new Date().toISOString();
    const rows = entries
      .filter((entry) => !sources.has(entry.date) || sources.get(entry.date) === "mom_data_gov_sg")
      .map((entry) => ({ calendar_code: "sg", date: entry.date, name: entry.name, kind: "public_holiday", is_non_working: true, source: "mom_data_gov_sg", source_updated_at: sourceUpdatedAt }));
    if (rows.length) {
      const { error } = await supabaseAdmin.from("working_calendar_days").upsert(rows, { onConflict: "calendar_code,date" });
      if (error) throw error;
    }
    return NextResponse.json({ ok: true, imported: rows.length, skippedManual: entries.length - rows.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not refresh official holidays." }, { status: 500 });
  }
}
