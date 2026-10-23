import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { getPaymentDetail, receiptNumber } from "@/services/payments";
import { paymentLabel } from "@/services/payment-labels";
import { whatsAppLink } from "@/services/red-list";
import { getGymName, siteOrigin } from "@/services/renewals";
import { formatDisplayDate } from "@/utils/dates";
import { formatRupees } from "@/utils/money";
import { PrintButton } from "@/components/print-button";
import { Receipt } from "@/components/receipt";
import { StatusBadge } from "@/components/status-badge";

export const metadata = { title: "Receipt" };

/** Staff view of a renewal payment; Paid ones render the shareable receipt. */
export default async function OwnerReceiptPage({ params }: { params: { id: string } }) {
  const [payment, gymName] = await Promise.all([getPaymentDetail(params.id), getGymName()]);
  if (!payment) notFound();

  // API.md "Payment success" template, fully rendered.
  const share =
    payment.status === "Paid" && payment.newExpiry
      ? `Payment of ${formatRupees(payment.amount)} received. Your membership is active till ${formatDisplayDate(payment.newExpiry)}. Receipt: ${siteOrigin()}/member/payments/${payment.id}`
      : null;

  return (
    <div className="p-4 md:p-6 max-w-xl space-y-4">
      <Link
        href={`/owner/members/${payment.memberId}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground min-h-[48px] print:hidden"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> {payment.memberName}
      </Link>
      {payment.status === "Paid" ? (
        <>
          <Receipt payment={payment} gymName={gymName} />
          <div className="grid gap-3 sm:grid-cols-2 print:hidden">
            {share && (
              <a
                href={whatsAppLink(payment.memberPhone, share)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary inline-flex items-center justify-center gap-2"
              >
                <MessageCircle className="h-4 w-4" aria-hidden /> Send on WhatsApp
              </a>
            )}
            <PrintButton />
          </div>
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
              ? "Not verified yet — verify or reject it from Renewals."
              : "This payment was not confirmed, so no receipt exists and the membership was not changed."}
          </p>
          {payment.status === "Pending" && (
            <Link href="/owner/renewals" className="btn-primary mt-4 flex w-full items-center justify-center">
              Go to Renewals
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
