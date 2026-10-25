// @vitest-environment node
// Renewals, desk payments and refunds against the real migrations (TESTING.md rows 6–8).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, DESK, member, OWNER, PLAN, TODAY, type TestDb } from "./harness";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
}, 60_000);
afterAll(() => db.close());

type Ok = { ok: boolean; code?: string; payment_id?: string; reference?: string; new_expiry?: string };
const expiryOf = (m: string) => db.one<string>(`select expiry_date::text from current_memberships where member_id = $1`, [m]);
const today = (plus = 0) => db.one<string>(`select (${TODAY} + $1::int)::text`, [plus]);

describe("verify_payment", () => {
  it("verifying the same payment twice extends the membership exactly once (TESTING.md #6)", async () => {
    const order = await db.call<Ok>("create_renewal_order", member(13), PLAN.monthly);
    const before = await expiryOf(member(13));
    const first = await db.call<Ok>("verify_payment", order.payment_id, "UTR412345678901", OWNER);
    const second = await db.call<Ok>("verify_payment", order.payment_id, "UTR412345678901", OWNER);
    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, code: "ALREADY_VERIFIED" });
    expect(await expiryOf(member(13))).toBe(await db.one(`select ($1::date + 30)::text`, [before]));
  });

  it("a rejected payment extends nothing and shows as Failed (TESTING.md #7)", async () => {
    const order = await db.call<Ok>("create_renewal_order", member(14), PLAN.monthly);
    const before = await expiryOf(member(14));
    expect((await db.call<Ok>("reject_payment", order.payment_id, OWNER, "Not in bank")).ok).toBe(true);
    expect(await expiryOf(member(14))).toBe(before);
    expect(await db.one(`select status::text from payments where id = $1`, [order.payment_id])).toBe("Failed");
    expect((await db.call<Ok>("verify_payment", order.payment_id, "UTR1", OWNER)).code).toBe("INVALID_STATE");
  });

  it("renewing Monthly → Yearly moves the membership to the Yearly plan", async () => {
    const order = await db.call<Ok>("create_renewal_order", member(10), PLAN.yearly);
    const result = await db.call<Ok>("verify_payment", order.payment_id, "UTR998877665544", OWNER);
    expect(await db.one(`select plan_id::text from current_memberships where member_id = $1`, [member(10)])).toBe(PLAN.yearly);
    expect(result.new_expiry).toBe(await expiryOf(member(10)));
    expect(await db.one(`select new_expiry::text from renewal_orders where payment_id = $1`, [order.payment_id])).toBe(result.new_expiry);
  });

  it("front desk can never verify", async () => {
    const order = await db.call<Ok>("create_renewal_order", member(16), PLAN.monthly);
    expect((await db.call<Ok>("verify_payment", order.payment_id, "UTR1234567", DESK)).code).toBe("FORBIDDEN");
  });
});

describe("desk payments (A1)", () => {
  it("cash at the desk stays Pending until the owner verifies, then extends from today", async () => {
    const desk = await db.call<Ok>("create_desk_renewal", member(24), PLAN.monthly, "Cash", null, DESK);
    expect(desk.reference).toMatch(/^CASH-\d{6}$/);
    expect(await db.one(`select status::text from members where id = $1`, [member(24)])).toBe("Expired");
    await db.call("verify_payment", desk.payment_id, desk.reference, OWNER);
    expect(await expiryOf(member(24))).toBe(await today(30));
    expect(await db.one(`select status::text from members where id = $1`, [member(24)])).toBe("Active");
  });

  it("a UTR can't be used twice", async () => {
    expect((await db.call<Ok>("create_desk_renewal", member(17), PLAN.monthly, "UPI", "777788889999", DESK)).ok).toBe(true);
    expect((await db.call<Ok>("create_desk_renewal", member(18), PLAN.monthly, "UPI", "777788889999", DESK)).code).toBe("DUPLICATE_REFERENCE");
  });
});

describe("refunds (A4)", () => {
  it("reverse takes the days back; the row becomes Refunded and is never deleted", async () => {
    const desk = await db.call<Ok>("create_desk_renewal", member(19), PLAN.monthly, "Cash", null, OWNER);
    const before = await expiryOf(member(19));
    await db.call("verify_payment", desk.payment_id, desk.reference, OWNER);
    expect((await db.call<Ok>("refund_payment", desk.payment_id, OWNER, "Wrong plan", true)).ok).toBe(true);
    expect(await expiryOf(member(19))).toBe(before);
    expect(await db.one(`select status::text from payments where id = $1`, [desk.payment_id])).toBe("Refunded");
    expect((await db.call<Ok>("refund_payment", desk.payment_id, OWNER, "Again", true)).code).toBe("ALREADY_REFUNDED");
  });

  it("only the owner refunds, and only Paid payments", async () => {
    const order = await db.call<Ok>("create_renewal_order", member(20), PLAN.monthly);
    expect((await db.call<Ok>("refund_payment", order.payment_id, OWNER, "x", false)).code).toBe("INVALID_STATE");
    expect((await db.call<Ok>("refund_payment", order.payment_id, DESK, "x", false)).code).toBe("FORBIDDEN");
  });
});

describe("renewals pipeline and receipts", () => {
  it("paused, cancelled and blocked members are not in the renewals pipeline", async () => {
    await db.call("set_member_status", member(7), "Cancel", "Left", OWNER);
    await db.call("set_member_status", member(8), "Block", "Barred", OWNER);
    const due = await db.rows<{ member_id: string }>(`select member_id::text from renewals_due()`);
    const ids = due.map((r) => r.member_id);
    expect(ids).not.toContain(member(7));
    expect(ids).not.toContain(member(8));
    expect(ids).not.toContain(member(22)); // Frozen in the seed
    expect(ids).toContain(member(9)); // Active, expiring in 5 days
  });

  it("a member can never read another member's payments (receipts)", async () => {
    const visible = await db.asMember(member(13), () => db.rows<{ member_id: string }>(`select member_id::text from payments`));
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every((r) => r.member_id === member(13))).toBe(true);
  });
});
