"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentMemberId } from "@/services/auth";
import { qrCheckIn, type CheckInResult } from "@/services/attendance";

export async function checkInAction(token: string): Promise<CheckInResult> {
  const memberId = await getCurrentMemberId();
  if (!memberId) redirect("/login");

  // Real tokens are ~120 characters; anything huge is not ours.
  const result = await qrCheckIn(memberId, typeof token === "string" ? token.slice(0, 512) : "");
  if (result.ok) revalidatePath("/member", "layout");
  return result;
}
