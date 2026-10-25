import Link from "next/link";
import { AlertTriangle, ChevronRight, CircleCheck, IdCard } from "lucide-react";
import { requireMember } from "@/services/auth";
import { getMemberHome } from "@/services/members";
import { listPlans } from "@/services/memberships";
import { listMemberPayments, receiptNumber } from "@/services/payments";
import { getGymName, getPaymentSetup, upiPayLink } from "@/services/renewals";
import { daysAgoKolkata, daysUntilKolkata, formatDisplayDate } from "@/utils/dates";
import { EmptyState } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import { PendingPayment } from "./pending-payment";
import { PlanPicker } from "./plan-picker";
import { Card } from "@/components/ui/card";
import { List, ListRow } from "@/components/ui/list";
import { Page, PageHeader } from "@/components/ui/page";

export const metadata = { title: "Renew" };

export default async function RenewPage() {
  const { memberId } = await requireMember();
  const [home, plans, payments, gymName] = await Promise.all([
    getMemberHome(memberId),
    listPlans(),
    listMemberPayments(memberId, "Renewal"),
    getGymName(),
  ]);
  const setup = await getPaymentSetup();
  const membership = home?.membership;

  if (!membership) {
    return (
      <Page>
        <EmptyState icon={<IdCard className="h-10 w-10" />} title="No membership to renew" message="Please visit the front desk to start a membership." />
      </Page>
    );
  }

  const pending = payments.find((p) => p.status === "Pending");
  const lastFailed = !pending && payments[0]?.status === "Failed" && payments[0]?.orderStatus === "Failed" ? payments[0] : null;
  const justPaid = payments[0]?.status === "Paid" && payments[0].verifiedAt && daysAgoKolkata(payments[0].verifiedAt) <= 7 ? payments[0] : null;
  const daysLeft = daysUntilKolkata(membership.expiry_date);
  const offered = plans.filter((p) => p.is_active);

  return (
    <Page className="space-y-4">
      <PageHeader title="Renew membership" className="mb-1" />

      <Card tone="dark" pad="sm" className="flex items-center justify-between gap-3 px-5">
        <div className="min-w-0">
          <p className="truncate text-sm text-background/70">
            {membership.planName} · {daysLeft < 0 ? "expired on" : "valid till"}
          </p>
          <p className="num-display text-3xl uppercase text-accent">{formatDisplayDate(membership.expiry_date)}</p>
        </div>
        <StatusBadge status={membership.status === "Active" && daysLeft < 0 ? "Expired" : membership.status} />
      </Card>

      {justPaid && (
        <section className="card border-success/40 p-5" role="status">
          <p className="flex items-center gap-2 font-semibold text-foreground">
            <CircleCheck className="h-5 w-5 text-success" aria-hidden /> Payment confirmed
          </p>
          <p className="mt-1 text-sm text-muted">
            {justPaid.planName} renewed{justPaid.newExpiry ? ` — valid till ${formatDisplayDate(justPaid.newExpiry)}` : ""}.
          </p>
          <Link href={`/member/payments/${justPaid.id}`} className="mt-3 inline-flex min-h-[40px] items-center gap-1 text-sm font-medium text-foreground underline underline-offset-4">
            View receipt <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </section>
      )}

      {lastFailed && (
        <section className="card border-danger/40 p-5" role="alert">
          <p className="flex items-center gap-2 font-semibold text-foreground">
            <AlertTriangle className="h-5 w-5 text-danger" aria-hidden /> Your last payment couldn&apos;t be confirmed
          </p>
          <p className="mt-1 text-sm text-muted">
            The gym couldn&apos;t find your {lastFailed.planName} payment. Your membership was not changed. If money was debited, show your
            UPI app to the front desk — they will sort it out. You can also try again below.
          </p>
        </section>
      )}

      {pending && (
        <PendingPayment
          paymentId={pending.id}
          planName={pending.planName}
          amount={pending.amount}
          receiptNo={receiptNumber(pending.id)}
          upiId={setup.upiId}
          upiLink={setup.upiId ? upiPayLink({ ...setup, upiId: setup.upiId }, pending.amount, `${gymName} renewal ${receiptNumber(pending.id)}`) : null}
          claimedRef={pending.providerRef}
          afterCancelHref="/member/renew"
        />
      )}

      {!pending?.providerRef &&
        (offered.length === 0 ? (
          <EmptyState title="No plans on offer right now" message="Please ask the front desk to renew your membership." />
        ) : (
          <PlanPicker plans={offered} currentExpiry={membership.expiry_date} replacesPending={Boolean(pending)} />
        ))}

      <details className="rounded-lg bg-surface p-4 text-sm text-muted">
        <summary className="cursor-pointer font-medium text-foreground min-h-[32px]">How renewal works</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>The price shown is the final amount you pay, after any discount.</li>
          <li>Your new plan starts from your current expiry date, or from today if it has already expired.</li>
          <li>Your membership is extended only after {gymName} confirms the payment.</li>
          <li>Pay only by UPI to the ID shown here or at the front desk. Never share your UPI PIN with anyone.</li>
        </ul>
      </details>

      {payments.length > 0 && (
        <List>
          <ListRow href="/member/payments" title="Payments and receipts" meta={`${payments.length} renewal ${payments.length === 1 ? "payment" : "payments"}`} />
        </List>
      )}
    </Page>
  );
}
