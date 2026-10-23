import { Check, Minus, Pause, Trophy } from "lucide-react";
import type { WeeklyGoalState, WeekResult } from "@/services/streak";
import { formatDisplayDate } from "@/utils/dates";
import { cn } from "@/utils/cn";

const R = 42;
const C = 2 * Math.PI * R;

const WEEK_STYLE: Record<WeekResult, { box: string; label: string }> = {
  met: { box: "bg-accent text-accent-foreground", label: "goal met" },
  missed: { box: "border border-border text-muted", label: "goal missed" },
  paused: { box: "bg-warning/15 text-warning", label: "paused — not counted" },
  current: { box: "border-2 border-accent text-accent", label: "this week, in progress" },
};

function WeekIcon({ result }: { result: WeekResult }) {
  if (result === "met") return <Check className="h-4 w-4" aria-hidden />;
  if (result === "paused") return <Pause className="h-3.5 w-3.5" aria-hidden />;
  if (result === "missed") return <Minus className="h-4 w-4" aria-hidden />;
  return <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />;
}

/** "3 of 4 visits this week" ring, streaks, and the last few weeks. Weekly — never daily. */
export function WeeklyGoalCard({ goal }: { goal: WeeklyGoalState }) {
  const fraction = Math.min(goal.completed / goal.target, 1);
  const left = Math.max(goal.target - goal.completed, 0);

  return (
    <section className="card p-5" aria-labelledby="goal-heading">
      <h2 id="goal-heading" className="text-sm text-muted mb-3">This week&apos;s goal</h2>

      <div className="flex items-center gap-5">
        <svg width="104" height="104" viewBox="0 0 104 104" className="-rotate-90 shrink-0" aria-hidden>
          <circle cx="52" cy="52" r={R} fill="none" strokeWidth="10" className="stroke-surface-2" />
          <circle
            cx="52"
            cy="52"
            r={R}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - fraction)}
            className={cn("goal-ring", goal.pausedNow ? "stroke-warning" : "stroke-accent")}
            style={{ "--goal-c": C } as React.CSSProperties}
          />
        </svg>
        <div>
          <p className="text-foreground">
            <span className="kpi-number">{goal.completed}</span>
            <span className="text-lg text-muted"> of {goal.target} visits</span>
          </p>
          <p className={cn("text-sm", goal.goalMet ? "text-accent" : goal.pausedNow ? "text-warning" : "text-muted")}>
            {goal.goalMet
              ? "Goal met this week — great work!"
              : goal.pausedNow
                ? "On hold while your membership is paused."
                : `${left} more ${left === 1 ? "visit" : "visits"} to reach your goal.`}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4">
        <div>
          <p className="text-xs text-muted">Current streak</p>
          <p className="text-lg font-bold text-foreground">
            {goal.currentStreak} {goal.currentStreak === 1 ? "week" : "weeks"}
          </p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-xs text-muted">
            <Trophy className="h-3.5 w-3.5" aria-hidden /> Best streak
          </p>
          <p className="text-lg font-bold text-foreground">
            {goal.bestStreak} {goal.bestStreak === 1 ? "week" : "weeks"}
          </p>
        </div>
      </div>

      {goal.recentWeeks.length > 1 && (
        <div className="mt-4">
          <p className="text-xs text-muted mb-2">Recent weeks</p>
          <ol className="flex gap-1.5" aria-label="Recent weeks, oldest first">
            {goal.recentWeeks.map((w) => (
              <li
                key={w.weekStart}
                className={cn("flex h-8 flex-1 max-w-10 items-center justify-center rounded-md", WEEK_STYLE[w.result].box)}
                aria-label={`Week of ${formatDisplayDate(w.weekStart)}: ${w.visits} ${w.visits === 1 ? "visit" : "visits"}, ${WEEK_STYLE[w.result].label}`}
                title={`Week of ${formatDisplayDate(w.weekStart)} · ${w.visits} ${w.visits === 1 ? "visit" : "visits"}`}
              >
                <WeekIcon result={w.result} />
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-muted">Rest days never break your streak. Paused weeks are not counted.</p>
        </div>
      )}
    </section>
  );
}
