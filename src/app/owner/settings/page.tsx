import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Tags, UserCog } from "lucide-react";
import { getCurrentStaff } from "@/services/auth";
import { getSettings } from "@/services/settings";
import { WeeklyGoalForm } from "./weekly-goal-form";
import { GymProfileForm, RulesForm } from "./settings-forms";

export const metadata = { title: "Settings" };

/** Owner-only settings (RLS: front desk has no settings access). */
export default async function SettingsPage() {
  const staff = await getCurrentStaff();
  if (staff?.role !== "Owner") redirect("/owner");
  const settings = await getSettings();

  return (
    <div className="mx-auto w-full px-4 pb-8 pt-4 md:px-6 md:pt-6 max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight text-foreground mb-6">Settings</h1>
      <section className="card p-5 mb-4">
        <h2 className="font-semibold text-foreground mb-1">Gym profile</h2>
        <p className="text-sm text-muted mb-4">Shown on your public website, on receipts and on the member payment screen.</p>
        <GymProfileForm s={settings} />
      </section>

      <section className="card p-5 mb-4">
        <h2 className="font-semibold text-foreground mb-1">Red List and renewals</h2>
        <p className="text-sm text-muted mb-4">When an absent member needs a call, and when renewals show up in your pipeline.</p>
        <RulesForm s={settings} />
      </section>

      <section className="card p-5">
        <h2 className="font-semibold text-foreground mb-1">Weekly goal</h2>
        <p className="text-sm text-muted mb-4">
          Members aim for a number of visits each Monday–Sunday week. Rest days and paused weeks never count against them.
        </p>
        <WeeklyGoalForm value={settings.weekly_goal_default} />
      </section>

      <Link href="/owner/plans" className="card mt-4 flex items-center gap-3 p-5 min-h-[64px] hover:bg-surface-2">
        <Tags className="h-5 w-5 text-muted" aria-hidden />
        <span className="flex-1">
          <span className="block font-semibold text-foreground">Membership plans</span>
          <span className="block text-sm text-muted">Prices, discounts and which plans are offered</span>
        </span>
        <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
      </Link>

      <Link href="/owner/staff" className="card mt-4 flex items-center gap-3 p-5 min-h-[64px] hover:bg-surface-2">
        <UserCog className="h-5 w-5 text-muted" aria-hidden />
        <span className="flex-1">
          <span className="block font-semibold text-foreground">Staff logins</span>
          <span className="block text-sm text-muted">Add front-desk staff, reset passwords, remove access</span>
        </span>
        <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
      </Link>
    </div>
  );
}
