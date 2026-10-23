"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaff } from "@/services/auth";
import type { ActionResult } from "@/services/payments";
import { createMember, pauseMember, resumeMember, updateMember } from "@/services/members";

// RLS (002) lets only the Owner change members; the service role bypasses RLS, so check here.
const OWNER_ONLY: ActionResult<never> = {
  ok: false,
  error: { code: "FORBIDDEN", message: "Only the owner can change member details." },
};

async function ownerId(): Promise<string | null> {
  const staff = await getCurrentStaff();
  return staff?.role === "Owner" ? staff.id : null;
}

function refreshMembers() {
  revalidatePath("/owner/members", "layout");
}

export async function createMemberAction(formData: FormData) {
  const staffId = await ownerId();
  if (!staffId) return OWNER_ONLY;
  const result = await createMember(Object.fromEntries(formData), staffId);
  if (result.ok) refreshMembers();
  return result;
}

export async function updateMemberAction(memberId: string, formData: FormData) {
  const staffId = await ownerId();
  if (!staffId) return OWNER_ONLY;
  const result = await updateMember(memberId, Object.fromEntries(formData), staffId);
  if (result.ok) refreshMembers();
  return result;
}

export async function pauseMemberAction(memberId: string, formData: FormData) {
  const staffId = await ownerId();
  if (!staffId) return OWNER_ONLY;
  const result = await pauseMember(memberId, Object.fromEntries(formData), staffId);
  if (result.ok) refreshMembers();
  return result;
}

export async function resumeMemberAction(memberId: string) {
  const staffId = await ownerId();
  if (!staffId) return OWNER_ONLY;
  const result = await resumeMember(memberId, staffId);
  if (result.ok) refreshMembers();
  return result;
}
