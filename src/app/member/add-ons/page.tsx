import Link from "next/link";
import { Apple, ChevronRight, Dumbbell, Package, ShoppingBag } from "lucide-react";
import { requireMember } from "@/services/auth";
import { listAddons, listMemberAddonOrders, type CatalogueItem, type OrderRow } from "@/services/addons";
import { addDaysToDate, formatDisplayDate, toKolkataDateString } from "@/utils/dates";
import { formatRupees } from "@/utils/money";
import { EmptyState } from "@/components/states";
import { BuyDialog } from "./buy-dialog";

export const metadata = { title: "Add-ons" };

const GROUPS = [
  { type: "PT", title: "Personal training", icon: Dumbbell },
  { type: "Diet", title: "Diet plans", icon: Apple },
  { type: "Product", title: "Supplements and products", icon: Package },
] as const;

function detailLine(item: CatalogueItem): string {
  if (item.type === "PT") return `${item.sessions} sessions · use within ${item.validity_days} days${item.trainerName ? ` · ${item.trainerName}` : ""}`;
  if (item.type === "Diet") return `${item.validity_days}-day plan`;
  return (item.stock ?? 0) > 0 ? `${item.stock} in stock` : "Out of stock";
}

function orderLine(o: OrderRow): string {
  const validTill = o.paidAt ? formatDisplayDate(addDaysToDate(toKolkataDateString(o.paidAt), o.validityDays)) : null;
  if (o.status === "Pending") return "Waiting for payment confirmation";
  if (o.type === "PT" && o.sessions_total) {
    return `${o.sessions_used ?? 0} of ${o.sessions_total} sessions used${validTill && o.status === "Active" ? ` · use by ${validTill}` : ""}`;
  }
  if (o.type === "Diet") return o.status === "Active" && validTill ? `Active till ${validTill}` : o.status;
  if (o.status === "Completed") return `Paid${o.quantity > 1 ? ` · ${o.quantity} items` : ""} · collect at the front desk`;
  return o.status === "Cancelled" ? "Cancelled" : o.status;
}

export default async function MemberAddonsPage() {
  const { memberId } = await requireMember();
  const [catalogue, orders] = await Promise.all([listAddons(), listMemberAddonOrders(memberId)]);
  const mine = orders.filter((o) => o.status !== "Cancelled" && o.status !== "Refunded").slice(0, 10);

  return (
    <div className="px-6 py-6 max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Add-ons</h1>

      {mine.length > 0 && (
        <section aria-labelledby="mine-heading">
          <h2 id="mine-heading" className="mb-2 text-lg font-semibold text-foreground">My add-ons</h2>
          <ul className="card divide-y divide-border">
            {mine.map((o) => (
              <li key={o.id}>
                <Link
                  href={o.status === "Pending" ? `/member/add-ons/pay/${o.payment_id}` : `/member/payments/${o.payment_id}`}
                  className="flex items-center gap-3 px-4 py-3 min-h-[64px] hover:bg-surface-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-foreground">{o.title}</span>
                    <span className={o.status === "Pending" ? "block text-sm text-warning" : "block text-sm text-muted"}>{orderLine(o)}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {catalogue.length === 0 ? (
        <EmptyState icon={<ShoppingBag className="h-10 w-10" />} title="No add-ons on offer right now" message="Ask the front desk about personal training and diet plans." />
      ) : (
        GROUPS.map((g) => {
          const items = catalogue.filter((c) => c.type === g.type);
          if (!items.length) return null;
          return (
            <section key={g.type} aria-labelledby={`group-${g.type}`}>
              <h2 id={`group-${g.type}`} className="mb-2 flex items-center gap-2 text-lg font-semibold text-foreground">
                <g.icon className="h-5 w-5 text-accent" aria-hidden /> {g.title}
              </h2>
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item.id} className="card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">{item.title}</p>
                        <p className="text-sm text-muted">{detailLine(item)}</p>
                      </div>
                      <p className="shrink-0 text-lg font-bold tabular-nums text-foreground">{formatRupees(item.price)}</p>
                    </div>
                    {item.description && <p className="mt-2 line-clamp-3 text-sm text-muted">{item.description}</p>}
                    <div className="mt-3">
                      <BuyDialog item={item} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
