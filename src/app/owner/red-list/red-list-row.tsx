import Link from "next/link";
import { MessageCircle, Phone } from "lucide-react";
import type { RedListRow as Row } from "@/services/red-list";
import { noShowMessage, whatsAppLink } from "@/services/red-list";
import { addDaysToDate, formatDisplayDate, toKolkataDateString } from "@/utils/dates";
import { CHANNEL_LABELS, OUTCOME_LABELS } from "@/utils/follow-up-labels";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import { OutcomeDialog } from "./outcome-dialog";

/** One at-risk member: days away first (the number that matters), then who, then the three actions. */
export function RedListRow({ row, today, gymPhone }: { row: Row; today: string; gymPhone: string | null }) {
  const text = noShowMessage({ name: row.member_name, lastVisit: row.last_visit, joinDate: row.join_date, gymPhone });
  const overdue = row.next_action_date !== null && row.next_action_date < today;
  const severe = row.absent_days >= 15;

  return (
    <li className="px-4 py-4">
      <div className="flex items-start gap-4">
        <div className={cn("w-16 shrink-0 rounded-md py-2 text-center", severe ? "bg-danger/10" : "bg-surface")}>
          <span className={cn("num-display block text-3xl", severe ? "text-danger" : "text-foreground")}>{row.absent_days}</span>
          <span className={cn("block text-xs", severe ? "text-danger" : "text-muted")}>days away</span>
        </div>
        <div className="min-w-0 flex-1">
          <Link href={`/owner/members/${row.member_id}`} className="block truncate font-semibold text-foreground underline-offset-4 hover:underline">
            {row.member_name}
          </Link>
          <p className="text-sm text-muted">
            {row.last_visit ? `Last visit ${formatDisplayDate(row.last_visit)}` : `No visits since joining ${formatDisplayDate(row.join_date)}`}
          </p>
          <p className="truncate text-sm text-muted">
            {row.plan_name} · till {formatDisplayDate(row.expiry_date)}
            {row.trainer_name && ` · ${row.trainer_name}`}
          </p>
          {row.last_followup_at && row.last_followup_outcome && (
            <p className="mt-1 text-sm text-muted">
              {CHANNEL_LABELS[row.last_followup_channel ?? "Call"]} {formatDisplayDate(toKolkataDateString(row.last_followup_at))}:{" "}
              <span className="font-medium text-foreground">{OUTCOME_LABELS[row.last_followup_outcome]}</span>
              {row.followup_count > 1 && ` · ${row.followup_count} follow-ups`}
            </p>
          )}
          {row.next_action_date && (
            <p className={cn("mt-1 text-sm font-medium", row.followUpDue ? "text-warning" : "text-muted")}>
              {overdue
                ? `Follow-up overdue since ${formatDisplayDate(row.next_action_date)}`
                : row.followUpDue
                  ? "Follow-up due today"
                  : `Next follow-up ${formatDisplayDate(row.next_action_date)}`}
            </p>
          )}
          {!row.notify_care && <p className="mt-1 text-sm text-muted">Opted out of absence messages — call instead.</p>}
        </div>
      </div>

      <div className={cn("mt-3 grid gap-2", row.notify_care ? "grid-cols-3" : "grid-cols-2")}>
        <a href={`tel:+91${row.member_phone}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Phone className="h-4 w-4" aria-hidden /> Call
        </a>
        {row.notify_care && (
          <a href={whatsAppLink(row.member_phone, text)} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp
          </a>
        )}
        <OutcomeDialog caseId={row.case_id} memberName={row.member_name} today={today} defaultNextDate={addDaysToDate(today, 2)} />
      </div>
    </li>
  );
}
