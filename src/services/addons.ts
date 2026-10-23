/**
 * Add-ons service — catalogue, orders, stock and PT session guards.
 *
 * Rules:
 * - Stock can never go negative.
 * - PT sessions_used can never exceed sessions_total.
 * - Add-ons are never pre-selected; always an explicit member action.
 *
 * The guards run inside database functions (migration 010): create_addon_order
 * reserves product stock in the same transaction as the order, and
 * record_pt_session / adjust_stock put the limit in the UPDATE itself, so two
 * quick taps can never oversell, overrun or go below zero.
 */
import { z } from "zod";
import { createServiceClient } from "./supabase/server";
import { validationError } from "./memberships";
import { formatRupees } from "@/utils/money";
import type { ActionResult } from "./payments";
import type { Addon, AddonOrder } from "./supabase/database.types";

export type CatalogueItem = Addon & { trainerName: string | null; available: boolean; unavailableReason?: string };

function withAvailability(addon: Addon, trainers: { id: string; name: string; is_active: boolean }[]): CatalogueItem {
  const trainer = trainers.find((t) => t.id === addon.trainer_id) ?? null;
  const base = { ...addon, trainerName: trainer?.name ?? null };
  if (addon.type === "Product" && (addon.stock ?? 0) <= 0) {
    return { ...base, available: false, unavailableReason: "Out of stock" };
  }
  if (addon.type === "PT" && trainer && !trainer.is_active) {
    return { ...base, available: false, unavailableReason: `${trainer.name} isn't taking PT clients right now` };
  }
  return { ...base, available: true };
}

async function trainersFor(addons: Addon[]) {
  const ids = [...new Set(addons.map((a) => a.trainer_id).filter((id): id is string => Boolean(id)))];
  if (!ids.length) return [];
  const { data, error } = await createServiceClient().from("trainers").select("id, name, is_active").in("id", ids);
  if (error) throw new Error("TRAINERS_LOAD_FAILED");
  return data;
}

/** Active add-ons with live stock/trainer availability. Throws on a database error. */
export async function listAddons(): Promise<CatalogueItem[]> {
  const { data, error } = await createServiceClient()
    .from("addons")
    .select("*")
    .eq("is_active", true)
    .order("type", { ascending: true })
    .order("price", { ascending: true });
  if (error) throw new Error("ADDONS_LOAD_FAILED");
  const trainers = await trainersFor(data);
  return data.map((a) => withAvailability(a, trainers));
}

/** Every add-on including inactive ones (owner catalogue). Throws on a database error. */
export async function listAllAddons(): Promise<CatalogueItem[]> {
  const { data, error } = await createServiceClient()
    .from("addons")
    .select("*")
    .order("is_active", { ascending: false })
    .order("type", { ascending: true })
    .order("title", { ascending: true });
  if (error) throw new Error("ADDONS_LOAD_FAILED");
  const trainers = await trainersFor(data);
  return data.map((a) => withAvailability(a, trainers));
}

export async function getAddon(addonId: string): Promise<Addon | null> {
  if (!z.string().uuid().safeParse(addonId).success) return null;
  const { data, error } = await createServiceClient().from("addons").select("*").eq("id", addonId).maybeSingle();
  if (error) throw new Error("ADDON_LOAD_FAILED");
  return data;
}

const ORDER_ERRORS: Record<string, string> = {
  VALIDATION: "Choose a quantity between 1 and 10.",
  NOT_FOUND: "This add-on is no longer available.",
  FORBIDDEN: "Purchases aren't available on this account. Please speak to the front desk.",
  TRAINER_UNAVAILABLE: "This trainer isn't taking PT clients right now. Please ask the front desk.",
};

/**
 * Explicit member purchase: order + Pending payment, product stock reserved.
 * A double tap returns the same unpaid order. Nothing is active until the
 * owner verifies the payment.
 */
export async function createAddonOrder(params: {
  memberId: string;
  addonId: unknown;
  quantity: unknown;
}): Promise<ActionResult<{ paymentId: string; existing: boolean }>> {
  const parsed = z
    .object({ addonId: z.string().uuid(), quantity: z.coerce.number().int().min(1).max(10) })
    .safeParse(params);
  if (!parsed.success) return { ok: false, error: { code: "VALIDATION", message: ORDER_ERRORS.VALIDATION } };

  const { data, error } = await createServiceClient().rpc("create_addon_order", {
    p_member_id: params.memberId,
    p_addon_id: parsed.data.addonId,
    p_quantity: parsed.data.quantity,
  });
  if (error || !data) {
    return { ok: false, error: { code: "INVALID_STATE", message: "We couldn't place this order. Please try again." } };
  }
  if (!data.ok) {
    const message =
      data.code === "OUT_OF_STOCK"
        ? data.stock
          ? `Only ${data.stock} left in stock. Choose a smaller quantity.`
          : "This item is out of stock."
        : ORDER_ERRORS[data.code];
    return { ok: false, error: { code: data.code, message } };
  }
  return { ok: true, data: { paymentId: data.payment_id, existing: data.existing } };
}

