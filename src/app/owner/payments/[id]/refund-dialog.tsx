"use client";

import { Undo2 } from "lucide-react";
import { FormField } from "@/components/form-field";
import { FormDialog, fieldProps } from "@/components/form-dialog";
import { formatDisplayDate } from "@/utils/dates";
import { formatRupees } from "@/utils/money";
import { refundPaymentAction } from "./actions";

/** Owner: refund a Paid payment, choosing whether the membership days it bought are taken back. */
export function RefundDialog({ paymentId, memberName, amount, purpose }: { paymentId: string; memberName: string; amount: number; purpose: "Renewal" | "AddOn" }) {
  return (
    <FormDialog<{ newExpiry: string | null }>
      trigger={
        <>
          <Undo2 className="h-4 w-4" aria-hidden /> Refund
        </>
      }
      triggerClassName="btn-danger inline-flex w-full items-center justify-center gap-2"
      title={`Refund ${formatRupees(amount)} to ${memberName}?`}
      description="Give the money back first (cash or UPI), then record it here. The payment is kept and marked Refunded; this can't be undone."
      submitLabel="Record refund"
      submitClassName="btn-danger"
      success={(d) => (d.newExpiry ? `Refund recorded — membership now valid till ${formatDisplayDate(d.newExpiry)}` : "Refund recorded")}
      action={refundPaymentAction}
    >
      {(errors) => (
        <>
          <input type="hidden" name="paymentId" value={paymentId} />
          <FormField label="Reason" htmlFor="reason" error={errors.fields?.reason}>
            <textarea {...fieldProps("reason", errors.fields?.reason)} rows={2} maxLength={200} placeholder="e.g. Paid twice by mistake" required />
          </FormField>
          {purpose === "Renewal" ? (
            <label className="flex items-start gap-3 text-sm text-foreground">
              <input type="checkbox" name="reverse" className="mt-1 h-5 w-5 accent-foreground" defaultChecked />
              <span>
                Take back the membership days this payment added
                <span className="block text-muted">Untick to refund the money but keep the membership as it is (goodwill).</span>
              </span>
            </label>
          ) : (
            <p className="text-sm text-muted">The add-on order is marked refunded and any remaining PT sessions stop.</p>
          )}
        </>
      )}
    </FormDialog>
  );
}
