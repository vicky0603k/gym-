"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormError, FormField } from "@/components/form-field";
import type { GymSettings } from "@/services/settings";
import type { ActionResult } from "@/services/payments";
import { updateGymProfileAction, updateRulesAction } from "./actions";

function useSave(action: (fd: FormData) => Promise<ActionResult<void>>, success: string) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setMessage(undefined);
    try {
      const result = await action(new FormData(e.currentTarget));
      if (!result.ok) {
        setErrors(result.error.fields ?? {});
        setMessage(result.error.fields ? undefined : result.error.message);
        return;
      }
      setErrors({});
      toast.success(success);
      router.refresh();
    } catch {
      setMessage("We couldn't reach the server. Check your internet and try again.");
    } finally {
      setPending(false);
    }
  }
  return { pending, errors, message, onSubmit };
}

function Submit({ pending }: { pending: boolean }) {
  return (
    <button type="submit" className="btn-primary" disabled={pending} aria-busy={pending}>
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

/** Gym profile: shown on the public website, receipts and the UPI payment screen. */
export function GymProfileForm({ s }: { s: GymSettings }) {
  const { pending, errors, message, onSubmit } = useSave(updateGymProfileAction, "Gym profile saved — the website shows it now");
  const text = (name: string, label: string, value: string | null, props: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
    <FormField label={label} htmlFor={name} error={errors[name]} hint={hint}>
      <input id={name} name={name} defaultValue={value ?? ""} className="input" {...props} />
    </FormField>
  );
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {text("gymName", "Gym name", s.gym_name, { maxLength: 60 })}
      {text("tagline", "Tagline (optional)", s.tagline, { maxLength: 120, placeholder: "e.g. Strength, cardio and coaching in Indiranagar" })}
      {text("address", "Address", s.address, { maxLength: 200 })}
      {text("mapsUrl", "Google Maps link", s.maps_url, { inputMode: "url", placeholder: "https://maps.app.goo.gl/…" }, "In Google Maps: Share → Copy link")}
      {text("phone", "Phone / WhatsApp", s.phone, { inputMode: "numeric", maxLength: 14 }, "Members call or message this number")}
      <FormField label="Opening hours" htmlFor="openingHours" error={errors.openingHours} hint="One line per row, e.g. Mon–Sat: 5:30 AM – 10:30 PM">
        <textarea id="openingHours" name="openingHours" rows={3} maxLength={400} defaultValue={s.opening_hours ?? ""} className="input" />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        {text("upiId", "UPI ID for payments", s.upi_id, { autoComplete: "off", placeholder: "gymname@okicici" })}
        {text("upiName", "UPI payee name (optional)", s.upi_name, { maxLength: 60 })}
      </div>
      {text("gstin", "GSTIN (only if GST-registered)", s.gstin, { autoComplete: "off", maxLength: 15, placeholder: "29ABCDE1234F1Z5" }, "When filled, receipts show the GSTIN and the 18% GST included in the price")}
      <FormError message={message} />
      <Submit pending={pending} />
    </form>
  );
}

/** Red List threshold and renewal reminder days. */
export function RulesForm({ s }: { s: GymSettings }) {
  const { pending, errors, message, onSubmit } = useSave(updateRulesAction, "Rules saved — they apply from the next scan");
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormField label="Red List after (days without a visit)" htmlFor="noShowThresholdDays" error={errors.noShowThresholdDays} hint="3 to 60 days. Paused and expired members are never listed.">
        <input id="noShowThresholdDays" name="noShowThresholdDays" type="number" inputMode="numeric" min={3} max={60} defaultValue={s.no_show_threshold_days} className="input max-w-[8rem]" />
      </FormField>
      <FormField
        label="Renewal stages (days before expiry)"
        htmlFor="renewalWindows"
        error={errors.renewalWindows}
        hint="Comma separated, e.g. 14, 7, 3, 0, -3. Include 0 (expiry day). Stages over 7 days are a heads-up for you only — members are never messaged that early."
      >
        <input id="renewalWindows" name="renewalWindows" defaultValue={s.renewal_windows.join(", ")} className="input" />
      </FormField>
      <FormField
        label="Paused days added back per year"
        htmlFor="freezeMaxDaysPerYear"
        error={errors.freezeMaxDaysPerYear}
        hint="When a paused membership is resumed, the days it was paused are added to the expiry — up to this many days in any 12 months. 0 = never add days."
      >
        <input id="freezeMaxDaysPerYear" name="freezeMaxDaysPerYear" type="number" inputMode="numeric" min={0} max={365} defaultValue={s.freeze_max_days_per_year} className="input max-w-[8rem]" />
      </FormField>
      <FormError message={message} />
      <Submit pending={pending} />
    </form>
  );
}
