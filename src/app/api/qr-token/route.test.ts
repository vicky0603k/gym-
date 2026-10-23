// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/services/auth", () => ({ getCurrentStaff: vi.fn() }));

import { getCurrentStaff } from "@/services/auth";
import { verifyQrToken } from "@/services/qr";
import { GET } from "./route";

beforeEach(() => {
  vi.stubEnv("QR_TOKEN_SECRET", "test-secret");
});

describe("GET /api/qr-token", () => {
  it("returns 401 without a staff session (anonymous or member)", async () => {
    // A member session has no staff_users row, so getCurrentStaff() is null for both.
    vi.mocked(getCurrentStaff).mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(await res.json()).not.toHaveProperty("token");
  });

  it.each(["Owner", "FrontDesk"] as const)("returns a valid token for %s", async (role) => {
    vi.mocked(getCurrentStaff).mockResolvedValue({
      id: "s1", name: "Staff", role, email: "s@gym.in", created_at: "", updated_at: "",
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(() => verifyQrToken(body.token)).not.toThrow();
  });
});
