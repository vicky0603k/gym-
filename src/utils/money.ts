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
