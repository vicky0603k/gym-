"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormError, FormField } from "@/components/form-field";
import { updateWeeklyGoalDefaultAction } from "./actions";

export function WeeklyGoalForm({ value }: { value: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ field?: string; message?: string }>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    try {
      const result = await updateWeeklyGoalDefaultAction(new FormData(e.currentTarget));
      if (!result.ok) {
        setError({ field: result.error.fields?.weeklyGoalDefault, message: result.error.fields ? undefined : result.error.message });
        return;
      }
      setError({});
      toast.success(`New members now start with ${result.data.value} visits a week`);
      router.refresh();
    } catch {
      setError({ message: "We couldn't reach the server. Check your internet and try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormField
        label="Default weekly visit target"
        htmlFor="weeklyGoalDefault"
        error={error.field}
        hint="1 to 7 visits a week. Pre-filled when you add a member; existing members keep their own target."
      >
        <input
          id="weeklyGoalDefault"
          name="weeklyGoalDefault"
          type="number"
          inputMode="numeric"
          min={1}
          max={7}
          defaultValue={value}
          className="input max-w-[8rem]"
          aria-invalid={error.field ? true : undefined}
          aria-describedby={error.field ? "weeklyGoalDefault-error" : undefined}
        />
      </FormField>
      <FormError message={error.message} />
      <button type="submit" className="btn-primary" disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
