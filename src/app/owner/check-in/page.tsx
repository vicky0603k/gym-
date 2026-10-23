import Link from "next/link";
import { QrCode, Search, SearchX, UserSearch } from "lucide-react";
import { listMembers } from "@/services/members";
import { formatDisplayDate } from "@/utils/dates";
import { formatPhone } from "@/utils/phone";
import { EmptyState } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import { AssistDialog } from "./assist-dialog";

export const metadata = { title: "Assisted check-in" };

const MAX_RESULTS = 20;

/** Front desk: find a member by name or mobile and check them in with a reason. */
export default async function AssistedCheckInPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q?.trim() ?? "";
  const members = q ? (await listMembers({ search: q })).slice(0, MAX_RESULTS) : [];

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold text-foreground">Assisted check-in</h1>
        <Link href="/owner/qr" className="btn-secondary inline-flex items-center gap-2 text-sm">
          <QrCode className="h-4 w-4" aria-hidden /> Show gate QR
        </Link>
      </div>
      <p className="text-sm text-muted mb-4">For members who can&apos;t scan the gate QR.</p>

      <form method="get" role="search" className="flex gap-2 mb-4">
        <input
          name="q"
          type="search"
          defaultValue={q}
          autoFocus
          placeholder="Name or mobile number"
          aria-label="Search members by name or mobile number"
          className="input"
        />
        <button type="submit" className="btn-secondary px-4" aria-label="Search">
          <Search className="h-5 w-5" aria-hidden />
        </button>
      </form>

      {!q ? (
        <EmptyState
          icon={<UserSearch className="h-10 w-10" />}
          title="Find the member"
          message="Search by name or the last few digits of their mobile number."
        />
      ) : members.length === 0 ? (
        <EmptyState icon={<SearchX className="h-10 w-10" />} title="No members match" message={`No one matches “${q}”. Check the spelling or try the mobile number.`} />
      ) : (
        <ul className="card divide-y divide-border">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2">
                  <span className="truncate font-medium text-foreground">{m.name}</span>
                  {m.status !== "Active" && <StatusBadge status={m.status} />}
                </p>
                <p className="text-sm text-muted">{formatPhone(m.phone)}</p>
                <p className="truncate text-xs text-muted">
                  {m.planName ?? "No plan"}
                  {m.expiryDate && ` · till ${formatDisplayDate(m.expiryDate)}`}
                </p>
              </div>
              <AssistDialog memberId={m.id} memberName={m.name} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
