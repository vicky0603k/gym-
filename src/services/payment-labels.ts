import type { PaymentDetail } from "./payments";

/** What a payment means to a person, from payment + order status. */
export function paymentLabel(p: Pick<PaymentDetail, "status" | "orderStatus">): string {
  if (p.status === "Paid") return "Paid";
  if (p.status === "Pending") return "Awaiting confirmation";
  if (p.orderStatus === "Cancelled") return "Replaced";
  if (p.status === "Refunded") return "Refunded";
  return "Not confirmed";
}
