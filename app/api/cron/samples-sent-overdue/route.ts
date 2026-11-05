import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSystemLabel } from "@/lib/system-labels";

function authorized(request: NextRequest) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const left = Buffer.from(supplied);
  const right = Buffer.from(secret);
  return left.length === right.length && timingSafeEqual(left, right);
}

function singaporeToday() {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Singapore",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date())
      .filter((part) => ["year", "month", "day"].includes(part.type))
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const [overdue, requestNoReturn, failedReturn, returned, noNeedToReturn, groups] = await Promise.all([
      getSystemLabel("samples_sent_status", "samples_sent_status_overdue"),
      getSystemLabel("samples_sent_status", "samples_sent_status_request_to_not_return"),
      getSystemLabel("samples_sent_status", "samples_sent_status_fail_to_return_remarks"),
      getSystemLabel("samples_sent_status", "samples_sent_status_returned"),
      getSystemLabel("samples_sent_status", "samples_sent_status_no_need_to_return"),
      supabaseAdmin
        .from("samples_sent_groups")
        .select("id")
        .eq("name", "Outstanding")
        .maybeSingle(),
    ]);
    if (groups.error || !groups.data) throw groups.error ?? new Error("The Samples Sent Outstanding group is not configured.");
    const today = singaporeToday();
    const { data: candidates, error: candidatesError } = await supabaseAdmin
      .from("samples_sent")
      .select("id, return_by, status_option_id")
      .is("deactivated_at", null)
      .not("return_by", "is", null)
      .lt("return_by", today)
      .not(
        "status_option_id",
        "in",
        `(${[
          overdue.id,
          requestNoReturn.id,
          failedReturn.id,
          returned.id,
          noNeedToReturn.id,
        ].join(",")})`,
      );
    if (candidatesError) throw candidatesError;

    let markedOverdue = 0;
    const failures: Array<{ id: string; error: string }> = [];
    for (const record of candidates ?? []) {
      const { error } = await supabaseAdmin
        .from("samples_sent")
        .update({
          status: overdue.value,
          status_option_id: overdue.id,
          group_id: groups.data.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", record.id)
        .eq("return_by", record.return_by)
        .not(
          "status_option_id",
          "in",
          `(${[
            overdue.id,
            requestNoReturn.id,
            failedReturn.id,
            returned.id,
            noNeedToReturn.id,
          ].join(",")})`,
        );
      if (error) {
        failures.push({ id: record.id, error: error.message });
      } else {
        markedOverdue += 1;
      }
    }
    return NextResponse.json({ ok: failures.length === 0, today, markedOverdue, failures });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Could not mark Samples Sent records overdue.",
    }, { status: 500 });
  }
}
