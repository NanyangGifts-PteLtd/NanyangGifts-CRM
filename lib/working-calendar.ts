import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const SINGAPORE_CALENDAR = "sg";
export const SINGAPORE_TIME_ZONE = "Asia/Singapore";

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDate(dateText: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) throw new Error("Expected a YYYY-MM-DD date.");
  return new Date(`${dateText}T12:00:00.000Z`);
}

async function nonWorkingDates(start: string, end: string, calendarCode = SINGAPORE_CALENDAR) {
  const { data, error } = await supabaseAdmin
    .from("working_calendar_days")
    .select("date")
    .eq("calendar_code", calendarCode)
    .eq("is_non_working", true)
    .gte("date", start)
    .lte("date", end);
  if (error) throw new Error(`Could not load the working calendar: ${error.message}`);
  return new Set((data ?? []).map((row) => String(row.date)));
}

export async function isSingaporeWorkingDay(dateText: string) {
  const date = parseDate(dateText);
  const weekday = date.getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  const holidays = await nonWorkingDates(dateText, dateText);
  return !holidays.has(dateText);
}

/** Adds business days using Mon–Fri and the stored Singapore working calendar. */
export async function addSingaporeWorkingDays(dateText: string, days: number) {
  if (!Number.isInteger(days) || days < 0) throw new Error("Working days must be a non-negative whole number.");
  const date = parseDate(dateText);
  // This horizon covers ordinary follow-up windows; load once rather than query per day.
  const horizon = new Date(date);
  horizon.setUTCDate(horizon.getUTCDate() + Math.max(370, days * 4 + 31));
  const holidays = await nonWorkingDates(formatDate(date), formatDate(horizon));
  let remaining = days;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !holidays.has(formatDate(date))) remaining -= 1;
  }
  return formatDate(date);
}

/** Moves a date that falls on a weekend/holiday to the next Singapore workday. */
export async function nextSingaporeWorkingDay(dateText: string) {
  const date = parseDate(dateText);
  const horizon = new Date(date);
  horizon.setUTCDate(horizon.getUTCDate() + 370);
  const holidays = await nonWorkingDates(formatDate(date), formatDate(horizon));
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6 || holidays.has(formatDate(date))) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return formatDate(date);
}
