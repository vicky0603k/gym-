/**
 * Auth helpers — role checks and current-user resolution.
 * All functions run server-side only.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import { createServerClient, createServiceClient } from "./supabase/server";
import type { StaffUser } from "./supabase/database.types";

export type AuthResult =
  | { ok: true }
  | { ok: false; error: { code: "VALIDATION" | "UNAUTHENTICATED"; message: string } };

export const memberLoginSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter your 10-digit mobile number"),
  pin: z.string().regex(/^\d{4}$/, "Enter your 4-digit PIN"),
});

export const staffLoginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

// One message for every member-login failure, so it never reveals whether a phone exists.
export const MEMBER_LOGIN_FAILED =
  "Phone number or PIN is incorrect. After 5 wrong tries, login pauses for 15 minutes — ask the front desk if you need your PIN reset.";
const STAFF_LOGIN_FAILED = "Email or password is incorrect.";
const SERVER_FAILED = "We couldn't log you in right now. Please try again in a minute.";

// Matches seed.sql: encode(digest(pin, 'sha256'), 'hex')
export function hashPin(pin: string): string {
  return createHash("sha256").update(pin).digest("hex");
}

// Member auth users get a synthetic, non-deliverable email; it is never shown or mailed.
function memberAuthEmail(memberId: string): string {
  return `member-${memberId}@members.invalid`;
}

/**
 * Phone + PIN login. PIN check and lockout run atomically in verify_member_pin
 * (migration 004); on success the browser gets a cookie session for a Supabase
 * Auth user whose app_metadata.member_id scopes RLS to this member only.
 */
export async function memberLogin(input: unknown): Promise<AuthResult> {
  const parsed = memberLoginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: parsed.error.issues[0].message } };
  }

  const admin = createServiceClient();
  const { data: memberId, error } = await admin.rpc("verify_member_pin", {
    p_phone: parsed.data.phone,
    p_pin_hash: hashPin(parsed.data.pin),
  });
  if (error) return { ok: false, error: { code: "UNAUTHENTICATED", message: SERVER_FAILED } };
  if (!memberId) return { ok: false, error: { code: "UNAUTHENTICATED", message: MEMBER_LOGIN_FAILED } };

  const email = memberAuthEmail(memberId);
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { member_id: memberId },
  });
  if (created.error && created.error.code !== "email_exists") {
    return { ok: false, error: { code: "UNAUTHENTICATED", message: SERVER_FAILED } };
  }

  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) return { ok: false, error: { code: "UNAUTHENTICATED", message: SERVER_FAILED } };

  const supabase = await createServerClient();
  const { error: otpError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.data.properties.hashed_token,
  });
  if (otpError) return { ok: false, error: { code: "UNAUTHENTICATED", message: SERVER_FAILED } };

  return { ok: true };
}

/** Owner / front-desk login. Only accounts with a staff_users row are let in. */
export async function staffLogin(input: unknown): Promise<AuthResult> {
  const parsed = staffLoginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: parsed.error.issues[0].message } };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: { code: "UNAUTHENTICATED", message: STAFF_LOGIN_FAILED } };

  if (!(await getCurrentStaff())) {
    await supabase.auth.signOut();
    return { ok: false, error: { code: "UNAUTHENTICATED", message: STAFF_LOGIN_FAILED } };
  }
  return { ok: true };
}

export async function logout(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
}

export interface CurrentStaff extends StaffUser {
  email: string;
}

export interface CurrentMember {
  id: string;
  name: string;
  phone: string;
}

/**
 * Returns the currently authenticated staff user, or null.
 * Reads the Supabase Auth session from the cookie.
 */
export async function getCurrentStaff(): Promise<CurrentStaff | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: staff } = await supabase
    .from("staff_users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!staff) return null;

  return {
    id: staff.id,
    name: staff.name,
    role: staff.role,
    created_at: staff.created_at,
    updated_at: staff.updated_at,
    email: user.email ?? "",
  };
}

/**
 * Asserts the current user is a staff member.
 * Throws (returns error result) if not authenticated or not staff.
 */
export async function requireStaff(): Promise<CurrentStaff> {
  const staff = await getCurrentStaff();
  if (!staff) {
    throw new Error("UNAUTHENTICATED");
  }
  return staff;
}

/**
 * Asserts the current user is an Owner.
 */
export async function requireOwner(): Promise<CurrentStaff> {
  const staff = await requireStaff();
  if (staff.role !== "Owner") {
    throw new Error("FORBIDDEN");
  }
  return staff;
}

/**
 * Gets the member id stored in the cookie-based session.
 * Read from app_metadata (server-set only) — never user_metadata, which the user can edit.
 */
export async function getCurrentMemberId(): Promise<string | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const memberId =
    (user.app_metadata as Record<string, unknown>)?.member_id as
      | string
      | undefined;
  return memberId ?? null;
}

/**
 * Asserts there is an authenticated member session.
 */
export async function requireMember(): Promise<{ memberId: string }> {
  const memberId = await getCurrentMemberId();
  if (!memberId) {
    throw new Error("UNAUTHENTICATED");
  }
  return { memberId };
}
