/**
 * Renewals service — the owner's renewals-due pipeline, the member reminder
 * text, and how members pay (manual UPI in the MVP; SECURITY.md §4).
 *
 * Stages come from settings.renewal_windows (default 14/7/3/0/−3). ADR-009:
 * windows earlier than 7 days are owner-only heads-ups; member reminders are
 * for 7 days or less, expiry day and overdue — staff send them by WhatsApp
 * (automated sending is Phase 2).
 */
import { headers } from "next/headers";
import { createServiceClient } from "./supabase/server";
import { formatDisplayDate } from "@/utils/dates";
import type { RenewalDueDbRow } from "./supabase/database.types";

export interface RenewalStage {
  key: string;
  title: string;
  memberReminder: boolean; // false = owner-only heads-up (ADR-009: never message earlier than 7 days)
  min: number; // days left, inclusive
  max: number;
}

/** settings.renewal_windows default (001). */
export const DEFAULT_RENEWAL_WINDOWS = [14, 7, 3, 0, -3];

/**
 * Pipeline stages from the owner's renewal windows, most urgent first:
 * Overdue (expired up to 30 days, as renewals_due()), Expires today, then one
 * stage per positive window covering the days since the previous window.
 */
export function buildStages(windows: number[]): RenewalStage[] {
  const positive = [...new Set(windows.filter((w) => w > 0))].sort((a, b) => a - b);
  const stages: RenewalStage[] = [
    { key: "overdue", title: "Overdue", memberReminder: true, min: -30, max: -1 },
    { key: "0", title: "Expires today", memberReminder: true, min: 0, max: 0 },
  ];
  let previous = 0;
  for (const w of positive) {
    stages.push({ key: String(w), title: `Due in ${w} ${w === 1 ? "day" : "days"}`, memberReminder: w <= 7, min: previous + 1, max: w });
    previous = w;
  }
  return stages;
}

export function stageFor(daysLeft: number, stages: RenewalStage[]): RenewalStage | null {
  return stages.find((s) => daysLeft >= s.min && daysLeft <= s.max) ?? null;
}

export interface RenewalGroup extends RenewalStage {
  rows: RenewalDueDbRow[];
  expected: number; // ₹ if every member in the stage renews on their current plan
  pending: number; // members who already started a payment
}

/** Pipeline grouped by the owner's stages, most urgent first, with expected collection. Throws on a database error. */
export async function listRenewalsDue(): Promise<RenewalGroup[]> {
  const supabase = createServiceClient();
  const [due, settings] = await Promise.all([
    supabase.rpc("renewals_due", {}),
    supabase.from("settings").select("renewal_windows").limit(1).maybeSingle(),
  ]);
  if (due.error || !due.data || settings.error) throw new Error("RENEWALS_LOAD_FAILED");
  return groupRenewals(due.data, settings.data?.renewal_windows ?? DEFAULT_RENEWAL_WINDOWS);
}

export function groupRenewals(rows: RenewalDueDbRow[], windows: number[] = DEFAULT_RENEWAL_WINDOWS): RenewalGroup[] {
  return buildStages(windows).map((stage) => {
    const inStage = rows.filter((r) => r.days_left >= stage.min && r.days_left <= stage.max);
    return {
      ...stage,
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

/** A UPI ID is shown only when it is well-formed; otherwise members are sent to the front desk. */
export function paymentSetupFrom(upiId: string | null | undefined, payeeName: string): PaymentSetup {
  const id = upiId?.trim();
  return { upiId: id && UPI_ID.test(id) ? id : null, payeeName };
}

/** The gym's UPI ID from Settings (gym profile), falling back to the GYM_UPI_ID env var used before Phase 11. */
export async function getPaymentSetup(): Promise<PaymentSetup> {
  const { data } = await createServiceClient().from("settings").select("gym_name, upi_id, upi_name").limit(1).maybeSingle();
  const gymName = data?.gym_name || process.env.NEXT_PUBLIC_GYM_NAME || "Your gym";
  return paymentSetupFrom(data?.upi_id || process.env.GYM_UPI_ID, data?.upi_name?.trim() || process.env.GYM_UPI_NAME?.trim() || gymName);
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
