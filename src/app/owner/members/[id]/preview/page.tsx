import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Eye, X } from "lucide-react";
import { getCurrentStaff } from "@/services/auth";
import { getMemberDetail, logMemberPreview } from "@/services/members";
import { getWeeklyGoalState } from "@/services/streak";
import { listMemberPayments } from "@/services/payments";
import { paymentLabel } from "@/services/payment-labels";
import { getGymName } from "@/services/renewals";
import { getMemberIdPrefix } from "@/services/settings";
import { formatMemberCode } from "@/utils/member-code";
import { formatDisplayDate, formatDisplayTime, toKolkataDateString } from "@/utils/dates";
import { formatRupees } from "@/utils/money";
import { StatusBadge } from "@/components/status-badge";
import { Avatar } from "@/components/ui/bits";
import { List, ListRow } from "@/components/ui/list";
import { Section } from "@/components/ui/page";
import { MembershipCard } from "@/app/member/membership-card";
import { WeeklyGoalCard } from "@/app/member/weekly-goal-card";

export const metadata = { title: "Member app preview" };
export const dynamic = "force-dynamic";

/**
 * Owner only: what this member sees in their app, read-only. No actions are offered,
 * the member's data is never changed, and every view is written to the audit log.
 */
export default async function MemberPreviewPage({ params }: { params: { id: string } }) {
  const staff = await getCurrentStaff();
  if (staff?.role !== "Owner") redirect(`/owner/members/${params.id}`);
  const detail = await getMemberDetail(params.id);
  if (!detail) notFound();
  const [goal, payments, gymName, prefix] = await Promise.all([
    getWeeklyGoalState(detail.member.id),
    listMemberPayments(detail.member.id),
    getGymName(),
    getMemberIdPrefix(),
    logMemberPreview(detail.member.id, staff.id),
  ]);
  const { member, current } = detail;

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-8 pt-4">
      <div className="sticky top-0 z-30 -mx-4 mb-4 flex items-center justify-between gap-3 bg-foreground px-4 py-3 text-background">
        <p className="flex min-w-0 items-center gap-2 text-sm">
          <Eye className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">Viewing {member.name}&apos;s app — read only</span>
        </p>
        <Link href={`/owner/members/${member.id}`} className="inline-flex min-h-[40px] items-center gap-1 rounded-md px-2 text-sm font-semibold hover:bg-background/10">
          <X className="h-4 w-4" aria-hidden /> Close
        </Link>
      </div>

      <header className="mb-4 flex items-center justify-between gap-3">
        <h1 className="truncate text-xl font-bold text-foreground">{member.name}</h1>
        <Avatar name={member.name} tone="volt" />
      </header>

      {current ? (
        <MembershipCard gymName={gymName} memberId={formatMemberCode(prefix, member.member_code)} membership={current} />
      ) : (
        <p className="rounded-lg bg-surface p-5 text-sm text-muted">No membership on file.</p>
      )}
      <div className="mt-3">
        <WeeklyGoalCard goal={goal} />
      </div>

      <Section title="Recent visits">
        {detail.recentVisits.length === 0 ? (
          <p className="rounded-lg bg-surface p-4 text-sm text-muted">No check-ins yet.</p>
        ) : (
          <List>
            {detail.recentVisits.slice(0, 5).map((v) => (
              <ListRow
                key={v.id}
                title={formatDisplayDate(toKolkataDateString(v.checkin_at))}
                meta={formatDisplayTime(v.checkin_at)}
                trailing={<span className="text-sm text-muted">{v.source === "QR" ? "QR scan" : "Front desk"}</span>}
              />
            ))}
          </List>
        )}
      </Section>

      <Section title="Payments">
        {payments.length === 0 ? (
          <p className="rounded-lg bg-surface p-4 text-sm text-muted">No payments yet.</p>
        ) : (
          <List>
            {payments.slice(0, 5).map((p) => (
              <ListRow
                key={p.id}
                title={p.planName}
                meta={formatDisplayDate(toKolkataDateString(p.verifiedAt ?? p.createdAt))}
                trailing={
                  <>
                    <span className="num-display block text-xl text-foreground">{formatRupees(p.amount)}</span>
                    <StatusBadge status={paymentLabel(p)} className="mt-1" />
                  </>
                }
              />
            ))}
          </List>
        )}
      </Section>
    </div>
  );
}
