import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Tags } from "lucide-react";
import { getCurrentStaff } from "@/services/auth";
import { getWeeklyGoalDefault } from "@/services/settings";
import { WeeklyGoalForm } from "./weekly-goal-form";

export const metadata = { title: "Settings" };

/** Owner-only settings (RLS: front desk has no settings access). */
export default async function SettingsPage() {
  const staff = await getCurrentStaff();
  if (staff?.role !== "Owner") redirect("/owner");
  const weeklyGoalDefault = await getWeeklyGoalDefault();

  return (
    <div className="p-4 md:p-6 max-w-xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>
      <section className="card p-5">
        <h2 className="font-semibold text-foreground mb-1">Weekly goal</h2>
        <p className="text-sm text-muted mb-4">
          Members aim for a number of visits each Monday–Sunday week. Rest days and paused weeks never count against them.
        </p>
        <WeeklyGoalForm value={weeklyGoalDefault} />
      </section>

      <Link href="/owner/plans" className="card mt-4 flex items-center gap-3 p-5 min-h-[64px] hover:bg-surface-2">
        <Tags className="h-5 w-5 text-muted" aria-hidden />
        <span className="flex-1">
          <span className="block font-semibold text-foreground">Membership plans</span>
          <span className="block text-sm text-muted">Prices, discounts and which plans are offered</span>
        </span>
        <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
      </Link>
    </div>
  );
}
