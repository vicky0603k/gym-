"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Hourglass, Smartphone } from "lucide-react";
import { formatRupees } from "@/utils/money";
import { FormError, FormField } from "@/components/form-field";
import { claimPaymentAction } from "./actions";

/** Unpaid / awaiting-verification renewal: how to pay, then send the UPI reference. */
export function PendingPayment({
  paymentId,
  planName,
  amount,
  receiptNo,
  upiId,
  upiLink,
  claimedRef,
}: {
  paymentId: string;
  planName: string;
  amount: number;
  receiptNo: string;
  upiId: string | null;
  upiLink: string | null;
  claimedRef: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ field?: string; message?: string }>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    try {
      const result = await claimPaymentAction(new FormData(e.currentTarget));
      if (!result.ok) {
        setError({ field: result.error.fields?.reference, message: result.error.fields ? undefined : result.error.message });
        return;
      }
      setError({});
      toast.success("Reference sent. The gym will confirm your payment.");
      router.refresh();
    } catch {
      setError({ message: "We couldn't reach the server. Check your internet and try again." });
    } finally {
      setPending(false);
    }
  }

  if (claimedRef) {
    return (
      <section className="card p-5 text-center" role="status">
        <Hourglass className="mx-auto mb-3 h-10 w-10 text-warning" aria-hidden />
        <h2 className="text-lg font-semibold text-foreground">Waiting for the gym to confirm</h2>
        <p className="mt-1 text-sm text-muted">
          {planName} · {formatRupees(amount)} · reference {claimedRef}
        </p>
        <p className="mt-3 text-sm text-muted">
          The gym checks the payment in their bank app and confirms it. Your new expiry date appears here and on your receipt as soon as it
          is confirmed. If money left your account, it is safe — there is nothing more to do.
        </p>
      </section>
    );
  }

  return (
    <section className="card p-5">
      <p className="text-sm text-muted">Renewal started · {receiptNo}</p>
      <h2 className="text-lg font-semibold text-foreground">
        Pay {formatRupees(amount)} for {planName}
      </h2>

      {upiId && upiLink ? (
        <div className="mt-4 space-y-3">
          <a href={upiLink} className="btn-primary flex w-full items-center justify-center gap-2">
            <Smartphone className="h-5 w-5" aria-hidden /> Pay with a UPI app
          </a>
          <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs text-muted">Or pay to UPI ID</p>
              <p className="truncate font-medium text-foreground">{upiId}</p>
            </div>
            <button
              type="button"
              className="btn-ghost shrink-0 px-3"
              aria-label="Copy UPI ID"
              onClick={() => navigator.clipboard?.writeText(upiId).then(() => toast.success("UPI ID copied"), () => undefined)}
            >
              <Copy className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">Pay {formatRupees(amount)} at the front desk by UPI, then enter the reference below.</p>
      )}

      <form onSubmit={onSubmit} className="mt-5 space-y-3 border-t border-border pt-4" noValidate>
        <input type="hidden" name="paymentId" value={paymentId} />
        <FormField
          label="After paying, enter the UPI reference (UTR)"
          htmlFor="reference"
          error={error.field}
          hint="12-digit number shown in your UPI app's payment details"
        >
          <input
            id="reference"
            name="reference"
            inputMode="text"
            autoComplete="off"
            maxLength={30}
            className="input uppercase"
            aria-invalid={error.field ? true : undefined}
            aria-describedby={error.field ? "reference-error" : undefined}
          />
        </FormField>
        <FormError message={error.message} />
        <button type="submit" className="btn-secondary w-full" disabled={pending} aria-busy={pending}>
          {pending ? "Sending…" : "I've paid — send reference"}
        </button>
        <p className="text-xs text-muted">Your membership is extended only after the gym confirms this payment.</p>
      </form>
    </section>
  );
}
