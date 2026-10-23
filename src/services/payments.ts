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
import { PAYMENT_STATUS } from "@/utils/constants";
import type { Payment, PaymentRpcErrorCode } from "./supabase/database.types";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

const PAYMENT_ERROR_MESSAGES: Record<Exclude<PaymentRpcErrorCode, "VALIDATION">, string> = {
  FORBIDDEN: "Only the owner can verify or reject payments.",
  NOT_FOUND: "Payment not found.",
  ALREADY_VERIFIED: "This payment has already been verified.",
  INVALID_STATE: "This payment can no longer be changed.",
};
const RPC_FAILED = "We couldn't update this payment. Please try again.";

function rpcError(code: PaymentRpcErrorCode, validationMessage: string) {
  return {
    ok: false as const,
    error: {
      code,
      message: code === "VALIDATION" ? validationMessage : PAYMENT_ERROR_MESSAGES[code],
    },
  };
}

/**
 * Verify a pending renewal payment (Owner only — checked in the database).
 * verify_payment (migrations 005, 006) runs as one locked transaction: payment
 * Pending → Paid, renewal order Paid, expiry extended from
 * max(today Kolkata, current expiry) + plan duration, audit row.
 * Verifying an already-Paid payment returns ALREADY_VERIFIED and changes nothing.
 * A Cancelled or Pending membership returns INVALID_STATE and is never made Active.
 */
export async function verifyPayment(params: {
  paymentId: string;
  providerRef: string;
  staffId: string;
}): Promise<ActionResult<{ newExpiry: string; paymentId: string }>> {
  const { data, error } = await createServiceClient().rpc("verify_payment", {
    p_payment_id: params.paymentId,
    p_provider_ref: params.providerRef,
    p_staff_id: params.staffId,
  });
  if (error || !data) return { ok: false, error: { code: "INVALID_STATE", message: RPC_FAILED } };
  if (!data.ok) return rpcError(data.code, "Enter the UPI reference for this payment.");
  return { ok: true, data: { newExpiry: data.new_expiry, paymentId: data.payment_id } };
}

/**
 * Reject a pending renewal payment (Owner only). reject_payment marks it
 * Failed with its renewal order and an audit row; a Paid payment is never changed.
 */
export async function rejectPayment(params: {
  paymentId: string;
  staffId: string;
  reason: string;
}): Promise<ActionResult<void>> {
  const { data, error } = await createServiceClient().rpc("reject_payment", {
    p_payment_id: params.paymentId,
    p_staff_id: params.staffId,
    p_reason: params.reason,
  });
  if (error || !data) return { ok: false, error: { code: "INVALID_STATE", message: RPC_FAILED } };
  if (!data.ok) return rpcError(data.code, "Enter a reason for rejecting this payment.");
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
