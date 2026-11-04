import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AWARDED_OR_LATER_SUBITEM_STATUS_SYSTEM_KEYS } from "@/lib/board-labels";

type TimelineRow = Record<string, unknown>;
type TimelineGroup = Record<string, unknown>;

function authorized(request: NextRequest) {
  const supplied =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
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

function dateOnly(value: unknown) {
  const text = typeof value === "string" ? value.trim().slice(0, 10) : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function isCompleted(
  row: TimelineRow,
  completedProgressIds: Set<string>,
) {
  return completedProgressIds.has(String(row.subProgressOptionId ?? ""));
}

function isNbd(row: TimelineRow) {
  return String(row.name ?? "").trim().toLowerCase() === "nbd";
}

function visibleTimelineRows(rows: TimelineRow[], completedProgressIds: Set<string>) {
  const activeRows = rows.filter((row) => !isCompleted(row, completedProgressIds));
  if (!activeRows.length) return [];

  // Gantt only renders processes that have a start date. It also suppresses a
  // timeline reduced to NBD alone after other completed processes disappear.
  const renderableRows = activeRows.filter((row) => Boolean(dateOnly(row.timelineStart)));
  if (!renderableRows.length) return [];
  const disappearedCount = rows.length - activeRows.length;
  if (disappearedCount > 0 && renderableRows.every(isNbd)) return [];
  return renderableRows;
}

function markLateRows(
  rows: TimelineRow[],
  completedProgressIds: Set<string>,
  lateId: string,
  lateValue: string,
  today: string,
) {
  const visibleIds = new Set(
    visibleTimelineRows(rows, completedProgressIds)
      .map((row) => String(row.id ?? ""))
      .filter(Boolean),
  );
  if (!visibleIds.size) return { rows, changed: 0 };

  let changed = 0;
  const nextRows = rows.map((row) => {
    const id = String(row.id ?? "");
    const end = dateOnly(row.timelineEnd);
    if (
      !visibleIds.has(id) ||
      !end ||
      end >= today ||
      isCompleted(row, completedProgressIds) ||
      String(row.subProgressOptionId ?? "") === lateId
    )
      return row;
    changed += 1;
    return { ...row, subProgress: lateValue, subProgressOptionId: lateId };
  });
  return { rows: nextRows, changed };
}

export async function GET(request: NextRequest) {
  if (!authorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [labelsResult, subitemStatusesResult] = await Promise.all([
      supabaseAdmin
        .from("option_values")
        .select("id, value, system_key, option_groups!inner(code)")
        .eq("option_groups.code", "subitem_subprogress")
        .in("system_key", [
          "subitem_subprogress_late",
          "subitem_subprogress_done",
          "subitem_subprogress_delivered",
        ]),
      supabaseAdmin
        .from("option_values")
        .select("id, system_key, option_groups!inner(code)")
        .eq("option_groups.code", "subitem_status")
        .in("system_key", [...AWARDED_OR_LATER_SUBITEM_STATUS_SYSTEM_KEYS]),
    ]);
    if (labelsResult.error) throw labelsResult.error;
    if (subitemStatusesResult.error) throw subitemStatusesResult.error;

    const labels = labelsResult.data ?? [];
    const late = labels.find(
      (label) => label.system_key === "subitem_subprogress_late",
    );
    if (!late) throw new Error("The Late timeline progress label is not configured.");
    const completedProgressIds = new Set(
      labels
        .filter((label) =>
          [
            "subitem_subprogress_done",
            "subitem_subprogress_delivered",
          ].includes(String(label.system_key)),
        )
        .map((label) => String(label.id)),
    );
    const eligibleStatusIds = (subitemStatusesResult.data ?? []).map((row) =>
      String(row.id),
    );
    if (!eligibleStatusIds.length)
      throw new Error("Awarded-or-later subitem statuses are not configured.");

    const today = singaporeToday();
    let from = 0;
    const pageSize = 500;
    let scanned = 0;
    let markedLate = 0;
    let changedSubitems = 0;
    const failures: Array<{ subitemId: string; error: string }> = [];

    while (true) {
      const { data: subitems, error } = await supabaseAdmin
        .from("subitems")
        .select("id, timeline_rows, timeline_groups")
        .is("deleted_at", null)
        .in("status_option_id", eligibleStatusIds)
        .order("id")
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!subitems?.length) break;
      scanned += subitems.length;

      for (const subitem of subitems) {
        const groups = Array.isArray(subitem.timeline_groups) && subitem.timeline_groups.length
          ? (subitem.timeline_groups as TimelineGroup[])
          : null;
        let changed = 0;
        let nextGroups: TimelineGroup[] | null = groups;
        let nextRows = Array.isArray(subitem.timeline_rows)
          ? (subitem.timeline_rows as TimelineRow[])
          : [];

        if (groups) {
          nextGroups = groups.map((group) => {
            const result = markLateRows(
              Array.isArray(group.rows) ? (group.rows as TimelineRow[]) : [],
              completedProgressIds,
              String(late.id),
              String(late.value),
              today,
            );
            changed += result.changed;
            return result.changed ? { ...group, rows: result.rows } : group;
          });
          // `timeline_rows` remains the legacy mirror of the first timeline.
          nextRows = (nextGroups[0]?.rows as TimelineRow[] | undefined) ?? [];
        } else {
          const result = markLateRows(
            nextRows,
            completedProgressIds,
            String(late.id),
            String(late.value),
            today,
          );
          nextRows = result.rows;
          changed = result.changed;
        }
        if (!changed) continue;

        const { error: updateError } = await supabaseAdmin
          .from("subitems")
          .update({
            timeline_rows: nextRows,
            ...(nextGroups ? { timeline_groups: nextGroups } : {}),
          })
          .eq("id", subitem.id);
        if (updateError) {
          failures.push({ subitemId: subitem.id, error: updateError.message });
          continue;
        }
        markedLate += changed;
        changedSubitems += 1;
      }

      if (subitems.length < pageSize) break;
      from += pageSize;
    }

    return NextResponse.json({
      ok: failures.length === 0,
      today,
      scanned,
      changedSubitems,
      markedLate,
      failures,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update overdue timeline progress.",
      },
      { status: 500 },
    );
  }
}
