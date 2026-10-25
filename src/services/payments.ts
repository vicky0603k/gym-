/**
 * Payment service — the most security-critical service in the system.
 *
 * Rules (from AGENTS.md):
 * - A membership extends only when payment becomes Paid, inside one transaction.
 * - Verifying a payment twice extends it exactly once (ALREADY_VERIFIED).
 * - A failed/rejected payment never extends anything.
 * - Financial rows are never deleted or silently edited.
 */
import { z } from "zod";
import { createServiceClient } from "./supabase/server";
import { validationError } from "./memberships";
import { PAYMENT_STATUS } from "@/utils/constants";
import type { AddonOrder, AddonType, Payment, PaymentRpcErrorCode, RenewalOrder } from "./supabase/database.types";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; fields?: Record<string, string> } };

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
 * verify_payment (migrations 005, 006, 009) runs as one locked transaction: payment
 * Pending → Paid, renewal order Paid (with new_expiry), membership on the paid plan, expiry extended from
 * max(today Kolkata, current expiry) + plan duration, audit row.
 * Verifying an already-Paid payment returns ALREADY_VERIFIED and changes nothing.
 * A Cancelled or Pending membership returns INVALID_STATE and is never made Active.
 */
export async function verifyPayment(params: {
  paymentId: string;
  providerRef: string;
  staffId: string;
}): Promise<ActionResult<{ newExpiry: string | null; paymentId: string }>> {
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

export interface PaymentDetail {
  id: string;
  purpose: Payment["purpose"];
  memberId: string;
  memberName: string;
  memberPhone: string;
  amount: number;
  baseAmount: number;
  discount: number;
  status: Payment["status"];
  providerRef: string | null;
  method: Payment["method"];
  createdAt: string;
  verifiedAt: string | null;
  planName: string; // the plan renewed, or the add-on bought
  durationDays: number; // plan duration or add-on validity
  newExpiry: string | null; // renewals only
  orderStatus: RenewalOrder["status"] | AddonOrder["status"];
  quantity: number;
  addonType: AddonType | null;
}

/** Receipt number shown to people: short, stable, derived from the payment id. */
export function receiptNumber(paymentId: string): string {
  return `RCPT-${paymentId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

const NONE = Promise.resolve({ data: [] as never[], error: null });

async function withOrders(payments: Payment[]): Promise<PaymentDetail[]> {
  if (!payments.length) return [];
  const supabase = createServiceClient();
  const ids = (purpose: Payment["purpose"]) => payments.filter((p) => p.purpose === purpose).map((p) => p.id);
  const renewalIds = ids("Renewal");
  const addonIds = ids("AddOn");

  const [renewalOrders, addonOrders, members] = await Promise.all([
    renewalIds.length ? supabase.from("renewal_orders").select("*").in("payment_id", renewalIds) : NONE,
    addonIds.length ? supabase.from("addon_orders").select("*").in("payment_id", addonIds) : NONE,
    supabase.from("members").select("id, name, phone").in("id", [...new Set(payments.map((p) => p.member_id))]),
  ]);
  if (renewalOrders.error || addonOrders.error || members.error) throw new Error("PAYMENTS_LOAD_FAILED");

  const planIds = [...new Set(renewalOrders.data.map((o) => o.plan_id))];
  const addonItemIds = [...new Set(addonOrders.data.map((o) => o.addon_id))];
  const [plans, addons] = await Promise.all([
    planIds.length ? supabase.from("plans").select("id, name, duration_days").in("id", planIds) : NONE,
    addonItemIds.length ? supabase.from("addons").select("id, title, type, validity_days").in("id", addonItemIds) : NONE,
  ]);
  if (plans.error || addons.error) throw new Error("PAYMENTS_LOAD_FAILED");

  return payments.flatMap((p): PaymentDetail[] => {
    const member = members.data.find((m) => m.id === p.member_id);
    if (!member) return [];
    const base = {
      id: p.id,
      purpose: p.purpose,
      memberId: member.id,
      memberName: member.name,
      memberPhone: member.phone,
      amount: p.amount,
      status: p.status,
      providerRef: p.provider_ref,
      method: p.method ?? "UPI",
      createdAt: p.created_at,
      verifiedAt: p.verified_at,
    };
    if (p.purpose === "AddOn") {
      const order = addonOrders.data.find((o) => o.payment_id === p.id);
      const addon = addons.data.find((x) => x.id === order?.addon_id);
      if (!order) return [];
      return [{
        ...base,
        baseAmount: order.amount,
        discount: 0,
        planName: addon?.title ?? "Add-on",
        durationDays: addon?.validity_days ?? 0,
        newExpiry: null,
        orderStatus: order.status,
        quantity: order.quantity,
        addonType: addon?.type ?? null,
      }];
    }
    const order = renewalOrders.data.find((o) => o.payment_id === p.id);
    const plan = plans.data.find((x) => x.id === order?.plan_id);
    if (!order) return [];
    return [{
      ...base,
      baseAmount: order.amount,
      discount: order.discount,
      planName: plan?.name ?? "Membership",
      durationDays: plan?.duration_days ?? 0,
      newExpiry: order.new_expiry,
      orderStatus: order.status,
      quantity: 1,
      addonType: null,
    }];
  });
}

/**
 * The owner's verification queue: Pending renewal and add-on payments. Those where the
 * member has sent a UPI reference come first, then oldest first. Throws on a database error.
 */
export async function listPendingPayments(): Promise<PaymentDetail[]> {
  const { data, error } = await createServiceClient()
    .from("payments")
    .select("*")
    .eq("status", PAYMENT_STATUS.PENDING)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw new Error("PAYMENTS_LOAD_FAILED");
  const rows = await withOrders(data);
  return [...rows.filter((r) => r.providerRef), ...rows.filter((r) => !r.providerRef)];
}

/**
 * One payment (renewal or add-on) with its order. Pass memberId to scope it to
 * that member (member screens) — another member's payment returns null.
 */
export async function getPaymentDetail(paymentId: string, memberId?: string): Promise<PaymentDetail | null> {
  if (!z.string().uuid().safeParse(paymentId).success) return null;
  let query = createServiceClient().from("payments").select("*").eq("id", paymentId);
  if (memberId) query = query.eq("member_id", memberId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error("PAYMENT_LOAD_FAILED");
  if (!data) return null;
  return (await withOrders([data]))[0] ?? null;
}

/** A member's payments (optionally one purpose), newest first. Throws on a database error. */
export async function listMemberPayments(memberId: string, purpose?: Payment["purpose"]): Promise<PaymentDetail[]> {
  let query = createServiceClient().from("payments").select("*").eq("member_id", memberId);
  if (purpose) query = query.eq("purpose", purpose);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error("PAYMENTS_LOAD_FAILED");
  return withOrders(data);
}

export const claimPaymentSchema = z.object({
  paymentId: z.string().uuid("This payment could not be found"),
  reference: z
    .string({ required_error: "Enter the UPI reference number from your payment app" })
    .trim()
    .regex(/^[A-Za-z0-9]{6,30}$/, "Enter the UPI reference number (UTR) exactly as your payment app shows it"),
});

const CLAIM_ERRORS: Record<string, string> = {
  VALIDATION: "Enter the UPI reference number (UTR) exactly as your payment app shows it",
  NOT_FOUND: "This payment could not be found.",
  INVALID_STATE: "This payment has already been checked by the gym.",
};

/** The member records their UPI reference. Status stays Pending — only the owner can verify. */
export async function claimRenewalPayment(memberId: string, input: unknown): Promise<ActionResult<void>> {
  const parsed = claimPaymentSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { data, error } = await createServiceClient().rpc("claim_renewal_payment", {
    p_payment_id: parsed.data.paymentId,
    p_member_id: memberId,
    p_reference: parsed.data.reference,
  });
  if (error || !data) return { ok: false, error: { code: "INVALID_STATE", message: "We couldn't save your reference. Please try again." } };
  if (!data.ok) return { ok: false, error: { code: data.code, message: CLAIM_ERRORS[data.code] } };
  return { ok: true, data: undefined };
}

export const verifyInputSchema = z.object({
  paymentId: z.string().uuid("This payment could not be found"),
  providerRef: z
    .string({ required_error: "Enter the UPI reference you see in your bank app" })
    .trim()
    .min(4, "Enter the UPI reference you see in your bank app")
    .max(40, "Keep the reference under 40 characters"),
});

export const rejectInputSchema = z.object({
  paymentId: z.string().uuid("This payment could not be found"),
  reason: z
    .string({ required_error: "Enter why this payment is being rejected" })
    .trim()
    .min(3, "Enter why this payment is being rejected")
    .max(200, "Keep the reason under 200 characters"),
});

const CANCEL_ERRORS: Record<string, string> = {
  NOT_FOUND: "This payment could not be found.",
  INVALID_STATE: "This order can't be cancelled now. If you have already paid, wait for the gym to confirm it.",
};

/** The member drops an unpaid order (before sending a reference). Reserved stock is returned. */
export async function cancelPayment(memberId: string, paymentId: unknown): Promise<ActionResult<void>> {
  if (!z.string().uuid().safeParse(paymentId).success) {
    return { ok: false, error: { code: "NOT_FOUND", message: CANCEL_ERRORS.NOT_FOUND } };
  }
  const { data, error } = await createServiceClient().rpc("cancel_payment", {
    p_payment_id: paymentId as string,
    p_member_id: memberId,
  });
  if (error || !data) return { ok: false, error: { code: "INVALID_STATE", message: "We couldn't cancel this order. Please try again." } };
  if (!data.ok) return { ok: false, error: { code: data.code, message: CANCEL_ERRORS[data.code] } };
  return { ok: true, data: undefined };
}

export const deskRenewalSchema = z
  .object({
    planId: z.string().uuid("Choose a plan"),
    method: z.enum(["UPI", "Cash"], { errorMap: () => ({ message: "Choose how the member paid" }) }),
    reference: z.string().trim().optional(),
  })
  .refine((v) => v.method === "Cash" || /^[A-Za-z0-9]{6,30}$/.test(v.reference ?? ""), {
    path: ["reference"],
    message: "Enter the UPI reference (UTR) from the payment screen",
  });

const DESK_ERRORS: Record<string, string> = {
  FORBIDDEN: "This member can't be renewed — they are cancelled or blocked.",
  VALIDATION: "Check the plan, payment method and reference.",
  DUPLICATE_REFERENCE: "This UPI reference is already used on another payment.",
  NOT_FOUND: "This member no longer exists.",
  PLAN_UNAVAILABLE: "This plan is no longer offered. Choose another plan.",
  PAYMENT_CLAIMED: "The member already sent a UPI reference for a renewal. Verify or reject that one in Renewals first.",
};

/**
 * Front desk records a renewal paid at the counter (A1). Creates the order and a
 * Pending payment with its method and reference in one transaction
 * (create_desk_renewal(), migration 012). Nothing is extended here: only
 * verify_payment() does that, and only the owner can call it.
 */
export async function createDeskRenewal(
  memberId: string,
  input: unknown,
  staffId: string
): Promise<ActionResult<{ paymentId: string; reference: string; amount: number }>> {
  const parsed = deskRenewalSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { planId, method, reference } = parsed.data;

  const { data, error } = await createServiceClient().rpc("create_desk_renewal", {
    p_member_id: memberId,
    p_plan_id: planId,
    p_method: method,
    p_reference: method === "UPI" ? reference ?? null : null,
    p_staff_id: staffId,
  });
  if (error || !data) return { ok: false, error: { code: "INVALID_STATE", message: RPC_FAILED } };
  if (!data.ok) {
    const fields = data.code === "DUPLICATE_REFERENCE" ? { reference: DESK_ERRORS.DUPLICATE_REFERENCE } : undefined;
    return { ok: false, error: { code: data.code, message: DESK_ERRORS[data.code], fields } };
  }
  return { ok: true, data: { paymentId: data.payment_id, reference: data.reference, amount: data.amount } };
}

export const refundInputSchema = z.object({
  paymentId: z.string().uuid("This payment could not be found"),
  reason: z
    .string({ required_error: "Enter why this payment is being refunded" })
    .trim()
    .min(3, "Enter why this payment is being refunded")
    .max(200, "Keep the reason under 200 characters"),
  // Checkbox: present = take the membership days back.
  reverse: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

const REFUND_ERRORS: Record<string, string> = {
  FORBIDDEN: "Only the owner can refund payments.",
  VALIDATION: "Enter why this payment is being refunded.",
  NOT_FOUND: "Payment not found.",
  ALREADY_REFUNDED: "This payment has already been refunded.",
  INVALID_STATE: "Only a paid payment can be refunded.",
};

/**
 * Owner refunds a Paid payment (A4). The row becomes Refunded (never deleted);
 * the owner chooses whether the membership days it bought are taken back.
 * One transaction with its audit row (refund_payment(), migration 012).
 */
export async function refundPayment(input: unknown, staffId: string): Promise<ActionResult<{ newExpiry: string | null }>> {
  const parsed = refundInputSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { data, error } = await createServiceClient().rpc("refund_payment", {
    p_payment_id: parsed.data.paymentId,
    p_staff_id: staffId,
    p_reason: parsed.data.reason,
    p_reverse: parsed.data.reverse,
  });
  if (error || !data) return { ok: false, error: { code: "INVALID_STATE", message: RPC_FAILED } };
  if (!data.ok) return { ok: false, error: { code: data.code, message: REFUND_ERRORS[data.code] } };
  return { ok: true, data: { newExpiry: data.new_expiry } };
}
