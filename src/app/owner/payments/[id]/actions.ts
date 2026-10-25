"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaff } from "@/services/auth";
import { refundPayment, type ActionResult } from "@/services/payments";

// refund_payment re-checks the Owner role inside the database.
export async function refundPaymentAction(formData: FormData): Promise<ActionResult<{ newExpiry: string | null }>> {
  const staff = await getCurrentStaff();
  if (staff?.role !== "Owner") return { ok: false, error: { code: "FORBIDDEN", message: "Only the owner can refund payments." } };
  const result = await refundPayment(Object.fromEntries(formData), staff.id);
  if (result.ok) revalidatePath("/owner", "layout");
  return result;
}
