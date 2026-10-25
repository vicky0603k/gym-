// @vitest-environment node
// Check-in and Red List rules against the real migrations.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, DESK, member, OWNER, TODAY, type TestDb } from "./harness";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
}, 60_000);
afterAll(() => db.close());

type R = { ok: boolean; code?: string; case_resolved?: boolean; closed?: boolean };
const assisted = (m: string) => db.call<R>("check_in", m, "Assisted", null, DESK, "Phone battery dead");
const openCase = async (m: string) =>
  (await db.one<string>(`select status::text from no_show_cases where member_id = $1 and status in ('Open','Contacted','FollowUpDue')`, [m])) ?? null;
const redListIds = async () => (await db.rows<{ member_id: string }>(`select member_id::text from red_list()`)).map((r) => r.member_id);

describe("check_in", () => {
  it("two scans in a row for one member write exactly one attendance row", async () => {
    await db.rows(`delete from attendance where member_id = $1 and checkin_at > now() - interval '1 day'`, [member(12)]);
    const before = await db.one<number>(`select count(*)::int from attendance where member_id = $1`, [member(12)]);
    const [first, second] = [await assisted(member(12)), await assisted(member(12))];
    expect(first.ok).toBe(true);
    expect(second.code).toBe("DUPLICATE_CHECKIN");
    expect(await db.one<number>(`select count(*)::int from attendance where member_id = $1`, [member(12)])).toBe(before + 1);
  });

  it("a Blocked member with an Active membership row is refused", async () => {
    await db.call("set_member_status", member(26), "Block", "Barred", OWNER);
    expect((await assisted(member(26))).code).toBe("MEMBER_BLOCKED");
  });

  it("an assisted check-in writes an attendance.assisted audit row", async () => {
    await db.rows(`delete from attendance where member_id = $1 and checkin_at > now() - interval '1 day'`, [member(27)]);
    expect((await assisted(member(27))).ok).toBe(true);
    expect(await db.one(`select count(*)::int from audit_logs where action = 'attendance.assisted' and record_type = 'attendance'`)).toBeGreaterThan(0);
  });
});

describe("Red List", () => {
  it("running the scan twice on one day opens no duplicate case", async () => {
    await db.call("run_no_show_scan");
    const first = await db.one<number>(`select count(*)::int from no_show_cases`);
    await db.call("run_no_show_scan");
    expect(await db.one<number>(`select count(*)::int from no_show_cases`)).toBe(first);
    expect(first).toBeGreaterThanOrEqual(6); // seed members 1–6 absent 12–20 days
  });

  it("a Paused / Frozen / Expired / Cancelled member never appears on the Red List", async () => {
    await db.call("set_member_status", member(6), "Cancel", "Moved", OWNER);
    const ids = await redListIds();
    for (const n of [6, 21, 22, 23, 24, 25]) expect(ids).not.toContain(member(n));
    expect(ids).toContain(member(1));
  });

  it("a member who joined yesterday or just resumed from a pause is not flagged", async () => {
    await db.rows(`insert into members (id, name, phone, pin_hash, join_date) values ('f0000000-0000-0000-0000-000000000009', 'New Joiner', '9333333333', 'x', ${TODAY} - 1)`);
    await db.rows(`insert into memberships (member_id, plan_id, start_date, expiry_date) values ('f0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000001', ${TODAY} - 1, ${TODAY} + 29)`);
    await db.call("resume_membership", await db.one(`select id from memberships where member_id = $1`, [member(23)]), OWNER);
    await db.call("run_no_show_scan");
    const ids = await redListIds();
    expect(ids).not.toContain("f0000000-0000-0000-0000-000000000009");
    expect(ids).not.toContain(member(23)); // last visit 20+ days ago, but just back from a pause
  });

  it("a Contacted case becomes FollowUpDue when its next action date arrives", async () => {
    const caseId = await db.one<string>(`select id from no_show_cases where member_id = $1 and status = 'Open'`, [member(2)]);
    expect((await db.call<R>("record_followup", caseId, DESK, "Call", "WillReturn", "Says next week", `${await db.one(`select (${TODAY} + 1)::text`)}`)).ok).toBe(true);
    expect(await openCase(member(2))).toBe("Contacted");
    await db.rows(`update no_show_cases set next_action_date = ${TODAY} where id = $1`, [caseId]);
    await db.call("run_no_show_scan");
    expect(await openCase(member(2))).toBe("FollowUpDue");
  });

  it("a return check-in resolves the case as Returned and its follow-ups stay visible", async () => {
    const caseId = await db.one<string>(`select id from no_show_cases where member_id = $1 and status = 'FollowUpDue'`, [member(2)]);
    const result = await assisted(member(2));
    expect(result).toMatchObject({ ok: true, case_resolved: true });
    expect(await db.one(`select status::text from no_show_cases where id = $1`, [caseId])).toBe("Returned");
    expect(await db.one(`select count(*)::int from followups where case_id = $1`, [caseId])).toBe(1);
    // Staff have no delete policy on follow-ups: a delete removes nothing.
    await db.asStaff(OWNER, () => db.rows(`delete from followups where case_id = $1`, [caseId]));
    expect(await db.one(`select count(*)::int from followups where case_id = $1`, [caseId])).toBe(1);
  });

  it("a member who turns off missed-visit messages is flagged on the Red List (no WhatsApp button)", async () => {
    await db.rows(`update members set notify_care = false where id = $1`, [member(3)]);
    const row = await db.rows<{ notify_care: boolean }>(`select notify_care from red_list() where member_id = $1`, [member(3)]);
    expect(row[0].notify_care).toBe(false);
  });

  it("a new Red List threshold applies on the next scan", async () => {
    await db.rows(`update settings set no_show_threshold_days = 30`);
    await db.rows(`insert into attendance (member_id, checkin_at, source) values ($1, now() - interval '9 days', 'QR')`, [member(28)]);
    await db.rows(`delete from attendance where member_id = $1 and checkin_at > now() - interval '9 days'`, [member(28)]);
    await db.call("run_no_show_scan");
    expect(await openCase(member(28))).toBeNull();
    await db.rows(`update settings set no_show_threshold_days = 5`);
    await db.call("run_no_show_scan");
    expect(await openCase(member(28))).toBe("Open");
  });
});
