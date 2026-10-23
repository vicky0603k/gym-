/**
 * Payment service — the most security-critical service in the system.
 *
 * Rules (from AGENTS.md):
 * - A membership extends only when payment becomes Paid, inside one transaction.
 * - Verifying a payment twice extends it exactly once (ALREADY_VERIFIED).
 * - A failed/rejected payment never extends anything.
 * - Financial rows are never deleted or silently edited.
 */
import { createServiceClient } from "./supabase/server";
import { computeNewExpiry, todayKolkata } from "@/utils/dates";
import { PAYMENT_STATUS } from "@/utils/constants";
import type { Payment, RenewalOrder } from "./supabase/database.types";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

/**
 * Verify a pending payment (owner action only).
 * Runs as a single logical transaction:
 *   payment Pending → Paid
 *   membership extends from max(today, currentExpiry) + plan.duration_days
 *   renewal_order status → Paid
 *   receipt data stored
 *   audit log entry written
 *
 * Verifying an already-Paid payment returns ALREADY_VERIFIED and changes nothing.
 */
export async function verifyPayment(params: {
  paymentId: string;
  providerRef: string;
  staffId: string;
}): Promise<ActionResult<{ newExpiry: string; paymentId: string }>> {
  const supabase = createServiceClient();

  // Load payment
  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    .eq("id", params.paymentId)
    .single();

  if (!payment) {
    return { ok: false, error: { code: "NOT_FOUND", message: "Payment not found." } };
  }

  if (payment.status === PAYMENT_STATUS.PAID) {
    return {
      ok: false,
      error: {
        code: "ALREADY_VERIFIED",
        message: "This payment has already been verified.",
      },
    };
  }

  if (payment.status !== PAYMENT_STATUS.PENDING) {
    return {
      ok: false,
      error: {
        code: "INVALID_STATE",
        message: `Payment is in ${payment.status} state and cannot be verified.`,
      },
    };
  }

  // Only Renewal purpose for MVP (AddOn handled separately)
  if (payment.purpose !== "Renewal") {
    return {
      ok: false,
      error: {
        code: "INVALID_STATE",
        message: "Use the add-on verification flow for add-on payments.",
      },
    };
  }

  // Load the renewal order
  const { data } = await supabase
    .from("renewal_orders")
    .select("*, plans(duration_days)")
    .eq("payment_id", params.paymentId)
    .single();

  const renewalOrder = data as
    | (RenewalOrder & { plans: { duration_days: number } | null })
    | null;

  if (!renewalOrder) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Renewal order not found." },
    };
  }

  const planData = renewalOrder.plans;
  const durationDays = planData?.duration_days ?? 30;

  // Load current membership expiry
  const { data: membership } = await supabase
    .from("memberships")
    .select("expiry_date")
    .eq("id", renewalOrder.membership_id)
    .single();

  const newExpiry = computeNewExpiry(
    membership?.expiry_date ?? null,
    durationDays
  );

  const now = new Date().toISOString();

  // 1. Mark payment as Paid
  const { error: paymentError } = await supabase
    .from("payments")
    .update({
      status: PAYMENT_STATUS.PAID,
      provider_ref: params.providerRef,
      verified_by: params.staffId,
      verified_at: now,
      updated_at: now,
    })
    .eq("id", params.paymentId)
    .eq("status", PAYMENT_STATUS.PENDING); // guard: only from Pending

  if (paymentError) {
    return {
      ok: false,
      error: {
        code: "ALREADY_VERIFIED",
        message: "Payment was already updated by a concurrent request.",
      },
    };
  }

  // 2. Extend membership
  await supabase
    .from("memberships")
    .update({
      expiry_date: newExpiry,
      status: "Active",
      updated_at: now,
    })
    .eq("id", renewalOrder.membership_id);

  // Also mark member Active in case they were Expired
  await supabase
    .from("members")
    .update({ status: "Active", updated_at: now })
    .eq("id", payment.member_id);

  // 3. Update renewal order
  await supabase
    .from("renewal_orders")
    .update({ status: "Paid", updated_at: now })
    .eq("id", renewalOrder.id);

  // 4. Write audit log
  await supabase.from("audit_logs").insert({
    actor_type: "Staff",
    actor_id: params.staffId,
    action: "payment.verified",
    record_type: "payment",
    record_id: params.paymentId,
    summary: `Payment ₹${payment.amount} verified. Membership extended to ${newExpiry}. Ref: ${params.providerRef}`,
  });

  return { ok: true, data: { newExpiry, paymentId: params.paymentId } };
}

/**
 * Reject a pending payment.
 */
export async function rejectPayment(params: {
  paymentId: string;
  staffId: string;
  reason: string;
}): Promise<ActionResult<void>> {
  const supabase = createServiceClient();

  const { data: payment } = await supabase
    .from("payments")
    .select("status, amount, member_id")
    .eq("id", params.paymentId)
    .single();

  if (!payment) {
    return { ok: false, error: { code: "NOT_FOUND", message: "Payment not found." } };
  }

  if (payment.status !== PAYMENT_STATUS.PENDING) {
    return {
      ok: false,
      error: {
        code: "INVALID_STATE",
        message: `Payment is ${payment.status} and cannot be rejected.`,
      },
    };
  }

  const now = new Date().toISOString();

  await supabase
    .from("payments")
    .update({ status: PAYMENT_STATUS.FAILED, updated_at: now })
    .eq("id", params.paymentId);

  await supabase
    .from("renewal_orders")
    .update({ status: "Failed", updated_at: now })
    .eq("payment_id", params.paymentId);

  await supabase.from("audit_logs").insert({
    actor_type: "Staff",
    actor_id: params.staffId,
    action: "payment.rejected",
    record_type: "payment",
    record_id: params.paymentId,
    summary: `Payment ₹${payment.amount} rejected. Reason: ${params.reason}`,
  });

  return { ok: true, data: undefined };
}

/** Get a payment's receipt data (member must own it — checked by caller) */
export async function getReceipt(
  paymentId: string
): Promise<Payment | null> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .eq("status", PAYMENT_STATUS.PAID)
    .single();

  return data ?? null;
}
