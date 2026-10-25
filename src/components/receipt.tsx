import type { PaymentDetail } from "@/services/payments";
import { receiptNumber } from "@/services/payments";
import { addDaysToDate, formatDisplayDate, formatDisplayDateTime, toKolkataDateString } from "@/utils/dates";
import { formatRupees, GST_RATE_PCT, gstIncluded } from "@/utils/money";
import { formatPhone } from "@/utils/phone";

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

/**
 * A counter receipt the owner can forward on WhatsApp (UI.md §1): gym on top, dashed rules,
 * the amount large, a tear edge at the bottom. Paid payments only.
 */
export function Receipt({ payment, gymName, gstin }: { payment: PaymentDetail; gymName: string; gstin?: string | null }) {
  const paidOn = payment.verifiedAt ?? payment.createdAt;
  const tax = gstin ? gstIncluded(payment.amount) : null;
  const validTill =
    payment.newExpiry ??
    (payment.purpose === "AddOn" && payment.addonType !== "Product"
      ? addDaysToDate(toKolkataDateString(paidOn), payment.durationDays)
      : null);

  return (
    <article className="receipt-edge border border-border bg-background px-5 pb-8 pt-5 print:border-0" aria-labelledby="receipt-title">
      <header className="border-b border-dashed border-border-strong pb-4 text-center">
        <p className="text-lg font-bold text-foreground">{gymName}</p>
        {gstin && <p className="text-xs text-muted">GSTIN {gstin}</p>}
        <h1 id="receipt-title" className="mt-2 text-sm text-muted">
          {tax ? "Tax invoice" : "Payment receipt"} · <span className="tabular-nums">{receiptNumber(payment.id)}</span>
        </h1>
      </header>

      <dl className="border-b border-dashed border-border-strong py-2">
        <Line label="Member" value={`${payment.memberName} · ${formatPhone(payment.memberPhone)}`} />
        {payment.purpose === "Renewal" ? (
          <Line label="Plan" value={`${payment.planName} · ${payment.durationDays} days`} />
        ) : (
          <Line label="Item" value={payment.quantity > 1 ? `${payment.planName} × ${payment.quantity}` : payment.planName} />
        )}
        {payment.discount > 0 && <Line label="Plan price" value={formatRupees(payment.baseAmount)} />}
        {payment.discount > 0 && <Line label="Discount" value={`− ${formatRupees(payment.discount)}`} />}
        {tax && <Line label="Taxable value" value={formatRupees(tax.taxable)} />}
        {tax && <Line label={`GST @ ${GST_RATE_PCT}% (included)`} value={formatRupees(tax.gst)} />}
        <Line label="Paid by" value={payment.method === "Cash" ? "Cash at the desk" : "UPI"} />
        <Line label={payment.method === "Cash" ? "Cash receipt no." : "UPI reference"} value={<span className="tabular-nums">{payment.providerRef ?? "—"}</span>} />
        <Line label="Paid on" value={formatDisplayDateTime(paidOn)} />
        {payment.addonType === "Product" && <Line label="Collection" value="At the front desk" />}
      </dl>

      <div className="flex items-end justify-between gap-4 pt-4">
        <div>
          <p className="text-sm text-muted">Amount paid</p>
          <p className="num-display text-5xl text-foreground">{formatRupees(payment.amount)}</p>
        </div>
        {validTill && (
          <div className="text-right">
            <p className="text-sm text-muted">{payment.purpose === "Renewal" ? "Membership valid till" : "Valid till"}</p>
            <p className="num-display text-2xl text-foreground">{formatDisplayDate(validTill)}</p>
          </div>
        )}
      </div>

      <p className="mt-5 text-xs text-muted">
        Confirmed by {gymName} on {formatDisplayDate(toKolkataDateString(paidOn))}. Keep this receipt for your records.
      </p>
    </article>
  );
}
