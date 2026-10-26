// @vitest-environment node
// Member IDs (migration 013): unique 6 digits, given by the database, never changed.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, member, type TestDb } from "./harness";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
}, 60_000);
afterAll(() => db.close());

describe("member IDs", () => {
  it("a new member gets a 6-digit ID without the app sending one", async () => {
    const code = await db.one<number>(`insert into members (name, phone, pin_hash) values ('Asha Rao', '9000030001', 'x') returning member_code`);
    expect(code).toBeGreaterThanOrEqual(100000);
    expect(code).toBeLessThanOrEqual(999999);
  });

  it("no two members share an ID", async () => {
    const [{ total, distinct }] = await db.rows<{ total: number; distinct: number }>(
      `select count(*)::int as total, count(distinct member_code)::int as distinct from members`
    );
    expect(total).toBeGreaterThan(1);
    expect(distinct).toBe(total);
  });

  it("an ID can never be changed", async () => {
    await expect(db.rows(`update members set member_code = 123456 where id = $1`, [member(12)])).rejects.toThrow(/cannot be changed/);
  });

  it("a member can read their own ID", async () => {
    const code = await db.asMember(member(12), () => db.one<number>(`select member_code from members`));
    expect(code).toBeGreaterThanOrEqual(100000);
  });
});

describe("member IDs on a gym that already has members", () => {
  let existing: TestDb;
  beforeAll(async () => {
    existing = await createTestDb({ seedBefore: "013_member_code.sql" });
  }, 60_000);
  afterAll(() => existing.close());

  it("every existing member gets a unique ID", async () => {
    const [{ total, coded, distinct }] = await existing.rows<{ total: number; coded: number; distinct: number }>(
      `select count(*)::int as total, count(member_code)::int as coded, count(distinct member_code)::int as distinct from members`
    );
    expect(total).toBeGreaterThan(0);
    expect(coded).toBe(total);
    expect(distinct).toBe(total);
  });
});
