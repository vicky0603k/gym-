/**
 * Auth helpers — role checks and current-user resolution.
 * All functions run server-side only.
 */
import { createServerClient } from "./supabase/server";
import type { StaffUser } from "./supabase/database.types";

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
 * Member sessions use a custom claim set during phone+PIN login.
 */
export async function getCurrentMemberId(): Promise<string | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Member sessions have a custom claim `member_id`
  const memberId =
    (user.user_metadata as Record<string, unknown>)?.member_id as
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
