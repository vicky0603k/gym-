// @vitest-environment node
// Members, RLS isolation, add-ons, dashboard numbers and the daily expiry job.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, DESK, member, OWNER, TODAY, type TestDb } from "./harness";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
}, 60_000);
afterAll(() => db.close());

type R = { ok: boolean; code?: string; payment_id?: string; sessions_used?: number; stock?: number };
const PT = "d0000000-0000-0000-0000-000000000001";
const WHEY = "d0000000-0000-0000-0000-000000000003";

describe("members", () => {
  it("members.phone unique constraint refuses a real duplicate phone (23505)", async () => {
    await expect(db.rows(`insert into members (name, phone, pin_hash) values ('Dup', '9000020001', 'x')`)).rejects.toMatchObject({ code: "23505" });
  });

  it("a member session cannot read another member's row or memberships (RLS)", async () => {
    const [rows, ships, visits] = await db.asMember(member(12), async () => [
      await db.rows<{ id: string }>(`select id::text from members`),
      await db.rows<{ member_id: string }>(`select member_id::text from memberships`),
      await db.rows<{ member_id: string }>(`select member_id::text from attendance`),
    ]);
    expect(rows.map((r) => r.id)).toEqual([member(12)]);
    expect(ships.every((r) => r.member_id === member(12))).toBe(true);
    expect(visits.every((r) => r.member_id === member(12)) && visits.length > 0).toBe(true);
  });

  it("a member cannot read the PIN hash column at all", async () => {
    await expect(db.asMember(member(12), () => db.rows(`select pin_hash from members`))).rejects.toThrow(/permission denied/);
  });

  it("an inactive plan is not offered (only is_active plans are listed)", async () => {
    await db.rows(`update plans set is_active = false where name = 'Half-yearly'`);
    const names = (await db.rows<{ name: string }>(`select name from plans where is_active order by duration_days`)).map((p) => p.name);
    expect(names).toEqual(["Monthly", "Quarterly", "Yearly"]);
    await db.rows(`update plans set is_active = true where name = 'Half-yearly'`);
  });
});

describe("add-ons", () => {
  it("two members buying the last item: exactly one order succeeds", async () => {
    await db.rows(`update addons set stock = 1 where id = $1`, [WHEY]);
    const a = await db.call<R>("create_addon_order", member(12), WHEY, 1);
    const b = await db.call<R>("create_addon_order", member(13), WHEY, 1);
    expect([a.ok, b.ok]).toEqual([true, false]);
    expect(b.code).toBe("OUT_OF_STOCK");
    expect(await db.one(`select stock from addons where id = $1`, [WHEY])).toBe(0);
  });

  it("rejecting or cancelling an unpaid product order returns its stock", async () => {
    const pending = await db.one<string>(`select payment_id from addon_orders where member_id = $1 and addon_id = $2`, [member(12), WHEY]);
    expect((await db.call<R>("reject_payment", pending, OWNER, "No payment")).ok).toBe(true);
    expect(await db.one(`select stock from addons where id = $1`, [WHEY])).toBe(1);
    const again = await db.call<R>("create_addon_order", member(14), WHEY, 1);
    expect((await db.call<R>("cancel_payment", again.payment_id, member(14))).ok).toBe(true);
    expect(await db.one(`select stock from addons where id = $1`, [WHEY])).toBe(1);
  });

  it("verifying a PT payment makes the order Active; +1 stops at sessions_total", async () => {
    await db.rows(`update addons set sessions = 2 where id = $1`, [PT]);
    const order = await db.call<R>("create_addon_order", member(15), PT, 1);
    await db.call("verify_payment", order.payment_id, "UTR5566778899", OWNER);
    const orderId = await db.one<string>(`select id from addon_orders where payment_id = $1`, [order.payment_id]);
    expect(await db.one(`select status::text from addon_orders where id = $1`, [orderId])).toBe("Active");
    expect((await db.call<R>("record_pt_session", orderId, DESK)).sessions_used).toBe(1);
    expect((await db.call<R>("record_pt_session", orderId, DESK)).sessions_used).toBe(2);
    expect((await db.call<R>("record_pt_session", orderId, DESK)).code).toBe("ALL_USED");
  });

  it("stock adjustments write an audit row and never go below 0", async () => {
    expect((await db.call<R>("adjust_stock", WHEY, 4, "New box", DESK)).stock).toBe(5);
    expect((await db.call<R>("adjust_stock", WHEY, -6, "Count", DESK)).code).toBe("NEGATIVE_STOCK");
    expect(await db.one(`select count(*)::int from audit_logs where action = 'addon.stock_adjusted'`)).toBe(1);
  });
});

describe("dashboard and the daily job", () => {
  it("KPIs match a hand count from the seed data", async () => {
    const k = await db.call<Record<string, number>>("dashboard_kpis");
    const hand = await db.one<number>(
      `select count(*)::int from members m join current_memberships c on c.member_id = m.id
        where m.status = 'Active' and c.status = 'Active' and c.expiry_date >= ${TODAY}`
    );
    expect(k.active_members).toBe(hand);
    expect(k.red_list_open).toBe(await db.one(`select count(*)::int from red_list()`));
    expect(k.payments_pending).toBe(await db.one(`select count(*)::int from payments where status = 'Pending'`));
  });

  it("7-day active counts distinct members, not check-ins", async () => {
    const k = await db.call<Record<string, number>>("dashboard_kpis");
    const visits = await db.one<number>(`select count(*)::int from attendance where checkin_at >= (${TODAY}::timestamp at time zone 'Asia/Kolkata') - interval '6 days'`);
    const people = await db.one<number>(`select count(distinct member_id)::int from attendance where checkin_at >= (${TODAY}::timestamp at time zone 'Asia/Kolkata') - interval '6 days'`);
    expect(k.active_7_days).toBe(people);
    expect(visits).toBeGreaterThan(people);
  });

  it("the daily job marks a lapsed member Expired and leaves Paused / Frozen alone", async () => {
    await db.rows(`update memberships set expiry_date = ${TODAY} - 1 where member_id = $1`, [member(29)]);
    await db.rows(`update memberships set expiry_date = ${TODAY} - 1 where member_id = $1`, [member(22)]);
    await db.call("expire_lapsed_memberships");
    expect(await db.one(`select status::text from members where id = $1`, [member(29)])).toBe("Expired");
    expect(await db.one(`select status::text from memberships where member_id = $1`, [member(22)])).toBe("Frozen");
    expect(await db.one(`select status::text from members where id = $1`, [member(22)])).toBe("Paused");
  });
});
