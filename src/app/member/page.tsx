import Link from "next/link";
import { CalendarClock, IdCard, ScanLine } from "lucide-react";
import { requireMember } from "@/services/auth";
import { getMemberHome } from "@/services/members";
import { getWeeklyGoalState } from "@/services/streak";
import { daysUntilKolkata, formatDisplayDate } from "@/utils/dates";
import { EmptyState } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import { WeeklyGoalCard } from "./weekly-goal-card";

/**
 * Member home — real current plan, exact expiry date and the weekly goal.
 * The renew link appears with its screen.
 */
export default async function MemberHomePage() {
  const { memberId } = await requireMember();
  const [home, goal] = await Promise.all([getMemberHome(memberId), getWeeklyGoalState(memberId)]);
  const membership = home?.membership ?? null;

  if (!membership) {
    return (
      <div className="px-6 py-6 max-w-md mx-auto">
        <EmptyState
          icon={<IdCard className="h-10 w-10" />}
          title="No membership on file"
          message="Please visit the front desk to start or renew your membership."
        />
      </div>
    );
  }

  const daysLeft = daysUntilKolkata(membership.expiry_date);
  const expired = daysLeft < 0;
  const status = membership.status === "Active" && expired ? "Expired" : membership.status;

  return (
    <div className="px-6 py-6 max-w-md mx-auto">
      <p className="text-muted">Welcome back,</p>
      <h1 className="text-2xl font-bold text-foreground mb-6">{home!.name}</h1>

      <div className="card p-5">
        <div className="flex justify-between items-start gap-3 mb-4">
          <div>
            <p className="text-sm text-muted">Current plan</p>
            <p className="text-lg font-semibold text-foreground">{membership.planName}</p>
          </div>
          <StatusBadge status={status} />
        </div>
        <div className="border-t border-border pt-3 flex items-start gap-3">
          <CalendarClock className="h-5 w-5 text-muted mt-0.5" aria-hidden />
          <div>
            <p className="text-sm text-muted">{expired ? "Expired on" : "Valid till"}</p>
            <p className="text-foreground font-semibold text-lg">{formatDisplayDate(membership.expiry_date)}</p>
            <p className={expired || daysLeft <= 7 ? "text-sm text-warning" : "text-sm text-muted"}>
              {membership.status === "Frozen"
                ? `Paused since ${formatDisplayDate(membership.freeze_start ?? membership.start_date)}`
                : expired
                  ? "Please renew at the front desk to keep checking in."
                  : daysLeft === 0
                    ? "Last day today"
                    : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`}
            </p>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted mt-3 mb-4">Started {formatDisplayDate(membership.start_date)}. Only you can see this.</p>

      <WeeklyGoalCard goal={goal} />

      <Link href="/member/check-in" className="btn-primary mt-6 flex w-full items-center justify-center gap-2">
        <ScanLine className="h-5 w-5" aria-hidden /> Check in
      </Link>
    </div>
  );
}
