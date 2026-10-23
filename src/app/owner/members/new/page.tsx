import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Tags } from "lucide-react";
import { getCurrentStaff } from "@/services/auth";
import { listPlans } from "@/services/memberships";
import { listActiveTrainers } from "@/services/members";
import { getWeeklyGoalDefault } from "@/services/settings";
import { EmptyState } from "@/components/states";
import { MemberForm } from "../member-form";

export const metadata = { title: "Add member" };

export default async function NewMemberPage() {
  const staff = await getCurrentStaff();
  if (staff?.role !== "Owner") redirect("/owner/members");

  // listPlans throws on a database error (→ error.tsx); inactive plans are never offered.
  const [allPlans, trainers, weeklyTarget] = await Promise.all([listPlans(), listActiveTrainers(), getWeeklyGoalDefault()]);
  const plans = allPlans.filter((p) => p.is_active);

  return (
    <div className="p-4 md:p-6 max-w-xl">
      <Link href="/owner/members" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground min-h-[48px]">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Members
      </Link>
      <h1 className="text-2xl font-bold text-foreground mb-6">Add member</h1>
      {plans.length === 0 ? (
        <EmptyState
          icon={<Tags className="h-10 w-10" />}
          title="No active plans"
          message="A new member needs a plan. Create or switch on a plan first."
          action={<Link href="/owner/plans" className="btn-primary">Go to plans</Link>}
        />
      ) : (
        <div className="card p-5">
          <MemberForm mode="create" plans={plans} trainers={trainers} defaultWeeklyTarget={weeklyTarget} />
        </div>
      )}
    </div>
  );
}
