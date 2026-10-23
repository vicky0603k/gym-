/**
 * Date helpers — all business date math goes through this file.
 * Every function that touches "today", "expiry", "absent days" or
 * "week boundaries" must use Asia/Kolkata, never raw UTC.
 */

import {
  format,
  formatISO,
  parseISO,
  startOfWeek,
  endOfWeek,
  differenceInCalendarDays,
  addDays,
  isAfter,
  isBefore,
  isEqual,
  startOfDay,
} from "date-fns";
import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";

export const TIMEZONE = "Asia/Kolkata";

/**
 * Returns the current date as a Date object in Asia/Kolkata time.
 * Use this everywhere you need "today".
 */
export function nowInKolkata(): Date {
  return toZonedTime(new Date(), TIMEZONE);
}

/**
 * Returns "today" as a date-only string YYYY-MM-DD in Asia/Kolkata.
 */
export function todayKolkata(): string {
  return formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
}

/**
 * Converts a UTC timestamp (Date or ISO string) to a Date in Asia/Kolkata.
 */
export function toKolkata(utcDate: Date | string): Date {
  const d = typeof utcDate === "string" ? parseISO(utcDate) : utcDate;
  return toZonedTime(d, TIMEZONE);
}

/**
 * Converts a local Kolkata date to a UTC Date suitable for Postgres timestamptz.
 */
export function fromKolkata(kolkataDate: Date): Date {
  return fromZonedTime(kolkataDate, TIMEZONE);
}

/**
 * Returns a date-only string YYYY-MM-DD from any date in Kolkata local time.
 */
export function toKolkataDateString(utcDate: Date | string): string {
  return formatInTimeZone(
    typeof utcDate === "string" ? parseISO(utcDate) : utcDate,
    TIMEZONE,
    "yyyy-MM-dd"
  );
}

/**
 * How many calendar days ago was `date` relative to today in Kolkata?
 * A positive result means the date is in the past.
 */
export function daysAgoKolkata(date: Date | string): number {
  const now = nowInKolkata();
  const d = toKolkata(typeof date === "string" ? parseISO(date) : date);
  return differenceInCalendarDays(startOfDay(now), startOfDay(d));
}

/**
 * Days until a future date (expiry). Negative = already expired.
 */
export function daysUntilKolkata(futureDate: Date | string): number {
  const now = nowInKolkata();
  const d =
    typeof futureDate === "string"
      ? toKolkata(parseISO(futureDate))
      : toKolkata(futureDate);
  return differenceInCalendarDays(startOfDay(d), startOfDay(now));
}

/**
 * Start of the week (Monday) in Kolkata for a given UTC date.
 */
export function weekStartKolkata(utcDate: Date | string): Date {
  const local = toKolkata(
    typeof utcDate === "string" ? parseISO(utcDate) : utcDate
  );
  return startOfWeek(local, { weekStartsOn: 1 });
}

/**
 * End of the week (Sunday) in Kolkata for a given UTC date.
 */
export function weekEndKolkata(utcDate: Date | string): Date {
  const local = toKolkata(
    typeof utcDate === "string" ? parseISO(utcDate) : utcDate
  );
  return endOfWeek(local, { weekStartsOn: 1 });
}

/**
 * Returns the Monday and Sunday of the current week in Kolkata as date strings.
 */
export function currentWeekRangeKolkata(): {
  start: string;
  end: string;
} {
  const now = nowInKolkata();
  const start = startOfWeek(now, { weekStartsOn: 1 });
  const end = endOfWeek(now, { weekStartsOn: 1 });
  return {
    start: format(start, "yyyy-MM-dd"),
    end: format(end, "yyyy-MM-dd"),
  };
}

/**
 * Compute the new membership expiry when renewing.
 * Rule: extend from max(today, currentExpiry) by durationDays.
 */
export function computeNewExpiry(
  currentExpiry: string | null,
  durationDays: number
): string {
  const today = todayKolkata();
  const base =
    currentExpiry && currentExpiry >= today ? currentExpiry : today;
  const baseDate = parseISO(base);
  return format(addDays(baseDate, durationDays), "yyyy-MM-dd");
}

/**
 * Display format for dates shown to members: "23 Oct 2026"
 */
export function formatDisplayDate(dateStr: string): string {
  return format(parseISO(dateStr), "d MMM yyyy");
}

/**
 * Display format for timestamps shown to members: "7:42 AM"
 */
export function formatDisplayTime(utcDate: Date | string): string {
  return formatInTimeZone(
    typeof utcDate === "string" ? parseISO(utcDate) : utcDate,
    TIMEZONE,
    "h:mm a"
  );
}

/**
 * Display format for timestamps: "23 Oct 2026, 7:42 AM"
 */
export function formatDisplayDateTime(utcDate: Date | string): string {
  return formatInTimeZone(
    typeof utcDate === "string" ? parseISO(utcDate) : utcDate,
    TIMEZONE,
    "d MMM yyyy, h:mm a"
  );
}

/**
 * Is a membership expired as of today in Kolkata?
 */
export function isExpiredKolkata(expiryDateStr: string): boolean {
  return daysUntilKolkata(expiryDateStr) < 0;
}

export { isAfter, isBefore, isEqual, addDays, differenceInCalendarDays, formatISO };
