/**
 * Staff accounts (C1, TASKS.md Module 8) — Owner only, every change audited.
 * A login is a Supabase Auth user plus a staff_users row with the same id.
 * Staff are never deleted (payments and visits point at them): removing
 * access sets is_active = false and bans the Auth user.
 */
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { STAFF_TAG } from "./auth";
import { createServiceClient } from "./supabase/server";
import { validationError } from "./memberships";
import type { ActionResult } from "./payments";
import type { StaffRole } from "./supabase/database.types";

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  isActive: boolean;
}

const password = z
  .string({ required_error: "Enter a password of at least 10 characters" })
  .min(10, "Enter a password of at least 10 characters")
  .max(72, "Keep the password under 72 characters");

export const createStaffSchema = z.object({
  name: z.string().trim().min(2, "Enter the staff member's name").max(60, "Keep the name under 60 characters"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password,
});

export const resetStaffPasswordSchema = z.object({ password });

const SAVE_FAILED = { ok: false as const, error: { code: "INVALID_STATE", message: "We couldn't save this staff account. Please try again." } };
// Effectively permanent; lifted again when access is restored.
const BAN_FOREVER = "876000h";

async function audit(staffId: string, action: string, recordId: string, summary: string) {
  await createServiceClient().from("audit_logs").insert({
    actor_type: "Staff",
    actor_id: staffId,
    action,
    record_type: "staff_user",
    record_id: recordId,
    summary,
  });
}

/** Owner and front-desk accounts with their login email. Throws on a database error. */
export async function listStaff(): Promise<StaffRow[]> {
  const admin = createServiceClient();
  const { data, error } = await admin.from("staff_users").select("id, name, role, is_active").order("name");
  if (error) throw new Error("STAFF_LOAD_FAILED");
  const users = await Promise.all(data.map((s) => admin.auth.admin.getUserById(s.id)));
  return data.map((s, i) => ({
    id: s.id,
    name: s.name,
    role: s.role,
    isActive: s.is_active,
    email: users[i].data.user?.email ?? "",
  }));
}

/** New front-desk login. The owner tells the person their password in person. */
export async function createStaff(input: unknown, ownerId: string): Promise<ActionResult<{ id: string }>> {
  const parsed = createStaffSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { name, email } = parsed.data;

  const admin = createServiceClient();
  const created = await admin.auth.admin.createUser({ email, password: parsed.data.password, email_confirm: true });
  if (created.error || !created.data.user) {
    if (created.error?.code === "email_exists") {
      const message = "This email already has a login.";
      return { ok: false, error: { code: "VALIDATION", message, fields: { email: message } } };
    }
    return SAVE_FAILED;
  }
  const id = created.data.user.id;
  const { error } = await admin.from("staff_users").insert({ id, name, role: "FrontDesk" });
  if (error) {
    await admin.auth.admin.deleteUser(id); // no staff row yet, so nothing references this user
    return SAVE_FAILED;
  }
  revalidateTag(STAFF_TAG);
  await audit(ownerId, "staff.created", id, `Front-desk login created for ${name} (${email}).`);
  return { ok: true, data: { id } };
}

/** Remove or restore a staff member's access. The owner can't lock themselves out. */
export async function setStaffActive(staffId: string, active: boolean, ownerId: string): Promise<ActionResult<void>> {
  if (staffId === ownerId) {
    return { ok: false, error: { code: "INVALID_STATE", message: "You can't remove your own access." } };
  }
  const admin = createServiceClient();
  const { data, error } = await admin.from("staff_users").update({ is_active: active }).eq("id", staffId).select("name, role");
  if (error) return SAVE_FAILED;
  if (!data?.length) return { ok: false, error: { code: "NOT_FOUND", message: "This staff account no longer exists." } };

  const banned = await admin.auth.admin.updateUserById(staffId, { ban_duration: active ? "none" : BAN_FOREVER });
  if (banned.error) {
    await admin.from("staff_users").update({ is_active: !active }).eq("id", staffId);
    return SAVE_FAILED;
  }
  revalidateTag(STAFF_TAG); // a removed login stops working on its very next request
  await audit(ownerId, active ? "staff.restored" : "staff.removed", staffId, `${data[0].name} (${data[0].role}) access ${active ? "restored" : "removed"}.`);
  return { ok: true, data: undefined };
}

/** Owner sets a new password for a staff member who forgot theirs. */
export async function resetStaffPassword(staffId: string, input: unknown, ownerId: string): Promise<ActionResult<void>> {
  const parsed = resetStaffPasswordSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const admin = createServiceClient();
  const { data } = await admin.from("staff_users").select("name").eq("id", staffId).maybeSingle();
  if (!data) return { ok: false, error: { code: "NOT_FOUND", message: "This staff account no longer exists." } };
  const { error } = await admin.auth.admin.updateUserById(staffId, { password: parsed.data.password });
  if (error) return SAVE_FAILED;
  await audit(ownerId, "staff.password_reset", staffId, `Password reset for ${data.name}.`);
  return { ok: true, data: undefined };
}
