import type { MembershipWithPlan } from "@/services/members";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { daysUntilKolkata, formatDisplayDate } from "@/utils/dates";

/**
 * The membership card members already carry, made digital (UI.md §3.3, mockup C):
 * black card, gym and plan on top, the expiry date large in condensed volt, days left below.
 * Warning/danger on black are solid pills with white text — tinted text would fail contrast.
 */
export function MembershipCard({ gymName, membership }: { gymName: string; membership: MembershipWithPlan }) {
  const daysLeft = daysUntilKolkata(membership.expiry_date);
  const expired = daysLeft < 0;
  const paused = membership.status === "Frozen";
  const note = paused
    ? `Paused since ${formatDisplayDate(membership.freeze_start ?? membership.start_date)}`
    : expired
      ? "Renew to keep checking in"
      : daysLeft === 0
        ? "Last day today"
        : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`;

  return (
    <Card tone="dark" aria-label="Your membership card">
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="truncate font-bold">{gymName}</p>
        <p className="shrink-0 font-semibold text-background/70">{membership.planName}</p>
      </div>

      <p className="mt-5 text-sm text-background/70">{expired ? "Expired on" : "Valid till"}</p>
      <p className="num-display mt-1 text-[3.4rem] uppercase text-accent">{formatDisplayDate(membership.expiry_date)}</p>

      <div className="mt-2 flex items-center gap-2">
        {paused ? (
          <Badge tone="warningSolid">{note}</Badge>
        ) : expired ? (
          <Badge tone="dangerSolid">{note}</Badge>
        ) : daysLeft <= 7 ? (
          <Badge tone="warningSolid">{note}</Badge>
        ) : (
          <span className="text-sm text-background/70">{note}</span>
        )}
      </div>
    </Card>
  );
}
