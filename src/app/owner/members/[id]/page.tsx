import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye, Pencil, Phone } from "lucide-react";
import { getCurrentStaff } from "@/services/auth";
import { getMemberDetail } from "@/services/members";
import { getMemberCases } from "@/services/red-list";
import { listMemberPayments } from "@/services/payments";
import { getActivePlans } from "@/services/memberships";
import { formatDisplayDate, todayKolkata } from "@/utils/dates";
import { formatPhone } from "@/utils/phone";
import { formatMemberCode } from "@/utils/member-code";
import { getMemberIdPrefix } from "@/services/settings";
import { StatusBadge } from "@/components/status-badge";
import { CurrentMembership, MembershipHistory, PaymentsSection, RecentVisits, RedListHistory } from "./sections";
import { StatusDialog } from "./status-dialog";
import { CorrectExpiryDialog, ResetPinDialog } from "./member-dialogs";
import { AnonymiseDialog, BackfillVisitDialog, DeskPaymentDialog, MemberStatusDialog } from "./desk-dialogs";
import { Avatar } from "@/components/ui/bits";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Member" };

export default async function MemberDetailPage({ params }: { params: { id: string } }) {
  const [staff, detail] = await Promise.all([getCurrentStaff(), getMemberDetail(params.id)]);
  if (!detail) notFound();
  const [cases, payments, plans, prefix] = await Promise.all([
    getMemberCases(detail.member.id),
    listMemberPayments(detail.member.id),
    getActivePlans(),
    getMemberIdPrefix(),
  ]);
  const { member, current } = detail;
  const isOwner = staff?.role === "Owner";
  const closed = member.status === "Cancelled" || member.status === "Blocked";
  const anonymised = member.name === "Former member";
  const paused = current?.status === "Frozen";
  // Pause needs a running membership; resume needs a frozen one.
  const canChangeStatus = isOwner && !closed && current && (paused || current.status === "Active");
  const canCorrectExpiry = isOwner && current && current.status !== "Pending";

  return (
    <div className="mx-auto w-full px-4 pb-8 pt-4 md:px-6 md:pt-6 max-w-2xl space-y-4">
      <Link href="/owner/members" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground min-h-[48px]">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Members
      </Link>

      <header className="flex items-center gap-4">
        <Avatar name={member.name} size="lg" tone={member.status === "Active" ? "volt" : "soft"} />
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-2xl font-bold tracking-tight text-foreground">{member.name}</h1>
          <p className="text-sm font-semibold tabular-nums tracking-wider text-foreground">
            <span className="sr-only">Member ID </span>
            {formatMemberCode(prefix, member.member_code)}
          </p>
          {anonymised ? (
            <p className="text-sm text-muted">Personal details removed on request</p>
          ) : (
            <a href={`tel:+91${member.phone}`} className="inline-flex min-h-[32px] items-center gap-2 text-muted hover:text-foreground">
              <Phone className="h-4 w-4" aria-hidden /> {formatPhone(member.phone)}
            </a>
          )}
        </div>
        <StatusBadge status={member.status} />
      </header>

      <div className="grid grid-cols-2 gap-2 [&_button]:w-full [&_a]:w-full">
        {isOwner && (
          <Link href={`/owner/members/${member.id}/edit`} className="btn-secondary px-3 whitespace-nowrap">
            <Pencil className="h-4 w-4" aria-hidden /> Edit
          </Link>
        )}
        {canChangeStatus && <StatusDialog memberId={member.id} memberName={member.name} paused={paused} />}
        {!closed && plans.length > 0 && <DeskPaymentDialog memberId={member.id} memberName={member.name} plans={plans} isOwner={isOwner} />}
        {canCorrectExpiry && (
          <CorrectExpiryDialog memberId={member.id} memberName={member.name} expiryDate={current.expiry_date} startDate={current.start_date} />
        )}
        {!anonymised && <ResetPinDialog memberId={member.id} memberName={member.name} />}
        <BackfillVisitDialog memberId={member.id} memberName={member.name} today={todayKolkata()} />
        {isOwner && !anonymised && <MemberStatusDialog memberId={member.id} memberName={member.name} status={member.status} />}
        {isOwner && member.status === "Cancelled" && !anonymised && <AnonymiseDialog memberId={member.id} memberName={member.name} />}
        {isOwner && !anonymised && (
          <Link href={`/owner/members/${member.id}/preview`} className="btn-secondary px-3 whitespace-nowrap">
            <Eye className="h-4 w-4" aria-hidden /> View member app
          </Link>
        )}
      </div>

      <CurrentMembership membership={current} />

      <Card tone="plain">
        <h2 className="mb-2 font-semibold text-foreground">Details</h2>
        <dl className="divide-y divide-border text-sm">
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-muted">Joined</dt>
            <dd className="text-foreground">{formatDisplayDate(member.join_date)}</dd>
          </div>
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-muted">Trainer</dt>
            <dd className="text-foreground">{detail.trainerName ?? "Not assigned"}</dd>
          </div>
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-muted">Weekly target</dt>
            <dd className="text-foreground">{member.weekly_target} visits</dd>
          </div>
        </dl>
      </Card>

      <RecentVisits memberId={member.id} visits={detail.recentVisits} lastVisit={detail.lastVisit} />
      <PaymentsSection payments={payments} />
      <RedListHistory cases={cases} />
      <MembershipHistory history={detail.history} />
    </div>
  );
}
