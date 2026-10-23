"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaff } from "@/services/auth";
import { adjustStock, createAddon, recordPTSession, updateAddon } from "@/services/addons";
import type { ActionResult } from "@/services/payments";

const SESSION_ENDED: ActionResult<never> = { ok: false, error: { code: "FORBIDDEN", message: "Your session has ended. Log in again." } };
const OWNER_ONLY: ActionResult<never> = { ok: false, error: { code: "FORBIDDEN", message: "Only the owner can change add-ons and prices." } };

function refresh() {
  revalidatePath("/owner", "layout");
}

/** Owner and front desk: one PT session (+1), capped in the database. */
export async function recordSessionAction(orderId: string) {
  const staff = await getCurrentStaff();
  if (!staff) return SESSION_ENDED;
  const result = await recordPTSession({ orderId: typeof orderId === "string" ? orderId : "", staffId: staff.id });
  if (result.ok) refresh();
  return result;
}

/** Owner and front desk: stock in/out with a reason, never below 0. */
export async function adjustStockAction(formData: FormData) {
  const staff = await getCurrentStaff();
  if (!staff) return SESSION_ENDED;
  const result = await adjustStock(Object.fromEntries(formData), staff.id);
  if (result.ok) refresh();
  return result;
}

export async function createAddonAction(formData: FormData) {
  const staff = await getCurrentStaff();
  if (staff?.role !== "Owner") return OWNER_ONLY;
  const result = await createAddon(Object.fromEntries(formData), staff.id);
  if (result.ok) refresh();
  return result;
}

export async function updateAddonAction(addonId: string, formData: FormData) {
  const staff = await getCurrentStaff();
  if (staff?.role !== "Owner") return OWNER_ONLY;
  const result = await updateAddon(addonId, Object.fromEntries(formData), staff.id);
  if (result.ok) refresh();
  return result;
}