export type OrderRow = AddonOrder & { title: string; type: Addon["type"]; validityDays: number; memberName: string; paidAt: string | null };

async function decorateOrders(orders: AddonOrder[]): Promise<OrderRow[]> {
  if (!orders.length) return [];
  const supabase = createServiceClient();
  const [addons, members, payments] = await Promise.all([
    supabase.from("addons").select("id, title, type, validity_days").in("id", [...new Set(orders.map((o) => o.addon_id))]),
    supabase.from("members").select("id, name").in("id", [...new Set(orders.map((o) => o.member_id))]),
    supabase.from("payments").select("id, verified_at").in("id", orders.map((o) => o.payment_id)),
  ]);
  if (addons.error || members.error || payments.error) throw new Error("ORDERS_LOAD_FAILED");
  return orders.map((o) => {
    const addon = addons.data.find((a) => a.id === o.addon_id);
    return {
      ...o,
      title: addon?.title ?? "Add-on",
      type: addon?.type ?? "Product",
      validityDays: addon?.validity_days ?? 0,
      memberName: members.data.find((m) => m.id === o.member_id)?.name ?? "Member",
      paidAt: payments.data.find((p) => p.id === o.payment_id)?.verified_at ?? null,
    };
  });
}

/** Owner view: running PT/diet orders, then the latest orders of any status. Throws on a database error. */
export async function listAddonOrders(): Promise<{ active: OrderRow[]; recent: OrderRow[] }> {
  const supabase = createServiceClient();
  const [active, recent] = await Promise.all([
    supabase.from("addon_orders").select("*").eq("status", "Active").order("created_at", { ascending: true }).limit(200),
    supabase.from("addon_orders").select("*").neq("status", "Active").order("created_at", { ascending: false }).limit(30),
  ]);
  if (active.error || recent.error) throw new Error("ORDERS_LOAD_FAILED");
  return { active: await decorateOrders(active.data), recent: await decorateOrders(recent.data) };
}

/** A member's own add-on orders, newest first. Throws on a database error. */
export async function listMemberAddonOrders(memberId: string): Promise<OrderRow[]> {
  const { data, error } = await createServiceClient()
    .from("addon_orders")
    .select("*")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error("ORDERS_LOAD_FAILED");
  return decorateOrders(data);
}

/** Record one PT session (+1), capped at the purchased total. */
export async function recordPTSession(params: {
  orderId: string;
  staffId: string;
}): Promise<ActionResult<{ sessionsUsed: number; sessionsTotal: number }>> {
  if (!z.string().uuid().safeParse(params.orderId).success) {
    return { ok: false, error: { code: "NOT_FOUND", message: "Order not found." } };
  }
  const { data, error } = await createServiceClient().rpc("record_pt_session", {
    p_order_id: params.orderId,
    p_staff_id: params.staffId,
  });
  if (error || !data) return { ok: false, error: { code: "INVALID_STATE", message: "We couldn't record the session. Please try again." } };
  if (!data.ok) {
    const message =
      data.code === "ALL_USED"
        ? `All ${data.sessions_total} sessions have already been used.`
        : data.code === "NOT_FOUND"
          ? "Order not found."
          : data.code === "FORBIDDEN"
            ? "Only gym staff can record PT sessions."
            : "This order isn't active, so sessions can't be recorded.";
    return { ok: false, error: { code: data.code, message } };
  }
  return { ok: true, data: { sessionsUsed: data.sessions_used, sessionsTotal: data.sessions_total } };
}

export const adjustStockSchema = z.object({
  addonId: z.string().uuid("This product could not be found"),
  delta: z.coerce
    .number({ invalid_type_error: "Enter how many to add or remove" })
    .int("Enter a whole number")
    .refine((n) => n !== 0, "Enter how many to add or remove")
    .refine((n) => Math.abs(n) <= 1000, "Change stock by at most 1,000 at a time"),
  reason: z.string({ required_error: "Enter a reason, e.g. New delivery" }).trim().min(3, "Enter a reason, e.g. New delivery").max(120),
});

