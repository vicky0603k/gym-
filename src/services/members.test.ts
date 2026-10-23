// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./supabase/server", () => ({
  createServerClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from "./supabase/server";
import { hashPin } from "./auth";
import { pauseMembership } from "./memberships";
import { createMember, createMemberSchema, pauseMember, updateMember } from "./members";

// Chainable stand-in for a Supabase query: every method returns itself and
// awaiting it resolves to `result`. Calls are recorded per table.
type Call = [method: string, args: unknown[]];
const calls: Record<string, Call[]> = {};
const results: Record<string, unknown[]> = {};
function query(table: string) {
  const log = (calls[table] ??= []);
  const result = results[table]?.shift() ?? { data: null, error: null };
  const q: unknown = new Proxy(
    {},
    {
      get: (_, prop: string) =>
        prop === "then"
          ? (resolve: (v: unknown) => void) => resolve(result)
          : (...args: unknown[]) => (log.push([prop, args]), q),
    }
  );
  return q;
}
const from = vi.fn(query);
const inserted = (table: string) => calls[table]?.find(([m]) => m === "insert")?.[1][0] as Record<string, unknown>;

const PLAN_ID = "c0000000-0000-4000-8000-000000000001";
const MEMBER_ID = "b0000000-0000-4000-8000-000000000001";
const validMember = { name: "Neha Verma", phone: "9876543210", pin: "4821", weeklyTarget: "4", trainerId: "", planId: PLAN_ID };

beforeEach(() => {
  for (const k of Object.keys(calls)) delete calls[k];
  for (const k of Object.keys(results)) delete results[k];
  from.mockClear();
  vi.mocked(createServiceClient).mockReset().mockReturnValue({ from } as never);
});
afterEach(() => vi.useRealTimers());

describe("createMemberSchema — phone format", () => {
  it("accepts a 10-digit Indian mobile", () => {
    expect(createMemberSchema.safeParse(validMember).success).toBe(true);
  });
  it.each(["987654321", "98765432100", "5876543210", "+919876543210", "98765 43210", ""])("rejects %j", (phone) => {
    const result = createMemberSchema.safeParse({ ...validMember, phone });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("Enter a 10-digit mobile number");
  });
  it.each(["123", "12345", "12a4"])("rejects PIN %j", (pin) => {
    expect(createMemberSchema.safeParse({ ...validMember, pin }).success).toBe(false);
  });
  it.each(["0", "8", "x"])("rejects weekly target %j", (weeklyTarget) => {
    expect(createMemberSchema.safeParse({ ...validMember, weeklyTarget }).success).toBe(false);
  });
});

describe("createMember", () => {
  it("returns a phone field error without touching the database", async () => {
    const result = await createMember({ ...validMember, phone: "12345" }, "s1");

    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION", fields: { phone: "Enter a 10-digit mobile number" } } });
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("maps a duplicate phone to a plain-language field error and creates no membership", async () => {
    results.plans = [{ data: { id: PLAN_ID, name: "Monthly", duration_days: 30 }, error: null }];
    results.members = [{ data: null, error: { code: "23505", message: 'duplicate key value violates unique constraint "members_phone_key"' } }];

    const result = await createMember(validMember, "s1");

    expect(result).toEqual({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "This mobile number already belongs to another member.",
        fields: { phone: "This mobile number already belongs to another member." },
      },
    });
    expect(calls.memberships).toBeUndefined();
  });

  it("rejects an inactive or missing plan", async () => {
    results.plans = [{ data: null, error: null }];

    const result = await createMember(validMember, "s1");

    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION", fields: { planId: expect.any(String) } } });
    expect(calls.members).toBeUndefined();
  });

  it("hashes the PIN and starts the first membership today in Kolkata", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-22T20:00:00Z")); // 23 Oct 2026, 1:30 AM in Kolkata
    results.plans = [{ data: { id: PLAN_ID, name: "Monthly", duration_days: 30 }, error: null }];
    results.members = [{ data: { id: MEMBER_ID }, error: null }];

    const result = await createMember(validMember, "s1");

    expect(result).toEqual({ ok: true, data: { memberId: MEMBER_ID, planName: "Monthly", expiryDate: "2026-11-22" } });
    expect(inserted("members")).toMatchObject({ pin_hash: hashPin("4821"), join_date: "2026-10-23", assigned_trainer_id: null });
    expect(inserted("members")).not.toHaveProperty("pin");
    expect(inserted("memberships")).toMatchObject({
      member_id: MEMBER_ID,
      plan_id: PLAN_ID,
      start_date: "2026-10-23",
      expiry_date: "2026-11-22",
      status: "Active",
    });
  });

  it("removes the new member when the membership cannot be created", async () => {
    results.plans = [{ data: { id: PLAN_ID, name: "Monthly", duration_days: 30 }, error: null }];
    results.members = [{ data: { id: MEMBER_ID }, error: null }];
    results.memberships = [{ data: null, error: { message: "boom" } }];

    const result = await createMember(validMember, "s1");

    expect(result).toMatchObject({ ok: false, error: { code: "INVALID_STATE" } });
    if (!result.ok) expect(result.error.message).not.toContain("boom");
    expect(calls.members.map(([m]) => m)).toContain("delete");
  });
});

