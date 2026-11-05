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
    const [overdue, groupsResult] = await Promise.all([
      getSystemLabel("samples_sent_status", "samples_sent_status_overdue"),
      supabaseAdmin
        .from("samples_sent_groups")
        .select("id, name"),
    ]);
    if (groupsResult.error) throw groupsResult.error;
    const groupsByName = new Map(
      (groupsResult.data ?? []).map((group) => [group.name, group.id]),
    );
    const outstandingGroupId = groupsByName.get("Outstanding");
    if (!outstandingGroupId) throw new Error("The Samples Sent Outstanding group is not configured.");
    const excludedGroupIds = new Set(
      ["Returned", "No need to return", "Failed to return", "Request not to return"]
        .map((name) => groupsByName.get(name))
        .filter((id): id is string => Boolean(id)),
    );
    const today = singaporeToday();
    const { data: candidates, error: candidatesError } = await supabaseAdmin
      .from("samples_sent")
      .select("id, return_by, status_option_id, group_id")
      .is("deactivated_at", null)
      .not("return_by", "is", null)
      .lt("return_by", today);
    if (candidatesError) throw candidatesError;

    let markedOverdue = 0;
    let skipped = 0;
    const failures: Array<{ id: string; error: string }> = [];
    for (const record of candidates ?? []) {
      if (excludedGroupIds.has(record.group_id ?? "")) {
        skipped += 1;
        continue;
      }
      if (record.status_option_id === overdue.id && record.group_id === outstandingGroupId) {
        skipped += 1;
        continue;
      }
      const { error } = await supabaseAdmin
        .from("samples_sent")
        .update({
          status: overdue.value,
          status_option_id: overdue.id,
          group_id: outstandingGroupId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", record.id)
        .eq("return_by", record.return_by);
      if (error) {
        failures.push({ id: record.id, error: error.message });
      } else {
        markedOverdue += 1;
      }
    }
    return NextResponse.json({ ok: failures.length === 0, today, markedOverdue, skipped, failures });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Could not mark Samples Sent records overdue.",
    }, { status: 500 });
  }
}
