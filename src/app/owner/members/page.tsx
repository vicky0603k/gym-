import Link from "next/link";
import { ChevronRight, Plus, Search, SearchX, Users } from "lucide-react";
import { getCurrentStaff } from "@/services/auth";
import { listMembers, MEMBER_LIST_LIMIT, MEMBER_STATUSES } from "@/services/members";
import { formatDisplayDate, todayKolkata } from "@/utils/dates";
import { formatPhone } from "@/utils/phone";
import { cn } from "@/utils/cn";
import { EmptyState } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";

export const metadata = { title: "Members" };

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}

export default async function MembersPage({ searchParams }: { searchParams: { q?: string; status?: string } }) {
  const q = searchParams.q?.trim() ?? "";
  const status = MEMBER_STATUSES.find((s) => s === searchParams.status);
  const [staff, members] = await Promise.all([getCurrentStaff(), listMembers({ search: q, status })]);
  const isOwner = staff?.role === "Owner";
  const today = todayKolkata();
  const filtered = Boolean(q || status);

  const chipHref = (s?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (s) p.set("status", s);
    return p.toString() ? `/owner/members?${p}` : "/owner/members";
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-foreground">Members</h1>
        {isOwner && (
          <Link href="/owner/members/new" className="btn-primary inline-flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4" aria-hidden /> Add member
          </Link>
        )}
      </div>

      <form method="get" role="search" className="flex gap-2 mb-3">
        {status && <input type="hidden" name="status" value={status} />}
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search name or mobile"
          aria-label="Search members by name or mobile number"
          className="input"
        />
        <button type="submit" className="btn-secondary px-4" aria-label="Search">
          <Search className="h-5 w-5" aria-hidden />
        </button>
      </form>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-2" aria-label="Filter by status">
        {[undefined, ...MEMBER_STATUSES].map((s) => (
          <Link
            key={s ?? "all"}
            href={chipHref(s)}
            aria-current={s === status ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-medium min-h-[40px] inline-flex items-center",
              s === status ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:text-foreground"
            )}
          >
            {s ?? "All"}
          </Link>
        ))}
      </div>

      {members.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={<SearchX className="h-10 w-10" />}
            title="No members match"
            message={q ? `No one matches “${q}”${status ? ` with status ${status}` : ""}.` : `No ${status} members right now.`}
            action={<Link href="/owner/members" className="btn-secondary">Clear search</Link>}
          />
        ) : (
          <EmptyState
            icon={<Users className="h-10 w-10" />}
            title="No members yet"
            message="Add your first member to start tracking check-ins and renewals."
            action={isOwner && <Link href="/owner/members/new" className="btn-primary">Add your first member</Link>}
          />
        )
      ) : (
        <>
          <p className="text-xs text-muted mb-2">
            {members.length === MEMBER_LIST_LIMIT
              ? `Showing the first ${MEMBER_LIST_LIMIT}. Search to narrow the list.`
              : `${members.length} ${members.length === 1 ? "member" : "members"}`}
          </p>
          <ul className="card divide-y divide-border">
            {members.map((m) => (
              <li key={m.id}>
                <Link href={`/owner/members/${m.id}`} className="flex items-center gap-3 px-4 py-3 min-h-[64px] hover:bg-surface-2">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-foreground">
                    {initials(m.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{m.name}</span>
                    <span className="block text-sm text-muted">{formatPhone(m.phone)}</span>
                    <span className="block truncate text-xs text-muted">
                      {m.planName ?? "No plan"}
                      {m.expiryDate && (
                        <span className={m.expiryDate < today ? "text-danger" : undefined}>
                          {" · "}
                          {m.expiryDate < today ? "expired" : "till"} {formatDisplayDate(m.expiryDate)}
                        </span>
                      )}
                    </span>
                  </span>
                  <StatusBadge status={m.status} />
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
