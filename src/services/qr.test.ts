// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateQrToken, verifyQrToken } from "./qr";

const STEP_MS = 45_000;
const STEP_START = Math.floor(1_800_000_000_000 / STEP_MS) * STEP_MS; // start of some time step

beforeEach(() => {
  vi.stubEnv("QR_TOKEN_SECRET", "test-secret");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(STEP_START + 1_000);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

function reencode(token: string, change: (p: { gym: string; step: number }) => object) {
  const [payload, sig] = token.split(".");
  const p = JSON.parse(Buffer.from(payload, "base64url").toString());
  return `${Buffer.from(JSON.stringify(change(p))).toString("base64url")}.${sig}`;
}

describe("QR token", () => {
  it("is valid in its own step and reports the seconds left", () => {
    const { token, expiresInSeconds } = generateQrToken();
    expect(expiresInSeconds).toBe(44);
    expect(verifyQrToken(token).step).toBe(STEP_START / STEP_MS);
  });

  it("is accepted in the next step (network tolerance)", () => {
    const { token } = generateQrToken();
    vi.setSystemTime(STEP_START + STEP_MS + 30_000);
    expect(() => verifyQrToken(token)).not.toThrow();
  });

  it("is rejected as expired two steps later (a screenshot shared 90 s on)", () => {
    const { token } = generateQrToken();
    vi.setSystemTime(STEP_START + 2 * STEP_MS);
    expect(() => verifyQrToken(token)).toThrow("QR_EXPIRED");
  });

  it("rejects a tampered step even with the original signature", () => {
    const { token } = generateQrToken();
    vi.setSystemTime(STEP_START + 5 * STEP_MS);
    expect(() => verifyQrToken(reencode(token, (p) => ({ ...p, step: p.step + 5 })))).toThrow("QR_INVALID");
  });

  it("rejects a tampered signature", () => {
    const { token } = generateQrToken();
    const flipped = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    expect(() => verifyQrToken(flipped)).toThrow("QR_INVALID");
  });

  it("rejects a token signed with another secret", () => {
    vi.stubEnv("QR_TOKEN_SECRET", "other-secret");
    const { token } = generateQrToken();
    vi.stubEnv("QR_TOKEN_SECRET", "test-secret");
    expect(() => verifyQrToken(token)).toThrow("QR_INVALID");
  });

  it("rejects a token from a future step as invalid", () => {
    vi.setSystemTime(STEP_START + 3 * STEP_MS);
    const { token } = generateQrToken();
    vi.setSystemTime(STEP_START);
    expect(() => verifyQrToken(token)).toThrow("QR_INVALID");
  });

  it.each(["", "not-a-token", "a.b.c", "https://example.com/checkin"])("rejects %j", (value) => {
    expect(() => verifyQrToken(value)).toThrow("QR_INVALID");
  });
});
