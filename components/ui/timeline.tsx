"use client";

import { TimelineRow } from "../../app/types";
import { EditableCell } from "./editablecell";
import { Calendar, GripVertical, Plus, Trash2 } from "lucide-react";
import { StatusBadge } from "./statusbadge";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog";

export type OptionEntry = { value: string; color: string };

export function parseDateUTC(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function diffDaysUTC(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

export const DEFAULT_TIMELINE_ROWS = [
  {
    id: "sample",
    name: "Sample",
    person: "",
    remarks: "",
    numOfCartons: "",
    subProgress: "Pending",
    timelineStart: "",
    timelineEnd: "",
    duration: "",
    dependency: "",
  },
  {
    id: "production",
    name: "Production 📦",
    person: "",
    remarks: "",
    numOfCartons: "",
    subProgress: "Pending",
    timelineStart: "",
    timelineEnd: "",
    duration: "",
    dependency: "Sample",
  },
  {
    id: "productionstatus",
    name: "Check Production Status (+3 from production start)",
    person: "",
    remarks: "",
    numOfCartons: "",
    subProgress: "Pending",
    timelineStart: "",
    timelineEnd: "",
    duration: "",
    dependency: "",
  },
  {
    id: "localshipping",
    name: "Local Shipping 🚚",
    person: "",
    remarks: "",
    numOfCartons: "",
    subProgress: "Pending",
    timelineStart: "",
    timelineEnd: "",
    duration: "",
    dependency: "Production 📦",
  },
  {
    id: "seaairfreight",
    name: "Sea/Air Freight ⛵✈️",
    person: "",
    remarks: "",
    numOfCartons: "",
    subProgress: "Pending",
    timelineStart: "",
    timelineEnd: "",
    duration: "",
    dependency: "Local Shipping 🚚",
  },
  {
    id: "shipmentstatus",
    name: "Check Shipment Status (+3 from shipment start)",
    person: "",
    remarks: "",
    numOfCartons: "",
    subProgress: "Pending",
    timelineStart: "",
    timelineEnd: "",
    duration: "",
    dependency: "",
  },
  {
    id: "nbd",
    name: "NBD",
    person: "",
    remarks: "",
    numOfCartons: "",
    subProgress: "Pending",
    timelineStart: "",
    timelineEnd: "",
    duration: "",
    dependency: "",
  },
];

export function TimelineSection({
  rows,
  onUpdate,
  timelineProgressOptions,
  onAddTimelineProgress,
  onDeleteTimelineProgress,
  onUpdateOptionColor,
  onRenameOption,
  onReorderOptions,
  readOnly = false,
}: {
  rows: TimelineRow[];
  onUpdate: (rows: TimelineRow[]) => void;
  timelineProgressOptions: OptionEntry[];
  onAddTimelineProgress?: (name: string) => void | Promise<void>;
  onDeleteTimelineProgress?: (name: string) => void | Promise<void>;
  onUpdateOptionColor?: (name: string, color: string) => void | Promise<void>;
  onRenameOption?: (oldName: string, newName: string) => void | Promise<void>;
  onReorderOptions?: (layout: Array<{ value: string; section: number }>) => void | Promise<void>;
  readOnly?: boolean;
}) {
  const [permissionNotice, setPermissionNotice] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [newTimelineName, setNewTimelineName] = useState("");
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [pendingRowRemovalId, setPendingRowRemovalId] = useState<string | null>(
    null,
  );
  useEffect(() => {
    if (readOnly) return;

    const markOverdueRows = () => {
      const today = formatDateUTC(new Date());
      const nextRows = rows.map((row) => {
        const progress = (row.subProgress ?? "").trim().toLowerCase();
        const isComplete =
          progress === "done" ||
          progress === "delivered" ||
          progress === "shipped out";
        const isPastEndDate = Boolean(
          row.timelineEnd && row.timelineEnd < today,
        );
        return isPastEndDate && !isComplete && progress !== "late"
          ? { ...row, subProgress: "Late" }
          : row;
      });
      const lateCount = nextRows.filter(
        (row, index) => row !== rows[index],
      ).length;
      if (lateCount > 0) {
        onUpdate(nextRows);
        toast.warning("Timeline progress updated", {
          description: `${lateCount} process${lateCount === 1 ? "" : "es"} automatically marked Late because its end date has passed.`,
        });
      }
    };

    markOverdueRows();
    const interval = window.setInterval(markOverdueRows, 60_000);
    return () => window.clearInterval(interval);
  }, [onUpdate, readOnly, rows]);

  const updateRow = (id: string, field: keyof TimelineRow, val: string) => {
    const currentRow = rows.find((row) => row.id === id);
    const normalizedValue = field === "name" ? val.trim() : val;
    if (field === "name") {
      if (!normalizedValue) {
        toast.error("Process name is required");
        return;
      }
      const duplicate = rows.some(
        (row) =>
          row.id !== id &&
          row.name.trim().toLocaleLowerCase() ===
            normalizedValue.toLocaleLowerCase(),
      );
      if (duplicate) {
        toast.error("Process names must be unique", {
          description: `A process named “${normalizedValue}” already exists in this timeline.`,
        });
        return;
      }
    }
    const nextRows = rows.map((r) => {
      if (r.id === id) return { ...r, [field]: normalizedValue };
      return field === "name" && currentRow && r.dependency === currentRow.name
        ? { ...r, dependency: normalizedValue }
        : r;
    });
    const target = nextRows.find((r) => r.id === id);

    if (target) {
      const start = parseDateUTC(target.timelineStart);
      const end = parseDateUTC(target.timelineEnd);

      if (field === "duration") {
        const durationDays = Number(val);
        if (val.trim() !== "" && Number.isFinite(durationDays)) {
          if (durationDays < 0) {
            toast.warning("Negative duration entered", {
              description: `${target.name} duration of ${durationDays} days is negative — dates were not automatically updated. Please check the entered value.`,
            });
          } else if (start) {
            const computedEnd = new Date(start);
            computedEnd.setUTCDate(computedEnd.getUTCDate() + durationDays);
            const nextEnd = formatDateUTC(computedEnd);
            if (nextEnd !== target.timelineEnd) {
              target.timelineEnd = nextEnd;
              toast.success("Timeline end date updated", {
                description: `${target.name} end date automatically set to ${nextEnd} based on the ${durationDays}-day duration.`,
              });
            }
          } else if (end) {
            const computedStart = new Date(end);
            computedStart.setUTCDate(computedStart.getUTCDate() - durationDays);
            const nextStart = formatDateUTC(computedStart);
            if (nextStart !== target.timelineStart) {
              target.timelineStart = nextStart;
              toast.success("Timeline start date updated", {
                description: `${target.name} start date automatically set to ${nextStart} based on the ${durationDays}-day duration.`,
              });
            }
          }
        }
      } else if (field === "timelineStart" || field === "timelineEnd") {
        if (field === "timelineEnd" && end && !start && !target.duration) {
          const today = formatDateUTC(new Date());
          target.timelineStart = today;
          toast.success("Timeline start date set", {
            description: `${target.name} start date automatically set to today because no start date or duration was provided.`,
          });
        }

        const resolvedStart = parseDateUTC(target.timelineStart);
        const resolvedEnd = parseDateUTC(target.timelineEnd);
        if (resolvedStart && resolvedEnd) {
          const durationDays = diffDaysUTC(resolvedStart, resolvedEnd);
          const nextDuration = String(durationDays);
          if (nextDuration !== (target.duration || "")) {
            target.duration = nextDuration;
            if (durationDays < 0) {
              toast.warning("Negative duration calculated", {
                description: `${target.name} end date is before its start date, giving a duration of ${durationDays} days. Please check these dates.`,
              });
            } else {
              toast.success("Duration updated", {
                description: `${target.name} duration automatically calculated as ${durationDays} day${durationDays === 1 ? "" : "s"}.`,
              });
            }
          }
        } else if (target.duration) {
          const durationDays = Number(target.duration);
          if (Number.isFinite(durationDays) && durationDays >= 0) {
            if (field === "timelineStart" && resolvedStart && !resolvedEnd) {
              const computedEnd = new Date(resolvedStart);
              computedEnd.setUTCDate(computedEnd.getUTCDate() + durationDays);
              target.timelineEnd = formatDateUTC(computedEnd);
              toast.success("Timeline end date updated", {
                description: `${target.name} end date automatically set based on the ${durationDays}-day duration.`,
              });
            } else if (
              field === "timelineEnd" &&
              resolvedEnd &&
              !resolvedStart
            ) {
              const computedStart = new Date(resolvedEnd);
              computedStart.setUTCDate(
                computedStart.getUTCDate() - durationDays,
              );
              target.timelineStart = formatDateUTC(computedStart);
              toast.success("Timeline start date updated", {
                description: `${target.name} start date automatically set based on the ${durationDays}-day duration.`,
              });
            }
          }
        }
      }
    }

    onUpdate(nextRows);
  };

  const createTimelineRow = () => {
    const name = newTimelineName.trim();
    if (!name) return;
    if (
      rows.some(
        (row) => row.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    ) {
      toast.error("Process names must be unique", {
        description: `A process named “${name}” already exists in this timeline.`,
      });
      return;
    }
    const id = crypto.randomUUID();
    onUpdate([
      ...rows,
      {
        id,
        isCustom: true,
        name,
        person: "",
        remarks: "",
        numOfCartons: "",
        subProgress: "Pending",
        timelineStart: "",
        timelineEnd: "",
        duration: "",
        dependency: "",
      },
    ]);
    setNewTimelineName("");
  };

  const moveRowBefore = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const source = rows.find((row) => row.id === sourceId);
    const remainingRows = rows.filter((row) => row.id !== sourceId);
    const targetIndex = remainingRows.findIndex((row) => row.id === targetId);
    if (!source || targetIndex < 0) return;
    const nextRows = [...remainingRows];
    nextRows.splice(targetIndex, 0, source);
    onUpdate(nextRows);
  };

  const moveRowToEnd = (sourceId: string) => {
    const source = rows.find((row) => row.id === sourceId);
    if (!source) return;
    onUpdate([...rows.filter((row) => row.id !== sourceId), source]);
  };

  const removeRow = (id: string) => {
    const row = rows.find((candidate) => candidate.id === id);
    if (!row?.isCustom) return;
    const nextRows = rows
      .filter((candidate) => candidate.id !== id)
      .map((candidate) =>
        candidate.dependency === row.name
          ? { ...candidate, dependency: "" }
          : candidate,
      );
    onUpdate(nextRows);
    setPendingRowRemovalId(null);
  };

  const pendingRowRemoval = rows.find((row) => row.id === pendingRowRemovalId);

  return (
    <div
      onClickCapture={(event) => {
        if (!readOnly) return;
        event.preventDefault();
        event.stopPropagation();
        const rect = (event.target as HTMLElement).getBoundingClientRect();
        setPermissionNotice({
          left: Math.min(rect.left, window.innerWidth - 300),
          top: Math.min(rect.bottom + 8, window.innerHeight - 48),
        });
        window.setTimeout(() => setPermissionNotice(null), 2600);
      }}
      title={
        readOnly
          ? "You can only edit items that are assigned to you"
          : undefined
      }
      className="ml-8 mr-2 mb-2 w-fit max-w-[1500px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
    >
      {permissionNotice && (
        <div
          role="alert"
          className="fixed z-[10000] rounded-md bg-slate-800 px-3 py-2 text-xs font-medium text-white shadow-xl"
          style={permissionNotice}
        >
          You can only edit items that are assigned to you
        </div>
      )}
      <AlertDialog
        open={!!pendingRowRemoval}
        onOpenChange={(open) => !open && setPendingRowRemovalId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove timeline process?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove “{pendingRowRemoval?.name}” from this timeline? Any
              process depending on it will have its dependency cleared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (pendingRowRemoval) removeRow(pendingRowRemoval.id);
              }}
            >
              Remove process
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="flex items-center gap-2 bg-gradient-to-r from-[#9bd9e0] to-[#7BCBD5] px-3 py-1.5">
        <Calendar size={12} className="text-white" />
        <span className="text-xs font-semibold text-white">
          Project Timeline
        </span>
      </div>

      <div className="max-w-full overflow-x-auto">
        <table
          className="table-fixed border-collapse"
          style={{ minWidth: 200, maxWidth: 500 }}
        >
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {[
                { label: "Process", w: 300 },
                { label: "Person", w: 30 },
                { label: "Remarks", w: 200 },
                { label: "No. of Cartons", w: 30 },
                { label: "Sub-Progress", w: 100 },
                { label: "Timeline", w: 100 },
                { label: "Duration", w: 70 },
                { label: "Dependency", w: 100 },
              ].map((col) => (
                <th
                  key={col.label}
                  style={{ minWidth: col.w }}
                  className="whitespace-nowrap border-r border-gray-100 px-2 text-left text-xs font-semibold text-gray-500 last:border-r-0"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const textColor =
                row.subProgress === "Done" || row.subProgress === "Started"
                  ? "#fff"
                  : "#333";

              return (
                <tr
                  key={row.id}
                  onDragOver={(event) => {
                    if (!draggedRowId || draggedRowId === row.id) return;
                    event.preventDefault();
                    setDropTargetId(row.id);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (draggedRowId) moveRowBefore(draggedRowId, row.id);
                    setDraggedRowId(null);
                    setDropTargetId(null);
                  }}
                  className={`border-b border-gray-100 hover:bg-gray-50 ${dropTargetId === row.id ? "border-t-2 border-t-[#3799b1]" : ""}`}
                >
                  <td className="border-r border-gray-100 px-2 py-1">
                    <div className="flex min-w-0 items-center gap-1">
                      <span
                        draggable={!readOnly}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", row.id);
                          setDraggedRowId(row.id);
                        }}
                        onDragEnd={() => {
                          setDraggedRowId(null);
                          setDropTargetId(null);
                        }}
                        className={`shrink-0 touch-none ${readOnly ? "cursor-not-allowed text-gray-200" : "cursor-grab text-gray-300 active:cursor-grabbing"}`}
                        title={readOnly ? undefined : "Drag to rearrange process"}
                        aria-label="Drag to rearrange process"
                      >
                        <GripVertical size={14} aria-hidden="true" />
                      </span>
                      {row.isCustom ? (
                        <EditableCell
                          value={row.name}
                          onChange={(value) => updateRow(row.id, "name", value)}
                          className="min-h-[25px] min-w-0 flex-1 !justify-start px-1 text-left text-xs"
                        />
                      ) : (
                        <span className="min-w-0 flex-1 text-xs text-gray-700">
                          {row.name}
                        </span>
                      )}
                      {row.isCustom && (
                        <button
                          type="button"
                          onClick={() => setPendingRowRemovalId(row.id)}
                          className="shrink-0 p-0.5 text-gray-300 transition hover:text-red-500"
                          title="Remove added row"
                          aria-label={`Remove ${row.name || "timeline row"}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>

                  <td className="border-r border-gray-100 px-2 py-1">
                    <EditableCell
                      value={row.person}
                      onChange={(v) => updateRow(row.id, "person", v)}
                    />
                  </td>

                  <td className="border-r border-gray-100 px-2 py-1">
                    <EditableCell
                      value={row.remarks}
                      onChange={(v) => updateRow(row.id, "remarks", v)}
                    />
                  </td>

                  <td className="border-r border-gray-100 px-2 py-1">
                    <EditableCell
                      value={row.numOfCartons ?? ""}
                      onChange={(v) => updateRow(row.id, "numOfCartons", v)}
                      type="number"
                    />
                  </td>

                  <td className="overflow-hidden whitespace-nowrap text-ellipsis !text-center border-r border-[#D0D4E4] p-0 h-[33.1px] flex-shrink-0 transition transform active:scale-95 duration-150">
                    <StatusBadge
                      value={row.subProgress || "Pending"}
                      onChange={(v) => updateRow(row.id, "subProgress", v)}
                      options={timelineProgressOptions}
                      onAddOption={onAddTimelineProgress}
                      onDeleteOption={onDeleteTimelineProgress}
                      manageLabel="timeline progress"
                      onUpdateOptionColor={onUpdateOptionColor}
                      onRenameOption={onRenameOption}
                      onReorderOptions={onReorderOptions}
                      small
                    />
                  </td>

                  <td className="border-r border-gray-100 px-2 py-1">
                    <div className="flex gap-1">
                      <input
                        type="date"
                        value={row.timelineStart || ""}
                        onChange={(e) =>
                          updateRow(row.id, "timelineStart", e.target.value)
                        }
                        className={`w-32 cursor-pointer rounded border border-gray-200 bg-white px-1 py-1 text-xs ${row.timelineStart ? "text-gray-700" : "text-transparent focus:text-gray-700"}`}
                      />
                      <input
                        type="date"
                        value={row.timelineEnd || ""}
                        onChange={(e) =>
                          updateRow(row.id, "timelineEnd", e.target.value)
                        }
                        className={`w-32 cursor-pointer rounded border border-gray-200 bg-white px-1 py-1 text-xs ${row.timelineEnd ? "text-gray-700" : "text-transparent focus:text-gray-700"}`}
                      />
                    </div>
                  </td>

                  <td className="border-r border-gray-100 px-2 py-1">
                    <EditableCell
                      value={row.duration}
                      onChange={(v) => updateRow(row.id, "duration", v)}
                    />
                  </td>

                  <td className="border-r border-gray-100 px-2 py-1">
                    <select
                      value={row.dependency || ""}
                      onChange={(event) =>
                        updateRow(row.id, "dependency", event.target.value)
                      }
                      className="w-full rounded border border-gray-200 bg-white px-1 py-1 text-xs outline-none focus:border-[#7BCBD5]"
                    >
                      <option value="">-</option>
                      {rows
                        .filter((candidate) => candidate.id !== row.id)
                        .map((candidate) => (
                          <option key={candidate.id} value={candidate.name}>
                            {candidate.name}
                          </option>
                        ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div
        onDragOver={(event) => {
          if (!draggedRowId) return;
          event.preventDefault();
          setDropTargetId("end");
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (draggedRowId) moveRowToEnd(draggedRowId);
          setDraggedRowId(null);
          setDropTargetId(null);
        }}
        className={`group/add-timeline-row border-t px-2 py-1.5 ${dropTargetId === "end" ? "border-t-2 border-t-[#3799b1] bg-[#f4fcfc]" : "border-gray-100"}`}
      >
        <div className="relative max-w-sm">
          <Plus
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#318d98]"
          />
          <input
            value={newTimelineName}
            onChange={(event) => setNewTimelineName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                createTimelineRow();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setNewTimelineName("");
                event.currentTarget.blur();
              }
            }}
            onBlur={createTimelineRow}
            disabled={readOnly}
            placeholder="Add timeline row"
            aria-label="New timeline process name"
            className="h-7 w-full rounded border border-transparent bg-transparent pl-7 pr-2 text-xs text-gray-700 outline-none transition group-hover/add-timeline-row:border-gray-500 group-hover/add-timeline-row:bg-white focus:border-[#3799b1] focus:bg-white focus:ring-2 focus:ring-[#7BCBD5]/25 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>
    </div>
  );
}
