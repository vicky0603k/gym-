import Link from "next/link";
import { CalendarCheck, ChevronRight, History, ReceiptIndianRupee, UserX } from "lucide-react";
import type { Attendance } from "@/services/supabase/database.types";
import type { MembershipWithPlan } from "@/services/members";
import type { MemberCase } from "@/services/red-list";
import type { PaymentDetail } from "@/services/payments";
import { paymentLabel } from "@/services/payment-labels";
import { formatRupees } from "@/utils/money";
import { CHANNEL_LABELS, OUTCOME_LABELS } from "@/utils/follow-up-labels";
import { daysUntilKolkata, formatDisplayDate, formatDisplayDateTime, toKolkataDateString } from "@/utils/dates";
import { StatusBadge } from "@/components/status-badge";

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
  const expired = daysLeft < 0;
  // The member's card, as staff see it: black, expiry large in volt (same design as member home).
  return (
    <section className="rounded-lg bg-foreground p-5 text-background" aria-label="Current membership">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">{membership.planName}</p>
        {membership.status === "Frozen" ? (
          <span className="rounded-full bg-warning px-2.5 py-1 text-xs font-bold text-background">Paused</span>
        ) : expired ? (
          <span className="rounded-full bg-danger px-2.5 py-1 text-xs font-bold text-background">Expired</span>
        ) : (
          <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">Active</span>
        )}
      </div>
      <p className="mt-4 text-sm text-background/70">{expired ? "Expired on" : "Expires"}</p>
      <p className="num-display text-5xl uppercase text-accent">{formatDisplayDate(membership.expiry_date)}</p>
      <p className="mt-2 text-sm text-background/70">
        {expired ? `${-daysLeft} days ago` : daysLeft === 0 ? "Today" : `${daysLeft} days left`} · started {formatDisplayDate(membership.start_date)}
        {membership.status === "Frozen" && membership.freeze_start && ` · paused since ${formatDisplayDate(membership.freeze_start)}`}
      </p>
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
          className="mt-2 inline-flex min-h-[48px] items-center gap-1 text-sm font-medium text-foreground underline underline-offset-4"
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
  Returned: { text: "Returned", tone: "bg-accent text-accent-foreground" },
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

/** Renewal payments with links to receipts (Paid) or their status. */
export function PaymentsSection({ payments }: { payments: PaymentDetail[] }) {
  if (payments.length === 0) return null;
  return (
    <section className="card p-5">
      <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
        <ReceiptIndianRupee className="h-4 w-4 text-muted" aria-hidden /> Payments
      </h2>
      <ul className="divide-y divide-border">
        {payments.map((p) => (
          <li key={p.id}>
            <Link href={`/owner/payments/${p.id}`} className="flex items-center justify-between gap-3 py-3 min-h-[56px]">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">
                  {p.planName} · {formatRupees(p.amount)}
                </span>
                <span className="block text-xs text-muted">
                  {formatDisplayDate(toKolkataDateString(p.verifiedAt ?? p.createdAt))}
                  {p.newExpiry && p.status === "Paid" && ` · valid till ${formatDisplayDate(p.newExpiry)}`}
                </span>
              </span>
              <StatusBadge status={paymentLabel(p)} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
