"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { PackagePlus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { FormError, FormField } from "@/components/form-field";
import { adjustStockAction, recordSessionAction } from "./actions";

/** +1 PT session. The database caps it at the purchased total. */
export function SessionButton({ orderId, memberName, disabled }: { orderId: string; memberName: string; disabled: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function record() {
    setPending(true);
    try {
      const result = await recordSessionAction(orderId);
      if (!result.ok) toast.error(result.error.message);
      else {
        const { sessionsUsed, sessionsTotal } = result.data;
        toast.success(
          sessionsUsed >= sessionsTotal
            ? `${memberName}: all ${sessionsTotal} sessions used — package complete`
            : `${memberName}: session ${sessionsUsed} of ${sessionsTotal} recorded`
        );
      }
      router.refresh();
    } catch {
      toast.error("We couldn't reach the server. Check your internet and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <button type="button" className="btn-primary inline-flex items-center gap-1 px-3 text-sm" disabled={disabled || pending} aria-busy={pending} onClick={record}>
      <Plus className="h-4 w-4" aria-hidden /> {pending ? "Saving…" : "Session"}
    </button>
  );
}

/** Stock in / out with a reason. */
export function StockDialog({ addonId, title, stock }: { addonId: string; title: string; stock: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    try {
      const result = await adjustStockAction(new FormData(e.currentTarget));
      if (!result.ok) {
        setErrors(result.error.fields ?? {});
        setMessage(result.error.fields ? undefined : result.error.message);
        return;
      }
      toast.success(`${title}: ${result.data.newStock} in stock`);
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
      <Dialog.Trigger className="btn-secondary inline-flex items-center gap-1 px-3 text-sm">
        <PackagePlus className="h-4 w-4" aria-hidden /> Stock
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 animate-fade-in" />
        <Dialog.Content className="fixed z-50 inset-x-4 bottom-4 sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md card p-5 animate-slide-up">
          <div className="flex items-start justify-between gap-3 mb-2">
            <Dialog.Title className="text-lg font-semibold text-foreground">Change stock: {title}</Dialog.Title>
            <Dialog.Close className="btn-ghost -mt-2 -mr-2 px-3" aria-label="Close">
              <X className="h-5 w-5" aria-hidden />
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-sm text-muted mb-4">
            {stock} in stock now. Use a minus number to remove (e.g. −2 for damaged items).
          </Dialog.Description>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <input type="hidden" name="addonId" value={addonId} />
            <FormField label="Add or remove" htmlFor="delta" error={errors.delta}>
              <input id="delta" name="delta" type="number" inputMode="numeric" step={1} placeholder="e.g. 12 or -2" className="input" />
            </FormField>
            <FormField label="Reason" htmlFor="stock-reason" error={errors.reason}>
              <input id="stock-reason" name="reason" maxLength={120} placeholder="e.g. New delivery, damaged, stock count" className="input" />
            </FormField>
            <FormError message={message} />
            <div className="grid grid-cols-2 gap-3">
              <Dialog.Close type="button" className="btn-secondary">
                Cancel
              </Dialog.Close>
              <button type="submit" className="btn-primary" disabled={pending} aria-busy={pending}>
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
