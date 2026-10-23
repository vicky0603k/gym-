/**
 * Dashboard service — all KPI queries.
 * Every number is a live query; nothing cached or hardcoded.
 */
import { createServiceClient } from "./supabase/server";
import { todayKolkata } from "@/utils/dates";

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
}

export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  const supabase = createServiceClient();
  const today = todayKolkata();

  // Today's start and end in UTC (Kolkata is UTC+5:30)
  const todayStart = new Date(`${today}T00:00:00+05:30`).toISOString();
  const todayEnd = new Date(`${today}T23:59:59+05:30`).toISOString();

  // 7 days ago
  const sevenDaysAgo = new Date(
    new Date(`${today}T00:00:00+05:30`).getTime() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  // Start of current month
  const monthStart = today.substring(0, 8) + "01";
  const monthStartUTC = new Date(`${monthStart}T00:00:00+05:30`).toISOString();

  const [
    { count: activeMembers },
    { count: todayCheckins },
    { count: openRedListCases },
    { count: sevenDayActiveMembers },
    { count: membersReturnedAfterFollowUp },
    { count: followupsDueToday },
  ] = await Promise.all([
    supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("status", "Active"),

    supabase
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .gte("checkin_at", todayStart)
      .lte("checkin_at", todayEnd),

    supabase
      .from("no_show_cases")
      .select("id", { count: "exact", head: true })
      .in("status", ["Open", "Contacted", "FollowUpDue"]),

    supabase
      .from("attendance")
      .select("member_id", { count: "exact", head: true })
      .gte("checkin_at", sevenDaysAgo),

    supabase
      .from("no_show_cases")
      .select("id", { count: "exact", head: true })
      .eq("status", "Returned"),

    supabase
      .from("no_show_cases")
      .select("id", { count: "exact", head: true })
      .eq("next_action_date", today)
      .in("status", ["Contacted", "FollowUpDue"]),
  ]);

  // Renewals due in next 7 days
  const in7Days = new Date(
    new Date(`${today}T23:59:59+05:30`).getTime() + 7 * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .substring(0, 10);

  const { data: renewalsDue } = await supabase
    .from("memberships")
    .select("expiry_date, plans(price, discount_pct)")
    .eq("status", "Active")
    .gte("expiry_date", today)
    .lte("expiry_date", in7Days);

  const renewalsDueIn7Days = {
    count: renewalsDue?.length ?? 0,
    expectedAmount: (renewalsDue ?? []).reduce((sum, m) => {
      const plan = m.plans as { price: number; discount_pct: number } | null;
      if (!plan) return sum;
      const disc = Math.floor((plan.price * plan.discount_pct) / 100);
      return sum + plan.price - disc;
    }, 0),
  };

  // Renewal collection this month
  const { data: renewalPayments } = await supabase
    .from("payments")
    .select("amount")
    .eq("purpose", "Renewal")
    .eq("status", "Paid")
    .gte("verified_at", monthStartUTC);

  const renewalCollectionThisMonth = (renewalPayments ?? []).reduce(
    (sum, p) => sum + p.amount,
    0
  );

  // Add-on revenue this month
  const { data: addonPayments } = await supabase
    .from("payments")
    .select("amount")
    .eq("purpose", "AddOn")
    .eq("status", "Paid")
    .gte("verified_at", monthStartUTC);

  const addonRevenueThisMonth = (addonPayments ?? []).reduce(
    (sum, p) => sum + p.amount,
    0
  );

  return {
    activeMembers: activeMembers ?? 0,
    todayCheckins: todayCheckins ?? 0,
    sevenDayActiveMembers: sevenDayActiveMembers ?? 0,
    openRedListCases: openRedListCases ?? 0,
    membersReturnedAfterFollowUp: membersReturnedAfterFollowUp ?? 0,
    renewalsDueIn7Days,
    renewalCollectionThisMonth,
    addonRevenueThisMonth,
    followupsDueToday: followupsDueToday ?? 0,
  };
}
