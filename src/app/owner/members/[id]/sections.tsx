import Link from "next/link";
import { CalendarCheck, ChevronRight, History, UserX } from "lucide-react";
import type { Attendance } from "@/services/supabase/database.types";
import type { MembershipWithPlan } from "@/services/members";
import type { MemberCase } from "@/services/red-list";
import { CHANNEL_LABELS, OUTCOME_LABELS } from "@/utils/follow-up-labels";
import { daysUntilKolkata, formatDisplayDate, formatDisplayDateTime, toKolkataDateString } from "@/utils/dates";
import { StatusBadge } from "@/components/status-badge";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm text-foreground text-right">{value}</dd>
    </div>
  );
}

export function CurrentMembership({ membership }: { membership: MembershipWithPlan | null }) {
  if (!membership) {
    return (
      <section className="card p-5">
        <h2 className="font-semibold text-foreground mb-1">Current membership</h2>
        <p className="text-sm text-muted">No membership on file.</p>
      </section>
    );
  }
  const daysLeft = daysUntilKolkata(membership.expiry_date);
  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h2 className="text-sm text-muted">Current membership</h2>
          <p className="text-lg font-semibold text-foreground">{membership.planName}</p>
        </div>
        <StatusBadge status={membership.status === "Active" && daysLeft < 0 ? "Expired" : membership.status} />
      </div>
      <dl className="divide-y divide-border">
        <Row label="Started" value={formatDisplayDate(membership.start_date)} />
        <Row
          label="Expires"
          value={
            <>
              <span className="font-semibold">{formatDisplayDate(membership.expiry_date)}</span>
              <span className={daysLeft < 0 ? "block text-xs text-danger" : "block text-xs text-muted"}>
                {daysLeft < 0 ? `${-daysLeft} days ago` : daysLeft === 0 ? "Today" : `${daysLeft} days left`}
              </span>
            </>
          }
        />
        {membership.status === "Frozen" && membership.freeze_start && (
          <Row label="Paused since" value={formatDisplayDate(membership.freeze_start)} />
        )}
      </dl>
    </section>
  );
}

export function MembershipHistory({ history }: { history: MembershipWithPlan[] }) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
        <History className="h-4 w-4 text-muted" aria-hidden /> Membership history
      </h2>
      {history.length === 0 ? (
        <p className="text-sm text-muted">No memberships yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {history.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{m.planName}</p>
                <p className="text-xs text-muted">
                  {formatDisplayDate(m.start_date)} – {formatDisplayDate(m.expiry_date)}
                </p>
                {m.freeze_start && (
                  <p className="text-xs text-warning">
                    Paused {formatDisplayDate(m.freeze_start)}
                    {m.freeze_end ? ` – ${formatDisplayDate(m.freeze_end)}` : " onwards"}
                  </p>
                )}
              </div>
              <StatusBadge status={m.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function RecentVisits({
  memberId,
  visits,
  lastVisit,
}: {
  memberId: string;
  visits: Attendance[];
  lastVisit: string | null;
}) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold text-foreground mb-1 flex items-center gap-2">
        <CalendarCheck className="h-4 w-4 text-muted" aria-hidden /> Attendance
      </h2>
      <p className="text-sm text-muted mb-3">
        {lastVisit ? `Last visit ${formatDisplayDate(lastVisit)}` : "No check-ins yet."}
      </p>
      {visits.length > 0 && (
        <ul className="divide-y divide-border">
          {visits.map((v) => (
            <li key={v.id} className="flex justify-between gap-3 py-2 text-sm">
              <span className="text-foreground">{formatDisplayDateTime(v.checkin_at)}</span>
              <span className="text-muted">{v.source === "QR" ? "QR scan" : "Front desk"}</span>
            </li>
          ))}
        </ul>
      )}
      {visits.length > 0 && (
        <Link
          href={`/owner/members/${memberId}/attendance`}
          className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent min-h-[48px]"
        >
          Full attendance history <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </section>
  );
}

const CASE_LABEL: Record<MemberCase["status"], { text: string; tone: string }> = {
  Open: { text: "On Red List", tone: "bg-danger/10 text-danger" },
  Contacted: { text: "Contacted", tone: "bg-warning/10 text-warning" },
  FollowUpDue: { text: "Follow-up due", tone: "bg-warning/10 text-warning" },
  Returned: { text: "Returned", tone: "bg-accent/10 text-accent" },
  Closed: { text: "Closed", tone: "bg-surface-2 text-muted" },
};

/** Every Red List case with its full follow-up history — kept after the member returns. */
export function RedListHistory({ cases }: { cases: MemberCase[] }) {
  if (cases.length === 0) return null;
  return (
    <section className="card p-5">
      <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
        <UserX className="h-4 w-4 text-muted" aria-hidden /> Red List history
      </h2>
      <ul className="space-y-4">
        {cases.map((c) => (
          <li key={c.id} className="border-l-2 border-border pl-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-foreground">
                Opened {formatDisplayDate(c.opened_on)} · {c.absent_days_at_open} days absent
              </p>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${CASE_LABEL[c.status].tone}`}>
                {CASE_LABEL[c.status].text}
              </span>
            </div>
            {c.resolved_at && (
              <p className="text-xs text-muted">
                {c.status === "Returned" ? "Came back" : "Closed"} {formatDisplayDate(toKolkataDateString(c.resolved_at))}
              </p>
            )}
            {c.followups.length === 0 ? (
              <p className="mt-1 text-xs text-muted">No follow-ups recorded.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {c.followups.map((f) => (
                  <li key={f.id} className="text-xs text-muted">
                    <span className="text-foreground">{formatDisplayDateTime(f.created_at)}</span> · {CHANNEL_LABELS[f.channel]} ·{" "}
                    {OUTCOME_LABELS[f.outcome]}
                    {f.next_action_date && ` · next ${formatDisplayDate(f.next_action_date)}`}
                    {f.notes && <span className="block text-muted">“{f.notes}”</span>}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
