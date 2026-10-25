// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./supabase/server", () => ({
  createServerClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from "./supabase/server";
import { verifyPayment, rejectPayment } from "./payments";
import { paymentLabel } from "./payment-labels";

const rpc = vi.fn();
beforeEach(() => {
  rpc.mockReset();
  vi.mocked(createServiceClient).mockReturnValue({ rpc } as never);
});

const verifyInput = { paymentId: "p1", providerRef: "UPI123", staffId: "s1" };

describe("verifyPayment", () => {
  it("calls verify_payment once and returns the new expiry", async () => {
    rpc.mockResolvedValue({ data: { ok: true, new_expiry: "2027-02-14", payment_id: "p1" }, error: null });

    const result = await verifyPayment(verifyInput);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("verify_payment", {
      p_payment_id: "p1",
      p_provider_ref: "UPI123",
      p_staff_id: "s1",
    });
    expect(result).toEqual({ ok: true, data: { newExpiry: "2027-02-14", paymentId: "p1" } });
  });

  it("passes ALREADY_VERIFIED through without any other database call", async () => {
    rpc.mockResolvedValue({ data: { ok: false, code: "ALREADY_VERIFIED" }, error: null });

    const result = await verifyPayment(verifyInput);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ ok: false, error: { code: "ALREADY_VERIFIED" } });
  });

  it.each(["FORBIDDEN", "NOT_FOUND", "INVALID_STATE"])("maps %s to a plain-language error", async (code) => {
    rpc.mockResolvedValue({ data: { ok: false, code }, error: null });

    const result = await verifyPayment(verifyInput);

    expect(result).toMatchObject({ ok: false, error: { code } });
    if (!result.ok) expect(result.error.message).not.toMatch(/sql|postgres|rpc/i);
  });

  it("asks for the UPI reference on VALIDATION", async () => {
    rpc.mockResolvedValue({ data: { ok: false, code: "VALIDATION" }, error: null });

    const result = await verifyPayment({ ...verifyInput, providerRef: " " });

    expect(result).toEqual({
      ok: false,
      error: { code: "VALIDATION", message: "Enter the UPI reference for this payment." },
    });
  });

  it("hides database errors behind a generic retry message", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "relation payments does not exist" } });

    const result = await verifyPayment(verifyInput);

    expect(result).toMatchObject({ ok: false, error: { code: "INVALID_STATE" } });
    if (!result.ok) expect(result.error.message).not.toContain("relation");
  });
});

describe("rejectPayment", () => {
  it("calls reject_payment with the reason", async () => {
    rpc.mockResolvedValue({ data: { ok: true }, error: null });

    const result = await rejectPayment({ paymentId: "p1", staffId: "s1", reason: "Not received" });

    expect(rpc).toHaveBeenCalledWith("reject_payment", {
      p_payment_id: "p1",
      p_staff_id: "s1",
      p_reason: "Not received",
    });
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it("reports INVALID_STATE for a payment that is no longer Pending", async () => {
    rpc.mockResolvedValue({ data: { ok: false, code: "INVALID_STATE" }, error: null });

    const result = await rejectPayment({ paymentId: "p1", staffId: "s1", reason: "x" });

    expect(result).toMatchObject({ ok: false, error: { code: "INVALID_STATE" } });
  });
});

describe("paymentLabel (what the member sees)", () => {
  it.each([
    [{ status: "Failed", orderStatus: "Failed" }, "Not confirmed"],
    [{ status: "Failed", orderStatus: "Cancelled" }, "Replaced"],
    [{ status: "Refunded", orderStatus: "Paid" }, "Refunded"],
    [{ status: "Pending", orderStatus: "Pending" }, "Awaiting confirmation"],
  ] as const)("%o → %s (TESTING.md #7)", (p, label) => {
    expect(paymentLabel(p)).toBe(label);
  });
});
