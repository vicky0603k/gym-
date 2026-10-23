import Link from "next/link";
import { PartyPopper, SearchX } from "lucide-react";
import { getCurrentStaff } from "@/services/auth";
import { countCheckinsToday } from "@/services/attendance";
import { getGymPhone, getRedList, RED_LIST_FILTERS, type RedListFilter } from "@/services/red-list";
import { todayKolkata } from "@/utils/dates";
import { cn } from "@/utils/cn";
import { EmptyState } from "@/components/states";
import { RedListRow } from "./red-list-row";
import { RunScanButton } from "./run-scan-button";

export const metadata = { title: "Red List" };

const FILTER_LABELS: Record<RedListFilter | "all", string> = {
  all: "All",
  "10-14": "10–14 days",
  "15-21": "15–21 days",
  "22+": "22+ days",
  "expiring-soon": "Expiring soon",
};

export default async function RedListPage({ searchParams }: { searchParams: { filter?: string } }) {
  const filter = RED_LIST_FILTERS.find((f) => f === searchParams.filter);
  const [staff, list, checkinsToday, gymPhone] = await Promise.all([
    getCurrentStaff(),
    getRedList(filter),
    countCheckinsToday(),
    getGymPhone(),
  ]);
  const today = todayKolkata();

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold text-foreground">Red List</h1>
        {staff?.role === "Owner" && <RunScanButton />}
      </div>
      <p className="text-sm text-muted mb-4">
        <span className="font-semibold text-foreground">{list.counts.all}</span> at risk ·{" "}
        <span className={cn("font-semibold", list.dueToday ? "text-warning" : "text-foreground")}>{list.dueToday}</span> follow-ups
        due today · {checkinsToday} check-ins today
      </p>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-2" aria-label="Filter the Red List">
        {(["all", ...RED_LIST_FILTERS] as const).map((f) => {
          const active = (f === "all" && !filter) || f === filter;
          return (
            <Link
              key={f}
              href={f === "all" ? "/owner/red-list" : `/owner/red-list?filter=${f}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-medium min-h-[40px] inline-flex items-center gap-1.5",
                active ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:text-foreground"
              )}
            >
              {FILTER_LABELS[f]} <span className="tabular-nums opacity-75">{list.counts[f]}</span>
            </Link>
          );
        })}
      </div>

      {list.rows.length === 0 ? (
        filter ? (
          <EmptyState
            icon={<SearchX className="h-10 w-10" />}
            title="No one in this group"
            message={`No open cases match “${FILTER_LABELS[filter]}”.`}
            action={<Link href="/owner/red-list" className="btn-secondary">Show everyone</Link>}
          />
        ) : (
          <EmptyState
            icon={<PartyPopper className="h-10 w-10 text-accent" />}
            title="No one is at risk today"
            message={`Every active member has visited recently. ${checkinsToday} ${checkinsToday === 1 ? "check-in" : "check-ins"} so far today.`}
          />
        )
      ) : (
        <ul className="card divide-y divide-border">
          {list.rows.map((row) => (
            <RedListRow key={row.case_id} row={row} today={today} gymPhone={gymPhone} />
          ))}
        </ul>
      )}
    </div>
  );
}
