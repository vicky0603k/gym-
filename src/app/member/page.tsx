import Link from "next/link";
import { ChevronRight, CreditCard, History, IdCard, ReceiptIndianRupee, ScanLine, ShoppingBag } from "lucide-react";
import { requireMember } from "@/services/auth";
import { getMemberHome } from "@/services/members";
import { getWeeklyGoalState } from "@/services/streak";
import { getGymName } from "@/services/renewals";
import { listAddons } from "@/services/addons";
import { getAttendanceHistory } from "@/services/attendance";
import { daysUntilKolkata, formatDisplayDate, formatDisplayTime, greetingKolkata, toKolkataDateString } from "@/utils/dates";
import { formatRupees } from "@/utils/money";
import { EmptyState } from "@/components/states";
import { Avatar, QuickActions } from "@/components/ui/bits";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Page, Section } from "@/components/ui/page";
import { List, ListRow } from "@/components/ui/list";
import { WeeklyGoalCard } from "./weekly-goal-card";
import { MembershipCard } from "./membership-card";

export const dynamic = "force-dynamic";

/**
 * Member home (mockup C): greeting, the black membership card, this week's visits,
 * the one main action, and one real add-on from the gym's catalogue.
 * A renew prompt appears from 7 days before expiry (member reminder stage, ADR-009).
 */
export default async function MemberHomePage() {
  const { memberId } = await requireMember();
  const [home, goal, gymName, addons, visits] = await Promise.all([
    getMemberHome(memberId),
    getWeeklyGoalState(memberId),
    getGymName(),
    listAddons(),
    getAttendanceHistory(memberId, 0, 3),
  ]);
  const membership = home?.membership ?? null;
  const name = home?.name ?? "";

  const header = (
    <header className="mb-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-muted">{greetingKolkata()}</p>
        <h1 className="truncate text-xl font-bold text-foreground">{name}</h1>
      </div>
      <Link href="/member/more" aria-label="Account and settings">
        <Avatar name={name} tone="volt" />
      </Link>
    </header>
  );

  if (!membership) {
    return (
      <Page>
        {header}
        <EmptyState
          icon={<IdCard className="h-10 w-10" />}
          title="No membership on file"
          message="Visit the front desk to start your membership — they can take cash or UPI."
        />
      </Page>
    );
  }

  const daysLeft = daysUntilKolkata(membership.expiry_date);
  const expired = daysLeft < 0;
  const featured = addons.find((a) => a.available);

  return (
    <Page>
      {header}
      <MembershipCard gymName={gymName} membership={membership} />

      {membership.status !== "Frozen" && daysLeft <= 7 && (
        <Link href="/member/renew" className="mt-3 flex min-h-[64px] items-center gap-3 rounded-lg border-2 border-warning bg-background p-4">
          <CreditCard className="h-6 w-6 shrink-0 text-warning" aria-hidden />
          <span className="flex-1">
            <span className="block font-semibold text-foreground">{expired ? "Renew to keep training" : "Time to renew"}</span>
            <span className="block text-sm text-muted">See plans and the final amount to pay</span>
          </span>
          <ChevronRight className="h-5 w-5 text-muted" aria-hidden />
        </Link>
      )}

      <div className="mt-3">
        <WeeklyGoalCard goal={goal} />
      </div>

      <ButtonLink href="/member/check-in" size="lg" block className="mt-3">
        <ScanLine className="h-5 w-5" aria-hidden /> Scan to check in
      </ButtonLink>

      <QuickActions
        className="mt-3"
        label="Shortcuts"
        items={[
          { href: "/member/renew", label: "Renew", icon: CreditCard },
          { href: "/member/add-ons", label: "Add-ons", icon: ShoppingBag },
          { href: "/member/attendance", label: "My visits", icon: History },
          { href: "/member/payments", label: "Receipts", icon: ReceiptIndianRupee },
        ]}
      />

      {featured && (
        <Link href="/member/add-ons" className="mt-3 block">
          <Card className="flex items-center justify-between gap-3 transition-colors hover:bg-surface-2" as="div">
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{featured.title}</p>
              <p className="text-sm text-muted">
                {featured.type === "PT"
                  ? `${featured.sessions} sessions · ${featured.validity_days} days`
                  : featured.type === "Diet"
                    ? `${featured.validity_days}-day plan`
                    : "Collect at the front desk"}
              </p>
              {featured.trainerName && (
                <Badge tone="dark" size="sm" className="mt-2">
                  With {featured.trainerName}
                </Badge>
              )}
            </div>
            <p className="num-display shrink-0 text-2xl text-foreground">{formatRupees(featured.price)}</p>
          </Card>
        </Link>
      )}

      {visits.length > 0 && (
        <Section title="Recent visits" link={{ href: "/member/attendance", label: "All" }}>
          <List>
            {visits.slice(0, 3).map((v) => (
              <ListRow
                key={v.id}
                title={formatDisplayDate(toKolkataDateString(v.checkin_at))}
                meta={formatDisplayTime(v.checkin_at)}
                trailing={<span className="text-sm text-muted">{v.source === "QR" ? "QR scan" : "Front desk"}</span>}
              />
            ))}
          </List>
        </Section>
      )}
    </Page>
  );
}
