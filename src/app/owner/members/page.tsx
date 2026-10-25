import { Plus, Search, SearchX, Users } from "lucide-react";
import { getCurrentStaff } from "@/services/auth";
import { listMembers, MEMBER_LIST_LIMIT, MEMBER_STATUSES } from "@/services/members";
import { formatDisplayDate, todayKolkata } from "@/utils/dates";
import { formatPhone } from "@/utils/phone";
import { EmptyState } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import { Avatar, Chips } from "@/components/ui/bits";
import { ButtonLink } from "@/components/ui/button";
import { List, ListRow } from "@/components/ui/list";
import { Page, PageHeader } from "@/components/ui/page";

export const metadata = { title: "Members" };

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
    <Page width="owner">
      <PageHeader
        title="Members"
        description={
          members.length === MEMBER_LIST_LIMIT
            ? `Showing the first ${MEMBER_LIST_LIMIT} — search to narrow the list`
            : `${members.length} ${members.length === 1 ? "member" : "members"}${filtered ? " found" : ""}`
        }
        action={
          isOwner && (
            <ButtonLink href="/owner/members/new" size="sm">
              <Plus className="h-4 w-4" aria-hidden /> Add member
            </ButtonLink>
          )
        }
      />

      <form method="get" role="search" className="relative mb-3">
        {status && <input type="hidden" name="status" value={status} />}
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search name or mobile"
          aria-label="Search members by name or mobile number"
          className="input pl-12"
        />
        <button type="submit" className="sr-only">
          Search
        </button>
      </form>

      <Chips
        label="Filter by status"
        items={[undefined, ...MEMBER_STATUSES].map((s) => ({ href: chipHref(s), label: s ?? "All", active: s === status }))}
      />

      <div className="mt-3">
        {members.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={<SearchX className="h-10 w-10" />}
              title="No members match"
              message={q ? `No one matches “${q}”${status ? ` with status ${status}` : ""}.` : `No ${status} members right now.`}
              action={
                <ButtonLink href="/owner/members" variant="outline">
                  Clear search
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              icon={<Users className="h-10 w-10" />}
              title="No members yet"
              message="Add your first member to start tracking check-ins and renewals."
              action={isOwner && <ButtonLink href="/owner/members/new">Add your first member</ButtonLink>}
            />
          )
        ) : (
          <List label="Members">
            {members.map((m) => {
              const lapsed = Boolean(m.expiryDate && m.expiryDate < today);
              return (
                <ListRow
                  key={m.id}
                  href={`/owner/members/${m.id}`}
                  leading={<Avatar name={m.name} />}
                  title={m.name}
                  meta={
                    <>
                      {m.phone.startsWith("removed-") ? "Personal details removed" : formatPhone(m.phone)} · {m.planName ?? "No plan"}
                      {m.expiryDate && (
                        <span className={lapsed ? "text-danger" : undefined}>
                          {" · "}
                          {lapsed ? "expired" : "till"} {formatDisplayDate(m.expiryDate)}
                        </span>
                      )}
                    </>
                  }
                  trailing={<StatusBadge status={m.status} />}
                />
              );
            })}
          </List>
        )}
      </div>
    </Page>
  );
}
