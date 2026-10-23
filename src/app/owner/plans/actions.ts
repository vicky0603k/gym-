"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaff } from "@/services/auth";
import type { ActionResult } from "@/services/payments";
import { createPlan, updatePlan } from "@/services/memberships";

// RLS (002) lets only the Owner change plans; the service role bypasses RLS, so check here.
const OWNER_ONLY: ActionResult<never> = {
  ok: false,
  error: { code: "FORBIDDEN", message: "Only the owner can change plans." },
};

async function ownerId(): Promise<string | null> {
  const staff = await getCurrentStaff();
  return staff?.role === "Owner" ? staff.id : null;
}

export async function createPlanAction(formData: FormData) {
  const staffId = await ownerId();
  if (!staffId) return OWNER_ONLY;
  const result = await createPlan(Object.fromEntries(formData), staffId);
  if (result.ok) revalidatePath("/owner", "layout");
  return result;
}

export async function updatePlanAction(planId: string, formData: FormData) {
  const staffId = await ownerId();
  if (!staffId) return OWNER_ONLY;
  const result = await updatePlan(planId, Object.fromEntries(formData), staffId);
  if (result.ok) revalidatePath("/owner", "layout");
  return result;
}
