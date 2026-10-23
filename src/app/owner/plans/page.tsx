import Link from "next/link";
import { Pencil, Plus, Tags } from "lucide-react";
import { getCurrentStaff } from "@/services/auth";
import { listPlans } from "@/services/memberships";
import { applyDiscount, formatRupees } from "@/utils/money";
import { EmptyState } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";

export const metadata = { title: "Plans" };
// Live prices on every request; never prerendered at build time.
export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const [staff, plans] = await Promise.all([getCurrentStaff(), listPlans()]);
  const isOwner = staff?.role === "Owner";

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-foreground">Plans</h1>
        {isOwner && plans.length > 0 && (
          <Link href="/owner/plans/new" className="btn-primary inline-flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4" aria-hidden /> Add plan
          </Link>
        )}
      </div>

      {plans.length === 0 ? (
        <EmptyState
          icon={<Tags className="h-10 w-10" />}
          title="No plans yet"
          message="Create the membership plans your gym sells, with price and any discount."
          action={isOwner && <Link href="/owner/plans/new" className="btn-primary">Create your first plan</Link>}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {plans.map((p) => {
            const final = applyDiscount(p.price, p.discount_pct);
            return (
              <li key={p.id} className="card p-5 flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">{p.name}</h2>
                    <p className="text-sm text-muted">{p.duration_days} days</p>
                  </div>
                  <StatusBadge status={p.is_active ? "Active" : "Inactive"} />
                </div>
                <p className="mt-3">
                  <span className="text-2xl font-bold text-foreground tabular-nums">{formatRupees(final)}</span>
                  {p.discount_pct > 0 && (
                    <span className="ml-2 text-sm text-muted">
                      <s>{formatRupees(p.price)}</s> · {p.discount_pct}% off
                    </span>
                  )}
                </p>
                {p.benefits && <p className="mt-2 text-sm text-muted">{p.benefits}</p>}
                {isOwner && (
                  <Link
                    href={`/owner/plans/${p.id}/edit`}
                    className="btn-secondary mt-4 inline-flex items-center justify-center gap-2 text-sm"
                    aria-label={`Edit ${p.name}`}
                  >
                    <Pencil className="h-4 w-4" aria-hidden /> Edit
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
