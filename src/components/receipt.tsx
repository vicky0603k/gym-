import type { PaymentDetail } from "@/services/payments";
import { receiptNumber } from "@/services/payments";
import { addDaysToDate, formatDisplayDate, formatDisplayDateTime, toKolkataDateString } from "@/utils/dates";
import { formatRupees } from "@/utils/money";
import { formatPhone } from "@/utils/phone";

function Line({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={strong ? "text-right font-bold text-foreground" : "text-right text-sm text-foreground"}>{value}</dd>
    </div>
  );
}

/** A receipt the owner could forward on WhatsApp: gym, member, plan, amount, reference, date, new expiry. Paid payments only. */
export function Receipt({ payment, gymName }: { payment: PaymentDetail; gymName: string }) {
  const paidOn = payment.verifiedAt ?? payment.createdAt;
  return (
    <article className="card p-5 print:border-0 print:bg-white print:text-black" aria-labelledby="receipt-title">
      <header className="flex items-center gap-3 border-b border-border pb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent" aria-hidden>
          <span className="text-xl font-black text-accent-foreground">{gymName.trim()[0]?.toUpperCase()}</span>
        </div>
        <div>
          <p className="font-bold text-foreground">{gymName}</p>
          <h1 id="receipt-title" className="text-sm text-muted">
            Payment receipt · {receiptNumber(payment.id)}
          </h1>
        </div>
      </header>

      <dl className="divide-y divide-border">
        <Line label="Member" value={`${payment.memberName} · ${formatPhone(payment.memberPhone)}`} />
        {payment.purpose === "Renewal" ? (
          <Line label="Plan" value={`${payment.planName} · ${payment.durationDays} days`} />
        ) : (
          <Line label="Item" value={payment.quantity > 1 ? `${payment.planName} × ${payment.quantity}` : payment.planName} />
        )}
        {payment.discount > 0 && <Line label="Plan price" value={formatRupees(payment.baseAmount)} />}
        {payment.discount > 0 && <Line label="Discount" value={`− ${formatRupees(payment.discount)}`} />}
        <Line label="Amount paid" value={formatRupees(payment.amount)} strong />
        <Line label="UPI reference" value={payment.providerRef ?? "—"} />
        <Line label="Paid on" value={formatDisplayDateTime(paidOn)} />
        {payment.newExpiry && <Line label="Membership valid till" value={formatDisplayDate(payment.newExpiry)} strong />}
        {payment.purpose === "AddOn" && payment.addonType !== "Product" && (
          <Line label="Valid till" value={formatDisplayDate(addDaysToDate(toKolkataDateString(paidOn), payment.durationDays))} strong />
        )}
        {payment.addonType === "Product" && <Line label="Collection" value="At the front desk" />}
      </dl>
      <p className="mt-4 text-xs text-muted">
        Confirmed by {gymName} on {formatDisplayDate(toKolkataDateString(paidOn))}. Keep this receipt for your records.
      </p>
    </article>
  );
}
