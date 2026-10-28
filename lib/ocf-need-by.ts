type TimelineRow = Record<string, unknown>;
type TimelineGroup = Record<string, unknown> & { rows?: unknown };

/**
 * Applies an OCF Need By selection to the first NBD timeline row.  The
 * timeline keeps ASAP in remarks (with no date), matching the CRM Board's
 * existing representation.
 */
export function withOcfNeedByTimelineRow(
  timelineRows: unknown,
  needBy: string,
) {
  const rows: TimelineRow[] = Array.isArray(timelineRows)
    ? timelineRows.filter(
        (row): row is TimelineRow => Boolean(row) && typeof row === "object",
      )
    : [];
  const nbdIndex = rows.findIndex(
    (row) => String(row.name ?? "").trim().toLowerCase() === "nbd",
  );
  const currentNbd = nbdIndex >= 0 ? rows[nbdIndex] : undefined;
  const nextNbd: TimelineRow = {
    ...currentNbd,
    id: currentNbd?.id ?? crypto.randomUUID(),
    name: "NBD",
    person: currentNbd?.person ?? "",
    subProgress: currentNbd?.subProgress ?? "",
    timelineEnd: currentNbd?.timelineEnd ?? "",
    duration: currentNbd?.duration ?? "",
    dependency: currentNbd?.dependency ?? "",
    timelineStart: needBy === "ASAP" ? "" : needBy,
    remarks:
      needBy === "ASAP"
        ? "ASAP"
        : String(currentNbd?.remarks ?? "").trim().toLowerCase() === "asap"
          ? ""
          : currentNbd?.remarks ?? "",
  };

  return nbdIndex >= 0
    ? rows.map((row, index) => (index === nbdIndex ? nextNbd : row))
    : [...rows, nextNbd];
}

/**
 * Updates every timeline group on a subitem, and keeps timeline_rows aligned
 * with the first group's rows. The CRM Board treats that first group as the
 * default timeline for compatibility reads.
 */
export function withOcfNeedByTimeline({
  timelineRows,
  timelineGroups,
  needBy,
}: {
  timelineRows: unknown;
  timelineGroups: unknown;
  needBy: string;
}) {
  const groups: TimelineGroup[] = Array.isArray(timelineGroups)
    ? timelineGroups.filter(
        (group): group is TimelineGroup =>
          Boolean(group) && typeof group === "object",
      )
    : [];

  if (groups.length === 0) {
    return {
      timelineRows: withOcfNeedByTimelineRow(timelineRows, needBy),
      timelineGroups: timelineGroups ?? [],
    };
  }

  const updatedTimelineGroups = groups.map((group) => ({
    ...group,
    rows: withOcfNeedByTimelineRow(group.rows, needBy),
  }));

  return {
    timelineRows: updatedTimelineGroups[0].rows,
    timelineGroups: updatedTimelineGroups,
  };
}
