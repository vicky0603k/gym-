// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./supabase/server", () => ({
  createServerClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from "./supabase/server";
import { summariseWeeks } from "./streak";
import { updateWeeklyGoalDefault } from "./settings";
import { toKolkataDateString, weekStartOf } from "@/utils/dates";

// Thursday 22 Oct 2026 — this week runs Mon 19 Oct to Sun 25 Oct.
const TODAY = "2026-10-22";
const base = { target: 3, pauses: [], joinDate: "2026-01-05", today: TODAY, lookbackWeeks: 8 };
const visits = (monday: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${monday.slice(0, 8)}${String(Number(monday.slice(8)) + i).padStart(2, "0")}`);

describe("week boundaries in Asia/Kolkata", () => {
  it("puts a 12:30 AM IST Monday check-in in the new week (it is still Sunday in UTC)", () => {
    const checkin = "2026-10-25T19:00:00Z"; // Mon 26 Oct, 12:30 AM IST
    expect(toKolkataDateString(checkin)).toBe("2026-10-26");
    expect(weekStartOf(toKolkataDateString(checkin))).toBe("2026-10-26");
  });

  it("keeps a Sunday 11:59 PM IST check-in in the old week", () => {
    expect(weekStartOf(toKolkataDateString("2026-10-25T18:29:00Z"))).toBe("2026-10-19");
  });

  it("handles weeks that cross a month boundary", () => {
    expect(weekStartOf("2026-11-01")).toBe("2026-10-26");
  });
});

describe("summariseWeeks", () => {
  it("goal met: counts this week's visits against the target", () => {
    const s = summariseWeeks({ ...base, checkinDates: visits("2026-10-19", 3) });
    expect(s).toMatchObject({ completed: 3, target: 3, goalMet: true, currentStreak: 1 });
    expect(s.recentWeeks.at(-1)).toEqual({ weekStart: "2026-10-19", visits: 3, result: "met" });
  });

  it("goal not met yet: this week is in progress, never a failure", () => {
    const s = summariseWeeks({ ...base, checkinDates: [...visits("2026-10-12", 3), "2026-10-20"] });
    expect(s).toMatchObject({ completed: 1, goalMet: false, currentStreak: 1 });
    expect(s.recentWeeks.at(-1)?.result).toBe("current");
  });

  it("a missed past week breaks the current streak but not the best streak", () => {
    const s = summariseWeeks({
      ...base,
      checkinDates: [...visits("2026-09-21", 3), ...visits("2026-09-28", 3), ...visits("2026-10-12", 3)],
    });
    expect(s.recentWeeks.find((w) => w.weekStart === "2026-10-05")?.result).toBe("missed");
    expect(s.currentStreak).toBe(1);
    expect(s.bestStreak).toBe(2);
  });

  it("frozen week excluded: a paused week is neutral and does not break the streak", () => {
    const s = summariseWeeks({
      ...base,
      checkinDates: [...visits("2026-09-28", 3), "2026-10-05", ...visits("2026-10-12", 3)],
      pauses: [{ start: "2026-10-07", end: "2026-10-11" }],
    });
    expect(s.recentWeeks.find((w) => w.weekStart === "2026-10-05")).toEqual({ weekStart: "2026-10-05", visits: 1, result: "paused" });
    expect(s.currentStreak).toBe(2);
    expect(s.recentWeeks.some((w) => w.result === "missed" && w.weekStart >= "2026-09-28")).toBe(false);
  });

  it("an ongoing pause (no end date) covers this week and is reported", () => {
    const s = summariseWeeks({ ...base, checkinDates: visits("2026-10-12", 3), pauses: [{ start: "2026-10-16", end: null }] });
    expect(s.pausedNow).toBe(true);
    expect(s.recentWeeks.at(-1)?.result).toBe("paused");
    expect(s.currentStreak).toBe(1);
  });

  it("a met week still counts even if it overlaps a pause", () => {
    const s = summariseWeeks({ ...base, checkinDates: visits("2026-10-12", 3), pauses: [{ start: "2026-10-17", end: "2026-10-18" }] });
    expect(s.recentWeeks.find((w) => w.weekStart === "2026-10-12")?.result).toBe("met");
  });

  it("a member resumed today is not on hold; a pause resumed the same day pauses nothing", () => {
    const s = summariseWeeks({ ...base, checkinDates: [], pauses: [{ start: TODAY, end: TODAY }] });
    expect(s.pausedNow).toBe(false);
    expect(s.recentWeeks.at(-1)?.result).toBe("current");
    const earlier = summariseWeeks({ ...base, checkinDates: [], pauses: [{ start: "2026-10-14", end: "2026-10-19" }] });
    expect(earlier.recentWeeks.find((w) => w.weekStart === "2026-10-12")?.result).toBe("paused");
    expect(earlier.recentWeeks.at(-1)?.result).toBe("current"); // resumed Monday 19 Oct: this week is live
  });

  it("backdated attendance lands in its own week and changes that week's count", () => {
    const before = summariseWeeks({ ...base, checkinDates: visits("2026-10-12", 2) });
    const after = summariseWeeks({ ...base, checkinDates: [...visits("2026-10-12", 2), "2026-10-18"] });
    expect(before.recentWeeks.find((w) => w.weekStart === "2026-10-12")?.result).toBe("missed");
    expect(after.recentWeeks.find((w) => w.weekStart === "2026-10-12")).toMatchObject({ visits: 3, result: "met" });
    expect(after.completed).toBe(0);
  });

  it("does not show weeks before joining, and a part join week is not a failure", () => {
    const s = summariseWeeks({ ...base, joinDate: "2026-10-15", checkinDates: ["2026-10-16"] });
    expect(s.recentWeeks.map((w) => [w.weekStart, w.result])).toEqual([
      ["2026-10-12", "paused"],
      ["2026-10-19", "current"],
    ]);
    expect(s.bestStreak).toBe(0);
  });

  it("is never a daily streak: rest days inside a met week change nothing", () => {
    const spread = summariseWeeks({ ...base, checkinDates: ["2026-10-12", "2026-10-15", "2026-10-18"] });
    const packed = summariseWeeks({ ...base, checkinDates: ["2026-10-12", "2026-10-13", "2026-10-14"] });
    expect(spread.currentStreak).toBe(packed.currentStreak);
  });
});

describe("updateWeeklyGoalDefault", () => {
  beforeEach(() => vi.mocked(createServiceClient).mockReset());

  it.each(["0", "8", "2.5", "x"])("rejects %j before any database call", async (weeklyGoalDefault) => {
    const result = await updateWeeklyGoalDefault({ weeklyGoalDefault }, "s1");
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION", fields: { weeklyGoalDefault: expect.any(String) } } });
    expect(createServiceClient).not.toHaveBeenCalled();
  });
});

// A backdated visit counts toward its week: tests/db/status-freeze.test.ts.
// Paused weeks and the default-target form: e2e/pilot.spec.ts.
