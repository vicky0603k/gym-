// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.mock("./supabase/server", () => ({
  createServerClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from "./supabase/server";
import { hashPin, legacyPinHash, memberLogin, memberLoginSchema, staffLoginSchema, MEMBER_LOGIN_FAILED } from "./auth";

describe("hashPin", () => {
  it("legacy hash matches the seed's sha256 hex", () => {
    expect(legacyPinHash("1234")).toBe("03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4");
  });

  it("salts every PIN: same PIN, different stored hash; same salt, same hash", () => {
    const a = hashPin("1234");
    const b = hashPin("1234");
    expect(a).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
    expect(hashPin("1234", a.split("$")[1])).toBe(a);
    expect(hashPin("1235", a.split("$")[1])).not.toBe(a);
  });
});

describe("memberLoginSchema", () => {
  it("accepts a 10-digit Indian mobile and 4-digit PIN", () => {
    expect(memberLoginSchema.safeParse({ phone: "9000020001", pin: "1234" }).success).toBe(true);
  });
  it.each([
    { phone: "900002000", pin: "1234" },
    { phone: "5000020001", pin: "1234" },
    { phone: "+919000020001", pin: "1234" },
    { phone: "9000020001", pin: "123" },
    { phone: "9000020001", pin: "12a4" },
    {},
  ])("rejects %o", (input) => {
    expect(memberLoginSchema.safeParse(input).success).toBe(false);
  });
});

describe("staffLoginSchema", () => {
  it("rejects a bad email or empty password", () => {
    expect(staffLoginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
    expect(staffLoginSchema.safeParse({ email: "a@b.in", password: "" }).success).toBe(false);
  });
});

describe("memberLogin", () => {
  it("returns VALIDATION without touching the database for bad input", async () => {
    const result = await memberLogin({ phone: "123", pin: "1" });
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("returns the generic message when the PIN check fails (unknown phone, wrong PIN or locked)", async () => {
    const rpc = vi.fn(async (fn: string) => ({ data: fn === "member_pin_salt" ? "ab".repeat(16) : null, error: null }));
    vi.mocked(createServiceClient).mockReturnValue({ rpc } as never);

    const result = await memberLogin({ phone: "9000020001", pin: "0000" });

    expect(rpc).toHaveBeenCalledWith("verify_member_pin", { p_phone: "9000020001", p_pin_hash: hashPin("0000", "ab".repeat(16)) });
    expect(result).toEqual({ ok: false, error: { code: "UNAUTHENTICATED", message: MEMBER_LOGIN_FAILED } });
  });

  it("checks a legacy (unsalted) PIN with the legacy hash", async () => {
    const rpc = vi.fn(async (fn: string) => ({ data: fn === "member_pin_salt" ? "" : null, error: null }));
    vi.mocked(createServiceClient).mockReturnValue({ rpc } as never);

    await memberLogin({ phone: "9000020001", pin: "1234" });

    expect(rpc).toHaveBeenCalledWith("verify_member_pin", { p_phone: "9000020001", p_pin_hash: legacyPinHash("1234") });
  });

  it("still hashes for an unknown phone and fails generically", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    vi.mocked(createServiceClient).mockReturnValue({ rpc } as never);

    const result = await memberLogin({ phone: "9999999999", pin: "1234" });

    expect(rpc).toHaveBeenCalledWith("verify_member_pin", { p_phone: "9999999999", p_pin_hash: expect.stringMatching(/^scrypt\$/) });
    expect(result).toMatchObject({ ok: false, error: { message: MEMBER_LOGIN_FAILED } });
  });
});
