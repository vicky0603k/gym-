/**
 * Memberships service — plans, lifecycle, renewal orders.
 */
import { createServiceClient } from "./supabase/server";
import { applyDiscount, discountAmount } from "@/utils/money";
import type { Plan, Membership } from "./supabase/database.types";
import type { ActionResult } from "./payments";

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

/** Pause a membership */
export async function pauseMembership(params: {
  membershipId: string;
  memberId: string;
  reason: string;
  staffId: string;
}): Promise<ActionResult<void>> {
  const supabase = createServiceClient();

  await supabase
    .from("memberships")
    .update({ status: "Frozen", updated_at: new Date().toISOString() })
    .eq("id", params.membershipId);

  await supabase
    .from("members")
    .update({ status: "Paused", updated_at: new Date().toISOString() })
    .eq("id", params.memberId);

  await supabase.from("audit_logs").insert({
    actor_type: "Staff",
    actor_id: params.staffId,
    action: "membership.paused",
    record_type: "membership",
    record_id: params.membershipId,
    summary: `Membership paused. Reason: ${params.reason}`,
  });

  return { ok: true, data: undefined };
}

/** Resume a paused membership */
export async function resumeMembership(params: {
  membershipId: string;
  memberId: string;
  staffId: string;
}): Promise<ActionResult<void>> {
  const supabase = createServiceClient();

  await supabase
    .from("memberships")
    .update({ status: "Active", updated_at: new Date().toISOString() })
    .eq("id", params.membershipId);

  await supabase
    .from("members")
    .update({ status: "Active", updated_at: new Date().toISOString() })
    .eq("id", params.memberId);

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
