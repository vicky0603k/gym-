// @vitest-environment node
// TESTING.md failure checklist rows not covered elsewhere (3, 4, 10, 12, 18).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, DESK, member, OWNER, PLAN, type TestDb } from "./harness";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
}, 60_000);
afterAll(() => db.close());

type R = { ok: boolean; code?: string; payment_id?: string };
const visits = (n: number) => db.one<number>(`select count(*)::int from attendance where member_id = $1`, [member(n)]);
const payments = () => db.one<number>(`select count(*)::int from payments`);

describe("failure checklist", () => {
  it("#3 an Expired member's scan is refused with MEMBERSHIP_EXPIRED and writes nothing", async () => {
    const before = await visits(24);
    expect((await db.call<R>("check_in", member(24), "Assisted", null, DESK, "Scan")).code).toBe("MEMBERSHIP_EXPIRED");
    expect(await visits(24)).toBe(before);
  });

  it("#4 a Paused / Frozen member's check-in shows the paused state", async () => {
    const before = await visits(22);
    expect((await db.call<R>("check_in", member(22), "Assisted", null, DESK, "Scan")).code).toBe("MEMBERSHIP_PAUSED");
    expect(await visits(22)).toBe(before);
  });

  it("#10 an add-on with stock 0 is blocked before any payment is created", async () => {
    await db.rows(`update addons set stock = 0 where type = 'Product'`);
    const before = await payments();
    expect((await db.call<R>("create_addon_order", member(12), "d0000000-0000-0000-0000-000000000003", 1)).code).toBe("OUT_OF_STOCK");
    expect(await payments()).toBe(before);
  });

  it("#12 a PT add-on whose trainer is unavailable is blocked with a clear code", async () => {
    await db.rows(`update trainers set is_active = false where id = 'a0000000-0000-0000-0000-000000000001'`);
    const before = await payments();
    expect((await db.call<R>("create_addon_order", member(12), "d0000000-0000-0000-0000-000000000001", 1)).code).toBe("TRAINER_UNAVAILABLE");
    expect(await payments()).toBe(before);
  });

  it("#18 after a renewal the member leaves the reminder pipeline for the old expiry", async () => {
    const due = async () => (await db.rows<{ member_id: string }>(`select member_id::text from renewals_due()`)).map((r) => r.member_id);
    expect(await due()).toContain(member(9)); // expiring in 5 days
    const order = await db.call<R>("create_renewal_order", member(9), PLAN.yearly);
    await db.call("verify_payment", order.payment_id, "UTR11223344", OWNER);
    expect(await due()).not.toContain(member(9));
  });
});
