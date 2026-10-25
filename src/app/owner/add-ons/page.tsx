import Link from "next/link";
import { Pencil, Plus, ShoppingBag } from "lucide-react";
import { getCurrentStaff } from "@/services/auth";
import { listAddonOrders, listAllAddons, type OrderRow } from "@/services/addons";
import { addDaysToDate, formatDisplayDate, toKolkataDateString } from "@/utils/dates";
import { formatRupees } from "@/utils/money";
import { EmptyState } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import { SessionButton, StockDialog } from "./order-controls";

export const metadata = { title: "Add-ons" };
// Live stock and orders on every request; never prerendered at build time.
export const dynamic = "force-dynamic";

const TYPE_LABEL = { PT: "Personal training", Diet: "Diet plan", Product: "Product" } as const;

function validTill(o: OrderRow) {
  return o.paidAt ? formatDisplayDate(addDaysToDate(toKolkataDateString(o.paidAt), o.validityDays)) : null;
}

export default async function OwnerAddonsPage() {
  const [staff, catalogue, orders] = await Promise.all([getCurrentStaff(), listAllAddons(), listAddonOrders()]);
  const isOwner = staff?.role === "Owner";

  return (
    <div className="mx-auto w-full px-4 pb-8 pt-4 md:px-6 md:pt-6 max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Add-ons</h1>
        <Link href="/owner/renewals" className="inline-flex min-h-[40px] items-center text-sm font-medium text-foreground underline underline-offset-4">
          Payments waiting to be verified →
        </Link>
      </div>

      <section aria-labelledby="active-heading">
        <h2 id="active-heading" className="mb-2 text-lg font-semibold text-foreground">
          Running now <span className="text-sm font-normal text-muted">({orders.active.length})</span>
        </h2>
        {orders.active.length === 0 ? (
          <p className="card p-4 text-sm text-muted">No active PT packages or diet plans. They appear here once their payment is verified.</p>
        ) : (
          <ul className="card divide-y divide-border">
            {orders.active.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/owner/members/${o.member_id}`} className="font-medium text-foreground hover:underline">
                    {o.memberName}
                  </Link>
                  <p className="text-sm text-muted">
                    {o.title}
                    {validTill(o) && ` · till ${validTill(o)}`}
                  </p>
                  {o.sessions_total !== null && (
                    <p className="text-sm text-foreground">
                      <span className="font-semibold tabular-nums">{o.sessions_used ?? 0}</span> of {o.sessions_total} sessions used
                    </p>
                  )}
                </div>
                {o.sessions_total !== null && (
                  <SessionButton orderId={o.id} memberName={o.memberName} disabled={(o.sessions_used ?? 0) >= o.sessions_total} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="catalogue-heading">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 id="catalogue-heading" className="text-lg font-semibold text-foreground">Catalogue</h2>
          {isOwner && catalogue.length > 0 && (
            <Link href="/owner/add-ons/new" className="btn-primary inline-flex items-center gap-2 text-sm">
              <Plus className="h-4 w-4" aria-hidden /> Add
            </Link>
          )}
        </div>
        {catalogue.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="h-10 w-10" />}
            title="No add-ons yet"
            message="Add personal training packages, diet plans or products members can buy in the app."
            action={isOwner && <Link href="/owner/add-ons/new" className="btn-primary">Add your first add-on</Link>}
          />
        ) : (
          <ul className="card divide-y divide-border">
            {catalogue.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2">
                    <span className="truncate font-medium text-foreground">{a.title}</span>
                    {!a.is_active && <StatusBadge status="Inactive" />}
                  </p>
                  <p className="text-sm text-muted">
                    {TYPE_LABEL[a.type]} · {formatRupees(a.price)}
                    {a.type === "PT" && ` · ${a.sessions} sessions${a.trainerName ? ` · ${a.trainerName}` : ""}`}
                    {a.type !== "Product" && ` · ${a.validity_days} days`}
                  </p>
                  {a.type === "Product" && (
                    <p className={(a.stock ?? 0) <= 0 ? "text-sm font-medium text-danger" : (a.stock ?? 0) <= 5 ? "text-sm text-warning" : "text-sm text-muted"}>
                      {(a.stock ?? 0) <= 0 ? "Out of stock — members can't buy it" : `${a.stock} in stock`}
                    </p>
                  )}
                  {a.is_active && !a.available && a.type === "PT" && <p className="text-sm text-warning">{a.unavailableReason}</p>}
                </div>
                <div className="flex gap-2">
                  {a.type === "Product" && <StockDialog addonId={a.id} title={a.title} stock={a.stock ?? 0} />}
                  {isOwner && (
                    <Link href={`/owner/add-ons/${a.id}/edit`} className="btn-secondary px-3" aria-label={`Edit ${a.title}`}>
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {orders.recent.length > 0 && (
        <section aria-labelledby="recent-heading">
          <h2 id="recent-heading" className="mb-2 text-lg font-semibold text-foreground">Recent orders</h2>
          <ul className="card divide-y divide-border">
            {orders.recent.map((o) => (
              <li key={o.id}>
                <Link href={`/owner/payments/${o.payment_id}`} className="flex items-center gap-3 px-4 py-3 min-h-[56px] hover:bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {o.memberName} · {o.title}
                      {o.quantity > 1 && ` × ${o.quantity}`}
                    </span>
                    <span className="block text-xs text-muted">
                      {formatRupees(o.amount)} · {formatDisplayDate(toKolkataDateString(o.created_at))}
                    </span>
                  </span>
                  <StatusBadge status={o.status === "Pending" ? "Awaiting confirmation" : o.status === "Completed" ? "Paid" : o.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
