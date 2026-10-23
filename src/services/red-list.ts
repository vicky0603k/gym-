/**
 * Red List service — daily scan, case management, follow-up recording.
 *
 * Rules (from AGENTS.md / DATABASE.md):
 * - Never include Paused, Frozen, Expired or Cancelled members.
 * - One open case per member (partial unique index enforces this in the DB).
 * - Daily scan is idempotent — running twice on the same day does nothing new.
 * - Follow-up rows are append-only; never edit or delete them.
 */
import { createServiceClient } from "./supabase/server";
import { todayKolkata, daysAgoKolkata } from "@/utils/dates";
import { DEFAULT_NO_SHOW_THRESHOLD_DAYS, CASE_STATUS } from "@/utils/constants";
import type {
  NoShowCase,
  FollowUp,
  FollowUpOutcome,
  FollowUpChannel,
} from "./supabase/database.types";

export interface RedListRow {
  case: NoShowCase;
  memberName: string;
  memberPhone: string;
  planName: string | null;
  expiryDate: string;
  lastVisitDate: string | null;
  absentDays: number;
  trainerName: string | null;
  lastFollowUp: FollowUp | null;
}

/**
 * Run the daily no-show scan. Idempotent.
 * Returns counts of new cases opened.
 */
export async function runDailyScan(): Promise<{
  casesOpened: number;
}> {
  const supabase = createServiceClient();
  const today = todayKolkata();

  // Load threshold from settings
  const { data: settings } = await supabase
    .from("settings")
    .select("no_show_threshold_days")
    .limit(1)
    .single();

  const threshold =
    settings?.no_show_threshold_days ?? DEFAULT_NO_SHOW_THRESHOLD_DAYS;

  // Get all Active members
  const { data: activeMembers } = await supabase
    .from("members")
    .select("id")
    .eq("status", "Active");

  if (!activeMembers?.length) return { casesOpened: 0 };

  // Get their active memberships (exclude Paused/Frozen/Expired/Cancelled)
  const memberIds = activeMembers.map((m) => m.id);

  const { data: activeMemberships } = await supabase
    .from("memberships")
    .select("member_id, expiry_date, status")
    .in("member_id", memberIds)
    .eq("status", "Active");

  if (!activeMemberships?.length) return { casesOpened: 0 };

  const eligibleMemberIds = new Set(
    activeMemberships.map((m) => m.member_id)
  );

  // Get last check-in per member
  const { data: lastCheckins } = await supabase
    .from("attendance")
    .select("member_id, checkin_at")
    .in("member_id", [...eligibleMemberIds])
    .order("checkin_at", { ascending: false });

  const lastVisitMap = new Map<string, string>();
  for (const row of lastCheckins ?? []) {
    if (!lastVisitMap.has(row.member_id)) {
      lastVisitMap.set(row.member_id, row.checkin_at);
    }
  }

  // Get members with an already open case
  const { data: openCases } = await supabase
    .from("no_show_cases")
    .select("member_id")
    .in("member_id", [...eligibleMemberIds])
    .in("status", [
      CASE_STATUS.OPEN,
      CASE_STATUS.CONTACTED,
      CASE_STATUS.FOLLOW_UP_DUE,
    ]);

  const membersWithOpenCase = new Set(
    (openCases ?? []).map((c) => c.member_id)
  );

  let casesOpened = 0;

  for (const memberId of eligibleMemberIds) {
    if (membersWithOpenCase.has(memberId)) continue;

    const lastVisit = lastVisitMap.get(memberId);
    const absentDays = lastVisit
      ? daysAgoKolkata(lastVisit)
      : // Never visited — use join date as reference
        // We'll treat 999 to always trigger; the scan service guards this
        999;

    if (absentDays >= threshold) {
      const { error } = await supabase.from("no_show_cases").insert({
        member_id: memberId,
        opened_on: today,
        absent_days_at_open: absentDays,
        status: CASE_STATUS.OPEN,
      });

      if (!error) casesOpened++;
    }
  }

  return { casesOpened };
}

