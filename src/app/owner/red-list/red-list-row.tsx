import Link from "next/link";
import { MessageCircle, Phone } from "lucide-react";
import type { RedListRow as Row } from "@/services/red-list";
import { noShowMessage, whatsAppLink } from "@/services/red-list";
import { addDaysToDate, formatDisplayDate, toKolkataDateString } from "@/utils/dates";
import { CHANNEL_LABELS, OUTCOME_LABELS } from "@/utils/follow-up-labels";
import { cn } from "@/utils/cn";
import { OutcomeDialog } from "./outcome-dialog";

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}

export function RedListRow({ row, today, gymPhone }: { row: Row; today: string; gymPhone: string | null }) {
  const text = noShowMessage({ name: row.member_name, lastVisit: row.last_visit, joinDate: row.join_date, gymPhone });
  const overdue = row.next_action_date !== null && row.next_action_date < today;

  return (
    <li className="px-4 py-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-foreground">
          {initials(row.member_name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/owner/members/${row.member_id}`} className="truncate font-medium text-foreground hover:underline">
              {row.member_name}
            </Link>
            <span className={cn("shrink-0 text-lg font-bold tabular-nums", row.absent_days >= 15 ? "text-danger" : "text-foreground")}>
              {row.absent_days} days
            </span>
          </div>
          <p className="text-sm text-muted">
            {row.last_visit ? `Last visit ${formatDisplayDate(row.last_visit)}` : `No visits since joining ${formatDisplayDate(row.join_date)}`}
          </p>
          <p className="truncate text-xs text-muted">
            {row.plan_name} · till {formatDisplayDate(row.expiry_date)}
            {row.trainer_name && ` · ${row.trainer_name}`}
          </p>
          {row.last_followup_at && row.last_followup_outcome && (
            <p className="mt-1 text-xs text-muted">
              {CHANNEL_LABELS[row.last_followup_channel ?? "Call"]} {formatDisplayDate(toKolkataDateString(row.last_followup_at))}:{" "}
              <span className="text-foreground">{OUTCOME_LABELS[row.last_followup_outcome]}</span>
              {row.followup_count > 1 && ` · ${row.followup_count} follow-ups`}
            </p>
          )}
          {row.next_action_date && (
            <p className={cn("mt-1 text-xs font-medium", row.followUpDue ? "text-warning" : "text-muted")}>
              {overdue
                ? `Follow-up overdue since ${formatDisplayDate(row.next_action_date)}`
                : row.followUpDue
                  ? "Follow-up due today"
                  : `Next follow-up ${formatDisplayDate(row.next_action_date)}`}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <a href={`tel:+91${row.member_phone}`} className="btn-secondary inline-flex items-center justify-center gap-2 px-3 text-sm">
          <Phone className="h-4 w-4" aria-hidden /> Call
        </a>
        <a
          href={whatsAppLink(row.member_phone, text)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary inline-flex items-center justify-center gap-2 px-3 text-sm"
        >
          <MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp
        </a>
        <OutcomeDialog caseId={row.case_id} memberName={row.member_name} today={today} defaultNextDate={addDaysToDate(today, 2)} />
      </div>
    </li>
  );
}
