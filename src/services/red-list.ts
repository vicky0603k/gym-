/**
 * Red List service — daily scan, case list, follow-up recording, WhatsApp text.
 *
 * Rules (from AGENTS.md / DATABASE.md):
 * - Never include Paused, Frozen, Expired or Cancelled members.
 * - One open case per member (partial unique index enforces this in the DB).
 * - Daily scan is idempotent — running twice on the same day does nothing new.
 * - Follow-up rows are append-only; never edit or delete them.
 *
 * The rules live in the database functions from migration 008 (one fair
 * absence rule, set-based scan, transactional follow-up); this file validates
 * input, applies the screen filters and maps results to plain language.
 */
import { z } from "zod";
import { createServiceClient } from "./supabase/server";
import { validationError } from "./memberships";
import { addDaysToDate, formatDisplayDate, todayKolkata } from "@/utils/dates";
import type { ActionResult } from "./payments";
import type { FollowUp, NoShowCase, RedListDbRow } from "./supabase/database.types";

export const RED_LIST_FILTERS = ["10-14", "15-21", "22+", "expiring-soon"] as const;
export type RedListFilter = (typeof RED_LIST_FILTERS)[number];

/** "Expiring soon" = within the owner-only 14-day renewal stage (ADR-009). */
export const EXPIRING_SOON_DAYS = 14;

export type RedListRow = RedListDbRow & { followUpDue: boolean };

/**
 * Run the daily scan (cron and the owner's "Run scan now"): first mark lapsed
 * memberships/members Expired (migration 011), then open no-show cases. Both
 * steps are idempotent. Throws on a database error.
 */
export async function runDailyScan(): Promise<{ casesOpened: number; followupsDue: number; threshold: number; membersExpired: number }> {
  const supabase = createServiceClient();
  const expired = await supabase.rpc("expire_lapsed_memberships", {});
  if (expired.error || !expired.data) throw new Error("SCAN_FAILED");
  const { data, error } = await supabase.rpc("run_no_show_scan", {});
  if (error || !data) throw new Error("SCAN_FAILED");
  return {
    casesOpened: data.cases_opened,
    followupsDue: data.followups_due,
    threshold: data.threshold,
    membersExpired: expired.data.members_expired,
  };
}

export function matchesFilter(row: RedListDbRow, filter: RedListFilter | undefined, today: string): boolean {
  switch (filter) {
    case "10-14":
      return row.absent_days >= 10 && row.absent_days <= 14;
    case "15-21":
      return row.absent_days >= 15 && row.absent_days <= 21;
    case "22+":
      return row.absent_days >= 22;
    case "expiring-soon":
      return row.expiry_date <= addDaysToDate(today, EXPIRING_SOON_DAYS);
    default:
      return true;
  }
}

/** Open cases for eligible members, most absent first, plus per-filter counts. Throws on a database error. */
export async function getRedList(filter?: RedListFilter): Promise<{
  rows: RedListRow[];
  counts: Record<RedListFilter | "all", number>;
  dueToday: number;
}> {
  const { data, error } = await createServiceClient().rpc("red_list", {});
  if (error || !data) throw new Error("RED_LIST_LOAD_FAILED");
  const today = todayKolkata();

  const all: RedListRow[] = data.map((r) => ({
    ...r,
    followUpDue: r.case_status === "FollowUpDue" || (r.next_action_date !== null && r.next_action_date <= today),
  }));
  const counts = { all: all.length } as Record<RedListFilter | "all", number>;
  for (const f of RED_LIST_FILTERS) counts[f] = all.filter((r) => matchesFilter(r, f, today)).length;

  return {
    rows: all.filter((r) => matchesFilter(r, filter, today)),
    counts,
    dueToday: all.filter((r) => r.followUpDue).length,
  };
}

export const FOLLOW_UP_OUTCOMES = [
  "WillReturn",
  "Injured",
  "Travelling",
  "TimingIssue",
  "Unhappy",
  "NoResponse",
  "Cancelled",
] as const;
export const FOLLOW_UP_CHANNELS = ["Call", "WhatsApp", "InPerson"] as const;

