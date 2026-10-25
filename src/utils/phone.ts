/** Display an Indian mobile as "98765 43210" (accepts "+91 98765 43210" too, so "+91 " is never doubled). */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  return /^\d{10}$/.test(digits) ? `${digits.slice(0, 5)} ${digits.slice(5)}` : phone;
}
