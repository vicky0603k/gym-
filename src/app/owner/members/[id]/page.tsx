import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Phone } from "lucide-react";
import { getCurrentStaff } from "@/services/auth";
import { getMemberDetail } from "@/services/members";
import { formatDisplayDate } from "@/utils/dates";
import { formatPhone } from "@/utils/phone";
import { StatusBadge } from "@/components/status-badge";
import { CurrentMembership, MembershipHistory, RecentVisits } from "./sections";
import { StatusDialog } from "./status-dialog";

export const metadata = { title: "Member" };

export default async function MemberDetailPage({ params }: { params: { id: string } }) {
  const [staff, detail] = await Promise.all([getCurrentStaff(), getMemberDetail(params.id)]);
  if (!detail) notFound();
  const { member, current } = detail;
  const isOwner = staff?.role === "Owner";
  const paused = current?.status === "Frozen";
  // Pause needs a running membership; resume needs a frozen one.
  const canChangeStatus = isOwner && current && (paused || current.status === "Active");

  return (
    <div className="p-4 md:p-6 max-w-xl space-y-4">
      <Link href="/owner/members" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground min-h-[48px]">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Members
      </Link>

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground break-words">{member.name}</h1>
          <a href={`tel:+91${member.phone}`} className="inline-flex items-center gap-2 text-muted hover:text-foreground min-h-[40px]">
            <Phone className="h-4 w-4" aria-hidden /> {formatPhone(member.phone)}
          </a>
        </div>
        <StatusBadge status={member.status} className="mt-2" />
      </header>

      {isOwner && (
        <div className="flex flex-wrap gap-3">
          <Link href={`/owner/members/${member.id}/edit`} className="btn-secondary inline-flex items-center gap-2">
            <Pencil className="h-4 w-4" aria-hidden /> Edit
          </Link>
          {canChangeStatus && <StatusDialog memberId={member.id} memberName={member.name} paused={paused} />}
        </div>
      )}

      <CurrentMembership membership={current} />

      <section className="card p-5">
        <h2 className="font-semibold text-foreground mb-2">Details</h2>
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
      </section>

      <RecentVisits visits={detail.recentVisits} lastVisit={detail.lastVisit} />
      <MembershipHistory history={detail.history} />
    </div>
  );
}
