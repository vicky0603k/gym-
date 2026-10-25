// @vitest-environment node
// Migration 012: freeze credit, member status, anonymising, missed visits, staff access.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, DESK, member, OWNER, TODAY, type TestDb } from "./harness";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
}, 60_000);
afterAll(() => db.close());

type R = { ok: boolean; code?: string; days_added?: number; status?: string; case_resolved?: boolean };
const membershipOf = (n: number) => db.one<string>(`select id from memberships where member_id = $1`, [member(n)]);
const today = (plus: number) => db.one<string>(`select (${TODAY} + $1::int)::text`, [plus]);

describe("resume with freeze credit (C5)", () => {
  it("adds the paused days, then caps at the yearly limit", async () => {
    const first = await db.call<R>("resume_membership", await membershipOf(21), OWNER); // paused 15 days
    expect(first.days_added).toBe(15);
    expect(await db.one(`select expiry_date::text from memberships where member_id = $1`, [member(21)])).toBe(await today(45));
    await db.rows(`update memberships set status = 'Frozen', freeze_start = ${TODAY} - 20, freeze_end = null where member_id = $1`, [member(21)]);
    expect((await db.call<R>("resume_membership", await membershipOf(21), OWNER)).days_added).toBe(15); // 30 − 15 used
  });

  it("front desk cannot resume, and a running membership can't be resumed", async () => {
    expect((await db.call<R>("resume_membership", await membershipOf(22), DESK)).code).toBe("FORBIDDEN");
    expect((await db.call<R>("resume_membership", await membershipOf(12), OWNER)).code).toBe("INVALID_STATE");
  });
});

describe("member status (C2)", () => {
  it("cancel blocks check-in; reactivate restores the status the membership implies", async () => {
    expect((await db.call<R>("set_member_status", member(11), "Cancel", "Moved city", OWNER)).status).toBe("Cancelled");
    expect((await db.call<R>("check_in", member(11), "Assisted", null, DESK, "test")).code).toBe("MEMBER_CANCELLED");
    expect((await db.call<R>("set_member_status", member(11), "Reactivate", "Back", OWNER)).status).toBe("Active");
    await db.call("set_member_status", member(25), "Block", "Dues", OWNER);
    expect((await db.call<R>("set_member_status", member(25), "Reactivate", "Paid", OWNER)).status).toBe("Expired");
  });

  it("anonymising needs a cancelled member and keeps payments and visits", async () => {
    expect((await db.call<R>("anonymise_member", member(3), OWNER)).code).toBe("INVALID_STATE");
    await db.call("set_member_status", member(3), "Cancel", "Asked to remove data", OWNER);
    expect((await db.call<R>("anonymise_member", member(3), OWNER)).ok).toBe(true);
    const row = (await db.rows<{ name: string; phone: string; pin_hash: string | null }>(`select name, phone, pin_hash from members where id = $1`, [member(3)]))[0];
    expect(row).toMatchObject({ name: "Former member", pin_hash: null });
    expect(row.phone).toMatch(/^removed-/);
    expect(await db.one(`select count(*)::int from attendance where member_id = $1`, [member(3)])).toBeGreaterThan(0);
  });
});

describe("missed visits (C3)", () => {
  it("adds a past visit with the reason, resolves an open case, refuses duplicates and the future", async () => {
    await db.call("run_no_show_scan");
    const result = await db.call<R>("backfill_attendance", member(4), new Date(Date.now() - 2 * 3600_000).toISOString(), "Tablet offline", DESK);
    expect(result).toMatchObject({ ok: true, case_resolved: true });
    expect((await db.call<R>("backfill_attendance", member(4), new Date(Date.now() - 3600_000).toISOString(), "Again", DESK)).code).toBe("DUPLICATE_CHECKIN");
    expect((await db.call<R>("backfill_attendance", member(4), new Date(Date.now() + 3600_000).toISOString(), "Future", DESK)).code).toBe("VALIDATION");
    expect(await db.one(`select count(*)::int from audit_logs where action = 'attendance.corrected'`)).toBe(1);
  });

  it("a backdated visit counts toward that week's goal", async () => {
    const weekVisits = () =>
      db.one<number>(
        `select count(*)::int from attendance where member_id = $1
           and checkin_at >= (date_trunc('week', ${TODAY})::timestamp at time zone 'Asia/Kolkata')`,
        [member(5)]
      );
    const before = await weekVisits();
    const at = await db.one<string>(`select to_char((date_trunc('week', ${TODAY}) + interval '7 hours') at time zone 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`);
    if (new Date(at).getTime() < Date.now()) {
      expect((await db.call<R>("backfill_attendance", member(5), at, "Gate down Monday", DESK)).ok).toBe(true);
      expect(await weekVisits()).toBe(before + 1);
    }
  });
});

describe("staff access (C1)", () => {
  it("a removed staff member can't record payments and loses staff RLS access", async () => {
    await db.rows(`update staff_users set is_active = false where id = $1`, [DESK]);
    expect((await db.call<R>("create_desk_renewal", member(12), "c0000000-0000-0000-0000-000000000001", "Cash", null, DESK)).code).toBe("FORBIDDEN");
    const seen = await db.asStaff(DESK, () => db.rows(`select id from members`));
    expect(seen).toEqual([]);
    await db.rows(`update staff_users set is_active = true where id = $1`, [DESK]);
    expect((await db.asStaff(DESK, () => db.rows(`select id from members`))).length).toBeGreaterThan(0);
  });
});
