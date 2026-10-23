"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormError, FormField } from "@/components/form-field";
import { applyDiscount, formatRupees } from "@/utils/money";
import { formatDisplayDate } from "@/utils/dates";
import { DEFAULT_WEEKLY_TARGET } from "@/utils/constants";
import type { Plan } from "@/services/supabase/database.types";
import { createMemberAction, updateMemberAction } from "./actions";

type Trainer = { id: string; name: string; specialisation: string | null };
type Defaults = { name: string; phone: string; weeklyTarget: number; trainerId: string | null };

const NETWORK_ERROR = "We couldn't reach the server. Check your internet and try again.";
const digitsOnly = (e: FormEvent<HTMLInputElement>) => {
  e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "");
};

/** Add member (with PIN + first plan) or edit member. Server re-validates everything with Zod. */
export function MemberForm(
  props:
    | { mode: "create"; plans: Plan[]; trainers: Trainer[] }
    | { mode: "edit"; memberId: string; defaults: Defaults; trainers: Trainer[] }
) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  const d = props.mode === "edit" ? props.defaults : undefined;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setMessage(undefined);
    const formData = new FormData(e.currentTarget);
    try {
      const result =
        props.mode === "create"
          ? await createMemberAction(formData)
          : await updateMemberAction(props.memberId, formData);
      if (!result.ok) {
        setErrors(result.error.fields ?? {});
        setMessage(result.error.fields ? undefined : result.error.message);
        setPending(false);
        return;
      }
      if (result.data) {
        toast.success(`Member added — ${result.data.planName} till ${formatDisplayDate(result.data.expiryDate)}`);
        router.push(`/owner/members/${result.data.memberId}`);
      } else {
        toast.success("Member details saved");
        router.push(props.mode === "edit" ? `/owner/members/${props.memberId}` : "/owner/members");
      }
    } catch {
      setMessage(NETWORK_ERROR);
      setPending(false);
    }
  }

  const invalid = (name: string) => (errors[name] ? { "aria-invalid": true, "aria-describedby": `${name}-error` } : {});

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormField label="Full name" htmlFor="name" error={errors.name}>
        <input id="name" name="name" className="input" autoComplete="off" defaultValue={d?.name} required {...invalid("name")} />
      </FormField>

      <FormField label="Mobile number" htmlFor="phone" error={errors.phone} hint="10 digits, without +91">
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          maxLength={10}
          className="input"
          defaultValue={d?.phone}
          onInput={digitsOnly}
          required
          {...invalid("phone")}
        />
      </FormField>

      {props.mode === "create" && (
        <>
          <FormField
            label="4-digit login PIN"
            htmlFor="pin"
            error={errors.pin}
            hint="Share it with the member privately. They log in with their mobile number and this PIN."
          >
            <input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={4}
              className="input"
              onInput={digitsOnly}
              required
              {...invalid("pin")}
            />
          </FormField>

          <FormField label="First plan" htmlFor="planId" error={errors.planId} hint="Starts today. Expiry is set from the plan's duration.">
            <select id="planId" name="planId" className="input" defaultValue="" required {...invalid("planId")}>
              <option value="" disabled>
                Choose a plan
              </option>
              {props.plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.duration_days} days · {formatRupees(applyDiscount(p.price, p.discount_pct))}
                </option>
              ))}
            </select>
          </FormField>
        </>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <FormField label="Weekly visit target" htmlFor="weeklyTarget" error={errors.weeklyTarget} hint="1 to 7 visits a week">
          <input
            id="weeklyTarget"
            name="weeklyTarget"
            type="number"
            inputMode="numeric"
            min={1}
            max={7}
            className="input"
            defaultValue={d?.weeklyTarget ?? DEFAULT_WEEKLY_TARGET}
            required
            {...invalid("weeklyTarget")}
          />
        </FormField>

        <FormField label="Trainer (optional)" htmlFor="trainerId" error={errors.trainerId}>
          <select id="trainerId" name="trainerId" className="input" defaultValue={d?.trainerId ?? ""} {...invalid("trainerId")}>
            <option value="">No trainer</option>
            {props.trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.specialisation ? ` · ${t.specialisation}` : ""}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <FormError message={message} />
      <button type="submit" className="btn-primary w-full" disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : props.mode === "create" ? "Add member" : "Save changes"}
      </button>
    </form>
  );
}
