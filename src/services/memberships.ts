/**
 * Memberships service — plans, lifecycle, renewal orders.
 */
import { z, type ZodError } from "zod";
import { createServiceClient } from "./supabase/server";
import { applyDiscount, discountAmount, formatRupees } from "@/utils/money";
import { todayKolkata } from "@/utils/dates";
import type { Plan, Membership } from "./supabase/database.types";
import type { ActionResult } from "./payments";

/** Zod failure → VALIDATION result with one plain-language message per field. */
export function validationError(error: ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) fields[String(issue.path[0])] ??= issue.message;
  return { ok: false as const, error: { code: "VALIDATION", message: error.issues[0].message, fields } };
}

// FormData values arrive as strings; an unticked checkbox is absent.
export const planSchema = z.object({
  name: z.string().trim().min(2, "Enter a plan name").max(40, "Keep the plan name under 40 characters"),
  durationDays: z.coerce
    .number({ invalid_type_error: "Enter the duration in days" })
    .int("Enter the duration in whole days")
    .min(1, "Duration must be at least 1 day")
    .max(1095, "Duration can be at most 1095 days (3 years)"),
  price: z.coerce
    .number({ invalid_type_error: "Enter the price in rupees" })
    .int("Enter the price in whole rupees")
    .min(0, "Price cannot be negative")
    .max(1000000, "Price can be at most ₹10,00,000"),
  discountPct: z.coerce
    .number({ invalid_type_error: "Enter a discount between 0 and 100" })
    .int("Enter the discount as a whole number")
    .min(0, "Discount must be between 0 and 100%")
    .max(100, "Discount must be between 0 and 100%"),
  benefits: z.string().trim().max(300, "Keep benefits under 300 characters").optional()
    .transform((v) => v || null),
  isActive: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

const PLAN_SAVE_FAILED = {
  ok: false as const,
  error: { code: "INVALID_STATE", message: "We couldn't save this plan. Please try again." },
};

/** Every plan, active and inactive, shortest first. Throws on a database error. */
export async function listPlans(): Promise<Plan[]> {
  const { data, error } = await createServiceClient()
    .from("plans")
    .select("*")
    .order("duration_days", { ascending: true });
  if (error) throw new Error("PLANS_LOAD_FAILED");
  return data;
}

export async function getPlan(planId: string): Promise<Plan | null> {
  const { data, error } = await createServiceClient()
    .from("plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();
  if (error) throw new Error("PLAN_LOAD_FAILED");
  return data;
}

function planRow(p: z.infer<typeof planSchema>) {
  return {
    name: p.name,
    duration_days: p.durationDays,
    price: p.price,
    discount_pct: p.discountPct,
    benefits: p.benefits,
    is_active: p.isActive,
  };
}

function planSummary(p: z.infer<typeof planSchema>) {
  return `${p.name}: ${p.durationDays} days, ${formatRupees(p.price)}, ${p.discountPct}% off, ${p.isActive ? "active" : "inactive"}`;
}

export async function createPlan(input: unknown, staffId: string): Promise<ActionResult<{ planId: string }>> {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const supabase = createServiceClient();
  const { data, error } = await supabase.from("plans").insert(planRow(parsed.data)).select("id").single();
  if (error || !data) return PLAN_SAVE_FAILED;

  await supabase.from("audit_logs").insert({
    actor_type: "Staff",
    actor_id: staffId,
    action: "plan.created",
    record_type: "plan",
    record_id: data.id,
    summary: `Plan created. ${planSummary(parsed.data)}`,
  });
  return { ok: true, data: { planId: data.id } };
}

/** Edit a plan. Price changes are audited (SECURITY.md); existing memberships are untouched. */
export async function updatePlan(
  planId: string,
  input: unknown,
  staffId: string
): Promise<ActionResult<void>> {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const supabase = createServiceClient();
  const before = await getPlan(planId).catch(() => null);
  if (!before) return { ok: false, error: { code: "NOT_FOUND", message: "This plan no longer exists." } };

  const { error } = await supabase.from("plans").update(planRow(parsed.data)).eq("id", planId);
  if (error) return PLAN_SAVE_FAILED;

  const priceNote =
    before.price !== parsed.data.price || before.discount_pct !== parsed.data.discountPct
      ? ` Price was ${formatRupees(before.price)} at ${before.discount_pct}% off.`
      : "";
  await supabase.from("audit_logs").insert({
    actor_type: "Staff",
    actor_id: staffId,
    action: "plan.updated",
    record_type: "plan",
    record_id: planId,
    summary: `Plan updated. ${planSummary(parsed.data)}.${priceNote}`,
  });
  return { ok: true, data: undefined };
}

/** Get all active plans */
export async function getActivePlans(): Promise<Plan[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("duration_days", { ascending: true });
  return data ?? [];
}

/** Get a member's current active membership */
export async function getActiveMembership(
  memberId: string
): Promise<Membership | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("memberships")
    .select("*")
    .eq("member_id", memberId)
    .eq("status", "Active")
    .order("expiry_date", { ascending: false })
    .limit(1)
    .single();
  return data ?? null;
}

/** Create a renewal order and a Pending payment */
export async function createRenewalOrder(params: {
  memberId: string;
  planId: string;
  currentMembershipId: string;
}): Promise<
  ActionResult<{
    orderId: string;
    paymentId: string;
    finalAmount: number;
    discountAmount: number;
  }>
> {
  const supabase = createServiceClient();

  const { data: plan } = await supabase
    .from("plans")
    .select("*")
    .eq("id", params.planId)
    .eq("is_active", true)
    .single();

  if (!plan) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Plan not found or inactive." },
    };
  }

  const finalAmount = applyDiscount(plan.price, plan.discount_pct);
  const discount = discountAmount(plan.price, plan.discount_pct);

  // Create payment first
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      member_id: params.memberId,
      purpose: "Renewal",
      ref_id: params.currentMembershipId, // will be updated to order id
      amount: finalAmount,
      status: "Pending",
    })
    .select()
    .single();

  if (paymentError || !payment) {
    return {
      ok: false,
      error: { code: "INVALID_STATE", message: "Failed to create payment." },
    };
  }

  // Create renewal order
  const { data: order, error: orderError } = await supabase
    .from("renewal_orders")
    .insert({
      membership_id: params.currentMembershipId,
      plan_id: params.planId,
      amount: plan.price,
      discount,
      payment_id: payment.id,
      status: "Pending",
    })
    .select()
    .single();

  if (orderError || !order) {
    // Rollback payment
    await supabase.from("payments").delete().eq("id", payment.id);
    return {
      ok: false,
      error: { code: "INVALID_STATE", message: "Failed to create renewal order." },
    };
  }

  // Update payment ref_id to the order id
  await supabase
    .from("payments")
    .update({ ref_id: order.id, updated_at: new Date().toISOString() })
    .eq("id", payment.id);

  return {
    ok: true,
    data: {
      orderId: order.id,
      paymentId: payment.id,
      finalAmount,
      discountAmount: discount,
    },
  };
}

