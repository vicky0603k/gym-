/**
 * Attendance service — QR check-in, assisted check-in, history queries.
 *
 * Both check-ins run through check_in() (migration 007): one transaction under
 * a per-member advisory lock that checks member + membership status, the
 * duplicate window, inserts attendance, resolves an open no-show case as
 * Returned and (assisted only) writes the audit row. This file verifies the
 * QR signature and maps result codes to plain-language messages.
 */
import { z } from "zod";
import { createServiceClient } from "./supabase/server";
import { verifyQrToken } from "./qr";
import { formatDisplayDate, formatDisplayTime, kolkataMidnightUtc, toKolkataDateString, todayKolkata } from "@/utils/dates";
import type { Attendance, CheckInRpcErrorCode, CheckInRpcResult } from "./supabase/database.types";

export type CheckInErrorCode = CheckInRpcErrorCode | "QR_INVALID" | "INVALID_STATE";

export type CheckInResult =
  | {
      ok: true;
      attendanceId: string;
      checkinAt: string;
      weeklyGoal: { completed: number; target: number };
      caseResolved: boolean;
    }
  | {
      ok: false;
      error: {
        code: CheckInErrorCode;
        message: string;
        fields?: Record<string, string>;
        lastCheckinAt?: string;
        expiryDate?: string | null;
      };
    };

type Rejection = Extract<CheckInRpcResult, { ok: false }>;
type Audience = "member" | "staff";

function message(code: CheckInErrorCode, r: Partial<Rejection>, who: Audience): string {
  const you = who === "member";
  switch (code) {
    case "QR_INVALID":
      return "This isn't the gym's check-in QR. Scan the QR shown on the screen at the gate.";
    case "QR_EXPIRED":
      return "This QR has expired. Scan the current QR at the gate.";
    case "DUPLICATE_CHECKIN":
      return `Already checked in at ${r.last_checkin_at ? formatDisplayTime(r.last_checkin_at) : "an earlier time"}.`;
    case "MEMBERSHIP_EXPIRED":
      if (!r.expiry_date) return you ? "You don't have an active membership." : "This member has no active membership.";
      return `${you ? "Your" : "This"} membership expired on ${formatDisplayDate(r.expiry_date)}.`;
    case "MEMBERSHIP_PAUSED":
      return you
        ? "Your membership is paused. Ask the front desk to resume it."
        : "This member's membership is paused. Resume it from their member page first.";
    case "MEMBER_BLOCKED":
      return you
        ? "Check-in isn't allowed on this account. Please speak to the front desk."
        : "This member is blocked and cannot check in.";
    case "MEMBER_CANCELLED":
      return you
        ? "This membership has been cancelled. Please speak to the front desk."
        : "This member's membership is cancelled and they cannot check in.";
    case "NOT_FOUND":
      return you ? "We couldn't find your member account. Please speak to the front desk." : "Member not found.";
    case "FORBIDDEN":
      return "Only gym staff can do an assisted check-in.";
    case "VALIDATION":
      return "Enter a reason for the assisted check-in.";
    case "INVALID_STATE":
      return you
        ? "Check-in failed. Please try again or ask the front desk."
        : "Check-in failed. Please try again.";
  }
}

function fail(code: CheckInErrorCode, who: Audience, r: Partial<Rejection> = {}): CheckInResult {
  return {
    ok: false,
    error: {
      code,
      message: message(code, r, who),
      ...(r.last_checkin_at ? { lastCheckinAt: r.last_checkin_at } : {}),
      ...(code === "MEMBERSHIP_EXPIRED" ? { expiryDate: r.expiry_date ?? null } : {}),
    },
  };
}

async function runCheckIn(
  args: { p_member_id: string; p_source: "QR" | "Assisted"; p_qr_step?: number; p_staff_id?: string; p_reason?: string },
  who: Audience
): Promise<CheckInResult> {
  const { data, error } = await createServiceClient().rpc("check_in", args);
  if (error || !data) return fail("INVALID_STATE", who);
  if (!data.ok) return fail(data.code, who, data);
  return {
    ok: true,
    attendanceId: data.attendance_id,
    checkinAt: data.checkin_at,
    weeklyGoal: { completed: data.week_visits, target: data.weekly_target },
    caseResolved: data.case_resolved,
  };
}

/** QR check-in for the signed-in member. A bad signature never reaches the database. */
export async function qrCheckIn(memberId: string, token: string): Promise<CheckInResult> {
  let step: number;
  try {
    step = verifyQrToken(String(token ?? "")).step;
  } catch (err: unknown) {
    return fail(err instanceof Error && err.message === "QR_EXPIRED" ? "QR_EXPIRED" : "QR_INVALID", "member");
  }
  return runCheckIn({ p_member_id: memberId, p_source: "QR", p_qr_step: step }, "member");
}

export const assistedCheckInSchema = z.object({
  memberId: z.string().uuid("Choose a member"),
  reason: z.string({ required_error: "Enter a reason for the assisted check-in" })
    .trim()
    .min(3, "Enter a reason for the assisted check-in")
    .max(200, "Keep the reason under 200 characters"),
});

/** Assisted check-in by staff. A reason is mandatory; the audit row is written in check_in(). */
export async function assistedCheckIn(input: unknown, staffId: string): Promise<CheckInResult> {
  const parsed = assistedCheckInSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message;
    return { ok: false, error: { code: "VALIDATION", message: parsed.error.issues[0].message, fields } };
  }
  return runCheckIn(
    { p_member_id: parsed.data.memberId, p_source: "Assisted", p_staff_id: staffId, p_reason: parsed.data.reason },
    "staff"
  );
}

/**
 * A member's attendance, newest first. `lookahead` extra rows past the page
 * let a pager know an older page exists. Throws on a database error.
 */
export async function getAttendanceHistory(
  memberId: string,
  page = 0,
  pageSize = 20,
  lookahead = 0
): Promise<Attendance[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .eq("member_id", memberId)
    .order("checkin_at", { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1 + lookahead);

  if (error) throw new Error("ATTENDANCE_LOAD_FAILED");
  return data;
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
    .maybeSingle();

  if (!data) return null;
  return toKolkataDateString(data.checkin_at);
}

/** Check-ins since 00:00 today in Kolkata, all members. Throws on a database error. */
export async function countCheckinsToday(): Promise<number> {
  const { count, error } = await createServiceClient()
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .gte("checkin_at", kolkataMidnightUtc(todayKolkata()).toISOString());
  if (error) throw new Error("ATTENDANCE_COUNT_FAILED");
  return count ?? 0;
}
