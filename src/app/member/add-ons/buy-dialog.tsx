"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Minus, Plus, X } from "lucide-react";
import type { CatalogueItem } from "@/services/addons";
import { formatRupees } from "@/utils/money";
import { FormError } from "@/components/form-field";
import { buyAddonAction } from "./actions";

/** Explicit purchase sheet. Quantity starts at 1 and only products can change it; nothing is pre-selected elsewhere. */
export function BuyDialog({ item }: { item: CatalogueItem }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const max = item.type === "Product" ? Math.min(item.stock ?? 0, 10) : 1;
  const total = item.price * quantity;

  async function buy() {
    setPending(true);
    setMessage(undefined);
    try {
      const result = await buyAddonAction(item.id, quantity);
      if (!result.ok) {
        setMessage(result.error.message);
        router.refresh(); // stock may have changed
        return;
      }
      router.push(`/member/add-ons/pay/${result.data.paymentId}`);
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
        setQuantity(1);
        setMessage(undefined);
      }}
    >
      <Dialog.Trigger className="btn-dark w-full" disabled={!item.available}>
        {item.available ? `Buy · ${formatRupees(item.price)}` : item.unavailableReason}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/50 animate-fade-in" />
        <Dialog.Content className="fixed z-50 inset-x-4 bottom-4 max-h-[90vh] overflow-y-auto sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md rounded-lg border border-border bg-background p-5 shadow-xl animate-slide-up">
          <div className="flex items-start justify-between gap-3 mb-2">
            <Dialog.Title className="text-lg font-semibold text-foreground">{item.title}</Dialog.Title>
            <Dialog.Close className="btn-ghost -mt-2 -mr-2 px-3" aria-label="Close">
              <X className="h-5 w-5" aria-hidden />
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-sm text-muted">
            {item.description ?? "Ask the front desk if you have any questions before buying."}
          </Dialog.Description>

          {item.type === "Product" && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-muted">Quantity</span>
              <div className="flex items-center gap-2">
                <button type="button" className="btn-secondary px-3" aria-label="One less" disabled={quantity <= 1} onClick={() => setQuantity((q) => q - 1)}>
                  <Minus className="h-4 w-4" aria-hidden />
                </button>
                <span className="w-8 text-center text-lg font-semibold tabular-nums text-foreground" aria-live="polite">
                  {quantity}
                </span>
                <button type="button" className="btn-secondary px-3" aria-label="One more" disabled={quantity >= max} onClick={() => setQuantity((q) => q + 1)}>
                  <Plus className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          )}

          <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-muted">
            <li>You pay by UPI on the next screen. Nothing starts until the gym confirms your payment.</li>
            {item.type === "PT" && <li>{item.sessions} sessions, to be used within {item.validity_days} days of confirmation.</li>}
            {item.type === "Diet" && <li>Plan runs for {item.validity_days} days from confirmation.</li>}
            {item.type === "Product" && <li>Collect it from the front desk after the gym confirms payment.</li>}
            <li>Results depend on your training, diet and health; no specific outcome is promised.</li>
          </ul>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <span className="text-muted">Total to pay</span>
            <span className="text-2xl font-bold tabular-nums text-foreground">{formatRupees(total)}</span>
          </div>
          <div className="mt-3">
            <FormError message={message} />
          </div>
          <button type="button" className="btn-primary mt-2 w-full" disabled={pending} aria-busy={pending} onClick={buy}>
            {pending ? "Placing order…" : `Buy for ${formatRupees(total)}`}
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