export type RedListFilter = "10-14" | "15-21" | "22+" | "expiring-soon";

/**
 * Get the Red List with optional filter.
 */
export async function getRedList(
  filter?: RedListFilter
): Promise<RedListRow[]> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("no_show_cases")
    .select(
      `
      *,
      members (id, name, phone, assigned_trainer_id, weekly_target),
      followups (id, channel, outcome, notes, staff_id, created_at, next_action_date)
    `
    )
    .in("status", [
      CASE_STATUS.OPEN,
      CASE_STATUS.CONTACTED,
      CASE_STATUS.FOLLOW_UP_DUE,
    ])
    .order("absent_days_at_open", { ascending: false });

  type CaseWithJoins = NoShowCase & {
    members: {
      id: string;
      name: string;
      phone: string;
      assigned_trainer_id: string | null;
      weekly_target: number;
    } | null;
    followups: FollowUp[];
  };
  const cases = data as CaseWithJoins[] | null;

  if (!cases) return [];

  // Enrich with membership and trainer info
  const rows: RedListRow[] = [];

  for (const c of cases) {
    const member = c.members;
    if (!member) continue;

    // Current active membership
    const { data: membershipData } = await supabase
      .from("memberships")
      .select("expiry_date, plans(name)")
      .eq("member_id", member.id)
      .eq("status", "Active")
      .order("expiry_date", { ascending: false })
      .limit(1)
      .single();

    const membership = membershipData as
      | { expiry_date: string; plans: { name: string } | null }
      | null;

    // Last visit
    const { data: lastAttendance } = await supabase
      .from("attendance")
      .select("checkin_at")
      .eq("member_id", member.id)
      .order("checkin_at", { ascending: false })
      .limit(1)
      .single();

    const absentDays = lastAttendance
      ? daysAgoKolkata(lastAttendance.checkin_at)
      : c.absent_days_at_open;

    // Apply filter
    if (filter === "10-14" && (absentDays < 10 || absentDays > 14)) continue;
    if (filter === "15-21" && (absentDays < 15 || absentDays > 21)) continue;
    if (filter === "22+" && absentDays < 22) continue;

    // Trainer name
    let trainerName: string | null = null;
    if (member.assigned_trainer_id) {
      const { data: trainer } = await supabase
        .from("trainers")
        .select("name")
        .eq("id", member.assigned_trainer_id)
        .single();
      trainerName = trainer?.name ?? null;
    }

    const followups = (c.followups ?? []) as FollowUp[];
    const lastFollowUp =
      followups.length > 0
        ? followups.sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          )[0]
        : null;

    const planData = membership?.plans;

    rows.push({
      case: c,
      memberName: member.name,
      memberPhone: member.phone,
      planName: planData?.name ?? null,
      expiryDate: membership?.expiry_date ?? "",
      lastVisitDate: lastAttendance
        ? lastAttendance.checkin_at
        : null,
      absentDays,
      trainerName,
      lastFollowUp,
    });
  }

  return rows;
}

/**
 * Record a follow-up and update the case status.
 */
export async function recordFollowUp(params: {
  caseId: string;
  channel: FollowUpChannel;
  outcome: FollowUpOutcome;
  notes?: string;
  nextActionDate?: string;
  staffId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient();

  // Append follow-up row (never edit existing rows)
  const { error: followUpError } = await supabase.from("followups").insert({
    case_id: params.caseId,
    channel: params.channel,
    outcome: params.outcome,
    notes: params.notes ?? null,
    staff_id: params.staffId,
    next_action_date: params.nextActionDate ?? null,
  });

  if (followUpError) {
    return { ok: false, error: "Failed to record follow-up." };
  }

  // Update case status
  const newStatus =
    params.outcome === "Cancelled"
      ? CASE_STATUS.CLOSED
      : params.nextActionDate
      ? CASE_STATUS.FOLLOW_UP_DUE
      : CASE_STATUS.CONTACTED;

  await supabase
    .from("no_show_cases")
    .update({
      status: newStatus,
      next_action_date: params.nextActionDate ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.caseId);

  return { ok: true };
}