export const followUpSchema = z
  .object({
    caseId: z.string().uuid("This case could not be found"),
    channel: z.enum(FOLLOW_UP_CHANNELS, { errorMap: () => ({ message: "Choose how you contacted them" }) }),
    outcome: z.enum(FOLLOW_UP_OUTCOMES, { errorMap: () => ({ message: "Choose what they said" }) }),
    notes: z.string().trim().max(500, "Keep the note under 500 characters").optional(),
    nextActionDate: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date").optional()
    ),
  })
  .superRefine((v, ctx) => {
    if (v.outcome === "Cancelled") return;
    const today = todayKolkata();
    if (!v.nextActionDate) {
      ctx.addIssue({ code: "custom", path: ["nextActionDate"], message: "Choose the date for the next follow-up" });
    } else if (v.nextActionDate < today) {
      ctx.addIssue({ code: "custom", path: ["nextActionDate"], message: "The next follow-up can't be in the past" });
    } else if (v.nextActionDate > addDaysToDate(today, 90)) {
      ctx.addIssue({ code: "custom", path: ["nextActionDate"], message: "Choose a date within the next 90 days" });
    }
  });

const FOLLOW_UP_ERRORS: Record<string, string> = {
  FORBIDDEN: "Only gym staff can record follow-ups.",
  VALIDATION: "Choose a next follow-up date from today onwards.",
  NOT_FOUND: "This case could not be found. Refresh the Red List.",
  INVALID_STATE: "This case is already resolved. Refresh the Red List.",
};

/** Append a follow-up and update the case — one transaction in record_followup(). */
export async function recordFollowUp(input: unknown, staffId: string): Promise<ActionResult<{ closed: boolean }>> {
  const parsed = followUpSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const v = parsed.data;

  const { data, error } = await createServiceClient().rpc("record_followup", {
    p_case_id: v.caseId,
    p_staff_id: staffId,
    p_channel: v.channel,
    p_outcome: v.outcome,
    p_notes: v.notes || null,
    p_next_action_date: v.outcome === "Cancelled" ? null : v.nextActionDate ?? null,
  });
  if (error || !data) {
    return { ok: false, error: { code: "INVALID_STATE", message: "We couldn't save this follow-up. Please try again." } };
  }
  if (!data.ok) return { ok: false, error: { code: data.code, message: FOLLOW_UP_ERRORS[data.code] } };
  return { ok: true, data: { closed: data.closed } };
}

export type MemberCase = NoShowCase & { followups: FollowUp[] };

/** Every Red List case for a member with its full follow-up history, newest first. Throws on a database error. */
export async function getMemberCases(memberId: string): Promise<MemberCase[]> {
  const supabase = createServiceClient();
  const { data: cases, error } = await supabase
    .from("no_show_cases")
    .select("*")
    .eq("member_id", memberId)
    .order("opened_on", { ascending: false });
  if (error) throw new Error("CASES_LOAD_FAILED");
  if (!cases.length) return [];

  const { data: followups, error: fError } = await supabase
    .from("followups")
    .select("*")
    .in("case_id", cases.map((c) => c.id))
    .order("created_at", { ascending: false });
  if (fError) throw new Error("FOLLOWUPS_LOAD_FAILED");

  return cases.map((c) => ({ ...c, followups: followups.filter((f) => f.case_id === c.id) }));
}

/**
 * The API.md "No-show care" message, fully rendered — never a raw {{placeholder}}.
 * Without a gym phone for the support link, it asks the member to reply instead.
 */
export function noShowMessage(p: { name: string; lastVisit: string | null; joinDate: string; gymPhone: string | null }): string {
  const firstName = p.name.trim().split(/\s+/)[0];
  const opener = p.lastVisit
    ? `your last gym check-in was on ${formatDisplayDate(p.lastVisit)}.`
    : `we haven't seen you at the gym since you joined on ${formatDisplayDate(p.joinDate)}.`;
  const help = p.gymPhone && /^[6-9]\d{9}$/.test(p.gymPhone)
    ? `reply here: https://wa.me/91${p.gymPhone}`
    : "just reply to this message.";
  return `Hi ${firstName}, ${opener} Is everything okay? If you need a timing change, a pause, or trainer help, ${help}`;
}

export function whatsAppLink(phone: string, text: string): string {
  return `https://wa.me/91${phone}?text=${encodeURIComponent(text)}`;
}

/** Gym phone for the WhatsApp support link (settings.phone). Null when not set. */
export async function getGymPhone(): Promise<string | null> {
  const { data } = await createServiceClient().from("settings").select("phone").limit(1).maybeSingle();
  return data?.phone?.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "") || null;
}
