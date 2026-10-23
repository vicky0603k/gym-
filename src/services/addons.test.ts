// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./supabase/server", () => ({
  createServerClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from "./supabase/server";
import { addonSchema, adjustStock, createAddonOrder, recordPTSession } from "./addons";
import { cancelPayment } from "./payments";

const ADDON_ID = "d0000000-0000-4000-8000-000000000003";
const ORDER_ID = "d1000000-0000-4000-8000-000000000001";
const PAYMENT_ID = "f0000000-0000-4000-8000-000000000009";
const rpc = vi.fn();

beforeEach(() => {
  rpc.mockReset();
  vi.mocked(createServiceClient).mockReset().mockReturnValue({ rpc } as never);
});

describe("createAddonOrder", () => {
  it.each([0, 11, "two", 1.5])("rejects quantity %j before any database call", async (quantity) => {
    const result = await createAddonOrder({ memberId: "m1", addonId: ADDON_ID, quantity });
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("an out-of-stock add-on cannot be purchased", async () => {
    rpc.mockResolvedValue({ data: { ok: false, code: "OUT_OF_STOCK", stock: 0 }, error: null });
    const result = await createAddonOrder({ memberId: "m1", addonId: ADDON_ID, quantity: 1 });
    expect(rpc).toHaveBeenCalledWith("create_addon_order", { p_member_id: "m1", p_addon_id: ADDON_ID, p_quantity: 1 });
    expect(result).toEqual({ ok: false, error: { code: "OUT_OF_STOCK", message: "This item is out of stock." } });
  });

  it("tells the member how many are left when they ask for too many", async () => {
    rpc.mockResolvedValue({ data: { ok: false, code: "OUT_OF_STOCK", stock: 2 }, error: null });
    const result = await createAddonOrder({ memberId: "m1", addonId: ADDON_ID, quantity: 3 });
    expect(result).toMatchObject({ ok: false, error: { message: "Only 2 left in stock. Choose a smaller quantity." } });
  });

  it("explains an unavailable trainer", async () => {
    rpc.mockResolvedValue({ data: { ok: false, code: "TRAINER_UNAVAILABLE" }, error: null });
    const result = await createAddonOrder({ memberId: "m1", addonId: ADDON_ID, quantity: 1 });
    expect(result).toMatchObject({ ok: false, error: { code: "TRAINER_UNAVAILABLE" } });
  });

  it("returns the Pending payment to pay", async () => {
    rpc.mockResolvedValue({ data: { ok: true, existing: false, payment_id: PAYMENT_ID }, error: null });
    await expect(createAddonOrder({ memberId: "m1", addonId: ADDON_ID, quantity: "2" })).resolves.toEqual({
      ok: true,
      data: { paymentId: PAYMENT_ID, existing: false },
    });
  });
});

describe("recordPTSession", () => {
  it("refuses a session past the purchased total", async () => {
    rpc.mockResolvedValue({ data: { ok: false, code: "ALL_USED", sessions_total: 12 }, error: null });
    const result = await recordPTSession({ orderId: ORDER_ID, staffId: "s1" });
    expect(result).toEqual({ ok: false, error: { code: "ALL_USED", message: "All 12 sessions have already been used." } });
  });

  it("returns the new count", async () => {
    rpc.mockResolvedValue({ data: { ok: true, sessions_used: 5, sessions_total: 12 }, error: null });
    await expect(recordPTSession({ orderId: ORDER_ID, staffId: "s1" })).resolves.toEqual({
      ok: true,
      data: { sessionsUsed: 5, sessionsTotal: 12 },
    });
  });
});

describe("adjustStock", () => {
  it.each([
    [{ addonId: ADDON_ID, delta: "0", reason: "Count" }, "delta"],
    [{ addonId: ADDON_ID, delta: "5", reason: "" }, "reason"],
    [{ addonId: ADDON_ID, delta: "2001", reason: "Count" }, "delta"],
  ])("rejects %o before any database call", async (input, field) => {
    const result = await adjustStock(input, "s1");
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION", fields: { [field]: expect.any(String) } } });
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("never lets stock go below zero", async () => {
    rpc.mockResolvedValue({ data: { ok: false, code: "NEGATIVE_STOCK", stock: 3 }, error: null });
    const result = await adjustStock({ addonId: ADDON_ID, delta: "-5", reason: "Damaged" }, "s1");
    expect(result).toMatchObject({ ok: false, error: { fields: { delta: "Stock can't go below 0. Only 3 in stock now." } } });
  });
});

describe("addonSchema", () => {
  const base = { title: "Whey Protein 1 kg", description: "", price: "2499", validityDays: "365", trainerId: "", isActive: "on" };

  it("needs sessions for PT and stock for products", () => {
    const pt = addonSchema.safeParse({ ...base, type: "PT", sessions: "", stock: "" });
    const product = addonSchema.safeParse({ ...base, type: "Product", sessions: "", stock: "" });
    expect(pt.success || pt.error.issues.map((i) => i.path[0])).toEqual(["sessions"]);
    expect(product.success || product.error.issues.map((i) => i.path[0])).toEqual(["stock"]);
  });

  it("accepts a product with stock and reads an unticked active box as off", () => {
    const parsed = addonSchema.parse({ ...base, type: "Product", sessions: "", stock: "12", isActive: undefined });
    expect(parsed).toMatchObject({ stock: 12, sessions: null, isActive: false, description: null });
  });
});

describe("cancelPayment", () => {
  it("refuses a payment the member already said they paid", async () => {
    rpc.mockResolvedValue({ data: { ok: false, code: "INVALID_STATE" }, error: null });
    const result = await cancelPayment("m1", PAYMENT_ID);
    expect(rpc).toHaveBeenCalledWith("cancel_payment", { p_payment_id: PAYMENT_ID, p_member_id: "m1" });
    expect(result).toMatchObject({ ok: false, error: { code: "INVALID_STATE" } });
  });
});

describe("live database (pending)", () => {
  it.todo("two members buying the last item at once: exactly one order succeeds");
  it.todo("rejecting or cancelling an unpaid product order returns its stock");
  it.todo("verifying a PT payment makes the order Active; +1 stops at sessions_total");
  it.todo("stock adjustments write an audit row and never go below 0");
});
