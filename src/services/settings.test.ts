// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./supabase/server", () => ({
  createServerClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from "./supabase/server";
import { gymProfileSchema, rulesSchema, updateGymProfile, updateRules } from "./settings";
import { updateMemberPreference } from "./members";

beforeEach(() => vi.mocked(createServiceClient).mockReset());

const profile = {
  gymName: "Iron Temple Fitness",
  tagline: "",
  address: "2nd Floor, 14 MG Road, Indiranagar, Bengaluru 560038",
  mapsUrl: "https://maps.app.goo.gl/AbC123",
  phone: "+91 98111 22233",
  openingHours: "Mon–Sat: 5:30 AM – 10:30 PM\nSun: 7 AM – 12 PM",
  upiId: "irontemple@okicici",
  upiName: "",
};

describe("gymProfileSchema", () => {
  it("normalises the phone and blanks optional fields", () => {
    expect(gymProfileSchema.parse(profile)).toMatchObject({ phone: "9811122233", tagline: null, upiName: null });
  });

  it.each([
    ["upiId", "irontemple", "Enter a UPI ID like gymname@okicici"],
    ["phone", "12345", "Enter a 10-digit mobile number"],
    ["mapsUrl", "https://example.com/where", "Paste the share link from Google Maps"],
    ["gymName", "A", "Enter the gym's name"],
    ["gstin", "29ABCDE1234F1Z", "Enter the 15-character GSTIN, e.g. 29ABCDE1234F1Z5"],
  ])("rejects a bad %s", (field, value, message) => {
    const result = gymProfileSchema.safeParse({ ...profile, [field]: value });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe(message);
  });
});

describe("gymProfileSchema — member ID letters", () => {
  it("upper-cases the letters", () => {
    expect(gymProfileSchema.parse({ ...profile, memberIdPrefix: "fl" }).memberIdPrefix).toBe("FL");
  });

  it("treats blank as 'use the gym's initials'", () => {
    expect(gymProfileSchema.parse({ ...profile, memberIdPrefix: "" }).memberIdPrefix).toBeNull();
  });

  it.each(["F", "FLXYZ", "F1", "F-L"])("rejects %j", (memberIdPrefix) => {
    const result = gymProfileSchema.safeParse({ ...profile, memberIdPrefix });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("Use 2 to 4 letters, e.g. FL");
  });
});

describe("rulesSchema", () => {
  it("parses, de-duplicates and sorts renewal windows", () => {
    expect(rulesSchema.parse({ noShowThresholdDays: "10", renewalWindows: "0, 7, 14 3,-3, 7", freezeMaxDaysPerYear: "30" })).toEqual({
      noShowThresholdDays: 10,
      renewalWindows: [14, 7, 3, 0, -3],
      freezeMaxDaysPerYear: 30,
    });
  });

  it.each([
    ["14, 7, 3", "Include 0 (the expiry day)"],
    ["0, -3", "Include at least one day before expiry"],
    ["14, seven, 0", "Enter 2–8 whole numbers between -30 and 30, separated by commas"],
    ["45, 0", "Enter 2–8 whole numbers between -30 and 30, separated by commas"],
  ])("rejects windows %j", (renewalWindows, message) => {
    const result = rulesSchema.safeParse({ noShowThresholdDays: "10", renewalWindows, freezeMaxDaysPerYear: "30" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe(message);
  });

  it.each(["-1", "366", "x"])("rejects a paused-days limit of %j", (freezeMaxDaysPerYear) => {
    expect(rulesSchema.safeParse({ noShowThresholdDays: "10", renewalWindows: "7, 0", freezeMaxDaysPerYear }).success).toBe(false);
  });

  it("upper-cases a valid GSTIN", () => {
    expect(gymProfileSchema.parse({ ...profile, gstin: "29abcde1234f1z5" }).gstin).toBe("29ABCDE1234F1Z5");
  });

  it.each(["2", "61", "ten"])("rejects a Red List threshold of %j", (noShowThresholdDays) => {
    expect(rulesSchema.safeParse({ noShowThresholdDays, renewalWindows: "7, 0", freezeMaxDaysPerYear: "30" }).success).toBe(false);
  });
});

describe("validation happens before any database call", () => {
  it("updateGymProfile", async () => {
    const result = await updateGymProfile({ ...profile, upiId: "bad" }, "s1");
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION", fields: { upiId: expect.any(String) } } });
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("updateRules", async () => {
    const result = await updateRules({ noShowThresholdDays: "10", renewalWindows: "7, 3", freezeMaxDaysPerYear: "30" }, "s1");
    expect(result).toMatchObject({ ok: false, error: { fields: { renewalWindows: "Include 0 (the expiry day)" } } });
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it.each([{ key: "pin_hash", value: true }, { key: "notifyCare", value: "no" }, {}])("updateMemberPreference rejects %o", async (input) => {
    const result = await updateMemberPreference("m1", input);
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(createServiceClient).not.toHaveBeenCalled();
  });
});

// Message toggles reach the Red List / Renewals rows and a new threshold applies on the next scan: tests/db/checkin-redlist.test.ts.
// Buttons hidden on screen and the landing page content: e2e/pilot.spec.ts.
