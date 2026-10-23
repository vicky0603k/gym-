/**
 * Renewals service — the owner's renewals-due pipeline, the member reminder
 * text, and how members pay (manual UPI in the MVP; SECURITY.md §4).
 *
 * Stages (ADR-009): 14 days is an owner-only heads-up; member reminders are
 * for 7 days, 3 days, expiry day and overdue (+3 in the ADR — staff send them
 * by WhatsApp; automated sending is Phase 2).
 */
import { headers } from "next/headers";
import { createServiceClient } from "./supabase/server";
import { formatDisplayDate } from "@/utils/dates";
import type { RenewalDueDbRow } from "./supabase/database.types";

export type RenewalStage = "14" | "7" | "3" | "0" | "overdue";

export const STAGE_ORDER: RenewalStage[] = ["overdue", "0", "3", "7", "14"];

export const STAGE_INFO: Record<RenewalStage, { title: string; memberReminder: boolean }> = {
  overdue: { title: "Overdue", memberReminder: true },
  "0": { title: "Expires today", memberReminder: true },
  "3": { title: "Due in 3 days", memberReminder: true },
  "7": { title: "Due in 7 days", memberReminder: true },
  "14": { title: "Due in 14 days", memberReminder: false }, // owner-only heads-up (ADR-009)
};

/** Days left → pipeline stage. Expired up to 30 days ago is Overdue (renewals_due() stops there). */
export function stageFor(daysLeft: number): RenewalStage {
  if (daysLeft < 0) return "overdue";
  if (daysLeft === 0) return "0";
  if (daysLeft <= 3) return "3";
  if (daysLeft <= 7) return "7";
  return "14";
}

export interface RenewalGroup {
  stage: RenewalStage;
  rows: RenewalDueDbRow[];
  expected: number; // ₹ if every member in the stage renews on their current plan
  pending: number; // members who already started a payment
}

/** Pipeline grouped by stage, most urgent first, with expected collection. Throws on a database error. */
export async function listRenewalsDue(): Promise<RenewalGroup[]> {
  const { data, error } = await createServiceClient().rpc("renewals_due", {});
  if (error || !data) throw new Error("RENEWALS_LOAD_FAILED");
  return groupRenewals(data);
}

export function groupRenewals(rows: RenewalDueDbRow[]): RenewalGroup[] {
  return STAGE_ORDER.map((stage) => {
    const inStage = rows.filter((r) => stageFor(r.days_left) === stage);
    return {
      stage,
      rows: inStage,
      expected: inStage.reduce((sum, r) => sum + (r.pending_amount ?? r.renewal_amount), 0),
      pending: inStage.filter((r) => r.pending_payment_id).length,
    };
  });
}

/** The API.md "Renewal reminder" message, fully rendered. */
export function renewalReminderMessage(p: { name: string; plan: string; expiryDate: string; renewalLink: string }): string {
  const firstName = p.name.trim().split(/\s+/)[0];
  return `Hi ${firstName}, your ${p.plan} membership expires on ${formatDisplayDate(p.expiryDate)}. Review plans and the final payable amount here: ${p.renewalLink}`;
}

export interface PaymentSetup {
  upiId: string | null;
  payeeName: string;
}

const UPI_ID = /^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$/;

/**
 * The gym's UPI ID comes from the GYM_UPI_ID environment variable (not a
 * secret). shortcut: env until Phase 11 adds it to the gym profile in settings.
 */
export function getPaymentSetup(gymName: string): PaymentSetup {
  const upiId = process.env.GYM_UPI_ID?.trim();
  return { upiId: upiId && UPI_ID.test(upiId) ? upiId : null, payeeName: process.env.GYM_UPI_NAME?.trim() || gymName };
}

/** upi:// deep link that opens any UPI app with payee, exact amount and note pre-filled. */
export function upiPayLink(setup: PaymentSetup & { upiId: string }, amount: number, note: string): string {
  const params = new URLSearchParams({ pa: setup.upiId, pn: setup.payeeName, am: `${amount}.00`, cu: "INR", tn: note });
  return `upi://pay?${params.toString().replace(/\+/g, "%20")}`;
}

/** Gym name for receipts and payee name. */
export async function getGymName(): Promise<string> {
  const { data } = await createServiceClient().from("settings").select("gym_name").limit(1).maybeSingle();
  return data?.gym_name || process.env.NEXT_PUBLIC_GYM_NAME || "Your gym";
}

/** This deployment's own origin (for links staff send by WhatsApp), from the request headers. */
export function siteOrigin(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
