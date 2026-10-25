import Link from "next/link";
import { BadgeCheck, MessageCircle, Phone, ReceiptIndianRupee } from "lucide-react";
import { getCurrentStaff } from "@/services/auth";
import { listPendingPayments, receiptNumber } from "@/services/payments";
import { whatsAppLink } from "@/services/red-list";
import { listRenewalsDue, renewalReminderMessage, siteOrigin } from "@/services/renewals";
import { formatDisplayDate, formatDisplayDateTime } from "@/utils/dates";
import { formatRupees } from "@/utils/money";
import { EmptyState } from "@/components/states";
import { ReviewDialog } from "./review-dialog";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Page, PageHeader } from "@/components/ui/page";

export const metadata = { title: "Renewals" };
// Live money data on every request; never prerendered at build time.
export const dynamic = "force-dynamic";

function daysText(days: number) {
  if (days === 0) return "Expires today";
  if (days < 0) return `Expired ${-days} ${days === -1 ? "day" : "days"} ago`;
  return `${days} ${days === 1 ? "day" : "days"} left`;
}

export default async function RenewalsPage() {
  const [staff, queue, groups] = await Promise.all([getCurrentStaff(), listPendingPayments(), listRenewalsDue()]);
  const isOwner = staff?.role === "Owner";
  const renewLink = `${siteOrigin()}/member/renew`;
  const total = groups.reduce((n, g) => n + g.rows.length, 0);

  return (
    <Page width="owner" className="space-y-6">
      <PageHeader title="Renewals" description="Verify payments, then remind members whose plans run out soon." className="mb-0" />

      <section aria-labelledby="queue-heading">
        <h2 id="queue-heading" className="mb-2 flex items-center gap-2 font-semibold text-foreground">
          <BadgeCheck className="h-5 w-5" aria-hidden /> Pending verification
          <Badge tone={queue.length ? "warning" : "muted"}>{queue.length}</Badge>
        </h2>
        {queue.length === 0 ? (
          <p className="rounded-lg bg-surface p-4 text-sm text-muted">No payments waiting. Renewal and add-on payments appear here as soon as a member pays.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-background">
            {queue.map((p) => (
              <li key={p.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/owner/members/${p.memberId}`} className="font-medium text-foreground hover:underline">
                      {p.memberName}
                    </Link>
                    <p className="text-sm text-muted">
                      {p.purpose === "AddOn" ? "Add-on: " : ""}
                      {p.planName}
                      {p.quantity > 1 ? ` × ${p.quantity}` : ""} · {receiptNumber(p.id)} · {formatDisplayDateTime(p.createdAt)}
                    </p>
                    <p className={p.providerRef ? "text-sm text-foreground" : "text-sm text-warning"}>
                      {p.method === "Cash"
                        ? `Cash taken at the desk · ${p.providerRef}`
                        : p.providerRef
                          ? `UPI reference: ${p.providerRef}`
                          : "Member hasn't sent a reference yet"}
                    </p>
                  </div>
                  <p className="num-display shrink-0 text-3xl text-foreground">{formatRupees(p.amount)}</p>
                </div>
                {isOwner && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <ReviewDialog mode="verify" paymentId={p.id} memberName={p.memberName} planName={p.planName} amount={p.amount} claimedRef={p.providerRef} purpose={p.purpose} method={p.method} />
                    <ReviewDialog mode="reject" paymentId={p.id} memberName={p.memberName} planName={p.planName} amount={p.amount} claimedRef={p.providerRef} purpose={p.purpose} method={p.method} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="pipeline-heading" className="space-y-4">
        <h2 id="pipeline-heading" className="font-semibold text-foreground">
          Renewals due
        </h2>
        {total === 0 ? (
          <EmptyState
            icon={<ReceiptIndianRupee className="h-10 w-10" />}
            title="No renewals due"
            message="No memberships expire in the next 14 days, and none expired in the last 30."
          />
        ) : (
          groups.map((g) => (
            <div key={g.key} className="overflow-hidden rounded-lg border border-border bg-background">
              <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
                <div>
                  <h3 className="font-semibold text-foreground">{g.title}</h3>
                  {!g.memberReminder && <p className="text-xs text-muted">Heads-up only — members aren&apos;t messaged yet</p>}
                </div>
                <p className="text-right text-sm text-muted">
                  {g.rows.length} · <span className="num-display text-xl text-foreground">{formatRupees(g.expected)}</span>
                  {g.pending > 0 && <span className="block text-xs text-warning">{g.pending} paying now</span>}
                </p>
              </div>
              {g.rows.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted">No one in this stage.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {g.rows.map((r) => (
                    <li key={r.member_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/owner/members/${r.member_id}`} className="font-medium text-foreground hover:underline">
                          {r.member_name}
                        </Link>
                        <p className="text-sm text-muted">
                          {r.plan_name} · {formatDisplayDate(r.expiry_date)} ·{" "}
                          <span className={r.days_left < 0 ? "text-danger" : undefined}>{daysText(r.days_left)}</span>
                        </p>
                        <p className="text-xs text-muted">
                          {r.pending_payment_id ? `Payment of ${formatRupees(r.pending_amount ?? 0)} pending` : `Renews at ${formatRupees(r.renewal_amount)}`}
                          {!r.notify_renewal && " · opted out of renewal reminders"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <a href={`tel:+91${r.member_phone}`} className={buttonVariants({ variant: "outline", size: "sm" })} aria-label={`Call ${r.member_name}`}>
                          <Phone className="h-4 w-4" aria-hidden />
                        </a>
                        {g.memberReminder && !r.pending_payment_id && r.notify_renewal && (
                          <a
                            href={whatsAppLink(
                              r.member_phone,
                              renewalReminderMessage({ name: r.member_name, plan: r.plan_name, expiryDate: r.expiry_date, renewalLink: renewLink })
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={buttonVariants({ variant: "dark", size: "sm" })}
                          >
                            <MessageCircle className="h-4 w-4" aria-hidden /> Remind
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </section>
    </Page>
  );
}
