import Link from "next/link";
import { AlertTriangle, BadgeCheck, CalendarCheck, HeartHandshake, IndianRupee, ShoppingBag, UserCheck, Users, UserX } from "lucide-react";
import { getDashboardKPIs, getDataQualityIssues, getFollowUpsDue } from "@/services/dashboard";
import { getCurrentStaff } from "@/services/auth";
import { formatDisplayDate, greetingKolkata, todayKolkata } from "@/utils/dates";
import { formatRupees } from "@/utils/money";
import { Avatar, Stat } from "@/components/ui/bits";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { List, ListRow } from "@/components/ui/list";
import { Page, PageHeader, Section } from "@/components/ui/page";

export const metadata = { title: "Dashboard" };
// Live numbers on every request (REAL_WORLD_STANDARD §2: no cached or hardcoded figures).
export const dynamic = "force-dynamic";

/** Owner home: what money is due, who to call today, then the numbers (UI.md §8). */
export default async function OwnerDashboardPage() {
  const [k, due, staff] = await Promise.all([getDashboardKPIs(), getFollowUpsDue(5), getCurrentStaff()]);
  const issues = staff?.role === "Owner" ? await getDataQualityIssues() : [];
  const n = (v: number) => new Intl.NumberFormat("en-IN").format(v);
  const pendingPayments = k.summary.paymentsPending;

  return (
    <Page width="wide">
      <PageHeader kicker={`${greetingKolkata()} · ${formatDisplayDate(todayKolkata())}`} title={staff?.name ?? "Dashboard"} />

      <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
        <Card tone="dark" className="flex flex-col">
          <p className="text-sm text-background/70">Renewals due in the next 7 days</p>
          <p className="num-display mt-2 text-6xl text-accent">{formatRupees(k.renewalsDueIn7Days.expectedAmount)}</p>
          <p className="mt-1 text-sm text-background/70">
            {n(k.renewalsDueIn7Days.count)} {k.renewalsDueIn7Days.count === 1 ? "member" : "members"} · {formatRupees(k.renewalCollectionThisMonth)} collected this month
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <ButtonLink href="/owner/renewals" variant="primary" size="sm">
              {pendingPayments > 0 ? (
                <>
                  <BadgeCheck className="h-4 w-4" aria-hidden /> Verify {n(pendingPayments)} {pendingPayments === 1 ? "payment" : "payments"}
                </>
              ) : (
                "Open renewals"
              )}
            </ButtonLink>
          </div>
        </Card>

        <Card tone="plain" pad="none" className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
            <h2 className="font-semibold text-foreground">Call today</h2>
            <Badge tone={due.total ? "warning" : "muted"}>{n(due.total)} due</Badge>
          </div>
          {due.rows.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted">Nothing due — every follow-up is on track.</p>
          ) : (
            <ul className="divide-y divide-border">
              {due.rows.map((r) => (
                <li key={r.case_id}>
                  <Link href={`/owner/members/${r.member_id}`} className="flex min-h-[56px] items-center gap-3 px-4 py-2 hover:bg-surface">
                    <Avatar name={r.member_name} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">{r.member_name}</span>
                    <span className={r.absent_days >= 15 ? "num-display text-xl text-danger" : "num-display text-xl text-foreground"}>{r.absent_days}d</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/owner/red-list" className="flex min-h-[48px] items-center justify-center border-t border-border text-sm font-semibold text-foreground hover:bg-surface">
            {due.total > due.rows.length ? `All ${due.total} on the Red List` : "Open the Red List"}
          </Link>
        </Card>
      </div>

      {issues.length > 0 && (
        <Card tone="warning" pad="sm" className="mt-3" aria-labelledby="data-quality-heading">
          <h2 id="data-quality-heading" className="mb-1 flex items-center gap-2 font-semibold text-warning">
            <AlertTriangle className="h-4 w-4" aria-hidden /> Records to check
          </h2>
          <ul className="space-y-1 text-sm">
            {issues.map((i) => (
              <li key={i.key}>
                <Link href={i.href} className="text-foreground underline-offset-4 hover:underline">
                  {n(i.count)} {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Section title="This month and today" id="kpi-heading">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat href="/owner/members?status=Active" icon={Users} label="Active members" value={n(k.activeMembers)} sub="On a running plan" />
          <Stat href="/owner/attendance" icon={CalendarCheck} label="Check-ins today" value={n(k.todayCheckins)} />
          <Stat href="/owner/members" icon={UserCheck} label="Visited in 7 days" value={n(k.sevenDayActiveMembers)} sub="Different members" />
          <Stat href="/owner/red-list" icon={UserX} label="Open Red List" value={n(k.openRedListCases)} tone={k.openRedListCases ? "danger" : undefined} />
          <Stat href="/owner/red-list" icon={HeartHandshake} label="Came back" value={n(k.membersReturnedAfterFollowUp)} sub="After a follow-up, this month" />
          <Stat href="/owner/renewals" icon={IndianRupee} label="Renewals" value={formatRupees(k.renewalCollectionThisMonth)} sub="Collected this month" />
          <Stat href="/owner/add-ons" icon={ShoppingBag} label="Add-ons" value={formatRupees(k.addonRevenueThisMonth)} sub="Collected this month" />
          <Stat href="/owner/renewals" icon={BadgeCheck} label="Paid today" value={formatRupees(k.summary.renewalsPaidToday.amount)} sub={`${n(k.summary.renewalsPaidToday.count)} renewals`} />
        </div>
      </Section>

      <Section title="Today so far" id="today-heading">
        <List>
          <ListRow title="New on the Red List" trailing={<span className="num-display text-2xl text-foreground">{n(k.summary.casesOpenedToday)}</span>} />
          <ListRow title="Follow-ups due" trailing={<span className="num-display text-2xl text-foreground">{n(k.followupsDueToday)}</span>} />
          <ListRow
            href="/owner/renewals"
            title="Payments waiting for you"
            trailing={<span className={pendingPayments ? "num-display text-2xl text-warning" : "num-display text-2xl text-foreground"}>{n(pendingPayments)}</span>}
          />
        </List>
      </Section>
    </Page>
  );
}
