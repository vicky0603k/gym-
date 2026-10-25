/**
 * Settings service — the single-row gym settings table: gym profile (also
 * shown on the public landing page), Red List / renewal rules and the default
 * weekly target. Owner only; every change is audited (SECURITY.md).
 */
import { z } from "zod";
import { createServiceClient } from "./supabase/server";
import { validationError } from "./memberships";
import { DEFAULT_NO_SHOW_THRESHOLD_DAYS, DEFAULT_WEEKLY_TARGET, RENEWAL_WINDOWS } from "@/utils/constants";
import type { ActionResult } from "./payments";
import type { Settings } from "./supabase/database.types";

const SAVE_FAILED = {
  ok: false as const,
  error: { code: "INVALID_STATE", message: "We couldn't save this setting. Please try again." },
};

export const weeklyGoalDefaultSchema = z.object({
  weeklyGoalDefault: z.coerce
    .number({ invalid_type_error: "Enter a target between 1 and 7 visits" })
    .int("Enter a target between 1 and 7 visits")
    .min(1, "Enter a target between 1 and 7 visits")
    .max(7, "Enter a target between 1 and 7 visits"),
});

/** Default weekly target for new members. Throws on a database error. */
export async function getWeeklyGoalDefault(): Promise<number> {
  const { data, error } = await createServiceClient()
    .from("settings")
    .select("weekly_goal_default")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("SETTINGS_LOAD_FAILED");
  return data?.weekly_goal_default ?? DEFAULT_WEEKLY_TARGET;
}

/** Owner changes the default. Existing members keep their own target. Audited (SECURITY.md). */
export async function updateWeeklyGoalDefault(input: unknown, staffId: string): Promise<ActionResult<{ value: number }>> {
  const parsed = weeklyGoalDefaultSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const value = parsed.data.weeklyGoalDefault;

  const supabase = createServiceClient();
  const { data: row, error: readError } = await supabase.from("settings").select("id, weekly_goal_default").limit(1).maybeSingle();
  if (readError) return SAVE_FAILED;

  // The table allows exactly one row (001 trigger); create it on first save.
  const { data: saved, error } = row
    ? await supabase.from("settings").update({ weekly_goal_default: value }).eq("id", row.id).select("id").single()
    : await supabase.from("settings").insert({ weekly_goal_default: value }).select("id").single();
  if (error || !saved) return SAVE_FAILED;

  await supabase.from("audit_logs").insert({
    actor_type: "Staff",
    actor_id: staffId,
    action: "settings.updated",
    record_type: "settings",
    record_id: saved.id,
    summary: `Default weekly target changed from ${row?.weekly_goal_default ?? DEFAULT_WEEKLY_TARGET} to ${value} visits.`,
  });
  return { ok: true, data: { value } };
}

export type GymSettings = Pick<
  Settings,
  | "gym_name" | "tagline" | "address" | "maps_url" | "phone" | "opening_hours" | "upi_id" | "upi_name"
  | "no_show_threshold_days" | "renewal_windows" | "weekly_goal_default" | "freeze_max_days_per_year" | "gstin"
>;

const DEFAULTS: GymSettings = {
  gym_name: process.env.NEXT_PUBLIC_GYM_NAME ?? "",
  tagline: null,
  address: null,
  maps_url: null,
  phone: null,
  opening_hours: null,
  upi_id: null,
  upi_name: null,
  no_show_threshold_days: DEFAULT_NO_SHOW_THRESHOLD_DAYS,
  renewal_windows: [...RENEWAL_WINDOWS],
  weekly_goal_default: DEFAULT_WEEKLY_TARGET,
  freeze_max_days_per_year: 30,
  gstin: null,
};

/** The single settings row, with defaults when it hasn't been created yet. Throws on a database error. */
export async function getSettings(): Promise<GymSettings> {
  const { data, error } = await createServiceClient()
    .from("settings")
    .select("gym_name, tagline, address, maps_url, phone, opening_hours, upi_id, upi_name, no_show_threshold_days, renewal_windows, weekly_goal_default, freeze_max_days_per_year, gstin")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("SETTINGS_LOAD_FAILED");
  return { ...DEFAULTS, ...(data ?? {}) };
}

const optionalText = (max: number, message: string) =>
  z.string().trim().max(max, message).optional().transform((v) => v || null);

