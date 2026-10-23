"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentMemberId } from "@/services/auth";
import { createAddonOrder } from "@/services/addons";

/** Explicit purchase by the signed-in member: order + Pending payment. */
export async function buyAddonAction(addonId: string, quantity: number) {
  const memberId = await getCurrentMemberId();
  if (!memberId) redirect("/login");
  const result = await createAddonOrder({ memberId, addonId, quantity });
  if (result.ok) revalidatePath("/member", "layout");
  return result;
}
