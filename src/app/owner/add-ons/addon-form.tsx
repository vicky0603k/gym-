"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormError, FormField } from "@/components/form-field";
import type { Addon } from "@/services/supabase/database.types";
import { createAddonAction, updateAddonAction } from "./actions";

type Trainer = { id: string; name: string; specialisation: string | null };

/** Create or edit an add-on. Stock is set once here; later changes go through the audited Stock dialog. */
export function AddonForm({ addon, trainers }: { addon?: Addon; trainers: Trainer[] }) {
  const router = useRouter();
  const [type, setType] = useState<Addon["type"] | "">(addon?.type ?? "");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setMessage(undefined);
    const formData = new FormData(e.currentTarget);
    try {
      const result = addon ? await updateAddonAction(addon.id, formData) : await createAddonAction(formData);
      if (!result.ok) {
        setErrors(result.error.fields ?? {});
        setMessage(result.error.fields ? undefined : result.error.message);
        setPending(false);
        return;
      }
      toast.success(addon ? "Add-on saved" : "Add-on created");
      router.push("/owner/add-ons");
    } catch {
      setMessage("We couldn't reach the server. Check your internet and try again.");
      setPending(false);
    }
  }

  const num = (name: string, label: string, def?: number | null, hint?: string) => (
    <FormField label={label} htmlFor={name} error={errors[name]} hint={hint}>
      <input id={name} name={name} type="number" inputMode="numeric" min={0} className="input" defaultValue={def ?? undefined} />
    </FormField>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormField label="Type" htmlFor="type" error={errors.type} hint={addon ? "The type can't change after creation." : undefined}>
        <select id="type" name="type" className="input" value={type} disabled={Boolean(addon)} onChange={(e) => setType(e.target.value as Addon["type"])}>
          <option value="" disabled>
            Choose a type
          </option>
          <option value="PT">Personal training package</option>
          <option value="Diet">Diet plan</option>
          <option value="Product">Product (supplement, gear)</option>
        </select>
        {addon && <input type="hidden" name="type" value={addon.type} />}
      </FormField>

      <FormField label="Name" htmlFor="title" error={errors.title}>
        <input id="title" name="title" className="input" defaultValue={addon?.title} placeholder="e.g. Personal Training 12 Sessions" />
      </FormField>

      <FormField label="What's included and terms" htmlFor="description" error={errors.description} hint="Members see this before buying. No medical or transformation claims.">
        <textarea id="description" name="description" rows={3} maxLength={600} className="input" defaultValue={addon?.description ?? ""} />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        {num("price", "Price (₹)", addon?.price)}
        {num("validityDays", type === "Product" ? "Valid for (days)" : "Validity (days)", addon?.validity_days ?? (type === "Product" ? 365 : undefined))}
      </div>

      {type === "PT" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {num("sessions", "Sessions", addon?.sessions)}
          <FormField label="Trainer (optional)" htmlFor="trainerId" error={errors.trainerId}>
            <select id="trainerId" name="trainerId" className="input" defaultValue={addon?.trainer_id ?? ""}>
              <option value="">Any trainer</option>
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.specialisation ? ` · ${t.specialisation}` : ""}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      )}
      {type === "Product" &&
        (addon ? (
          <>
            {/* Satisfies validation only; updateAddon never writes stock. */}
            <input type="hidden" name="stock" value={addon.stock ?? 0} />
            <p className="text-sm text-muted">Stock: {addon.stock ?? 0}. Change it with the Stock button on the add-ons list.</p>
          </>
        ) : (
          num("stock", "Opening stock", 0)
        ))}

      <label className="flex items-center gap-3 min-h-[48px] cursor-pointer">
        <input type="checkbox" name="isActive" defaultChecked={addon?.is_active ?? true} className="h-5 w-5 accent-[#B5FF47]" />
        <span>
          <span className="block text-foreground">Offered to members</span>
          <span className="block text-xs text-muted">Switch off to hide it. Existing orders are not changed.</span>
        </span>
      </label>

      <FormError message={message} />
      <button type="submit" className="btn-primary w-full" disabled={pending || !type} aria-busy={pending}>
        {pending ? "Saving…" : addon ? "Save add-on" : "Create add-on"}
      </button>
    </form>
  );
}
