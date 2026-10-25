import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireMember } from "@/services/auth";
import { getPaymentDetail, receiptNumber } from "@/services/payments";
import { getGymName, getPaymentSetup, upiPayLink } from "@/services/renewals";
import { PendingPayment } from "@/app/member/renew/pending-payment";

export const metadata = { title: "Pay for add-on" };

/** Payment step for an add-on order, scoped to the session's member. */
export default async function AddonPayPage({ params }: { params: { paymentId: string } }) {
  const { memberId } = await requireMember();
  const [payment, gymName, setup] = await Promise.all([getPaymentDetail(params.paymentId, memberId), getGymName(), getPaymentSetup()]);
  if (!payment || payment.purpose !== "AddOn") notFound();
  if (payment.status !== "Pending") redirect(`/member/payments/${payment.id}`);

  const title = payment.quantity > 1 ? `${payment.planName} × ${payment.quantity}` : payment.planName;

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-8 pt-4 space-y-4">
      <Link href="/member/add-ons" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground min-h-[48px]">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Add-ons
      </Link>
      <PendingPayment
        paymentId={payment.id}
        planName={title}
        amount={payment.amount}
        receiptNo={receiptNumber(payment.id)}
        upiId={setup.upiId}
        upiLink={setup.upiId ? upiPayLink({ ...setup, upiId: setup.upiId }, payment.amount, `${gymName} ${receiptNumber(payment.id)}`) : null}
        claimedRef={payment.providerRef}
        afterCancelHref="/member/add-ons"
      />
    </div>
  );
}
