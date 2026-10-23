"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaff } from "@/services/auth";
import { validationError } from "@/services/memberships";
import { rejectInputSchema, rejectPayment, verifyInputSchema, verifyPayment, type ActionResult } from "@/services/payments";

// verify_payment / reject_payment re-check the Owner role inside the database.
const OWNER_ONLY: ActionResult<never> = {
  ok: false,
  error: { code: "FORBIDDEN", message: "Only the owner can verify or reject payments." },
};

export async function verifyPaymentAction(formData: FormData) {
  const staff = await getCurrentStaff();
  if (staff?.role !== "Owner") return OWNER_ONLY;
  const parsed = verifyInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);

  const result = await verifyPayment({ ...parsed.data, staffId: staff.id });
  if (result.ok) revalidatePath("/owner", "layout");
  return result;
}

export async function rejectPaymentAction(formData: FormData) {
  const staff = await getCurrentStaff();
  if (staff?.role !== "Owner") return OWNER_ONLY;
  const parsed = rejectInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);

  const result = await rejectPayment({ ...parsed.data, staffId: staff.id });
  if (result.ok) revalidatePath("/owner", "layout");
  return result;
}
