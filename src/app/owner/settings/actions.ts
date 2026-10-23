"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaff } from "@/services/auth";
import { updateGymProfile, updateRules, updateWeeklyGoalDefault } from "@/services/settings";
import type { ActionResult } from "@/services/payments";

// RLS (002) lets only the Owner change settings; the service role bypasses RLS, so check here.
const OWNER_ONLY: ActionResult<never> = {
  ok: false,
  error: { code: "FORBIDDEN", message: "Only the owner can change settings." },
};

export async function updateWeeklyGoalDefaultAction(formData: FormData) {
  const staff = await getCurrentStaff();
  if (staff?.role !== "Owner") return OWNER_ONLY;
  const result = await updateWeeklyGoalDefault(Object.fromEntries(formData), staff.id);
  if (result.ok) revalidatePath("/owner", "layout");
  return result;
}

export async function updateGymProfileAction(formData: FormData) {
  const staff = await getCurrentStaff();
  if (staff?.role !== "Owner") return OWNER_ONLY;
  const result = await updateGymProfile(Object.fromEntries(formData), staff.id);
  // The landing page shows the gym profile too.
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function updateRulesAction(formData: FormData) {
  const staff = await getCurrentStaff();
  if (staff?.role !== "Owner") return OWNER_ONLY;
  const result = await updateRules(Object.fromEntries(formData), staff.id);
  if (result.ok) revalidatePath("/owner", "layout");
  return result;
}
