import { redirect } from "next/navigation";
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
    </div>
  );
}
