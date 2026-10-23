import Link from "next/link";
import { CalendarCheck, ChevronRight, ClipboardList, HeartHandshake, IndianRupee, ShoppingBag, UserCheck, Users, UserX, type LucideIcon } from "lucide-react";
import { getDashboardKPIs, getFollowUpsDue } from "@/services/dashboard";
import { formatDisplayDate, todayKolkata } from "@/utils/dates";
import { formatRupees } from "@/utils/money";
import { cn } from "@/utils/cn";

export const metadata = { title: "Dashboard" };
// Live numbers on every request (REAL_WORLD_STANDARD §2: no cached or hardcoded figures).
export const dynamic = "force-dynamic";

function Kpi({
  href,
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  tone?: "danger" | "warning";
}) {
  return (
    <Link href={href} className="card flex flex-col p-4 min-h-[112px] hover:bg-surface-2 transition-colors">
      <span className="flex items-center gap-1.5 text-xs text-muted">
        <Icon className="h-4 w-4" aria-hidden /> {label}
      </span>
      <span className={cn("kpi-number mt-1", tone === "danger" && "text-danger", tone === "warning" && "text-warning")}>{value}</span>
      {sub && <span className="mt-auto text-xs text-muted">{sub}</span>}
    </Link>
  );
}

export default async function OwnerDashboardPage() {
  const [k, due] = await Promise.all([getDashboardKPIs(), getFollowUpsDue(5)]);
  const n = (v: number) => new Intl.NumberFormat("en-IN").format(v);

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted">{formatDisplayDate(todayKolkata())}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Kpi href="/owner/members?status=Active" icon={Users} label="Active members" value={n(k.activeMembers)} sub="On a running plan" />
        <Kpi href="/owner/attendance" icon={CalendarCheck} label="Today's check-ins" value={n(k.todayCheckins)} />
        <Kpi href="/owner/members" icon={UserCheck} label="Active in last 7 days" value={n(k.sevenDayActiveMembers)} sub="Members who visited" />
        <Kpi href="/owner/red-list" icon={UserX} label="Open Red List" value={n(k.openRedListCases)} tone={k.openRedListCases ? "danger" : undefined} />
        <Kpi href="/owner/red-list" icon={HeartHandshake} label="Returned after follow-up" value={n(k.membersReturnedAfterFollowUp)} sub="This month" />
        <Kpi href="/owner/red-list" icon={ClipboardList} label="Follow-ups due" value={n(k.followupsDueToday)} sub="Today or overdue" tone={k.followupsDueToday ? "warning" : undefined} />
        <Kpi
          href="/owner/renewals"
          icon={IndianRupee}
          label="Renewals due in 7 days"
          value={n(k.renewalsDueIn7Days.count)}
          sub={`${formatRupees(k.renewalsDueIn7Days.expectedAmount)} expected`}
        />
        <Kpi href="/owner/renewals" icon={IndianRupee} label="Renewal collection" value={formatRupees(k.renewalCollectionThisMonth)} sub="This month, verified" />
        <Kpi href="/owner/add-ons" icon={ShoppingBag} label="Add-on revenue" value={formatRupees(k.addonRevenueThisMonth)} sub="This month, verified" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card p-5" aria-labelledby="summary-heading">
          <h2 id="summary-heading" className="font-semibold text-foreground mb-3">Today so far</h2>
          <dl className="divide-y divide-border text-sm">
            {[
              ["Check-ins", n(k.todayCheckins)],
              ["New on the Red List", n(k.summary.casesOpenedToday)],
              ["Follow-ups due", n(k.followupsDueToday)],
              ["Renewals paid", `${n(k.summary.renewalsPaidToday.count)} · ${formatRupees(k.summary.renewalsPaidToday.amount)}`],
              ["Payments waiting for you", n(k.summary.paymentsPending)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 py-2">
                <dt className="text-muted">{label}</dt>
                <dd className="font-medium text-foreground tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {k.summary.paymentsPending > 0 && (
            <Link href="/owner/renewals" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent min-h-[40px]">
              Verify payments <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </section>

        <section className="card p-5" aria-labelledby="due-heading">
          <h2 id="due-heading" className="font-semibold text-foreground mb-3">Follow-ups due today</h2>
          {due.rows.length === 0 ? (
            <p className="text-sm text-muted">Nothing due — every follow-up is on track.</p>
          ) : (
            <ul className="divide-y divide-border">
              {due.rows.map((r) => (
                <li key={r.case_id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/owner/members/${r.member_id}`} className="min-w-0 truncate text-sm font-medium text-foreground hover:underline">
                    {r.member_name}
                  </Link>
                  <span className={cn("shrink-0 text-sm tabular-nums", r.absent_days >= 15 ? "text-danger" : "text-muted")}>
                    {r.absent_days} days away
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/owner/red-list" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent min-h-[40px]">
            {due.total > due.rows.length ? `All ${due.total} on the Red List` : "Open the Red List"} <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </section>
      </div>
    </div>
  );
}
