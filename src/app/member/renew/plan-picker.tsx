"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleCheck } from "lucide-react";
import type { Plan } from "@/services/supabase/database.types";
import { applyDiscount, discountAmount, formatRupees } from "@/utils/money";
import { computeNewExpiry, formatDisplayDate } from "@/utils/dates";
import { FormError } from "@/components/form-field";
import { cn } from "@/utils/cn";
import { startRenewalAction } from "./actions";

/** Plan cards with the final payable amount. Nothing is pre-selected; Pay needs an explicit choice. */
export function PlanPicker({
  plans,
  currentExpiry,
  replacesPending,
}: {
  plans: Plan[];
  currentExpiry: string;
  replacesPending: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const plan = plans.find((p) => p.id === selected);

  async function pay() {
    if (!plan) return;
    setPending(true);
    setMessage(undefined);
    try {
      const result = await startRenewalAction(plan.id);
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      toast.success(`${plan.name} selected — pay ${formatRupees(applyDiscount(plan.price, plan.discount_pct))} to finish`);
      router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setMessage("We couldn't reach the server. Check your internet and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <fieldset>
        <legend className="text-lg font-semibold text-foreground mb-3">Choose a plan</legend>
        <div className="space-y-3">
          {plans.map((p) => {
            const final = applyDiscount(p.price, p.discount_pct);
            const active = p.id === selected;
            return (
              <label
                key={p.id}
                className={cn(
                  "card block cursor-pointer p-4 transition-colors",
                  active ? "border-accent ring-1 ring-accent" : "hover:border-muted"
                )}
              >
                <input type="radio" name="plan" value={p.id} className="sr-only" checked={active} onChange={() => setSelected(p.id)} />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{p.name}</p>
                    <p className="text-sm text-muted">{p.duration_days} days</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-foreground tabular-nums">{formatRupees(final)}</p>
                    {p.discount_pct > 0 && (
                      <p className="text-xs text-muted">
                        <s>{formatRupees(p.price)}</s> · save {formatRupees(discountAmount(p.price, p.discount_pct))}
                      </p>
                    )}
                  </div>
                </div>
                {p.benefits && <p className="mt-2 text-sm text-muted">{p.benefits}</p>}
                {active && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-accent">
                    <CircleCheck className="h-4 w-4" aria-hidden /> New expiry {formatDisplayDate(computeNewExpiry(currentExpiry, p.duration_days))} once the gym confirms payment
                  </p>
                )}
              </label>
            );
          })}
        </div>
      </fieldset>

      {replacesPending && (
        <p className="mt-3 text-sm text-muted">Choosing a different plan replaces your unpaid request above.</p>
      )}
      <div className="mt-4">
        <FormError message={message} />
      </div>
      <button type="button" className="btn-primary mt-2 w-full" disabled={!plan || pending} aria-busy={pending} onClick={pay}>
        {pending ? "Starting…" : plan ? `Pay ${formatRupees(applyDiscount(plan.price, plan.discount_pct))}` : "Choose a plan to pay"}
      </button>
    </div>
  );
}
