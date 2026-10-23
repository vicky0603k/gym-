// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./supabase/server", () => ({
  createServerClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from "./supabase/server";
import { getDashboardKPIs } from "./dashboard";

const rpc = vi.fn();
beforeEach(() => {
  rpc.mockReset();
  vi.mocked(createServiceClient).mockReset().mockReturnValue({ rpc } as never);
});

describe("getDashboardKPIs", () => {
  it("maps every KPI from one dashboard_kpis() call", async () => {
    rpc.mockResolvedValue({
      data: {
        active_members: 84, checkins_today: 37, active_7_days: 61, red_list_open: 6, followups_due: 2,
        returned_this_month: 3, renewals_due_7_count: 5, renewals_due_7_amount: 9750, renewal_collection_month: 41250,
        addon_revenue_month: 12497, cases_opened_today: 1, renewals_paid_today_count: 2, renewals_paid_today_amount: 3250,
        payments_pending: 4,
      },
      error: null,
    });

    const k = await getDashboardKPIs();

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("dashboard_kpis", {});
    expect(k).toEqual({
      activeMembers: 84,
      todayCheckins: 37,
      sevenDayActiveMembers: 61,
      openRedListCases: 6,
      membersReturnedAfterFollowUp: 3,
      renewalsDueIn7Days: { count: 5, expectedAmount: 9750 },
      renewalCollectionThisMonth: 41250,
      addonRevenueThisMonth: 12497,
      followupsDueToday: 2,
      summary: { casesOpenedToday: 1, renewalsPaidToday: { count: 2, amount: 3250 }, paymentsPending: 4 },
    });
  });

  it("throws instead of showing zeros when the query fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(getDashboardKPIs()).rejects.toThrow("DASHBOARD_LOAD_FAILED");
  });
});

describe("live database (pending)", () => {
  it.todo("every KPI matches a hand count from the seed data (Phase 11 done criterion)");
  it.todo("7-day active counts distinct members, not check-ins");
  it.todo("the daily cron marks a lapsed member Expired and leaves Paused / Frozen alone");
});
