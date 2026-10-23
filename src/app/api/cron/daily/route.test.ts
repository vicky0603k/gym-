// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/services/red-list", () => ({ runDailyScan: vi.fn() }));

import { runDailyScan } from "@/services/red-list";
import { GET } from "./route";

const call = (auth?: string) =>
  GET(new Request("http://localhost/api/cron/daily", { headers: auth ? { authorization: auth } : {} }));

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "cron-secret");
  vi.mocked(runDailyScan).mockReset().mockResolvedValue({ casesOpened: 2, followupsDue: 1, threshold: 10 });
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/cron/daily", () => {
  it.each([undefined, "Bearer wrong", "cron-secret", "Bearer cron-secret-longer"])("rejects %j without running the scan", async (auth) => {
    const res = await call(auth);
    expect(res.status).toBe(401);
    expect(runDailyScan).not.toHaveBeenCalled();
  });

  it("rejects everything when CRON_SECRET is not set", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer ")).status).toBe(401);
  });

  it("runs the scan with the right secret", async () => {
    const res = await call("Bearer cron-secret");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ cases_opened: 2, followups_due: 1 });
  });

  it("returns 500 without details when the scan fails", async () => {
    vi.mocked(runDailyScan).mockRejectedValue(new Error("relation does not exist"));
    const res = await call("Bearer cron-secret");
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("relation");
  });
});
