import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { getCurrentStaff } from "@/services/auth";
import { getPlan } from "@/services/memberships";
import { PlanForm } from "../../plan-form";

export const metadata = { title: "Edit plan" };

export default async function EditPlanPage({ params }: { params: { id: string } }) {
  const staff = await getCurrentStaff();
  if (staff?.role !== "Owner") redirect("/owner/plans");

  const plan = z.string().uuid().safeParse(params.id).success ? await getPlan(params.id) : null;
  if (!plan) notFound();

  return (
    <div className="p-4 md:p-6 max-w-xl">
      <Link href="/owner/plans" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground min-h-[48px]">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Plans
      </Link>
      <h1 className="text-2xl font-bold text-foreground mb-1">Edit {plan.name}</h1>
      <p className="text-sm text-muted mb-6">Changes apply to new members and renewals. Running memberships keep their dates.</p>
      <div className="card p-5">
        <PlanForm plan={plan} />
      </div>
    </div>
  );
}
