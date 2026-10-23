"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { BadgeCheck, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { FormError, FormField } from "@/components/form-field";
import { formatDisplayDate } from "@/utils/dates";
import { formatRupees } from "@/utils/money";
import { rejectPaymentAction, verifyPaymentAction } from "./actions";

type Mode = "verify" | "reject";

/**
 * Verify (needs the UPI reference seen in the bank app) or Reject (needs a reason).
 * The server is the only place a payment becomes Paid; this only asks.
 */
export function ReviewDialog({
  mode,
  paymentId,
  memberName,
  planName,
  amount,
  claimedRef,
}: {
  mode: Mode;
  paymentId: string;
  memberName: string;
  planName: string;
  amount: number;
  claimedRef: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  const verify = mode === "verify";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setMessage(undefined);
    try {
      const formData = new FormData(e.currentTarget);
      const result = verify ? await verifyPaymentAction(formData) : await rejectPaymentAction(formData);
      if (!result.ok) {
        setErrors(result.error.fields ?? {});
        // ALREADY_VERIFIED etc.: say it plainly and refresh so the queue matches the database.
        setMessage(result.error.fields ? undefined : result.error.message);
        if (result.error.code === "ALREADY_VERIFIED") router.refresh();
        return;
      }
      if (result.data && "newExpiry" in result.data) {
        toast.success(`Payment verified — ${memberName}'s membership extended till ${formatDisplayDate(result.data.newExpiry)}`, {
          action: { label: "Receipt", onClick: () => router.push(`/owner/payments/${paymentId}`) },
        });
      } else {
        toast.success(`Payment rejected. ${memberName}'s membership was not changed.`);
      }
      setOpen(false);
      router.refresh();
    } catch {
      setMessage("We couldn't reach the server. Check your internet and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        setErrors({});
        setMessage(undefined);
      }}
    >
      <Dialog.Trigger className={verify ? "btn-primary inline-flex items-center justify-center gap-2 px-4 text-sm" : "btn-danger inline-flex items-center justify-center gap-2 px-4 text-sm"}>
        {verify ? <BadgeCheck className="h-4 w-4" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />}
        {verify ? "Verify" : "Reject"}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 animate-fade-in" />
        <Dialog.Content className="fixed z-50 inset-x-4 bottom-4 sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md card p-5 animate-slide-up">
          <div className="flex items-start justify-between gap-3 mb-2">
            <Dialog.Title className="text-lg font-semibold text-foreground">
              {verify ? `Verify ${formatRupees(amount)} from ${memberName}?` : `Reject ${memberName}'s payment?`}
            </Dialog.Title>
            <Dialog.Close className="btn-ghost -mt-2 -mr-2 px-3" aria-label="Close">
              <X className="h-5 w-5" aria-hidden />
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-sm text-muted mb-4">
            {verify
              ? `Only verify after you see ${formatRupees(amount)} in your bank or UPI app. ${planName} will be added to their membership straight away.`
              : "Their membership will not change. They will see that the payment couldn't be confirmed."}
          </Dialog.Description>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <input type="hidden" name="paymentId" value={paymentId} />
            {verify ? (
              <FormField
                label="UPI reference in your bank app"
                htmlFor="providerRef"
                error={errors.providerRef}
                hint={claimedRef ? `The member entered ${claimedRef}. Check it matches.` : "The member hasn't sent a reference."}
              >
                <input id="providerRef" name="providerRef" defaultValue={claimedRef ?? ""} maxLength={40} autoComplete="off" className="input uppercase" />
              </FormField>
            ) : (
              <FormField label="Reason" htmlFor="reason" error={errors.reason}>
                <textarea id="reason" name="reason" rows={2} maxLength={200} className="input" placeholder="e.g. No matching payment in the bank statement" />
              </FormField>
            )}
            <FormError message={message} />
            <div className="grid grid-cols-2 gap-3">
              <Dialog.Close type="button" className="btn-secondary">
                Cancel
              </Dialog.Close>
              <button type="submit" className={verify ? "btn-primary" : "btn-danger"} disabled={pending} aria-busy={pending}>
                {pending ? "Saving…" : verify ? "Verify payment" : "Reject"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
