import { PartyPopper, SearchX } from "lucide-react";
import { getCurrentStaff } from "@/services/auth";
import { countCheckinsToday } from "@/services/attendance";
import { getGymPhone, getRedList, RED_LIST_FILTERS, type RedListFilter } from "@/services/red-list";
import { todayKolkata } from "@/utils/dates";
import { cn } from "@/utils/cn";
import { EmptyState } from "@/components/states";
import { RedListRow } from "./red-list-row";
import { RunScanButton } from "./run-scan-button";
import { Chips } from "@/components/ui/bits";
import { ButtonLink } from "@/components/ui/button";
import { Page, PageHeader } from "@/components/ui/page";

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
    <Page width="owner">
      <PageHeader title="Red List" description="Members who stopped coming. Call or message them before they quit." action={staff?.role === "Owner" && <RunScanButton />} />

      <div className="mb-4 grid grid-cols-3 gap-2">
        {[
          { label: "At risk", value: list.counts.all, tone: list.counts.all ? "text-danger" : "text-foreground" },
          { label: "Due today", value: list.dueToday, tone: list.dueToday ? "text-warning" : "text-foreground" },
          { label: "Check-ins today", value: checkinsToday, tone: "text-foreground" },
        ].map((m) => (
          <div key={m.label} className="rounded-lg bg-surface px-3 py-3">
            <p className={cn("num-display text-3xl", m.tone)}>{m.value}</p>
            <p className="text-xs text-muted">{m.label}</p>
          </div>
        ))}
      </div>

      <Chips
        label="Filter the Red List"
        items={(["all", ...RED_LIST_FILTERS] as const).map((f) => ({
          href: f === "all" ? "/owner/red-list" : `/owner/red-list?filter=${f}`,
          label: FILTER_LABELS[f],
          count: list.counts[f],
          active: (f === "all" && !filter) || f === filter,
        }))}
      />

      <div className="mt-3">
        {list.rows.length === 0 ? (
          filter ? (
            <EmptyState
              icon={<SearchX className="h-10 w-10" />}
              title="No one in this group"
              message={`No open cases match “${FILTER_LABELS[filter]}”.`}
              action={
                <ButtonLink href="/owner/red-list" variant="outline">
                  Show everyone
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              icon={<PartyPopper className="h-10 w-10 text-success" />}
              title="No one is at risk today"
              message={`Every active member has visited recently. ${checkinsToday} ${checkinsToday === 1 ? "check-in" : "check-ins"} so far today.`}
            />
          )
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-background">
            {list.rows.map((row) => (
              <RedListRow key={row.case_id} row={row} today={today} gymPhone={gymPhone} />
            ))}
          </ul>
        )}
      </div>
    </Page>
  );
}
