import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireMember } from "@/services/auth";
import { getPaymentDetail, receiptNumber } from "@/services/payments";
import { paymentLabel } from "@/services/payment-labels";
import { getSettings } from "@/services/settings";
import { formatRupees } from "@/utils/money";
import { PrintButton } from "@/components/print-button";
import { Receipt } from "@/components/receipt";
import { StatusBadge } from "@/components/status-badge";

export const metadata = { title: "Receipt" };

/** Scoped to the session's member: another member's payment id is a 404. */
export default async function MemberReceiptPage({ params }: { params: { id: string } }) {
  const { memberId } = await requireMember();
  const [payment, settings] = await Promise.all([getPaymentDetail(params.id, memberId), getSettings()]);
  const gymName = settings.gym_name || "Your gym";
  if (!payment) notFound();

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-8 pt-4 space-y-4">
      <Link href="/member/payments" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground min-h-[48px] print:hidden">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Payments
      </Link>
      {payment.status === "Paid" ? (
        <>
          <Receipt payment={payment} gymName={gymName} gstin={settings.gstin} />
          <PrintButton />
        </>
      ) : (
        <section className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted">{receiptNumber(payment.id)}</p>
              <h1 className="text-lg font-semibold text-foreground">
                {payment.planName} · {formatRupees(payment.amount)}
              </h1>
            </div>
            <StatusBadge status={paymentLabel(payment)} />
          </div>
          <p className="mt-3 text-sm text-muted">
            {payment.status === "Pending"
              ? "The gym hasn't confirmed this payment yet. Your receipt appears here once it is confirmed."
              : payment.orderStatus === "Cancelled"
                ? "You chose a different plan before paying, so this request was replaced. Nothing was charged by the app."
                : "The gym couldn't confirm this payment and your membership was not changed. If money was debited, show your UPI app at the front desk."}
          </p>
          <Link href="/member/renew" className="btn-primary mt-4 flex w-full items-center justify-center">
            Go to renewal
          </Link>
        </section>
      )}
    </div>
  );
}
