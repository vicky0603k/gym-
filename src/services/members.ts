/**
 * Members service — owner member management (list, detail, add, edit,
 * pause/resume) and the member's own home card.
 * All dates come from src/utils/dates.ts (Asia/Kolkata).
 */
import { z } from "zod";
import { createServiceClient } from "./supabase/server";
import { hashPin } from "./auth";
import { pauseMembership, resumeMembership, validationError } from "./memberships";
import { getAttendanceHistory, getLastCheckinDate } from "./attendance";
import { computeNewExpiry, todayKolkata } from "@/utils/dates";
import type { ActionResult } from "./payments";
import type { Attendance, Member, MemberStatus, Membership } from "./supabase/database.types";

export const MEMBER_STATUSES = ["Active", "Paused", "Expired", "Cancelled", "Blocked"] as const;

// shortcut: the list shows at most this many rows; add paging when a gym passes it.
export const MEMBER_LIST_LIMIT = 500;

const memberFields = {
  name: z.string().trim().min(2, "Enter the member's full name").max(80, "Keep the name under 80 characters"),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number"),
  weeklyTarget: z.coerce
    .number({ invalid_type_error: "Enter a weekly target between 1 and 7 visits" })
    .int("Enter a weekly target between 1 and 7 visits")
    .min(1, "Enter a weekly target between 1 and 7 visits")
    .max(7, "Enter a weekly target between 1 and 7 visits"),
  // "" from the "No trainer" option means none.
  trainerId: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.string().uuid("Choose a trainer from the list").nullable()
  ),
};

export const createMemberSchema = z.object({
  ...memberFields,
  pin: z.string().regex(/^\d{4}$/, "Enter a 4-digit PIN"),
  planId: z.string().uuid("Choose a plan"),
});

export const updateMemberSchema = z.object(memberFields);

export const pauseMemberSchema = z.object({
  reason: z.string({ required_error: "Enter a reason for the pause" }).trim().min(3, "Enter a reason for the pause"),
});

const DUPLICATE_PHONE = "This mobile number already belongs to another member.";
const SAVE_FAILED = {
  ok: false as const,
  error: { code: "INVALID_STATE", message: "We couldn't save this member. Please try again." },
};

function duplicatePhone() {
  return { ok: false as const, error: { code: "VALIDATION", message: DUPLICATE_PHONE, fields: { phone: DUPLICATE_PHONE } } };
}

const MEMBER_COLUMNS =
  "id, name, phone, status, assigned_trainer_id, weekly_target, join_date, created_at, updated_at";

export type MemberProfile = Pick<
  Member,
  "id" | "name" | "phone" | "status" | "assigned_trainer_id" | "weekly_target" | "join_date" | "created_at" | "updated_at"
>;
export type MembershipWithPlan = Membership & { planName: string };

export interface MemberListRow {
  id: string;
  name: string;
  phone: string;
  status: MemberStatus;
  planName: string | null;
  expiryDate: string | null;
}

async function planNames(): Promise<Map<string, string>> {
  const { data, error } = await createServiceClient().from("plans").select("id, name");
  if (error) throw new Error("PLANS_LOAD_FAILED");
  return new Map(data.map((p) => [p.id, p.name]));
}

/** Latest non-cancelled membership per member (the one the owner and member care about). */
async function currentMemberships(memberIds: string[]): Promise<Map<string, Membership>> {
  const supabase = createServiceClient();
  const current = new Map<string, Membership>();
  // Chunked so the id list never overflows the request URL.
  for (let i = 0; i < memberIds.length; i += 100) {
    const { data, error } = await supabase
      .from("memberships")
      .select("*")
      .in("member_id", memberIds.slice(i, i + 100))
      .neq("status", "Cancelled")
      .order("expiry_date", { ascending: false });
    if (error) throw new Error("MEMBERSHIPS_LOAD_FAILED");
    for (const m of data) if (!current.has(m.member_id)) current.set(m.member_id, m);
  }
  return current;
}