/** Add or remove stock for a product. Never below 0; reason required; audited. */
export async function adjustStock(input: unknown, staffId: string): Promise<ActionResult<{ newStock: number }>> {
  const parsed = adjustStockSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { data, error } = await createServiceClient().rpc("adjust_stock", {
    p_addon_id: parsed.data.addonId,
    p_delta: parsed.data.delta,
    p_reason: parsed.data.reason,
    p_staff_id: staffId,
  });
  if (error || !data) return { ok: false, error: { code: "INVALID_STATE", message: "We couldn't update stock. Please try again." } };
  if (!data.ok) {
    const message =
      data.code === "NEGATIVE_STOCK"
        ? `Stock can't go below 0. Only ${data.stock ?? 0} in stock now.`
        : data.code === "NOT_FOUND"
          ? "This product could not be found."
          : data.code === "FORBIDDEN"
            ? "Only gym staff can change stock."
            : "Enter how many to add or remove and a reason.";
    return { ok: false, error: { code: data.code, message, ...(data.code === "NEGATIVE_STOCK" ? { fields: { delta: message } } : {}) } };
  }
  return { ok: true, data: { newStock: data.stock } };
}

const optionalInt = (label: string) =>
  z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.coerce.number({ invalid_type_error: `Enter ${label}` }).int(`Enter ${label} as a whole number`).nullable()
  );

export const addonSchema = z
  .object({
    type: z.enum(["PT", "Diet", "Product"], { errorMap: () => ({ message: "Choose a type" }) }),
    title: z.string().trim().min(3, "Enter a name").max(80, "Keep the name under 80 characters"),
    description: z.string().trim().max(600, "Keep the description under 600 characters").optional().transform((v) => v || null),
    price: z.coerce.number({ invalid_type_error: "Enter the price in rupees" }).int("Enter the price in whole rupees").min(1, "Enter a price").max(1000000),
    validityDays: z.coerce.number({ invalid_type_error: "Enter validity in days" }).int().min(1, "Validity must be at least 1 day").max(730),
    sessions: optionalInt("the number of sessions"),
    stock: optionalInt("the stock count"),
    trainerId: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.string().uuid("Choose a trainer").nullable()),
    isActive: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  })
  .superRefine((v, ctx) => {
    if (v.type === "PT" && (v.sessions === null || v.sessions < 1 || v.sessions > 200)) {
      ctx.addIssue({ code: "custom", path: ["sessions"], message: "Enter between 1 and 200 sessions" });
    }
    if (v.type === "Product" && (v.stock === null || v.stock < 0)) {
      ctx.addIssue({ code: "custom", path: ["stock"], message: "Enter the stock count (0 or more)" });
    }
  });

function addonRow(a: z.infer<typeof addonSchema>) {
  return {
    type: a.type,
    title: a.title,
    description: a.description,
    price: a.price,
    validity_days: a.validityDays,
    sessions: a.type === "PT" ? a.sessions : null,
    stock: a.type === "Product" ? a.stock : null,
    trainer_id: a.type === "PT" ? a.trainerId : null,
    is_active: a.isActive,
  };
}

const ADDON_SAVE_FAILED = {
  ok: false as const,
  error: { code: "INVALID_STATE", message: "We couldn't save this add-on. Please try again." },
};

export async function createAddon(input: unknown, staffId: string): Promise<ActionResult<{ addonId: string }>> {
  const parsed = addonSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const supabase = createServiceClient();
  const { data, error } = await supabase.from("addons").insert(addonRow(parsed.data)).select("id").single();
  if (error || !data) return ADDON_SAVE_FAILED;
  await supabase.from("audit_logs").insert({
    actor_type: "Staff",
    actor_id: staffId,
    action: "addon.created",
    record_type: "addon",
    record_id: data.id,
    summary: `Add-on created: ${parsed.data.title}, ${formatRupees(parsed.data.price)}.`,
  });
  return { ok: true, data: { addonId: data.id } };
}

/**
 * Edit an add-on. Stock is not edited here (use adjustStock, which is audited
 * and guarded); existing orders keep the amount they were placed at.
 */
export async function updateAddon(addonId: string, input: unknown, staffId: string): Promise<ActionResult<void>> {
  const parsed = addonSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const before = await getAddon(addonId).catch(() => null);
  if (!before) return { ok: false, error: { code: "NOT_FOUND", message: "This add-on no longer exists." } };
  if (before.type !== parsed.data.type) {
    const message = "The type of an existing add-on can't change. Create a new add-on instead.";
    return { ok: false, error: { code: "VALIDATION", message, fields: { type: message } } };
  }

  const { stock: _stock, ...row } = addonRow(parsed.data);
  void _stock;
  const supabase = createServiceClient();
  const { error } = await supabase.from("addons").update(row).eq("id", addonId);
  if (error) return ADDON_SAVE_FAILED;
  await supabase.from("audit_logs").insert({
    actor_type: "Staff",
    actor_id: staffId,
    action: "addon.updated",
    record_type: "addon",
    record_id: addonId,
    summary:
      `Add-on updated: ${parsed.data.title}, ${formatRupees(parsed.data.price)}, ${parsed.data.isActive ? "active" : "inactive"}.` +
      (before.price !== parsed.data.price ? ` Price was ${formatRupees(before.price)}.` : ""),
  });
  return { ok: true, data: undefined };
}
