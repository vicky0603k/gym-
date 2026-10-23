import { CalendarCheck, History } from "lucide-react";
import type { Attendance } from "@/services/supabase/database.types";
import type { MembershipWithPlan } from "@/services/members";
import { daysUntilKolkata, formatDisplayDate, formatDisplayDateTime } from "@/utils/dates";
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

export function RecentVisits({ visits, lastVisit }: { visits: Attendance[]; lastVisit: string | null }) {
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
    </section>
  );
}
