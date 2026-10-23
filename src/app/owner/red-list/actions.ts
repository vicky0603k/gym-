"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaff } from "@/services/auth";
import { recordFollowUp, runDailyScan } from "@/services/red-list";
import type { ActionResult } from "@/services/payments";

/** Owner-only manual run of the daily scan (same idempotent function as the cron). */
export async function runScanAction(): Promise<ActionResult<{ casesOpened: number; threshold: number }>> {
  const staff = await getCurrentStaff();
  if (staff?.role !== "Owner") {
    return { ok: false, error: { code: "FORBIDDEN", message: "Only the owner can run the scan." } };
  }
  try {
    const { casesOpened, threshold } = await runDailyScan();
    revalidatePath("/owner", "layout");
    return { ok: true, data: { casesOpened, threshold } };
  } catch {
    return { ok: false, error: { code: "INVALID_STATE", message: "The scan couldn't run. Please try again." } };
  }
}

const SESSION_ENDED: ActionResult<never> = {
  ok: false,
  error: { code: "FORBIDDEN", message: "Your session has ended. Log in again." },
};

/** Owner and front desk both record follow-ups (DATABASE.md). */
export async function recordFollowUpAction(formData: FormData) {
  const staff = await getCurrentStaff();
  if (!staff) return SESSION_ENDED;
  const result = await recordFollowUp(Object.fromEntries(formData), staff.id);
  if (result.ok) revalidatePath("/owner", "layout");
  return result;
}
