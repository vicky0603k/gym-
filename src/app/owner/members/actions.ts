"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaff } from "@/services/auth";
import type { ActionResult } from "@/services/payments";
import { anonymiseMember, correctExpiry, createMember, pauseMember, resetMemberPin, resumeMember, setMemberStatus, updateMember } from "@/services/members";
import { createDeskRenewal } from "@/services/payments";
import { backfillAttendance } from "@/services/attendance";

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

export async function correctExpiryAction(memberId: string, formData: FormData) {
  const staffId = await ownerId();
  if (!staffId) return OWNER_ONLY;
  const result = await correctExpiry(memberId, Object.fromEntries(formData), staffId);
  if (result.ok) refreshMembers();
  return result;
}

// Any staff member may reset a PIN at the desk (SECURITY.md §1).
export async function resetPinAction(memberId: string, formData: FormData): Promise<ActionResult<void>> {
  const staff = await getCurrentStaff();
  if (!staff) return { ok: false, error: { code: "FORBIDDEN", message: "Please log in again." } };
  return resetMemberPin(memberId, Object.fromEntries(formData), staff.id);
}

const LOGIN_AGAIN: ActionResult<never> = { ok: false, error: { code: "FORBIDDEN", message: "Please log in again." } };

// Owner and front desk take payments at the counter; only the owner verifies them.
export async function deskRenewalAction(memberId: string, formData: FormData) {
  const staff = await getCurrentStaff();
  if (!staff) return LOGIN_AGAIN;
  const result = await createDeskRenewal(memberId, Object.fromEntries(formData), staff.id);
  if (result.ok) revalidatePath("/owner", "layout");
  return result;
}

export async function backfillAttendanceAction(memberId: string, formData: FormData): Promise<ActionResult<{ caseResolved: boolean }>> {
  const staff = await getCurrentStaff();
  if (!staff) return LOGIN_AGAIN;
  const result = await backfillAttendance(memberId, Object.fromEntries(formData), staff.id);
  if (!result.ok) return result;
  revalidatePath("/owner", "layout");
  return { ok: true, data: { caseResolved: result.caseResolved } };
}

export async function memberStatusAction(memberId: string, formData: FormData) {
  const staffId = await ownerId();
  if (!staffId) return OWNER_ONLY;
  const result = await setMemberStatus(memberId, Object.fromEntries(formData), staffId);
  if (result.ok) refreshMembers();
  return result;
}

export async function anonymiseMemberAction(memberId: string) {
  const staffId = await ownerId();
  if (!staffId) return OWNER_ONLY;
  const result = await anonymiseMember(memberId, staffId);
  if (result.ok) refreshMembers();
  return result;
}
