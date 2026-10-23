import Link from "next/link";
import { ChevronRight, ReceiptIndianRupee } from "lucide-react";
import { requireMember } from "@/services/auth";
import { listMemberPayments, receiptNumber } from "@/services/payments";
import { paymentLabel } from "@/services/payment-labels";
import { formatDisplayDate, toKolkataDateString } from "@/utils/dates";
import { formatRupees } from "@/utils/money";
import { EmptyState } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";

export const metadata = { title: "Payments" };

/** The signed-in member's own renewal payments (member id comes from the session). */
export default async function MemberPaymentsPage() {
  const { memberId } = await requireMember();
  const payments = await listMemberPayments(memberId);

  return (
    <div className="px-6 py-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-4">Payments</h1>
      {payments.length === 0 ? (
        <EmptyState
          icon={<ReceiptIndianRupee className="h-10 w-10" />}
          title="No payments yet"
          message="Receipts for your renewals will appear here."
          action={<Link href="/member/renew" className="btn-primary">Renew membership</Link>}
        />
      ) : (
        <ul className="card divide-y divide-border">
          {payments.map((p) => (
            <li key={p.id}>
              <Link href={`/member/payments/${p.id}`} className="flex items-center gap-3 px-4 py-3 min-h-[64px] hover:bg-surface-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-foreground">
                    {p.planName} · {formatRupees(p.amount)}
                  </span>
                  <span className="block text-xs text-muted">
                    {formatDisplayDate(toKolkataDateString(p.verifiedAt ?? p.createdAt))} · {receiptNumber(p.id)}
                  </span>
                </span>
                <StatusBadge status={paymentLabel(p)} />
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
