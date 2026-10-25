"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaff } from "@/services/auth";
import type { ActionResult } from "@/services/payments";
import { createStaff, resetStaffPassword, setStaffActive } from "@/services/staff";

const OWNER_ONLY: ActionResult<never> = { ok: false, error: { code: "FORBIDDEN", message: "Only the owner can manage staff logins." } };

async function ownerId(): Promise<string | null> {
  const staff = await getCurrentStaff();
  return staff?.role === "Owner" ? staff.id : null;
}

export async function createStaffAction(formData: FormData) {
  const id = await ownerId();
  if (!id) return OWNER_ONLY;
  const result = await createStaff(Object.fromEntries(formData), id);
  if (result.ok) revalidatePath("/owner/staff");
  return result;
}

export async function setStaffActiveAction(staffId: string, active: boolean) {
  const id = await ownerId();
  if (!id) return OWNER_ONLY;
  const result = await setStaffActive(staffId, active, id);
  if (result.ok) revalidatePath("/owner/staff");
  return result;
}

export async function resetStaffPasswordAction(staffId: string, formData: FormData) {
  const id = await ownerId();
  if (!id) return OWNER_ONLY;
  return resetStaffPassword(staffId, Object.fromEntries(formData), id);
}
