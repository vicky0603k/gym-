"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentMemberId } from "@/services/auth";
import { updateMemberPreference } from "@/services/members";

export async function updatePreferenceAction(key: string, value: boolean) {
  const memberId = await getCurrentMemberId();
  if (!memberId) redirect("/login");
  const result = await updateMemberPreference(memberId, { key, value });
  if (result.ok) revalidatePath("/member/settings");
  return result;
}
