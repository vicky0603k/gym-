import Link from "next/link";
import { CalendarCheck, ChevronLeft, ChevronRight } from "lucide-react";
import type { Attendance } from "@/services/supabase/database.types";
import { formatDisplayDate, formatDisplayTime, toKolkataDateString } from "@/utils/dates";
import { EmptyState } from "./states";

export const HISTORY_PAGE_SIZE = 20;

/**
 * Paged attendance list (newest first). Pass one extra row beyond the page
 * size; it only signals that an older page exists.
 */
export function AttendanceList({
  visits,
  page,
  basePath,
  emptyMessage,
  emptyAction,
}: {
  visits: Attendance[];
  page: number;
  basePath: string;
  emptyMessage: string;
  emptyAction?: React.ReactNode;
}) {
  if (visits.length === 0 && page === 0) {
    return (
      <EmptyState icon={<CalendarCheck className="h-10 w-10" />} title="No check-ins yet" message={emptyMessage} action={emptyAction} />
    );
  }
  const rows = visits.slice(0, HISTORY_PAGE_SIZE);
  const hasOlder = visits.length > HISTORY_PAGE_SIZE;

  return (
    <>
      {rows.length === 0 ? (
        <p className="card p-5 text-sm text-muted">No older check-ins.</p>
      ) : (
        <ul className="card divide-y divide-border">
          {rows.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium text-foreground">{formatDisplayDate(toKolkataDateString(v.checkin_at))}</p>
                <p className="text-sm text-muted">{formatDisplayTime(v.checkin_at)}</p>
              </div>
              <span className="text-sm text-muted">{v.source === "QR" ? "QR scan" : "Front desk"}</span>
            </li>
          ))}
        </ul>
      )}
      {(page > 0 || hasOlder) && (
        <nav className="mt-4 flex justify-between gap-3" aria-label="Pages">
          {page > 0 ? (
            <Link href={page === 1 ? basePath : `${basePath}?page=${page - 1}`} className="btn-secondary inline-flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" aria-hidden /> Newer
            </Link>
          ) : (
            <span />
          )}
          {hasOlder && (
            <Link href={`${basePath}?page=${page + 1}`} className="btn-secondary inline-flex items-center gap-1">
              Older <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </nav>
      )}
    </>
  );
}

/** ?page= → a safe page index. */
export function pageParam(value?: string): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n < 10_000 ? n : 0;
}
