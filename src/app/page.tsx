import { redirect } from "next/navigation";
import { getCurrentMemberId, getCurrentStaff } from "@/services/auth";

// The app opens on login; a signed-in person goes straight to their own dashboard.
// The gym's public website lives at /gym.
export const dynamic = "force-dynamic";

export default async function Home() {
  if (await getCurrentMemberId()) redirect("/member");
  if (await getCurrentStaff()) redirect("/owner");
  redirect("/login");
}
