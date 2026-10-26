/**
 * Member IDs, e.g. "FL-346587". Each member has a unique 6-digit number
 * (members.member_code, migration 013); the letters come from settings and are
 * added only when shown, so changing them updates every member's ID at once.
 */

/** First letter of up to 4 words; a one-word name gives its first 2 letters. */
export function gymInitials(gymName: string): string {
  const words = gymName.toUpperCase().match(/[A-Z][A-Z']*/g) ?? [];
  if (!words.length) return "GYM";
  if (words.length === 1) return words[0].replace(/'/g, "").slice(0, 2);
  return words.slice(0, 4).map((w) => w[0]).join("");
}

export function memberIdPrefix(s: { member_id_prefix: string | null; gym_name: string }): string {
  return s.member_id_prefix || gymInitials(s.gym_name);
}

export function formatMemberCode(prefix: string, code: number): string {
  return `${prefix}-${code}`;
}

/** "FL-346587", "fl346587" or "346587" → 346587; anything else → null. */
export function parseMemberCode(input: string): number | null {
  const match = input.trim().match(/^(?:[A-Za-z]{2,4}[\s-]*)?([1-9]\d{5})$/);
  return match ? Number(match[1]) : null;
}
