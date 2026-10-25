// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./supabase/server", () => ({
  createServerClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from "./supabase/server";
import { generateQrToken } from "./qr";
import { assistedCheckIn, qrCheckIn } from "./attendance";

const MEMBER_ID = "b0000000-0000-4000-8000-000000000001";
const rpc = vi.fn();

beforeEach(() => {
  vi.stubEnv("QR_TOKEN_SECRET", "test-secret");
  rpc.mockReset();
  vi.mocked(createServiceClient).mockReset().mockReturnValue({ rpc } as never);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("qrCheckIn", () => {
  it("calls check_in once with the verified step and maps success", async () => {
    const { token } = generateQrToken();
    rpc.mockResolvedValue({
      data: { ok: true, attendance_id: "a1", checkin_at: "2026-10-23T02:12:00Z", case_resolved: true, week_visits: 3, weekly_target: 4 },
      error: null,
    });

    const result = await qrCheckIn(MEMBER_ID, token);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("check_in", {
      p_member_id: MEMBER_ID,
      p_source: "QR",
      p_qr_step: Math.floor(Date.now() / 45_000),
    });
    expect(result).toEqual({
      ok: true,
      attendanceId: "a1",
      checkinAt: "2026-10-23T02:12:00Z",
      weeklyGoal: { completed: 3, target: 4 },
      caseResolved: true,
    });
  });

  it("rejects a forged token without touching the database", async () => {
    const result = await qrCheckIn(MEMBER_ID, "forged.token");

    expect(result).toMatchObject({ ok: false, error: { code: "QR_INVALID" } });
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("rejects an old token as expired without touching the database", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { token } = generateQrToken();
    vi.setSystemTime(Date.now() + 120_000);

    const result = await qrCheckIn(MEMBER_ID, token);

    expect(result).toMatchObject({ ok: false, error: { code: "QR_EXPIRED", message: "This QR has expired. Scan the current QR at the gate." } });
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("shows the earlier check-in time (Kolkata) for a duplicate", async () => {
    rpc.mockResolvedValue({ data: { ok: false, code: "DUPLICATE_CHECKIN", last_checkin_at: "2026-10-23T02:12:00Z" }, error: null });

    const result = await qrCheckIn(MEMBER_ID, generateQrToken().token);

    expect(result).toEqual({
      ok: false,
      error: { code: "DUPLICATE_CHECKIN", message: "Already checked in at 7:42 AM.", lastCheckinAt: "2026-10-23T02:12:00Z" },
    });
  });

  it.each([
    ["MEMBER_BLOCKED", "Check-in isn't allowed on this account. Please speak to the front desk."],
    ["MEMBER_CANCELLED", "This membership has been cancelled. Please speak to the front desk."],
    ["MEMBERSHIP_PAUSED", "Your membership is paused. Ask the front desk to resume it."],
  ])("maps %s to one plain-language message", async (code, message) => {
    rpc.mockResolvedValue({ data: { ok: false, code }, error: null });

    const result = await qrCheckIn(MEMBER_ID, generateQrToken().token);

    expect(result).toEqual({ ok: false, error: { code, message } });
  });

  it("returns the expiry date for an expired membership", async () => {
    rpc.mockResolvedValue({ data: { ok: false, code: "MEMBERSHIP_EXPIRED", expiry_date: "2027-02-14" }, error: null });

    const result = await qrCheckIn(MEMBER_ID, generateQrToken().token);

    expect(result).toEqual({
      ok: false,
      error: { code: "MEMBERSHIP_EXPIRED", message: "Your membership expired on 14 Feb 2027.", expiryDate: "2027-02-14" },
    });
  });

  it("hides database errors behind a retry message", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "function check_in does not exist" } });

    const result = await qrCheckIn(MEMBER_ID, generateQrToken().token);

    expect(result).toMatchObject({ ok: false, error: { code: "INVALID_STATE" } });
    if (!result.ok) expect(result.error.message).not.toContain("function");
  });
});

describe("assistedCheckIn", () => {
  it.each([{ memberId: MEMBER_ID }, { memberId: MEMBER_ID, reason: "" }, { memberId: MEMBER_ID, reason: "   " }])(
    "requires a reason before any database call: %o",
    async (input) => {
      const result = await assistedCheckIn(input, "s1");

      expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION", fields: { reason: "Enter a reason for the assisted check-in" } } });
      expect(createServiceClient).not.toHaveBeenCalled();
    }
  );

  it("passes staff id and trimmed reason to the same check_in function", async () => {
    rpc.mockResolvedValue({
      data: { ok: true, attendance_id: "a2", checkin_at: "2026-10-23T12:00:00Z", case_resolved: false, week_visits: 1, weekly_target: 4 },
      error: null,
    });

    const result = await assistedCheckIn({ memberId: MEMBER_ID, reason: "  Phone battery dead " }, "s1");

    expect(rpc).toHaveBeenCalledWith("check_in", {
      p_member_id: MEMBER_ID,
      p_source: "Assisted",
      p_staff_id: "s1",
      p_reason: "Phone battery dead",
    });
    expect(result.ok).toBe(true);
  });

  it("uses staff wording for a paused member", async () => {
    rpc.mockResolvedValue({ data: { ok: false, code: "MEMBERSHIP_PAUSED" }, error: null });

    const result = await assistedCheckIn({ memberId: MEMBER_ID, reason: "Forgot phone" }, "s1");

    expect(result).toMatchObject({ ok: false, error: { message: expect.stringContaining("This member's membership is paused") } });
  });
});

// Database rules (one row for repeat scans, Blocked refused, case resolved, assisted audit):
// tests/db/checkin-redlist.test.ts and tests/live/live.test.ts (truly simultaneous scans).
// A 2-minute-old QR screenshot is refused above ("rejects an old token as expired").
