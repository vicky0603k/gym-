import { Apple, Dumbbell, Package, ShoppingBag } from "lucide-react";
import { requireMember } from "@/services/auth";
import { listAddons, listMemberAddonOrders, type CatalogueItem, type OrderRow } from "@/services/addons";
import { addDaysToDate, formatDisplayDate, toKolkataDateString } from "@/utils/dates";
import { formatRupees } from "@/utils/money";
import { EmptyState } from "@/components/states";
import { BuyDialog } from "./buy-dialog";
import { Badge } from "@/components/ui/badge";
import { List, ListRow } from "@/components/ui/list";
import { Page, PageHeader, Section } from "@/components/ui/page";

export const metadata = { title: "Add-ons" };

const GROUPS = [
  { type: "PT", title: "Personal training", icon: Dumbbell },
  { type: "Diet", title: "Diet plans", icon: Apple },
  { type: "Product", title: "Supplements and products", icon: Package },
] as const;

function detailLine(item: CatalogueItem): string {
  if (item.type === "PT") return `${item.sessions} sessions · use within ${item.validity_days} days`;
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
    <Page>
      <PageHeader title="Add-ons" description="Personal training, diet plans and products from the front desk." />

      {mine.length > 0 && (
        <Section title="My add-ons" id="mine-heading" className="mt-0">
          <List>
            {mine.map((o) => (
              <ListRow
                key={o.id}
                href={o.status === "Pending" ? `/member/add-ons/pay/${o.payment_id}` : `/member/payments/${o.payment_id}`}
                title={o.title}
                meta={<span className={o.status === "Pending" ? "text-warning" : undefined}>{orderLine(o)}</span>}
              />
            ))}
          </List>
        </Section>
      )}

      {catalogue.length === 0 ? (
        <EmptyState icon={<ShoppingBag className="h-10 w-10" />} title="No add-ons on offer right now" message="Ask the front desk about personal training and diet plans." />
      ) : (
        GROUPS.map((g) => {
          const items = catalogue.filter((c) => c.type === g.type);
          if (!items.length) return null;
          return (
            <Section
              key={g.type}
              id={`group-${g.type}`}
              title={
                <span className="flex items-center gap-2">
                  <g.icon className="h-5 w-5" aria-hidden /> {g.title}
                </span>
              }
            >
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.id} className="rounded-lg bg-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">{item.title}</p>
                        <p className="text-sm text-muted">{detailLine(item)}</p>
                        {item.type === "PT" && item.trainerName && (
                          <Badge tone="dark" size="sm" className="mt-2">
                            With {item.trainerName}
                          </Badge>
                        )}
                      </div>
                      <p className="num-display shrink-0 text-3xl text-foreground">{formatRupees(item.price)}</p>
                    </div>
                    {item.description && <p className="mt-2 line-clamp-3 text-sm text-muted">{item.description}</p>}
                    <div className="mt-3">
                      <BuyDialog item={item} />
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          );
        })
      )}
    </Page>
  );
}
