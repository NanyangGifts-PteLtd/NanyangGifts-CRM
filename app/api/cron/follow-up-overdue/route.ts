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
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts
      .filter((part) => ["year", "month", "day"].includes(part.type))
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function isExcludedGroup(name: string | null | undefined) {
  const normalized = String(name ?? "").trim().toLowerCase();
  return (
    normalized.startsWith("closed leads") ||
    ["failed", "unqualified lead", "to delete", "test"].includes(normalized)
  );
}

export async function GET(request: NextRequest) {
  if (!authorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [overdueLabel, groupsResult] = await Promise.all([
      getSystemLabel("client_status", "client_status_overdue"),
      supabaseAdmin.from("crm_groups").select("id, name"),
    ]);
    if (groupsResult.error) throw groupsResult.error;

    const excludedGroupIds = new Set(
      (groupsResult.data ?? [])
        .filter((group) => isExcludedGroup(group.name))
        .map((group) => group.id),
    );
    const today = singaporeToday();
    const { data: candidates, error: candidatesError } = await supabaseAdmin
      .from("clients")
      .select("id, name, follow_up, status, status_option_id, group_id")
      .is("deleted_at", null)
      .not("follow_up", "is", null)
      .neq("follow_up", "")
      .lt("follow_up", today);
    if (candidatesError) throw candidatesError;

    let markedOverdue = 0;
    let skipped = 0;
    const failures: Array<{ clientId: string; error: string }> = [];
    for (const client of candidates ?? []) {
      if (excludedGroupIds.has(client.group_id ?? "")) {
        skipped += 1;
        continue;
      }
      if (client.status_option_id === overdueLabel.id) {
        skipped += 1;
        continue;
      }

      // Guard against a concurrent user edit: the row is only changed when
      // the same overdue Follow Up value and a non-Overdue status remain.
      let updateQuery = supabaseAdmin
        .from("clients")
        .update({
          status: overdueLabel.value,
          status_option_id: overdueLabel.id,
        })
        .eq("id", client.id)
        .eq("follow_up", client.follow_up);
      updateQuery = client.status_option_id
        ? updateQuery.eq("status_option_id", client.status_option_id)
        : updateQuery.is("status_option_id", null);
      const { data: updated, error: updateError } = await updateQuery
        .select("id")
        .maybeSingle();
      if (updateError) {
        failures.push({ clientId: client.id, error: updateError.message });
        continue;
      }
      if (!updated) {
        skipped += 1;
        continue;
      }

      const { error: activityError } = await supabaseAdmin
        .from("activity_log")
        .insert({
          client_id: client.id,
          subitem_id: null,
          actor_name: "Follow Up automation",
          action: "field_changed",
          field_name: "status",
          old_value: client.status ?? "",
          new_value: overdueLabel.value,
          title: "marked this lead as Overdue",
          description: `Follow Up date ${client.follow_up} has passed.`,
          meta: {
            automation: "follow_up_overdue",
            followUpDate: client.follow_up,
            evaluatedOn: today,
          },
        });
      if (activityError) {
        // The status change is still correct; surface the audit failure in
        // the cron result so it can be repaired without repeating the update.
        failures.push({ clientId: client.id, error: activityError.message });
      }
      markedOverdue += 1;
    }

    return NextResponse.json({
      ok: failures.length === 0,
      today,
      markedOverdue,
      skipped,
      failures,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not run Follow Up overdue automation.",
      },
      { status: 500 },
    );
  }
}
