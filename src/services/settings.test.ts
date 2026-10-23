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
  ])("rejects a bad %s", (field, value, message) => {
    const result = gymProfileSchema.safeParse({ ...profile, [field]: value });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe(message);
  });
});

describe("rulesSchema", () => {
  it("parses, de-duplicates and sorts renewal windows", () => {
    expect(rulesSchema.parse({ noShowThresholdDays: "10", renewalWindows: "0, 7, 14 3,-3, 7" })).toEqual({
      noShowThresholdDays: 10,
      renewalWindows: [14, 7, 3, 0, -3],
    });
  });

  it.each([
    ["14, 7, 3", "Include 0 (the expiry day)"],
    ["0, -3", "Include at least one day before expiry"],
    ["14, seven, 0", "Enter 2–8 whole numbers between -30 and 30, separated by commas"],
    ["45, 0", "Enter 2–8 whole numbers between -30 and 30, separated by commas"],
  ])("rejects windows %j", (renewalWindows, message) => {
    const result = rulesSchema.safeParse({ noShowThresholdDays: "10", renewalWindows });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe(message);
  });

  it.each(["2", "61", "ten"])("rejects a Red List threshold of %j", (noShowThresholdDays) => {
    expect(rulesSchema.safeParse({ noShowThresholdDays, renewalWindows: "7, 0" }).success).toBe(false);
  });
});

describe("validation happens before any database call", () => {
  it("updateGymProfile", async () => {
    const result = await updateGymProfile({ ...profile, upiId: "bad" }, "s1");
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION", fields: { upiId: expect.any(String) } } });
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("updateRules", async () => {
    const result = await updateRules({ noShowThresholdDays: "10", renewalWindows: "7, 3" }, "s1");
    expect(result).toMatchObject({ ok: false, error: { fields: { renewalWindows: "Include 0 (the expiry day)" } } });
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it.each([{ key: "pin_hash", value: true }, { key: "notifyCare", value: "no" }, {}])("updateMemberPreference rejects %o", async (input) => {
    const result = await updateMemberPreference("m1", input);
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(createServiceClient).not.toHaveBeenCalled();
  });
});

describe("live database (pending)", () => {
  it.todo("a member who turns off missed-visit messages has no WhatsApp button on the Red List");
  it.todo("a member who turns off renewal reminders has no Remind button on Renewals");
  it.todo("the landing page shows the saved plans, trainers, timings and map link");
  it.todo("a new Red List threshold applies on the next scan");
});
