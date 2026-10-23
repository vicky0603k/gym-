/**
 * Dashboard service — all KPI queries.
 * Every number is a live query; nothing cached or hardcoded.
 *
 * The definitions live in dashboard_kpis() (migration 010) and reuse the same
 * red_list() / renewals_due() functions as the screens each card links to, so
 * a card and its list always agree.
 */
import { createServiceClient } from "./supabase/server";
import { getRedList, type RedListRow } from "./red-list";

export interface DashboardKPIs {
  activeMembers: number;
  todayCheckins: number;
  sevenDayActiveMembers: number;
  openRedListCases: number;
  membersReturnedAfterFollowUp: number;
  renewalsDueIn7Days: { count: number; expectedAmount: number };
  renewalCollectionThisMonth: number;
  addonRevenueThisMonth: number;
  followupsDueToday: number;
  summary: {
    casesOpenedToday: number;
    renewalsPaidToday: { count: number; amount: number };
    paymentsPending: number;
  };
}

/** Throws on a database error (the dashboard then shows its error state with Retry). */
export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  const { data, error } = await createServiceClient().rpc("dashboard_kpis", {});
  if (error || !data) throw new Error("DASHBOARD_LOAD_FAILED");
  return {
    activeMembers: data.active_members,
    todayCheckins: data.checkins_today,
    sevenDayActiveMembers: data.active_7_days,
    openRedListCases: data.red_list_open,
    membersReturnedAfterFollowUp: data.returned_this_month,
    renewalsDueIn7Days: { count: data.renewals_due_7_count, expectedAmount: data.renewals_due_7_amount },
    renewalCollectionThisMonth: data.renewal_collection_month,
    addonRevenueThisMonth: data.addon_revenue_month,
    followupsDueToday: data.followups_due,
    summary: {
      casesOpenedToday: data.cases_opened_today,
      renewalsPaidToday: { count: data.renewals_paid_today_count, amount: data.renewals_paid_today_amount },
      paymentsPending: data.payments_pending,
    },
  };
}

/** Follow-ups due today or overdue, most absent first. */
export async function getFollowUpsDue(limit = 5): Promise<{ rows: RedListRow[]; total: number }> {
  const { rows } = await getRedList();
  const due = rows.filter((r) => r.followUpDue);
  return { rows: due.slice(0, limit), total: due.length };
}
