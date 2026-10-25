import Link from "next/link";
import { ReceiptIndianRupee } from "lucide-react";
import { requireMember } from "@/services/auth";
import { listMemberPayments, receiptNumber } from "@/services/payments";
import { paymentLabel } from "@/services/payment-labels";
import { formatDisplayDate, toKolkataDateString } from "@/utils/dates";
import { formatRupees } from "@/utils/money";
import { EmptyState } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import { List, ListRow } from "@/components/ui/list";
import { Page, PageHeader } from "@/components/ui/page";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Payments" };

/** The signed-in member's own renewal payments (member id comes from the session). */
export default async function MemberPaymentsPage() {
  const { memberId } = await requireMember();
  const payments = await listMemberPayments(memberId);

  return (
    <Page>
      <PageHeader title="Payments" back={{ href: "/member/more", label: "More" }} />
      {payments.length === 0 ? (
        <EmptyState
          icon={<ReceiptIndianRupee className="h-10 w-10" />}
          title="No payments yet"
          message="Receipts for your renewals will appear here."
          action={<Link href="/member/renew" className={buttonVariants()}>Renew membership</Link>}
        />
      ) : (
        <List label="Your payments">
          {payments.map((p) => (
            <ListRow
              key={p.id}
              href={`/member/payments/${p.id}`}
              title={p.planName}
              meta={`${formatDisplayDate(toKolkataDateString(p.verifiedAt ?? p.createdAt))} · ${receiptNumber(p.id)}`}
              trailing={
                <>
                  <span className="num-display block text-xl text-foreground">{formatRupees(p.amount)}</span>
                  <StatusBadge status={paymentLabel(p)} className="mt-1" />
                </>
              }
            />
          ))}
        </List>
      )}
    </Page>
  );
}
