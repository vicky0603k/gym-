// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./supabase/server", () => ({
  createServerClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from "./supabase/server";
import { getRedList, noShowMessage, recordFollowUp, runDailyScan, whatsAppLink } from "./red-list";
import type { RedListDbRow } from "./supabase/database.types";

const CASE_ID = "e0000000-0000-4000-8000-000000000001";
const rpc = vi.fn();

beforeEach(() => {
  rpc.mockReset();
  vi.mocked(createServiceClient).mockReset().mockReturnValue({ rpc } as never);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-23T06:00:00Z")); // 23 Oct 2026, Kolkata
});
afterEach(() => vi.useRealTimers());

function row(over: Partial<RedListDbRow>): RedListDbRow {
  return {
    case_id: CASE_ID, member_id: "m1", member_name: "Neha Verma", member_phone: "9876543210",
    case_status: "Open", opened_on: "2026-10-20", next_action_date: null, plan_name: "Quarterly",
    expiry_date: "2027-01-10", join_date: "2026-03-01", last_visit: "2026-10-08", absent_days: 15,
    trainer_name: null, last_followup_at: null, last_followup_outcome: null, last_followup_channel: null,
    followup_count: 0, notify_care: true, ...over,
  };
}

describe("runDailyScan", () => {
  it("marks lapsed members Expired first, then runs the no-show scan", async () => {
    rpc
      .mockResolvedValueOnce({ data: { ok: true, memberships_expired: 5, members_expired: 4 }, error: null })
      .mockResolvedValueOnce({ data: { ok: true, cases_opened: 3, followups_due: 1, threshold: 10 }, error: null });
    await expect(runDailyScan()).resolves.toEqual({ casesOpened: 3, followupsDue: 1, threshold: 10, membersExpired: 4 });
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(["expire_lapsed_memberships", "run_no_show_scan"]);
  });

  it("throws (never reports zero) when the database call fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(runDailyScan()).rejects.toThrow("SCAN_FAILED");
  });
});

describe("getRedList filters", () => {
  beforeEach(() => {
    rpc.mockResolvedValue({
      data: [
        row({ case_id: "a", absent_days: 11 }),
        row({ case_id: "b", absent_days: 14, expiry_date: "2026-11-05" }),
        row({ case_id: "c", absent_days: 15 }),
        row({ case_id: "d", absent_days: 21, case_status: "Contacted", next_action_date: "2026-10-23" }),
        row({ case_id: "e", absent_days: 40, case_status: "Contacted", next_action_date: "2026-10-30" }),
      ],
      error: null,
    });
  });

  it.each([
    [undefined, ["a", "b", "c", "d", "e"]],
    ["10-14", ["a", "b"]],
    ["15-21", ["c", "d"]],
    ["22+", ["e"]],
    ["expiring-soon", ["b"]],
  ] as const)("filter %s", async (filter, ids) => {
    const { rows } = await getRedList(filter);
    expect(rows.map((r) => r.case_id)).toEqual(ids);
  });

  it("counts every filter and the follow-ups due today", async () => {
    const { counts, dueToday, rows } = await getRedList();
    expect(counts).toEqual({ all: 5, "10-14": 2, "15-21": 2, "22+": 1, "expiring-soon": 1 });
    expect(dueToday).toBe(1);
    expect(rows.find((r) => r.case_id === "d")?.followUpDue).toBe(true);
  });
});

describe("recordFollowUp", () => {
  const valid = { caseId: CASE_ID, channel: "Call", outcome: "WillReturn", nextActionDate: "2026-10-25", notes: " Back on Monday " };

  it.each([
    [{ ...valid, nextActionDate: "" }, "nextActionDate", "Choose the date for the next follow-up"],
    [{ ...valid, nextActionDate: "2026-10-22" }, "nextActionDate", "The next follow-up can't be in the past"],
    [{ ...valid, outcome: "Maybe" }, "outcome", "Choose what they said"],
    [{ ...valid, channel: "Email" }, "channel", "Choose how you contacted them"],
  ])("rejects %o before any database call", async (input, field, message) => {
    const result = await recordFollowUp(input, "s1");
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION", fields: { [field]: message } } });
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("appends through record_followup with trimmed notes", async () => {
    rpc.mockResolvedValue({ data: { ok: true, closed: false }, error: null });
    const result = await recordFollowUp(valid, "s1");
    expect(rpc).toHaveBeenCalledWith("record_followup", {
      p_case_id: CASE_ID, p_staff_id: "s1", p_channel: "Call", p_outcome: "WillReturn",
      p_notes: "Back on Monday", p_next_action_date: "2026-10-25",
    });
    expect(result).toEqual({ ok: true, data: { closed: false } });
  });

  it("closes a case for a member who wants to cancel without a next date", async () => {
    rpc.mockResolvedValue({ data: { ok: true, closed: true }, error: null });
    await recordFollowUp({ ...valid, outcome: "Cancelled", nextActionDate: "" }, "s1");
    expect(rpc).toHaveBeenCalledWith("record_followup", expect.objectContaining({ p_outcome: "Cancelled", p_next_action_date: null }));
  });

  it("explains an already-resolved case in plain language", async () => {
    rpc.mockResolvedValue({ data: { ok: false, code: "INVALID_STATE" }, error: null });
    const result = await recordFollowUp(valid, "s1");
    expect(result).toEqual({ ok: false, error: { code: "INVALID_STATE", message: "This case is already resolved. Refresh the Red List." } });
  });
});

describe("no-show WhatsApp message", () => {
  it("renders the API.md template with no placeholders left", () => {
    const text = noShowMessage({ name: "Neha Verma", lastVisit: "2026-10-08", joinDate: "2026-03-01", gymPhone: "9811122233" });
    expect(text).toBe(
      "Hi Neha, your last gym check-in was on 8 Oct 2026. Is everything okay? If you need a timing change, a pause, or trainer help, reply here: https://wa.me/919811122233"
    );
    expect(text).not.toMatch(/\{\{|\}\}/);
  });

  it("handles a member who never checked in and a gym with no phone set", () => {
    const text = noShowMessage({ name: "Arjun", lastVisit: null, joinDate: "2026-10-01", gymPhone: null });
    expect(text).toContain("we haven't seen you at the gym since you joined on 1 Oct 2026.");
    expect(text).toMatch(/just reply to this message\.$/);
  });

  it("builds a wa.me link with +91 and an encoded message", () => {
    expect(whatsAppLink("9876543210", "Hi Neha, okay?")).toBe("https://wa.me/919876543210?text=Hi%20Neha%2C%20okay%3F");
  });
});

describe("live database (pending)", () => {
  it.todo("running the scan twice on one day opens no duplicate case");
  it.todo("a Paused / Frozen / Expired / Cancelled member never appears on the Red List");
  it.todo("a member who joined yesterday or just resumed from a pause is not flagged");
  it.todo("a return check-in resolves the case as Returned and its follow-ups stay visible");
  it.todo("a Contacted case becomes FollowUpDue when its next action date arrives");
});