/** Owner members list. Search matches name or phone. Throws on a database error. */
export async function listMembers(filters: { search?: string; status?: string }): Promise<MemberListRow[]> {
  let query = createServiceClient()
    .from("members")
    .select("id, name, phone, status")
    .order("name", { ascending: true })
    .limit(MEMBER_LIST_LIMIT);

  // Keep only characters that are safe inside a PostgREST or() filter.
  const term = (filters.search ?? "").replace(/[^\p{L}\p{N} '-]/gu, "").trim();
  if (term) {
    const digits = term.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
    query = query.or(
      digits.length >= 3 ? `name.ilike.%${term}%,phone.ilike.%${digits}%` : `name.ilike.%${term}%`
    );
  }
  const status = MEMBER_STATUSES.find((s) => s === filters.status);
  if (status) query = query.eq("status", status);

  const { data: members, error } = await query;
  if (error) throw new Error("MEMBERS_LOAD_FAILED");
  if (!members.length) return [];

  const [names, current] = await Promise.all([planNames(), currentMemberships(members.map((m) => m.id))]);
  return members.map((m) => {
    const ms = current.get(m.id);
    return {
      ...m,
      planName: ms ? names.get(ms.plan_id) ?? null : null,
      expiryDate: ms?.expiry_date ?? null,
    };
  });
}

export interface MemberDetail {
  member: MemberProfile;
  trainerName: string | null;
  current: MembershipWithPlan | null;
  history: MembershipWithPlan[];
  recentVisits: Attendance[];
  lastVisit: string | null;
}

/** Everything the owner's member detail screen shows. Null when the member does not exist. */
export async function getMemberDetail(memberId: string): Promise<MemberDetail | null> {
  if (!z.string().uuid().safeParse(memberId).success) return null;
  const supabase = createServiceClient();

  const { data: member, error } = await supabase
    .from("members")
    .select(MEMBER_COLUMNS)
    .eq("id", memberId)
    .maybeSingle();
  if (error) throw new Error("MEMBER_LOAD_FAILED");
  if (!member) return null;

  const [names, memberships, trainer, recentVisits, lastVisit] = await Promise.all([
    planNames(),
    supabase.from("memberships").select("*").eq("member_id", memberId).order("start_date", { ascending: false }),
    member.assigned_trainer_id
      ? supabase.from("trainers").select("name").eq("id", member.assigned_trainer_id).maybeSingle()
      : Promise.resolve({ data: null }),
    getAttendanceHistory(memberId, 0, 10),
    getLastCheckinDate(memberId),
  ]);
  if (memberships.error) throw new Error("MEMBERSHIPS_LOAD_FAILED");

  const history = memberships.data.map((m) => ({ ...m, planName: names.get(m.plan_id) ?? "Plan removed" }));
  const current =
    [...history].sort((a, b) => b.expiry_date.localeCompare(a.expiry_date)).find((m) => m.status !== "Cancelled") ??
    null;

  return { member, trainerName: trainer.data?.name ?? null, current, history, recentVisits, lastVisit };
}

/** Member profile for the edit form. */
export async function getMemberProfile(memberId: string): Promise<MemberProfile | null> {
  if (!z.string().uuid().safeParse(memberId).success) return null;
  const { data, error } = await createServiceClient()
    .from("members")
    .select(MEMBER_COLUMNS)
    .eq("id", memberId)
    .maybeSingle();
  if (error) throw new Error("MEMBER_LOAD_FAILED");
  return data;
}

export async function listActiveTrainers(): Promise<{ id: string; name: string; specialisation: string | null }[]> {
  const { data, error } = await createServiceClient()
    .from("trainers")
    .select("id, name, specialisation")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw new Error("TRAINERS_LOAD_FAILED");
  return data;
}

/**
 * Add a member and their first membership: start = today (Kolkata),
 * expiry = start + plan duration. The PIN is stored only as hashPin().
 */
export async function createMember(
  input: unknown,
  staffId: string
): Promise<ActionResult<{ memberId: string; planName: string; expiryDate: string }>> {
  const parsed = createMemberSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { name, phone, pin, weeklyTarget, trainerId, planId } = parsed.data;

  const supabase = createServiceClient();
  const { data: plan } = await supabase
    .from("plans")
    .select("id, name, duration_days")
    .eq("id", planId)
    .eq("is_active", true)
    .maybeSingle();
  if (!plan) {
    const message = "This plan is no longer offered. Choose another plan.";
    return { ok: false, error: { code: "VALIDATION", message, fields: { planId: message } } };
  }

  const startDate = todayKolkata();
  const { data: member, error } = await supabase
    .from("members")
    .insert({
      name,
      phone,
      pin_hash: hashPin(pin),
      weekly_target: weeklyTarget,
      assigned_trainer_id: trainerId,
      join_date: startDate,
    })
    .select("id")
    .single();
  if (error?.code === "23505") return duplicatePhone();
  if (error || !member) return SAVE_FAILED;

  const expiryDate = computeNewExpiry(startDate, plan.duration_days);
  const { error: membershipError } = await supabase.from("memberships").insert({
    member_id: member.id,
    plan_id: plan.id,
    start_date: startDate,
    expiry_date: expiryDate,
    status: "Active",
    renewal_source: "Joining",
  });
  if (membershipError) {
    // The member row is brand new and has no history yet, so removing it is safe.
    await supabase.from("members").delete().eq("id", member.id);
    return SAVE_FAILED;
  }

  await supabase.from("audit_logs").insert({
    actor_type: "Staff",
    actor_id: staffId,
    action: "member.created",
    record_type: "member",
    record_id: member.id,
    summary: `Member ${name} added on ${plan.name}, ${startDate} to ${expiryDate}.`,
  });

  return { ok: true, data: { memberId: member.id, planName: plan.name, expiryDate } };
}

/** Edit name, phone, trainer and weekly target. */
export async function updateMember(memberId: string, input: unknown, staffId: string): Promise<ActionResult<void>> {
  const parsed = updateMemberSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { name, phone, weeklyTarget, trainerId } = parsed.data;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("members")
    .update({ name, phone, weekly_target: weeklyTarget, assigned_trainer_id: trainerId })
    .eq("id", memberId)
    .select("id");
  if (error?.code === "23505") return duplicatePhone();
  if (error) return SAVE_FAILED;
  if (!data?.length) return { ok: false, error: { code: "NOT_FOUND", message: "This member no longer exists." } };

  await supabase.from("audit_logs").insert({
    actor_type: "Staff",
    actor_id: staffId,
    action: "member.updated",
    record_type: "member",
    record_id: memberId,
    summary: `Member details updated: ${name}, ${phone}, target ${weeklyTarget}/week.`,
  });
  return { ok: true, data: undefined };
}

/** Pause the member's active membership. A reason is mandatory. */
export async function pauseMember(memberId: string, input: unknown, staffId: string): Promise<ActionResult<void>> {
  const parsed = pauseMemberSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const { data: membership, error } = await createServiceClient()
    .from("memberships")
    .select("id, expiry_date")
    .eq("member_id", memberId)
    .eq("status", "Active")
    .order("expiry_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return SAVE_FAILED;
  if (!membership || membership.expiry_date < todayKolkata()) {
    return { ok: false, error: { code: "INVALID_STATE", message: "Only a member with a running membership can be paused." } };
  }

  return pauseMembership({ membershipId: membership.id, memberId, reason: parsed.data.reason, staffId });
}

export async function resumeMember(memberId: string, staffId: string): Promise<ActionResult<{ daysAdded: number; newExpiry: string }>> {
  const { data: membership, error } = await createServiceClient()
    .from("memberships")
    .select("id")
    .eq("member_id", memberId)
    .eq("status", "Frozen")
    .order("expiry_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return SAVE_FAILED;
  if (!membership) return { ok: false, error: { code: "INVALID_STATE", message: "This member is not paused." } };

  return resumeMembership({ membershipId: membership.id, memberId, staffId });
}

export const resetPinSchema = z.object({ pin: z.string().regex(/^\d{4}$/, "Enter a 4-digit PIN") });

/** Staff set a new PIN at the desk (SECURITY.md §1). Clears any login lockout; audited. */
export async function resetMemberPin(memberId: string, input: unknown, staffId: string): Promise<ActionResult<void>> {
  const parsed = resetPinSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("members")
    .update({ pin_hash: hashPin(parsed.data.pin), pin_failed_attempts: 0, pin_locked_until: null })
    .eq("id", memberId)
    .select("name");
  if (error) return { ok: false, error: { code: "INVALID_STATE", message: "We couldn't reset the PIN. Please try again." } };
  if (!data?.length) return { ok: false, error: { code: "NOT_FOUND", message: "This member no longer exists." } };

  await supabase.from("audit_logs").insert({
    actor_type: "Staff",
    actor_id: staffId,
    action: "member.pin_reset",
    record_type: "member",
    record_id: memberId,
    summary: `Login PIN reset for ${data[0].name}; login lockout cleared.`,
  });
  return { ok: true, data: undefined };
}

export const correctExpirySchema = z.object({
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the correct expiry date"),
  reason: z.string({ required_error: "Enter a reason for the correction" }).trim().min(3, "Enter a reason for the correction"),
});

/**
 * Owner fixes the expiry of the member's current membership (TESTING.md row 9).
 * Reason mandatory, audited. A date moved back into the future re-opens an
 * Expired membership, the same way a verified renewal does.
 */
export async function correctExpiry(memberId: string, input: unknown, staffId: string): Promise<ActionResult<void>> {
  const parsed = correctExpirySchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { expiryDate, reason } = parsed.data;

  const supabase = createServiceClient();
  const { data: membership, error } = await supabase
    .from("memberships")
    .select("id, start_date, expiry_date, status")
    .eq("member_id", memberId)
    .in("status", ["Active", "Frozen", "Expired"])
    .order("expiry_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return SAVE_FAILED;
  if (!membership) return { ok: false, error: { code: "INVALID_STATE", message: "This member has no membership to correct." } };
  if (expiryDate <= membership.start_date) {
    const message = "The expiry must be after the start date.";
    return { ok: false, error: { code: "VALIDATION", message, fields: { expiryDate: message } } };
  }
  if (expiryDate === membership.expiry_date) {
    const message = "This is already the expiry date.";
    return { ok: false, error: { code: "VALIDATION", message, fields: { expiryDate: message } } };
  }

  const reopen = membership.status === "Expired" && expiryDate >= todayKolkata();
  const { data: updated, error: updateError } = await supabase
    .from("memberships")
    .update(reopen ? { expiry_date: expiryDate, status: "Active" } : { expiry_date: expiryDate })
    .eq("id", membership.id)
    .eq("expiry_date", membership.expiry_date) // a concurrent change makes this a no-op
    .select("id");
  if (updateError || !updated?.length) return SAVE_FAILED;

  if (reopen) {
    const { error: memberError } = await supabase.from("members").update({ status: "Active" }).eq("id", memberId).eq("status", "Expired");
    if (memberError) {
      await supabase.from("memberships").update({ expiry_date: membership.expiry_date, status: "Expired" }).eq("id", membership.id);
      return SAVE_FAILED;
    }
  }

  await supabase.from("audit_logs").insert({
    actor_type: "Staff",
    actor_id: staffId,
    action: "membership.expiry_corrected",
    record_type: "membership",
    record_id: membership.id,
    summary: `Expiry corrected from ${membership.expiry_date} to ${expiryDate}. Reason: ${reason}`,
  });
  return { ok: true, data: undefined };
}

export interface MemberHome {
  name: string;
  membership: MembershipWithPlan | null;
}

/** The signed-in member's own card: real plan name and exact expiry. */
export async function getMemberHome(memberId: string): Promise<MemberHome | null> {
  const { data: member, error } = await createServiceClient()
    .from("members")
    .select("id, name")
    .eq("id", memberId)
    .maybeSingle();
  if (error) throw new Error("MEMBER_LOAD_FAILED");
  if (!member) return null;

  const [names, current] = await Promise.all([planNames(), currentMemberships([memberId])]);
  const m = current.get(memberId);
  return {
    name: member.name,
    membership: m ? { ...m, planName: names.get(m.plan_id) ?? "Membership" } : null,
  };
}

export interface MemberPreferences {
  notifyRenewal: boolean;
  notifyCare: boolean;
  marketingConsent: boolean;
}

/** The member's own message preferences. Throws on a database error. */
export async function getMemberPreferences(memberId: string): Promise<MemberPreferences | null> {
  const { data, error } = await createServiceClient()
    .from("members")
    .select("notify_renewal, notify_care, marketing_consent")
    .eq("id", memberId)
    .maybeSingle();
  if (error) throw new Error("MEMBER_LOAD_FAILED");
  return data ? { notifyRenewal: data.notify_renewal, notifyCare: data.notify_care, marketingConsent: data.marketing_consent } : null;
}

export const preferenceSchema = z.object({
  key: z.enum(["notifyRenewal", "notifyCare", "marketingConsent"]),
  value: z.boolean(),
});

const PREF_COLUMN = { notifyRenewal: "notify_renewal", notifyCare: "notify_care", marketingConsent: "marketing_consent" } as const;
const PREF_LABEL = { notifyRenewal: "renewal reminders", notifyCare: "missed-visit messages", marketingConsent: "offers and promotions" } as const;

/**
 * One toggle, saved immediately. Staff screens read it on their next load
 * (Red List / Renewals hide the WhatsApp button). Audited as a consent record.
 */
export async function updateMemberPreference(memberId: string, input: unknown): Promise<ActionResult<void>> {
  const parsed = preferenceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "VALIDATION", message: "That setting couldn't be saved." } };
  const { key, value } = parsed.data;

  const supabase = createServiceClient();
  const patch: Partial<Pick<Member, (typeof PREF_COLUMN)[keyof typeof PREF_COLUMN]>> = { [PREF_COLUMN[key]]: value };
  const { error } = await supabase.from("members").update(patch).eq("id", memberId);
  if (error) return { ok: false, error: { code: "INVALID_STATE", message: "We couldn't save that. Please try again." } };

  await supabase.from("audit_logs").insert({
    actor_type: "Member",
    actor_id: memberId,
    action: "member.preferences",
    record_type: "member",
    record_id: memberId,
    summary: `Member turned ${value ? "on" : "off"} ${PREF_LABEL[key]}.`,
  });
  return { ok: true, data: undefined };
}

export const memberStatusSchema = z.object({
  action: z.enum(["Cancel", "Block", "Reactivate"], { errorMap: () => ({ message: "Choose what to do" }) }),
  reason: z.string({ required_error: "Enter a reason" }).trim().min(3, "Enter a reason").max(300, "Keep the reason under 300 characters"),
});

const STATUS_ERRORS: Record<string, string> = {
  FORBIDDEN: "Only the owner can change a member's status.",
  VALIDATION: "Enter a reason.",
  NOT_FOUND: "This member no longer exists.",
  INVALID_STATE: "This member is already in that state.",
};

/**
 * Owner marks a member Cancelled (left) or Blocked, or reactivates them (C2).
 * Reason mandatory, audited; memberships, payments and visits stay untouched
 * (set_member_status(), migration 012). Cancelled/Blocked members can't check in
 * and never appear on the Red List.
 */
export async function setMemberStatus(memberId: string, input: unknown, staffId: string): Promise<ActionResult<{ status: MemberStatus }>> {
  const parsed = memberStatusSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { data, error } = await createServiceClient().rpc("set_member_status", {
    p_member_id: memberId,
    p_action: parsed.data.action,
    p_reason: parsed.data.reason,
    p_staff_id: staffId,
  });
  if (error || !data) return SAVE_FAILED;
  if (!data.ok) return { ok: false, error: { code: data.code, message: STATUS_ERRORS[data.code] } };
  return { ok: true, data: { status: data.status } };
}

/** On the member's request: remove name, phone and PIN of a Cancelled member; history stays (SECURITY.md §6). */
export async function anonymiseMember(memberId: string, staffId: string): Promise<ActionResult<void>> {
  const { data, error } = await createServiceClient().rpc("anonymise_member", { p_member_id: memberId, p_staff_id: staffId });
  if (error || !data) return SAVE_FAILED;
  if (!data.ok) {
    const message = data.code === "INVALID_STATE" ? "Only a cancelled member's details can be removed." : STATUS_ERRORS[data.code];
    return { ok: false, error: { code: data.code, message } };
  }
  return { ok: true, data: undefined };
}

/** An owner opened a member's app in read-only preview: record who looked, and when (SECURITY.md §5). */
export async function logMemberPreview(memberId: string, staffId: string): Promise<void> {
  await createServiceClient().from("audit_logs").insert({
    actor_type: "Staff",
    actor_id: staffId,
    action: "member.previewed",
    record_type: "member",
    record_id: memberId,
    summary: "Member app viewed read-only by staff.",
  });
}