describe("updateMember", () => {
  it("maps a duplicate phone to the phone field", async () => {
    results.members = [{ data: null, error: { code: "23505", message: "duplicate" } }];

    const { trainerId, name, phone, weeklyTarget } = validMember;
    const result = await updateMember(MEMBER_ID, { trainerId, name, phone, weeklyTarget }, "s1");

    expect(result).toMatchObject({ ok: false, error: { fields: { phone: "This mobile number already belongs to another member." } } });
  });
});

describe("pause without a reason", () => {
  it.each([{}, { reason: "" }, { reason: "   " }])("pauseMember rejects %o before any database call", async (input) => {
    const result = await pauseMember(MEMBER_ID, input, "s1");

    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION", fields: { reason: "Enter a reason for the pause" } } });
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("pauseMembership itself refuses a blank reason", async () => {
    const result = await pauseMembership({ membershipId: "m1", memberId: MEMBER_ID, reason: " ", staffId: "s1" });

    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("freezes the membership, pauses the member and audits the reason", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-23T06:00:00Z"));
    results.memberships = [{ data: [{ id: "m1" }], error: null }];

    const result = await pauseMembership({ membershipId: "m1", memberId: MEMBER_ID, reason: " Knee surgery ", staffId: "s1" });

    expect(result).toEqual({ ok: true, data: undefined });
    expect(calls.memberships.find(([m]) => m === "update")?.[1][0]).toEqual({ status: "Frozen", freeze_start: "2026-10-23", freeze_end: null });
    expect(calls.members.find(([m]) => m === "update")?.[1][0]).toEqual({ status: "Paused" });
    expect(inserted("audit_logs")).toMatchObject({ action: "membership.paused", summary: expect.stringContaining("Reason: Knee surgery") });
  });

  it("undoes the freeze when the member cannot be marked Paused", async () => {
    results.memberships = [{ data: [{ id: "m1" }], error: null }];
    results.members = [{ data: null, error: { message: "boom" } }];

    const result = await pauseMembership({ membershipId: "m1", memberId: MEMBER_ID, reason: "Travel", staffId: "s1" });

    expect(result).toMatchObject({ ok: false, error: { code: "INVALID_STATE" } });
    expect(calls.memberships.filter(([m]) => m === "update")[1][1][0]).toMatchObject({ status: "Active" });
    expect(calls.audit_logs).toBeUndefined();
  });
});

// Need a connected Supabase project — run after the database is connected.
describe("live database (pending)", () => {
  it.todo("members.phone unique constraint returns 23505 for a real duplicate phone");
  it.todo("a newly added member logs in with phone + PIN and sees the correct plan and expiry");
  it.todo("a member session cannot read another member's row or memberships (RLS)");
  it.todo("an inactive plan is not offered on the Add member form");
});
