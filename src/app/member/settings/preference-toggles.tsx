"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { MemberPreferences } from "@/services/members";
import { cn } from "@/utils/cn";
import { updatePreferenceAction } from "./actions";

const ITEMS: { key: keyof MemberPreferences; title: string; hint: string }[] = [
  { key: "notifyRenewal", title: "Renewal reminders", hint: "A WhatsApp message from the gym before your membership expires." },
  { key: "notifyCare", title: "Missed-visit messages", hint: "A WhatsApp message if you haven't visited for a while." },
  { key: "marketingConsent", title: "Offers and promotions", hint: "Occasional offers from the gym. Off unless you turn it on." },
];

/** Each switch saves on its own, effective immediately; it flips back if saving fails. */
export function PreferenceToggles({ initial }: { initial: MemberPreferences }) {
  const [prefs, setPrefs] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function toggle(key: keyof MemberPreferences) {
    const value = !prefs[key];
    setSaving(true);
    setPrefs((p) => ({ ...p, [key]: value }));
    try {
      const result = await updatePreferenceAction(key, value);
      if (!result.ok) throw new Error(result.error.message);
      toast.success("Saved");
    } catch (e) {
      setPrefs((p) => ({ ...p, [key]: !value }));
      toast.error(e instanceof Error && e.message ? e.message : "We couldn't save that. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ul className="card divide-y divide-border">
      {ITEMS.map((item) => (
        <li key={item.key} className="flex items-center gap-4 px-4 py-4">
          <span className="flex-1">
            <span id={`${item.key}-label`} className="block font-medium text-foreground">
              {item.title}
            </span>
            <span className="block text-sm text-muted">{item.hint}</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={prefs[item.key]}
            aria-labelledby={`${item.key}-label`}
            disabled={saving}
            onClick={() => toggle(item.key)}
            className={cn(
              "relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-60",
              prefs[item.key] ? "bg-accent" : "border border-border bg-surface-2"
            )}
          >
            <span
              className={cn(
                "absolute top-1 h-6 w-6 rounded-full transition-transform",
                prefs[item.key] ? "translate-x-7 bg-accent-foreground" : "translate-x-1 bg-foreground"
              )}
            />
          </button>
        </li>
      ))}
    </ul>
  );
}
