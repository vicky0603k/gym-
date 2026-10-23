/**
 * Attendance service — QR check-in, assisted check-in, history queries.
 * All date logic uses src/utils/dates.ts (Asia/Kolkata).
 */
import { createServiceClient } from "./supabase/server";
import { verifyQrToken } from "./qr";
import { todayKolkata, toKolkataDateString } from "@/utils/dates";
import { DUPLICATE_WINDOW_HOURS, CASE_STATUS } from "@/utils/constants";
import type { Attendance } from "./supabase/database.types";

export interface CheckInResult {
  ok: true;
  attendance: Attendance;
  weeklyGoal: { completed: number; target: number };
  caseResolved: boolean;
} | {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

/**
 * QR-based check-in. Verifies the token, checks membership status,
 * guards duplicates, writes attendance and resolves any open no-show case.
 */
export async function qrCheckIn(
  memberId: string,
  token: string
): Promise<CheckInResult> {
  const supabase = createServiceClient();

  // 1. Verify QR token
  try {
    verifyQrToken(token);
  } catch (err: unknown) {
    const code = err instanceof Error ? err.message : "QR_INVALID";
    return {
      ok: false,
      error: {
        code,
        message:
          code === "QR_EXPIRED"
            ? "This QR has expired. Please scan the current QR at the gate."
            : "Invalid QR code. Please scan the QR displayed at the gym gate.",
      },
    };
  }

  // 2. Load active membership
  const { data: membership } = await supabase
    .from("memberships")
    .select("id, status, expiry_date")
    .eq("member_id", memberId)
    .in("status", ["Active", "Frozen"])
    .order("expiry_date", { ascending: false })
    .limit(1)
    .single();

  if (!membership) {
    // Check if there's an expired one
    const { data: expiredMembership } = await supabase
      .from("memberships")
      .select("id, status, expiry_date")
      .eq("member_id", memberId)
      .eq("status", "Expired")
      .order("expiry_date", { ascending: false })
      .limit(1)
      .single();

    if (expiredMembership) {
      return {
        ok: false,
        error: {
          code: "MEMBERSHIP_EXPIRED",
          message:
            "Your membership has expired. Please renew to continue checking in.",
        },
      };
    }

    return {
      ok: false,
      error: {
        code: "MEMBERSHIP_EXPIRED",
        message: "No active membership found. Please contact the front desk.",
      },
    };
  }

  if (membership.status === "Frozen") {
    return {
      ok: false,
      error: {
        code: "MEMBERSHIP_PAUSED",
        message:
          "Your membership is currently paused. Please contact the front desk.",
      },
    };
  }

  // Check expiry
  const today = todayKolkata();
  if (membership.expiry_date < today) {
    return {
      ok: false,
      error: {
        code: "MEMBERSHIP_EXPIRED",
        message: "Your membership has expired. Please renew to continue.",
      },
    };
  }

  // 3. Duplicate guard — any check-in within the window
  const windowStart = new Date(
    Date.now() - DUPLICATE_WINDOW_HOURS * 60 * 60 * 1000
  ).toISOString();

  const { data: recent } = await supabase
    .from("attendance")
    .select("id, checkin_at")
    .eq("member_id", memberId)
    .gte("checkin_at", windowStart)
    .order("checkin_at", { ascending: false })
    .limit(1)
    .single();

  if (recent) {
    return {
      ok: false,
      error: {
        code: "DUPLICATE_CHECKIN",
        message: `Already checked in today. Come back after ${DUPLICATE_WINDOW_HOURS} hours.`,
      },
    };
  }

  // 4. Write attendance
  const { data: attendance, error: insertError } = await supabase
    .from("attendance")
    .insert({
      member_id: memberId,
      checkin_at: new Date().toISOString(),
      source: "QR",
    })
    .select()
    .single();

  if (insertError || !attendance) {
    return {
      ok: false,
      error: {
        code: "INVALID_STATE",
        message: "Check-in failed. Please try again or ask the front desk.",
      },
    };
  }

  // 5. Resolve open no-show case if any
  let caseResolved = false;
  const { data: openCase } = await supabase
    .from("no_show_cases")
    .select("id")
    .eq("member_id", memberId)
    .in("status", [
      CASE_STATUS.OPEN,
      CASE_STATUS.CONTACTED,
      CASE_STATUS.FOLLOW_UP_DUE,
    ])
    .limit(1)
    .single();

  if (openCase) {
    await supabase
      .from("no_show_cases")
      .update({
        status: CASE_STATUS.RETURNED,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", openCase.id);
    caseResolved = true;
  }

  // 6. Compute weekly goal
  const weeklyGoal = await computeWeeklyGoal(memberId);

  return {
    ok: true,
    attendance,
    weeklyGoal,
    caseResolved,
  };
}

/** Compute visits completed vs target for the current Kolkata week */
export async function computeWeeklyGoal(
  memberId: string
): Promise<{ completed: number; target: number }> {
  const supabase = createServiceClient();

  const now = new Date();
  // Monday of current week at 00:00 Kolkata = 18:30 previous day UTC
  const kolkataOffset = 5.5 * 60 * 60 * 1000; // +05:30 in ms
  const kolkataNow = new Date(now.getTime() + kolkataOffset);
  const dayOfWeek = kolkataNow.getUTCDay(); // 0=Sun, 1=Mon...
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(kolkataNow);
  weekStart.setUTCDate(kolkataNow.getUTCDate() - daysFromMonday);
  weekStart.setUTCHours(0, 0, 0, 0);
  const weekStartUTC = new Date(weekStart.getTime() - kolkataOffset);

  const weekEnd = new Date(weekStartUTC.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { count } = await supabase
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId)
    .gte("checkin_at", weekStartUTC.toISOString())
    .lt("checkin_at", weekEnd.toISOString());

  const { data: member } = await supabase
    .from("members")
    .select("weekly_target")
    .eq("id", memberId)
    .single();

  return {
    completed: count ?? 0,
    target: member?.weekly_target ?? 4,
  };
}

/** Assisted check-in by staff */
export async function assistedCheckIn(params: {
  memberId: string;
  staffId: string;
  reason: string;
}): Promise<CheckInResult> {
  if (!params.reason?.trim()) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "A reason is required for assisted check-in.",
      },
    };
  }

  const supabase = createServiceClient();

  const { data: attendance, error } = await supabase
    .from("attendance")
    .insert({
      member_id: params.memberId,
      checkin_at: new Date().toISOString(),
      source: "Assisted",
      staff_id: params.staffId,
      correction_reason: params.reason,
    })
    .select()
    .single();

  if (error || !attendance) {
    return {
      ok: false,
      error: {
        code: "INVALID_STATE",
        message: "Assisted check-in failed. Please try again.",
      },
    };
  }

  // Write audit log
  await supabase.from("audit_logs").insert({
    actor_type: "Staff",
    actor_id: params.staffId,
    action: "attendance.assisted",
    record_type: "attendance",
    record_id: attendance.id,
    summary: `Assisted check-in for member ${params.memberId}. Reason: ${params.reason}`,
  });

  // Resolve open case
  let caseResolved = false;
  const { data: openCase } = await supabase
    .from("no_show_cases")
    .select("id")
    .eq("member_id", params.memberId)
    .in("status", [
      CASE_STATUS.OPEN,
      CASE_STATUS.CONTACTED,
      CASE_STATUS.FOLLOW_UP_DUE,
    ])
    .limit(1)
    .single();

  if (openCase) {
    await supabase
      .from("no_show_cases")
      .update({
        status: CASE_STATUS.RETURNED,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", openCase.id);
    caseResolved = true;
  }

  const weeklyGoal = await computeWeeklyGoal(params.memberId);

  return {
    ok: true,
    attendance,
    weeklyGoal,
    caseResolved,
  };
}

/** Get a member's attendance history, newest first */
export async function getAttendanceHistory(
  memberId: string,
  page = 0,
  pageSize = 20
): Promise<Attendance[]> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("attendance")
    .select("*")
    .eq("member_id", memberId)
    .order("checkin_at", { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  return data ?? [];
}

/** Get the last check-in date for a member (used for Red List scan) */
export async function getLastCheckinDate(
  memberId: string
): Promise<string | null> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("attendance")
    .select("checkin_at")
    .eq("member_id", memberId)
    .order("checkin_at", { ascending: false })
    .limit(1)
    .single();

  if (!data) return null;
  return toKolkataDateString(data.checkin_at);
}
