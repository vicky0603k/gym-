"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentMemberId } from "@/services/auth";
import { createRenewalOrder } from "@/services/memberships";
import { cancelPayment, claimRenewalPayment } from "@/services/payments";

/** Start (or reuse) a renewal for the signed-in member. Never extends anything. */
export async function startRenewalAction(planId: string) {
  const memberId = await getCurrentMemberId();
  if (!memberId) redirect("/login");
  const result = await createRenewalOrder({ memberId, planId: typeof planId === "string" ? planId : "" });
  if (result.ok) revalidatePath("/member", "layout");
  return result;
}

/** The member says they have paid and gives the UPI reference. Status stays Pending. */
export async function claimPaymentAction(formData: FormData) {
  const memberId = await getCurrentMemberId();
  if (!memberId) redirect("/login");
  const result = await claimRenewalPayment(memberId, Object.fromEntries(formData));
  if (result.ok) revalidatePath("/member", "layout");
  return result;
}

/** The member drops an unpaid order (renewal or add-on) before sending a reference. */
export async function cancelPaymentAction(paymentId: string) {
  const memberId = await getCurrentMemberId();
  if (!memberId) redirect("/login");
  const result = await cancelPayment(memberId, paymentId);
  if (result.ok) revalidatePath("/member", "layout");
  return result;
}
