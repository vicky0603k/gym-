"use server";

import { redirect } from "next/navigation";
import { memberLogin, staffLogin, logout, type AuthResult } from "@/services/auth";

export async function memberLoginAction(_prev: AuthResult | null, formData: FormData) {
  const result = await memberLogin(Object.fromEntries(formData));
  if (result.ok) redirect("/member");
  return result;
}

export async function staffLoginAction(_prev: AuthResult | null, formData: FormData) {
  const result = await staffLogin(Object.fromEntries(formData));
  if (result.ok) redirect("/owner");
  return result;
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}
