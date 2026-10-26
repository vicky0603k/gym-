// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./supabase/server", () => ({
  createServerClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from "./supabase/server";
import { hashPin } from "./auth";
import { pauseMembership } from "./memberships";
import { correctExpiry, createMember, createMemberSchema, listMembers, pauseMember, resetMemberPin, updateMember } from "./members";

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

describe("listMembers — search", () => {
  const orFilter = () => calls.members?.find(([m]) => m === "or")?.[1][0];

  it("finds a member by their member ID", async () => {
    results.members = [{ data: [], error: null }];
    await listMembers({ search: "FL-346587" });
    expect(orFilter()).toContain("member_code.eq.346587");
  });

  it("finds a member by the 6 digits alone", async () => {
    results.members = [{ data: [], error: null }];
    await listMembers({ search: "346587" });
    expect(orFilter()).toContain("member_code.eq.346587");
  });

  it("does not search member IDs for a name", async () => {
    results.members = [{ data: [], error: null }];
    await listMembers({ search: "Neha" });
    expect(orFilter()).not.toContain("member_code");
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
    expect(inserted("members")).toMatchObject({ pin_hash: expect.stringMatching(/^scrypt\$/), join_date: "2026-10-23", assigned_trainer_id: null });
    const stored = inserted("members").pin_hash as string;
    expect(hashPin("4821", stored.split("$")[1])).toBe(stored);
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

describe("resetMemberPin", () => {
  it.each([{}, { pin: "12" }, { pin: "12a4" }])("rejects %o before any database call", async (input) => {
    expect(await resetMemberPin(MEMBER_ID, input, "s1")).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("stores only the hash, clears the lockout and audits without the PIN", async () => {
    results.members = [{ data: [{ name: "Neha Verma" }], error: null }];

    expect(await resetMemberPin(MEMBER_ID, { pin: "5512" }, "s1")).toEqual({ ok: true, data: undefined });
    const update = calls.members.find(([m]) => m === "update")?.[1][0] as Record<string, unknown>;
    expect(update).toMatchObject({ pin_failed_attempts: 0, pin_locked_until: null });
    expect(hashPin("5512", (update.pin_hash as string).split("$")[1])).toBe(update.pin_hash);
    expect(inserted("audit_logs")).toMatchObject({ action: "member.pin_reset", record_id: MEMBER_ID });
    expect(JSON.stringify(inserted("audit_logs"))).not.toContain("5512");
  });

  it("reports a missing member and writes no audit row", async () => {
    results.members = [{ data: [], error: null }];
    expect(await resetMemberPin(MEMBER_ID, { pin: "5512" }, "s1")).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(calls.audit_logs).toBeUndefined();
  });
});

describe("correctExpiry", () => {
  const membership = { id: "m1", start_date: "2026-09-01", expiry_date: "2026-10-01", status: "Expired" };

  it.each([
    [{ expiryDate: "2026-11-01" }, "reason"],
    [{ expiryDate: "2026-11-01", reason: "  " }, "reason"],
    [{ expiryDate: "1 Nov", reason: "Typo" }, "expiryDate"],
  ])("rejects %o before any database call", async (input, field) => {
    const result = await correctExpiry(MEMBER_ID, input, "s1");
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION", fields: { [field]: expect.any(String) } } });
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("refuses a date on or before the start date", async () => {
    results.memberships = [{ data: membership, error: null }];
    const result = await correctExpiry(MEMBER_ID, { expiryDate: "2026-09-01", reason: "Typo" }, "s1");
    expect(result).toMatchObject({ ok: false, error: { fields: { expiryDate: "The expiry must be after the start date." } } });
    expect(calls.memberships.map(([m]) => m)).not.toContain("update");
  });

  it("re-opens an expired membership moved into the future and audits old and new dates", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-23T06:00:00Z"));
    results.memberships = [{ data: membership, error: null }, { data: [{ id: "m1" }], error: null }];

    const result = await correctExpiry(MEMBER_ID, { expiryDate: "2026-11-01", reason: " Typed the wrong month " }, "s1");

    expect(result).toEqual({ ok: true, data: undefined });
    expect(calls.memberships.find(([m]) => m === "update")?.[1][0]).toEqual({ expiry_date: "2026-11-01", status: "Active" });
    expect(calls.members.find(([m]) => m === "update")?.[1][0]).toEqual({ status: "Active" });
    expect(inserted("audit_logs")).toMatchObject({
      action: "membership.expiry_corrected",
      summary: "Expiry corrected from 2026-10-01 to 2026-11-01. Reason: Typed the wrong month",
    });
  });

  it("only changes the date of an active membership", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-23T06:00:00Z"));
    results.memberships = [{ data: { ...membership, status: "Active", expiry_date: "2026-12-01" }, error: null }, { data: [{ id: "m1" }], error: null }];

    expect(await correctExpiry(MEMBER_ID, { expiryDate: "2026-11-15", reason: "Wrong plan length" }, "s1")).toMatchObject({ ok: true });
    expect(calls.memberships.find(([m]) => m === "update")?.[1][0]).toEqual({ expiry_date: "2026-11-15" });
    expect(calls.members).toBeUndefined();
  });

  it("writes no audit row when the date changed underneath (concurrent edit)", async () => {
    results.memberships = [{ data: { ...membership, status: "Active" }, error: null }, { data: [], error: null }];
    expect(await correctExpiry(MEMBER_ID, { expiryDate: "2026-11-15", reason: "Typo" }, "s1")).toMatchObject({ ok: false });
    expect(calls.audit_logs).toBeUndefined();
  });
});

// Duplicate phone, RLS isolation, inactive plans: tests/db/members-addons.test.ts.
// New member logs in with phone + PIN and sees plan and expiry: tests/live/live.test.ts and e2e/pilot.spec.ts.
