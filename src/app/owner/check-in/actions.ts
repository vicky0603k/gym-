"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaff } from "@/services/auth";
import { assistedCheckIn, type CheckInResult } from "@/services/attendance";

/** Owner and front desk may both do assisted check-ins (check_in() re-checks the staff row). */
export async function assistedCheckInAction(formData: FormData): Promise<CheckInResult> {
  const staff = await getCurrentStaff();
  if (!staff) {
    return { ok: false, error: { code: "FORBIDDEN", message: "Your session has ended. Log in again." } };
  }
  const result = await assistedCheckIn(Object.fromEntries(formData), staff.id);
  if (result.ok) revalidatePath("/owner/members", "layout");
  return result;
}
