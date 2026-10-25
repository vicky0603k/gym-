import { getGymName } from "@/services/renewals";
import { LoginForm } from "./login-form";

export const metadata = { title: "Log in" };
// The gym's own name heads the login screen, read fresh from Settings.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  return <LoginForm gymName={await getGymName()} />;
}
