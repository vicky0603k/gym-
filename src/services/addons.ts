/**
 * Add-ons service — catalogue, orders, stock and PT session guards.
 *
 * Rules:
 * - Stock can never go negative.
 * - PT sessions_used can never exceed sessions_total.
 * - Add-ons are never pre-selected; always an explicit member action.
 */
import { createServiceClient } from "./supabase/server";
import type { Addon, AddonOrder } from "./supabase/database.types";
import type { ActionResult } from "./payments";

/** List active add-ons with live stock/availability */
export async function listAddons(): Promise<
  (Addon & { available: boolean; unavailableReason?: string })[]
> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("addons")
    .select("*, trainers(id, name, is_active)")
    .eq("is_active", true)
    .order("type", { ascending: true });

  type AddonWithTrainer = Addon & {
    trainers: { id: string; name: string; is_active: boolean } | null;
  };
  const addons = data as AddonWithTrainer[] | null;

  return (addons ?? []).map((addon) => {
    const trainer = addon.trainers;

    if (addon.type === "Product" && addon.stock !== null && addon.stock <= 0) {
      return { ...addon, available: false, unavailableReason: "Out of stock" };
    }

    if (addon.type === "PT" && trainer && !trainer.is_active) {
      return {
        ...addon,
        available: false,
        unavailableReason: `Trainer ${trainer.name} is currently unavailable`,
      };
    }

    return { ...addon, available: true };
  });
}

/** Create an add-on order with stock/trainer check */
export async function createAddonOrder(params: {
  memberId: string;
  addonId: string;
  quantity: number;
}): Promise<
  ActionResult<{
    orderId: string;
    paymentId: string;
    finalAmount: number;
  }>
> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("addons")
    .select("*, trainers(id, name, is_active)")
    .eq("id", params.addonId)
    .eq("is_active", true)
    .single();

  type AddonWithTrainer = Addon & {
    trainers: { id: string; name: string; is_active: boolean } | null;
  };
  const addon = data as AddonWithTrainer | null;

  if (!addon) {
    return { ok: false, error: { code: "NOT_FOUND", message: "Add-on not found." } };
  }

  // Stock check
  if (
    addon.type === "Product" &&
    addon.stock !== null &&
    addon.stock < params.quantity
  ) {
    return {
      ok: false,
      error: {
        code: "OUT_OF_STOCK",
        message: `Only ${addon.stock} item(s) left in stock.`,
      },
    };
  }

  // Trainer availability check
  const trainer = addon.trainers;
  if (addon.type === "PT" && trainer && !trainer.is_active) {
    return {
      ok: false,
      error: {
        code: "TRAINER_UNAVAILABLE",
        message: `Trainer ${trainer.name} is currently unavailable.`,
      },
    };
  }

  const totalAmount = addon.price * params.quantity;

  // Create payment
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      member_id: params.memberId,
      purpose: "AddOn",
      ref_id: addon.id, // temp; updated after order created
      amount: totalAmount,
      status: "Pending",
    })
    .select()
    .single();

  if (paymentError || !payment) {
    return { ok: false, error: { code: "INVALID_STATE", message: "Failed to create payment." } };
  }

  // Create add-on order
  const { data: order, error: orderError } = await supabase
    .from("addon_orders")
    .insert({
      member_id: params.memberId,
      addon_id: params.addonId,
      trainer_id: trainer?.id ?? null,
      quantity: params.quantity,
      amount: totalAmount,
      payment_id: payment.id,
      sessions_total: addon.type === "PT" ? (addon.sessions ?? 1) * params.quantity : null,
      sessions_used: addon.type === "PT" ? 0 : null,
      status: "Pending",
    })
    .select()
    .single();

  if (orderError || !order) {
    await supabase.from("payments").delete().eq("id", payment.id);
    return { ok: false, error: { code: "INVALID_STATE", message: "Failed to create order." } };
  }

  await supabase
    .from("payments")
    .update({ ref_id: order.id, updated_at: new Date().toISOString() })
    .eq("id", payment.id);

  return {
    ok: true,
    data: { orderId: order.id, paymentId: payment.id, finalAmount: totalAmount },
  };
}

/** Record a PT session. Capped at sessions_total. */
export async function recordPTSession(params: {
  orderId: string;
  staffId: string;
}): Promise<ActionResult<{ sessionsUsed: number; sessionsTotal: number }>> {
  const supabase = createServiceClient();

  const { data: order } = await supabase
    .from("addon_orders")
    .select("id, sessions_used, sessions_total, status")
    .eq("id", params.orderId)
    .single();

  if (!order) {
    return { ok: false, error: { code: "NOT_FOUND", message: "Order not found." } };
  }

  if (order.sessions_used === null || order.sessions_total === null) {
    return {
      ok: false,
      error: { code: "INVALID_STATE", message: "This order does not track sessions." },
    };
  }

  if (order.sessions_used >= order.sessions_total) {
    return {
      ok: false,
      error: {
        code: "INVALID_STATE",
        message: `All ${order.sessions_total} sessions have been used.`,
      },
    };
  }

  const newUsed = order.sessions_used + 1;

  await supabase
    .from("addon_orders")
    .update({
      sessions_used: newUsed,
      status: newUsed >= order.sessions_total ? "Completed" : "Active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.orderId);

  await supabase.from("audit_logs").insert({
    actor_type: "Staff",
    actor_id: params.staffId,
    action: "addon.pt_session",
    record_type: "addon_orders",
    record_id: params.orderId,
    summary: `PT session recorded. ${newUsed}/${order.sessions_total} used.`,
  });

  return {
    ok: true,
    data: { sessionsUsed: newUsed, sessionsTotal: order.sessions_total },
  };
}

/** Adjust stock for a product add-on (never below 0) */
export async function adjustStock(params: {
  addonId: string;
  delta: number; // positive = add stock, negative = remove
  staffId: string;
}): Promise<ActionResult<{ newStock: number }>> {
  const supabase = createServiceClient();

  const { data: addon } = await supabase
    .from("addons")
    .select("id, stock, title")
    .eq("id", params.addonId)
    .single();

  if (!addon || addon.stock === null) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Add-on not found or not a product." },
    };
  }

  const newStock = addon.stock + params.delta;
  if (newStock < 0) {
    return {
      ok: false,
      error: {
        code: "INVALID_STATE",
        message: `Cannot reduce stock below 0. Current stock: ${addon.stock}.`,
      },
    };
  }

  await supabase
    .from("addons")
    .update({ stock: newStock, updated_at: new Date().toISOString() })
    .eq("id", params.addonId);

  await supabase.from("audit_logs").insert({
    actor_type: "Staff",
    actor_id: params.staffId,
    action: "addon.stock_adjusted",
    record_type: "addons",
    record_id: params.addonId,
    summary: `Stock adjusted by ${params.delta}. New stock: ${newStock}. Add-on: ${addon.title}`,
  });

  return { ok: true, data: { newStock } };
}