export const gymProfileSchema = z.object({
  gymName: z.string().trim().min(2, "Enter the gym's name").max(60, "Keep the name under 60 characters"),
  tagline: optionalText(120, "Keep the tagline under 120 characters"),
  address: optionalText(200, "Keep the address under 200 characters"),
  mapsUrl: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || /^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)\S*$/i.test(v), "Paste the share link from Google Maps"),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "") : null))
    .refine((v) => v === null || /^[6-9]\d{9}$/.test(v), "Enter a 10-digit mobile number"),
  openingHours: optionalText(400, "Keep opening hours under 400 characters"),
  upiId: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || /^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$/.test(v), "Enter a UPI ID like gymname@okicici"),
  upiName: optionalText(60, "Keep the payee name under 60 characters"),
  // Only for GST-registered gyms; receipts then show the tax included (C8).
  gstin: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.toUpperCase() : null))
    .refine((v) => v === null || /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v), "Enter the 15-character GSTIN, e.g. 29ABCDE1234F1Z5"),
});

export const rulesSchema = z.object({
  noShowThresholdDays: z.coerce
    .number({ invalid_type_error: "Enter a number of days between 3 and 60" })
    .int("Enter a whole number of days")
    .min(3, "Enter a number of days between 3 and 60")
    .max(60, "Enter a number of days between 3 and 60"),
  // "14, 7, 3, 0, -3" → [14, 7, 3, 0, -3]
  renewalWindows: z
    .string({ required_error: "Enter the reminder days" })
    .transform((v) => v.split(/[\s,]+/).filter(Boolean).map(Number))
    .refine((list) => list.length >= 2 && list.length <= 8 && list.every((n) => Number.isInteger(n) && n >= -30 && n <= 30), "Enter 2–8 whole numbers between -30 and 30, separated by commas")
    .refine((list) => list.includes(0), "Include 0 (the expiry day)")
    .refine((list) => list.some((n) => n > 0), "Include at least one day before expiry")
    .transform((list) => [...new Set(list)].sort((a, b) => b - a)),
  freezeMaxDaysPerYear: z.coerce
    .number({ invalid_type_error: "Enter 0 to 365 days" })
    .int("Enter a whole number of days")
    .min(0, "Enter 0 to 365 days")
    .max(365, "Enter 0 to 365 days"),
});

/** Update (or create) the single settings row and audit it. */
async function saveSettings(patch: Partial<Omit<Settings, "id" | "created_at" | "updated_at">>, staffId: string, summary: string): Promise<ActionResult<void>> {
  const supabase = createServiceClient();
  const { data: row, error: readError } = await supabase.from("settings").select("id").limit(1).maybeSingle();
  if (readError) return SAVE_FAILED;
  const { data: saved, error } = row
    ? await supabase.from("settings").update(patch).eq("id", row.id).select("id").single()
    : await supabase.from("settings").insert({ gym_name: DEFAULTS.gym_name || "Gym", ...patch }).select("id").single();
  if (error || !saved) return SAVE_FAILED;
  await supabase.from("audit_logs").insert({
    actor_type: "Staff",
    actor_id: staffId,
    action: "settings.updated",
    record_type: "settings",
    record_id: saved.id,
    summary,
  });
  return { ok: true, data: undefined };
}

export async function updateGymProfile(input: unknown, staffId: string): Promise<ActionResult<void>> {
  const parsed = gymProfileSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const v = parsed.data;
  return saveSettings(
    {
      gym_name: v.gymName,
      tagline: v.tagline,
      address: v.address,
      maps_url: v.mapsUrl,
      phone: v.phone,
      opening_hours: v.openingHours,
      upi_id: v.upiId,
      upi_name: v.upiName,
      gstin: v.gstin,
    },
    staffId,
    `Gym profile updated: ${v.gymName}${v.upiId ? `, UPI ${v.upiId}` : ", no UPI ID"}.`
  );
}

/** Threshold and reminder windows apply from the next scan / page load. */
export async function updateRules(input: unknown, staffId: string): Promise<ActionResult<void>> {
  const parsed = rulesSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { noShowThresholdDays, renewalWindows, freezeMaxDaysPerYear } = parsed.data;
  return saveSettings(
    { no_show_threshold_days: noShowThresholdDays, renewal_windows: renewalWindows, freeze_max_days_per_year: freezeMaxDaysPerYear },
    staffId,
    `Rules updated: Red List after ${noShowThresholdDays} days absent; renewal windows ${renewalWindows.join(", ")}; up to ${freezeMaxDaysPerYear} paused days added per year.`
  );
}