const STATUS_SAVE_FAILED = {
  ok: false as const,
  error: { code: "INVALID_STATE", message: "We couldn't update this membership. Please try again." },
};

/**
 * Pause a membership: membership Frozen (freeze_start = today Kolkata) and
 * member Paused together. If the second write fails the first is undone.
 */
export async function pauseMembership(params: {
  membershipId: string;
  memberId: string;
  reason: string;
  staffId: string;
}): Promise<ActionResult<void>> {
  if (!params.reason?.trim()) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Enter a reason for the pause.", fields: { reason: "Enter a reason for the pause." } },
    };
  }

  const supabase = createServiceClient();

  const { data: frozen, error: freezeError } = await supabase
    .from("memberships")
    .update({ status: "Frozen", freeze_start: todayKolkata(), freeze_end: null })
    .eq("id", params.membershipId)
    .eq("status", "Active")
    .select("id");
  if (freezeError) return STATUS_SAVE_FAILED;
  if (!frozen?.length) {
    return { ok: false, error: { code: "INVALID_STATE", message: "Only an active membership can be paused." } };
  }

  const { error: memberError } = await supabase
    .from("members")
    .update({ status: "Paused" })
    .eq("id", params.memberId);
  if (memberError) {
    await supabase
      .from("memberships")
      .update({ status: "Active", freeze_start: null })
      .eq("id", params.membershipId);
    return STATUS_SAVE_FAILED;
  }

  await supabase.from("audit_logs").insert({
    actor_type: "Staff",
    actor_id: params.staffId,
    action: "membership.paused",
    record_type: "membership",
    record_id: params.membershipId,
    summary: `Membership paused from ${todayKolkata()}. Reason: ${params.reason.trim()}`,
  });

  return { ok: true, data: undefined };
}

/**
 * Resume a paused membership: freeze_end = today Kolkata, membership Active,
 * member Active. Expiry is not extended (freeze rules are still open in PRD.md).
 */
export async function resumeMembership(params: {
  membershipId: string;
  memberId: string;
  staffId: string;
}): Promise<ActionResult<void>> {
  const supabase = createServiceClient();

  const { data: resumed, error: resumeError } = await supabase
    .from("memberships")
    .update({ status: "Active", freeze_end: todayKolkata() })
    .eq("id", params.membershipId)
    .eq("status", "Frozen")
    .select("id");
  if (resumeError) return STATUS_SAVE_FAILED;
  if (!resumed?.length) {
    return { ok: false, error: { code: "INVALID_STATE", message: "This membership is not paused." } };
  }

  const { error: memberError } = await supabase
    .from("members")
    .update({ status: "Active" })
    .eq("id", params.memberId);
  if (memberError) {
    await supabase
      .from("memberships")
      .update({ status: "Frozen", freeze_end: null })
      .eq("id", params.membershipId);
    return STATUS_SAVE_FAILED;
  }

  await supabase.from("audit_logs").insert({
    actor_type: "Staff",
    actor_id: params.staffId,
    action: "membership.resumed",
    record_type: "membership",
    record_id: params.membershipId,
    summary: "Membership resumed.",
  });

  return { ok: true, data: undefined };
}
