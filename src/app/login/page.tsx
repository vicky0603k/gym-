import { redirect } from "next/navigation";
import { getCurrentMemberId, getCurrentStaff } from "@/services/auth";
import { getGymName } from "@/services/renewals";
import { LoginForm } from "./login-form";

export const metadata = { title: "Log in" };
// The gym's own name heads the login screen, read fresh from Settings.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Already signed in: go to your own dashboard (log out first to switch accounts).
  if (await getCurrentMemberId()) redirect("/member");
  if (await getCurrentStaff()) redirect("/owner");
  return <LoginForm gymName={await getGymName()} />;
}
