/**
 * Weekly goal / streak service.
 *
 * The streak is a WEEKLY visit goal, never a daily calendar streak.
 * Computed on read from the attendance table — no streaks table.
 * Frozen weeks are excluded from the consecutive-weeks count.
 */
import { createServiceClient } from "./supabase/server";
import { weekStartKolkata, weekEndKolkata } from "@/utils/dates";
import { format } from "date-fns";

export interface WeeklyGoalState {
  completed: number;
  target: number;
  goalMet: boolean;
  consecutiveWeeksGoalMet: number; // best current streak of consecutive goal-met weeks
}

/**
 * Compute the current week's goal state for a member.
 */
export async function getWeeklyGoalState(
  memberId: string
): Promise<WeeklyGoalState> {
  const supabase = createServiceClient();

  const { data: member } = await supabase
    .from("members")
    .select("weekly_target")
    .eq("id", memberId)
    .single();

  const target = member?.weekly_target ?? 4;

  // Current week bounds (Mon–Sun in Kolkata)
  const now = new Date();
  const kolkataStart = weekStartKolkata(now);
  const kolkataEnd = weekEndKolkata(now);
  // Convert back to UTC for the DB query
  const utcStart = new Date(
    kolkataStart.getTime() - 5.5 * 60 * 60 * 1000
  );
  const utcEnd = new Date(
    kolkataEnd.getTime() - 5.5 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000
  );

  const { count: completed } = await supabase
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId)
    .gte("checkin_at", utcStart.toISOString())
    .lt("checkin_at", utcEnd.toISOString());

  // Consecutive goal-met weeks (look back up to 52 weeks)
  const consecutiveWeeksGoalMet = await countConsecutiveGoalWeeks(memberId, target);

  return {
    completed: completed ?? 0,
    target,
    goalMet: (completed ?? 0) >= target,
    consecutiveWeeksGoalMet,
  };
}

/**
 * Count how many consecutive past weeks (not counting the current week)
 * the member met their weekly goal. Frozen weeks are skipped.
 */
async function countConsecutiveGoalWeeks(
  memberId: string,
  target: number
): Promise<number> {
  const supabase = createServiceClient();

  // Get frozen date ranges for this member
  const { data: memberships } = await supabase
    .from("memberships")
    .select("freeze_start, freeze_end")
    .eq("member_id", memberId)
    .not("freeze_start", "is", null);

  const frozenRanges: Array<{ start: string; end: string }> = (
    memberships ?? []
  )
    .filter((m) => m.freeze_start && m.freeze_end)
    .map((m) => ({ start: m.freeze_start!, end: m.freeze_end! }));

  let streak = 0;
  const now = new Date();

  // Start from the most recently completed week
  for (let weeksBack = 1; weeksBack <= 52; weeksBack++) {
    const weekDate = new Date(now.getTime() - weeksBack * 7 * 24 * 60 * 60 * 1000);
    const kolkataStart = weekStartKolkata(weekDate);
    const kolkataEnd = weekEndKolkata(weekDate);

    // Is this week frozen?
    const weekStartStr = format(kolkataStart, "yyyy-MM-dd");
    const isFrozen = frozenRanges.some(
      (r) => weekStartStr >= r.start && weekStartStr <= r.end
    );

    if (isFrozen) {
      // Skip frozen weeks — they don't break the streak
      continue;
    }

    const utcStart = new Date(kolkataStart.getTime() - 5.5 * 60 * 60 * 1000);
    const utcEnd = new Date(
      kolkataEnd.getTime() - 5.5 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000
    );

    const { count } = await supabase
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberId)
      .gte("checkin_at", utcStart.toISOString())
      .lt("checkin_at", utcEnd.toISOString());

    if ((count ?? 0) >= target) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
