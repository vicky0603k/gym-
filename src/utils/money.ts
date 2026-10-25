/**
 * Currency helpers — all amounts in the app are integer rupees.
 * Display with en-IN locale and ₹ symbol.
 */

const formatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Format an integer rupee amount for display.
 * e.g. formatRupees(120000) → "₹1,20,000"
 */
export function formatRupees(amountInRupees: number): string {
  return formatter.format(amountInRupees);
}

/**
 * Compute final payable amount after a percentage discount.
 * Discount is stored as an integer (e.g. 10 = 10%).
 * Always returns an integer (floor).
 */
export function applyDiscount(
  basePrice: number,
  discountPct: number
): number {
  if (discountPct <= 0) return basePrice;
  const discount = Math.floor((basePrice * discountPct) / 100);
  return basePrice - discount;
}

/**
 * Compute the discount amount in rupees.
 */
export function discountAmount(
  basePrice: number,
  discountPct: number
): number {
  if (discountPct <= 0) return 0;
  return Math.floor((basePrice * discountPct) / 100);
}

/** GST rate for gym and fitness services (SAC 9997), used only when the gym has a GSTIN. */
export const GST_RATE_PCT = 18;

/**
 * Split a GST-inclusive amount into taxable value and GST, in whole rupees.
 * Prices in this app already include GST, so the total never changes.
 */
export function gstIncluded(amount: number, ratePct: number = GST_RATE_PCT): { taxable: number; gst: number } {
  const taxable = Math.round((amount * 100) / (100 + ratePct));
  return { taxable, gst: amount - taxable };
}
