// @vitest-environment node
// Desk payments, refunds, member status, missed visits, staff logins, data quality (migration 012).
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./supabase/server", () => ({
  createServerClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from "./supabase/server";
import { createDeskRenewal, refundPayment } from "./payments";
import { setMemberStatus } from "./members";
import { backfillAttendance } from "./attendance";
import { createStaff, setStaffActive } from "./staff";
import { getDataQualityIssues } from "./dashboard";

const PLAN = "c0000000-0000-4000-8000-000000000001";
const PAYMENT = "a0000000-0000-4000-8000-000000000001";
const rpc = vi.fn();
beforeEach(() => {
  rpc.mockReset();
  vi.mocked(createServiceClient).mockReset().mockReturnValue({ rpc } as never);
});

describe("createDeskRenewal", () => {
  it("needs a UTR for UPI but not for cash, before any database call", async () => {
    const result = await createDeskRenewal("m1", { planId: PLAN, method: "UPI", reference: "12" }, "s1");
    expect(result).toMatchObject({ ok: false, error: { fields: { reference: expect.stringContaining("UTR") } } });
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("sends cash with no reference (the database numbers the receipt)", async () => {
    rpc.mockResolvedValue({ data: { ok: true, payment_id: PAYMENT, reference: "CASH-000007", amount: 1000 }, error: null });
    const result = await createDeskRenewal("m1", { planId: PLAN, method: "Cash", reference: "ignored" }, "s1");
    expect(rpc).toHaveBeenCalledWith("create_desk_renewal", { p_member_id: "m1", p_plan_id: PLAN, p_method: "Cash", p_reference: null, p_staff_id: "s1" });
    expect(result).toEqual({ ok: true, data: { paymentId: PAYMENT, reference: "CASH-000007", amount: 1000 } });
  });

  it("maps a reused UTR to the reference field and a claimed renewal to a plain message", async () => {
    rpc.mockResolvedValueOnce({ data: { ok: false, code: "DUPLICATE_REFERENCE" }, error: null });
    expect(await createDeskRenewal("m1", { planId: PLAN, method: "UPI", reference: "412345678901" }, "s1")).toMatchObject({
      ok: false,
      error: { fields: { reference: "This UPI reference is already used on another payment." } },
    });
    rpc.mockResolvedValueOnce({ data: { ok: false, code: "PAYMENT_CLAIMED" }, error: null });
    expect(await createDeskRenewal("m1", { planId: PLAN, method: "Cash" }, "s1")).toMatchObject({
      ok: false,
      error: { message: expect.stringContaining("Verify or reject that one") },
    });
  });
});

describe("refundPayment", () => {
  it("requires a reason and reads the checkbox as the reverse flag", async () => {
    expect(await refundPayment({ paymentId: PAYMENT, reason: " " }, "s1")).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(createServiceClient).not.toHaveBeenCalled();

    rpc.mockResolvedValue({ data: { ok: true, new_expiry: "2026-10-24" }, error: null });
    await refundPayment({ paymentId: PAYMENT, reason: "Paid twice", reverse: "on" }, "s1");
    expect(rpc).toHaveBeenLastCalledWith("refund_payment", { p_payment_id: PAYMENT, p_staff_id: "s1", p_reason: "Paid twice", p_reverse: true });
    await refundPayment({ paymentId: PAYMENT, reason: "Goodwill" }, "s1");
    expect(rpc).toHaveBeenLastCalledWith("refund_payment", expect.objectContaining({ p_reverse: false }));
  });

  it("never refunds twice", async () => {
    rpc.mockResolvedValue({ data: { ok: false, code: "ALREADY_REFUNDED" }, error: null });
    expect(await refundPayment({ paymentId: PAYMENT, reason: "again" }, "s1")).toMatchObject({
      ok: false,
      error: { message: "This payment has already been refunded." },
    });
  });
});

describe("setMemberStatus", () => {
  it.each([{ action: "Delete", reason: "x" }, { action: "Cancel", reason: "" }])("rejects %o before the database", async (input) => {
    expect(await setMemberStatus("m1", input, "s1")).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(createServiceClient).not.toHaveBeenCalled();
  });
});

describe("backfillAttendance", () => {
  it("refuses a future time without calling the database", async () => {
    const result = await backfillAttendance("m1", { date: "2999-01-01", time: "07:00", reason: "Tablet offline" }, "s1");
    expect(result).toMatchObject({ ok: false, error: { fields: { time: "The visit can't be in the future." } } });
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("sends the Kolkata wall-clock time as UTC (7:00 AM IST = 01:30 UTC)", async () => {
    rpc.mockResolvedValue({ data: { ok: true, attendance_id: "a1", case_resolved: true }, error: null });
    const result = await backfillAttendance("m1", { date: "2026-10-20", time: "07:00", reason: "Tablet offline" }, "s1");
    expect(rpc).toHaveBeenCalledWith("backfill_attendance", expect.objectContaining({ p_at: "2026-10-20T01:30:00.000Z" }));
    expect(result).toEqual({ ok: true, caseResolved: true });
  });
});

describe("staff logins", () => {
  it("the owner cannot remove their own access", async () => {
    expect(await setStaffActive("s1", false, "s1")).toMatchObject({ ok: false, error: { message: "You can't remove your own access." } });
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("deletes the new auth user if the staff row can't be saved", async () => {
    const deleteUser = vi.fn().mockResolvedValue({ error: null });
    const insert = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    vi.mocked(createServiceClient).mockReturnValue({
      auth: { admin: { createUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } }, error: null }), deleteUser } },
      from: () => ({ insert }),
    } as never);

    const result = await createStaff({ name: "Desk One", email: "desk1@example.com", password: "long-enough-pw" }, "owner");

    expect(result).toMatchObject({ ok: false });
    expect(deleteUser).toHaveBeenCalledWith("u1");
  });

  it("rejects a short password before creating anything", async () => {
    expect(await createStaff({ name: "Desk One", email: "desk1@example.com", password: "short" }, "owner")).toMatchObject({
      ok: false,
      error: { fields: { password: "Enter a password of at least 10 characters" } },
    });
    expect(createServiceClient).not.toHaveBeenCalled();
  });
});

describe("getDataQualityIssues", () => {
  it("returns only the non-zero checks, with a link each", async () => {
    rpc.mockResolvedValue({
      data: { paid_without_reference: 0, active_past_expiry: 2, members_without_membership: 0, payments_pending_over_3_days: 1, stock_below_zero: 0 },
      error: null,
    });
    const issues = await getDataQualityIssues();
    expect(issues.map((i) => [i.key, i.count])).toEqual([["active_past_expiry", 2], ["payments_pending_over_3_days", 1]]);
    expect(issues.every((i) => i.href.startsWith("/owner"))).toBe(true);
  });
});
