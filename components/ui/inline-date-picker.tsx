"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type InlineDatePickerProps = {
  value: string;
  onChange: (date: string) => void;
  label: string;
  className?: string;
};

function isDateValue(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * A calendar-only date control. The displayed month is independent from the
 * selected value, so navigating months never writes a date by accident.
 */
export function InlineDatePicker({
  value,
  onChange,
  label,
  className,
}: InlineDatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => (isDateValue(value) ? new Date(`${value}T12:00:00`) : undefined),
    [value],
  );
  const [displayedMonth, setDisplayedMonth] = useState(
    () => selected ?? new Date(),
  );

  useEffect(() => {
    if (open) setDisplayedMonth(selected ?? new Date());
  }, [open, selected]);

  const year = displayedMonth.getFullYear();
  const month = displayedMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from(
    { length: firstWeekday + daysInMonth },
    (_, index) => (index < firstWeekday ? null : index - firstWeekday + 1),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={`flex h-full w-full items-center justify-between text-left ${className ?? ""}`}
        >
          <span>{selected ? selected.toLocaleDateString("en-GB") : ""}</span>
          <CalendarDays size={14} className="shrink-0 text-slate-600" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="z-tooltip w-[248px] !border-slate-200 !bg-white !p-3 !text-slate-800 !opacity-100 shadow-xl"
        style={{ backgroundColor: "#ffffff", opacity: 1 }}
      >
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setDisplayedMonth(new Date(year, month - 1, 1))}
            className="rounded p-1 text-slate-600 hover:bg-slate-100"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-slate-800">
            {displayedMonth.toLocaleDateString("en-SG", {
              month: "long",
              year: "numeric",
            })}
          </span>
          <button
            type="button"
            onClick={() => setDisplayedMonth(new Date(year, month + 1, 1))}
            className="rounded p-1 text-slate-600 hover:bg-slate-100"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
            <span key={day} className="py-1 font-medium text-slate-400">
              {day}
            </span>
          ))}
          {cells.map((day, index) =>
            day === null ? (
              <span key={`blank-${index}`} />
            ) : (
              <button
                key={day}
                type="button"
                onClick={() => {
                  onChange(toDateValue(new Date(year, month, day)));
                  setOpen(false);
                }}
                className={`h-8 rounded text-sm hover:bg-sky-100 ${selected?.getFullYear() === year && selected.getMonth() === month && selected.getDate() === day ? "bg-sky-600 font-semibold text-white hover:bg-sky-700" : "text-slate-700"}`}
              >
                {day}
              </button>
            ),
          )}
        </div>
        {value && (
          <div className="border-t border-slate-100 p-2">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="w-full rounded px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
            >
              Clear date
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
