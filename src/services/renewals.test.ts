// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./supabase/server", () => ({
  createServerClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from "./supabase/server";
import { buildStages, DEFAULT_RENEWAL_WINDOWS, groupRenewals, paymentSetupFrom, renewalReminderMessage, stageFor, upiPayLink } from "./renewals";
import { createRenewalOrder } from "./memberships";
import { claimRenewalPayment, receiptNumber } from "./payments";
import type { RenewalDueDbRow } from "./supabase/database.types";

const PLAN_ID = "c0000000-0000-4000-8000-000000000002";
const PAYMENT_ID = "f0000000-0000-4000-8000-000000000001";
const rpc = vi.fn();

beforeEach(() => {
  rpc.mockReset();
  vi.mocked(createServiceClient).mockReset().mockReturnValue({ rpc } as never);
});
afterEach(() => vi.unstubAllEnvs());

describe("renewal stages (ADR-009)", () => {
  it.each([
    [14, "14"], [8, "14"], [7, "7"], [4, "7"], [3, "3"], [1, "3"], [0, "0"], [-1, "overdue"], [-30, "overdue"],
  ])("%i days left → stage %s", (days, stage) => {
    expect(stageFor(days, buildStages(DEFAULT_RENEWAL_WINDOWS))?.key).toBe(stage);
  });

  it("groups most urgent first with expected ₹ (pending amount wins over plan price)", () => {
    const row = (days: number, over: Partial<RenewalDueDbRow> = {}): RenewalDueDbRow => ({
      member_id: `m${days}`, member_name: "A", member_phone: "9876543210", plan_name: "Monthly", renewal_amount: 1000,
      expiry_date: "2026-11-01", days_left: days, pending_payment_id: null, pending_amount: null, pending_reference: null, notify_renewal: true, ...over,
    });
    const groups = groupRenewals([row(2), row(3, { pending_payment_id: "p", pending_amount: 2250 }), row(10), row(-2)]);
    expect(groups.map((g) => g.key)).toEqual(["overdue", "0", "3", "7", "14"]);
    expect(groups.find((g) => g.key === "3")).toMatchObject({ expected: 3250, pending: 1 });
    expect(groups.find((g) => g.key === "0")?.rows).toEqual([]);
  });

  it("follows the owner's windows; windows over 7 days are owner-only", () => {
    const stages = buildStages([21, 10, 5, 0, -3]);
    expect(stages.map((s) => [s.key, s.min, s.max, s.memberReminder])).toEqual([
      ["overdue", -30, -1, true],
      ["0", 0, 0, true],
      ["5", 1, 5, true],
      ["10", 6, 10, false],
      ["21", 11, 21, false],
    ]);
    expect(stageFor(25, stages)).toBeNull();
  });
});

describe("messages and payment links", () => {
  it("renders the renewal reminder with no placeholders", () => {
    const text = renewalReminderMessage({ name: "Neha Verma", plan: "Quarterly", expiryDate: "2027-02-14", renewalLink: "https://gym.example/member/renew" });
    expect(text).toBe("Hi Neha, your Quarterly membership expires on 14 Feb 2027. Review plans and the final payable amount here: https://gym.example/member/renew");
    expect(text).not.toMatch(/\{\{/);
  });

  it("builds a UPI deep link with the exact amount", () => {
    const link = upiPayLink({ upiId: "fitzone@okicici", payeeName: "FitZone Gym" }, 2250, "Renewal RCPT-F0000000");
    expect(link).toBe("upi://pay?pa=fitzone%40okicici&pn=FitZone%20Gym&am=2250.00&cu=INR&tn=Renewal%20RCPT-F0000000");
  });

  it("ignores a malformed UPI ID instead of showing it", () => {
    expect(paymentSetupFrom("not a upi id", "FitZone").upiId).toBeNull();
    expect(paymentSetupFrom(" fitzone@okicici ", "FitZone")).toEqual({ upiId: "fitzone@okicici", payeeName: "FitZone" });
  });

  it("makes a short receipt number from the payment id", () => {
    expect(receiptNumber(PAYMENT_ID)).toBe("RCPT-F0000000");
  });
});

describe("createRenewalOrder", () => {
  it("rejects a missing plan without a database call", async () => {
    const result = await createRenewalOrder({ memberId: "m1", planId: "" });
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("returns the same pending order on a double tap", async () => {
    rpc.mockResolvedValue({ data: { ok: true, existing: true, payment_id: PAYMENT_ID }, error: null });
    const result = await createRenewalOrder({ memberId: "m1", planId: PLAN_ID });
    expect(rpc).toHaveBeenCalledWith("create_renewal_order", { p_member_id: "m1", p_plan_id: PLAN_ID });
    expect(result).toEqual({ ok: true, data: { paymentId: PAYMENT_ID, existing: true } });
  });

  it.each(["PLAN_UNAVAILABLE", "PAYMENT_CLAIMED", "NO_MEMBERSHIP", "FORBIDDEN"])("explains %s in plain language", async (code) => {
    rpc.mockResolvedValue({ data: { ok: false, code }, error: null });
    const result = await createRenewalOrder({ memberId: "m1", planId: PLAN_ID });
    expect(result).toMatchObject({ ok: false, error: { code, message: expect.stringMatching(/\w+ \w+/) } });
  });
});

describe("claimRenewalPayment", () => {
  it.each(["", "12345", "UTR 1234567", "123456789012345678901234567890X"])("rejects reference %j before any database call", async (reference) => {
    const result = await claimRenewalPayment("m1", { paymentId: PAYMENT_ID, reference });
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION", fields: { reference: expect.any(String) } } });
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("records a 12-digit UTR for the signed-in member only", async () => {
    rpc.mockResolvedValue({ data: { ok: true }, error: null });
    const result = await claimRenewalPayment("m1", { paymentId: PAYMENT_ID, reference: " 412345678901 " });
    expect(rpc).toHaveBeenCalledWith("claim_renewal_payment", { p_payment_id: PAYMENT_ID, p_member_id: "m1", p_reference: "412345678901" });
    expect(result.ok).toBe(true);
  });
});

describe("live database (pending)", () => {
  it.todo("verifying the same payment twice extends the membership exactly once (TESTING.md #6)");
  it.todo("a rejected payment extends nothing and the member sees the failed state (TESTING.md #7)");
  it.todo("renewing Monthly → Yearly moves the membership to the Yearly plan and the receipt shows the new expiry");
  it.todo("a member can never open another member's receipt");
  it.todo("paused, cancelled and blocked members are not in the renewals pipeline");
});
