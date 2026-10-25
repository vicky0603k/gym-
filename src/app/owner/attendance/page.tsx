import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { listCheckinsToday } from "@/services/attendance";
import { formatDisplayDate, formatDisplayTime, todayKolkata } from "@/utils/dates";
import { EmptyState } from "@/components/states";

export const metadata = { title: "Today's check-ins" };
export const dynamic = "force-dynamic";

export default async function TodayCheckinsPage() {
  const checkins = await listCheckinsToday();

  return (
    <div className="mx-auto w-full px-4 pb-8 pt-4 md:px-6 md:pt-6 max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Today&apos;s check-ins</h1>
      <p className="text-sm text-muted mb-4">
        {formatDisplayDate(todayKolkata())} · {checkins.length} so far
      </p>
      {checkins.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck className="h-10 w-10" />}
          title="No check-ins yet today"
          message="Members appear here the moment they scan the gate QR or are checked in at the desk."
          action={<Link href="/owner/qr" className="btn-primary">Show the gate QR</Link>}
        />
      ) : (
        <ul className="card divide-y divide-border">
          {checkins.map((c) => (
            <li key={c.id}>
              <Link href={`/owner/members/${c.member_id}`} className="flex items-center justify-between gap-3 px-4 py-3 min-h-[56px] hover:bg-surface-2">
                <span className="min-w-0 truncate font-medium text-foreground">{c.memberName}</span>
                <span className="shrink-0 text-sm text-muted">
                  {formatDisplayTime(c.checkin_at)} · {c.source === "QR" ? "QR scan" : "Front desk"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
