"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormError, FormField } from "@/components/form-field";
import type { Plan } from "@/services/supabase/database.types";
import { createPlanAction, updatePlanAction } from "./actions";

/** Create or edit a plan. Server re-validates everything with Zod. */
export function PlanForm({ plan }: { plan?: Plan }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setMessage(undefined);
    const formData = new FormData(e.currentTarget);
    try {
      const result = plan ? await updatePlanAction(plan.id, formData) : await createPlanAction(formData);
      if (!result.ok) {
        setErrors(result.error.fields ?? {});
        setMessage(result.error.fields ? undefined : result.error.message);
        setPending(false);
        return;
      }
      toast.success(plan ? "Plan saved" : "Plan created");
      router.push("/owner/plans");
    } catch {
      setMessage("We couldn't reach the server. Check your internet and try again.");
      setPending(false);
    }
  }

  const invalid = (name: string) => (errors[name] ? { "aria-invalid": true, "aria-describedby": `${name}-error` } : {});

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormField label="Plan name" htmlFor="name" error={errors.name}>
        <input id="name" name="name" className="input" placeholder="e.g. Quarterly" defaultValue={plan?.name} {...invalid("name")} />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Duration (days)" htmlFor="durationDays" error={errors.durationDays}>
          <input
            id="durationDays"
            name="durationDays"
            type="number"
            inputMode="numeric"
            min={1}
            className="input"
            defaultValue={plan?.duration_days}
            {...invalid("durationDays")}
          />
        </FormField>
        <FormField label="Price (₹)" htmlFor="price" error={errors.price}>
          <input
            id="price"
            name="price"
            type="number"
            inputMode="numeric"
            min={0}
            className="input"
            defaultValue={plan?.price}
            {...invalid("price")}
          />
        </FormField>
      </div>

      <FormField label="Discount (%)" htmlFor="discountPct" error={errors.discountPct} hint="0 for no discount">
        <input
          id="discountPct"
          name="discountPct"
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          className="input"
          defaultValue={plan?.discount_pct ?? 0}
          {...invalid("discountPct")}
        />
      </FormField>

      <FormField label="Benefits (optional)" htmlFor="benefits" error={errors.benefits}>
        <textarea
          id="benefits"
          name="benefits"
          rows={3}
          maxLength={300}
          className="input"
          placeholder="e.g. Full gym access, group classes"
          defaultValue={plan?.benefits ?? ""}
          {...invalid("benefits")}
        />
      </FormField>

      <label className="flex items-center gap-3 min-h-[48px] cursor-pointer">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={plan?.is_active ?? true}
          className="h-5 w-5 accent-[#B5FF47]"
        />
        <span>
          <span className="block text-foreground">Offered to new members</span>
          <span className="block text-xs text-muted">Switch off to stop offering it. Existing memberships are not changed.</span>
        </span>
      </label>

      <FormError message={message} />
      <button type="submit" className="btn-primary w-full" disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : plan ? "Save plan" : "Create plan"}
      </button>
    </form>
  );
}
