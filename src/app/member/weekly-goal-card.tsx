import type { WeeklyGoalState, WeekResult } from "@/services/streak";
import { Card, CardHeader } from "@/components/ui/card";
import { VisitSegments } from "@/components/ui/bits";
import { formatDisplayDate } from "@/utils/dates";
import { cn } from "@/utils/cn";

const WEEK_STYLE: Record<WeekResult, { dot: string; label: string }> = {
  met: { dot: "bg-foreground", label: "goal met" },
  missed: { dot: "border-2 border-border-strong", label: "goal missed" },
  paused: { dot: "border-2 border-dashed border-warning", label: "paused — not counted" },
  current: { dot: "bg-accent ring-2 ring-foreground ring-offset-2 ring-offset-surface", label: "this week, in progress" },
};

function caption(goal: WeeklyGoalState): string {
  const left = Math.max(goal.target - goal.completed, 0);
  const lead = goal.goalMet
    ? "Goal met — every extra visit is a bonus"
    : goal.pausedNow
      ? "On hold while your membership is paused"
      : `${left === 1 ? "One more visit" : `${left} more visits`} to hit your goal`;
  return goal.bestStreak > 0 ? `${lead} · best run ${goal.bestStreak} ${goal.bestStreak === 1 ? "week" : "weeks"}` : lead;
}

/** "This week · 3 OF 4 VISITS" with the visits as segments (mockup C). Weekly — never daily. */
export function WeeklyGoalCard({ goal }: { goal: WeeklyGoalState }) {
  return (
    <Card aria-labelledby="goal-heading">
      <CardHeader label={<span id="goal-heading">This week</span>}>
        <p className="num-display text-2xl uppercase text-foreground">
          {goal.completed} of {goal.target} visits
        </p>
      </CardHeader>

      <VisitSegments className="mt-4" done={goal.completed} target={goal.target} paused={goal.pausedNow} />

      <p className={cn("mt-3 text-sm", goal.goalMet ? "font-semibold text-success" : goal.pausedNow ? "text-warning" : "text-muted")}>
        {caption(goal)}
      </p>

      {goal.recentWeeks.length > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
          <p className="text-sm text-muted">
            Streak <span className="font-semibold text-foreground">{goal.currentStreak} {goal.currentStreak === 1 ? "week" : "weeks"}</span>
          </p>
          <ol className="flex items-center gap-1.5" aria-label="Recent weeks, oldest first">
            {goal.recentWeeks.map((w) => (
              <li
                key={w.weekStart}
                className={cn("h-3 w-3 rounded-full", WEEK_STYLE[w.result].dot)}
                aria-label={`Week of ${formatDisplayDate(w.weekStart)}: ${w.visits} ${w.visits === 1 ? "visit" : "visits"}, ${WEEK_STYLE[w.result].label}`}
                title={`Week of ${formatDisplayDate(w.weekStart)} · ${w.visits} ${w.visits === 1 ? "visit" : "visits"}`}
              />
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}
