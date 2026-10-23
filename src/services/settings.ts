/**
 * Settings service — the single-row gym settings table.
 * Phase 8 covers only the default weekly visit target; Phase 11 adds the rest.
 */
import { z } from "zod";
import { createServiceClient } from "./supabase/server";
import { validationError } from "./memberships";
import { DEFAULT_WEEKLY_TARGET } from "@/utils/constants";
import type { ActionResult } from "./payments";

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

const SAVE_FAILED = {
  ok: false as const,
  error: { code: "INVALID_STATE", message: "We couldn't save this setting. Please try again." },
};
