/**
 * Weekly goal / streak service.
 *
 * The streak is a WEEKLY visit goal, never a daily calendar streak (ADR-005).
 * Computed on read from the attendance table — no streaks table (ADR-010).
 * Weeks are Monday–Sunday in Asia/Kolkata.
 *
 * Fairness rules — a member is never marked as failing a week they could not train:
 *  - a week that overlaps a pause/freeze and was not met is "paused" (neutral);
 *  - the week they joined, if not met, is neutral too; weeks before joining are not shown;
 *  - the current week is "in progress" until it is met — it never breaks a streak.
 * A met week always counts, paused or not.
 */
import { createServiceClient } from "./supabase/server";
import { addDaysToDate, kolkataMidnightUtc, toKolkataDateString, todayKolkata, weekStartOf } from "@/utils/dates";
import { DEFAULT_WEEKLY_TARGET } from "@/utils/constants";

export const LOOKBACK_WEEKS = 52;
export const RECENT_WEEKS = 8;

export type WeekResult = "met" | "missed" | "paused" | "current";

export interface WeekSummary {
  weekStart: string; // Monday, YYYY-MM-DD
  visits: number;
  result: WeekResult;
}

export interface WeeklyGoalState {
  completed: number;
  target: number;
  goalMet: boolean;
  pausedNow: boolean;
  currentStreak: number; // consecutive met weeks up to now (this week counts once met)
  bestStreak: number; // longest run of met weeks in the last LOOKBACK_WEEKS
  recentWeeks: WeekSummary[]; // oldest → newest, ending with this week
}

export interface PausePeriod {
  start: string;
  end: string | null; // null = still paused
}

/**
 * Pure weekly-goal calculation. All inputs are Kolkata calendar dates.
 * `checkinDates` may contain duplicates (one per visit).
 */
export function summariseWeeks(input: {
  checkinDates: string[];
  target: number;
  pauses: PausePeriod[];
  joinDate: string;
  today: string;
  lookbackWeeks?: number;
}): WeeklyGoalState {
  const { target, pauses, today } = input;
  const lookback = input.lookbackWeeks ?? LOOKBACK_WEEKS;
  const thisWeek = weekStartOf(today);
  const joinWeek = weekStartOf(input.joinDate);

  const visitsByWeek = new Map<string, number>();
  for (const d of input.checkinDates) {
    const w = weekStartOf(d);
    visitsByWeek.set(w, (visitsByWeek.get(w) ?? 0) + 1);
  }

  // freeze_end is the resume day: the member is active again from that day, so a
  // pause covers [start, end) and one resumed the day it started covers nothing.
  const overlapsPause = (weekStart: string) => {
    const weekEnd = addDaysToDate(weekStart, 6);
    return pauses.some((p) => p.start <= weekEnd && (p.end === null || (p.end > weekStart && p.end > p.start)));
  };
  const pausedNow = pauses.some((p) => p.start <= today && (p.end === null || p.end > today));

  // Oldest → newest, never before the join week.
  const weeks: WeekSummary[] = [];
  for (let i = lookback; i >= 0; i--) {
    const weekStart = addDaysToDate(thisWeek, -7 * i);
    if (weekStart < joinWeek) continue;
    const visits = visitsByWeek.get(weekStart) ?? 0;
    let result: WeekResult;
    if (visits >= target) result = "met";
    else if (overlapsPause(weekStart) || (weekStart === thisWeek && pausedNow)) result = "paused";
    else if (weekStart === thisWeek) result = "current";
    else if (weekStart === joinWeek) result = "paused"; // a part week after joining is not a failure
    else result = "missed";
    weeks.push({ weekStart, visits, result });
  }

  let bestStreak = 0;
  let run = 0;
  for (const w of weeks) {
    if (w.result === "met") bestStreak = Math.max(bestStreak, ++run);
    else if (w.result === "missed") run = 0;
  }

  let currentStreak = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    const r = weeks[i].result;
    if (r === "met") currentStreak++;
    else if (r === "missed") break;
  }

  const completed = visitsByWeek.get(thisWeek) ?? 0;
  return {
    completed,
    target,
    goalMet: completed >= target,
    pausedNow,
    currentStreak,
    bestStreak,
    recentWeeks: weeks.slice(-RECENT_WEEKS),
  };
}

/**
 * Load a member's weekly-goal state: three reads (member, memberships'
 * freeze periods, one year of check-ins), then summariseWeeks().
 * Throws on a database error.
 */
export async function getWeeklyGoalState(memberId: string): Promise<WeeklyGoalState> {
  const supabase = createServiceClient();
  const today = todayKolkata();
  const fromDate = addDaysToDate(weekStartOf(today), -7 * LOOKBACK_WEEKS);

  const [member, memberships, attendance] = await Promise.all([
    supabase.from("members").select("weekly_target, join_date, status").eq("id", memberId).maybeSingle(),
    supabase.from("memberships").select("status, freeze_start, freeze_end").eq("member_id", memberId),
    supabase
      .from("attendance")
      .select("checkin_at")
      .eq("member_id", memberId)
      .gte("checkin_at", kolkataMidnightUtc(fromDate).toISOString())
      // The 3-hour duplicate guard caps a year at well under this.
      .limit(3000),
  ]);
  if (member.error || memberships.error || attendance.error) throw new Error("GOAL_LOAD_FAILED");

  // shortcut: a membership stores only its latest freeze period (DATABASE.md); earlier
  // pauses of the same membership are in audit_logs only. Upgrade with a pauses table.
  const pauses: PausePeriod[] = memberships.data
    .filter((m) => m.freeze_start)
    .map((m) => ({ start: m.freeze_start!, end: m.status === "Frozen" ? null : m.freeze_end }));
  // A Paused member with no recorded freeze start is still on hold today.
  if (member.data?.status === "Paused" && !pauses.some((p) => p.end === null)) pauses.push({ start: today, end: null });

  return summariseWeeks({
    checkinDates: attendance.data.map((a) => toKolkataDateString(a.checkin_at)),
    target: member.data?.weekly_target ?? DEFAULT_WEEKLY_TARGET,
    pauses,
    joinDate: member.data?.join_date ?? today,
    today,
  });
}
