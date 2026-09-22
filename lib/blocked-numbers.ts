/**
 * Internal/Test phone numbers to block and exclude from dashboard analytics.
 */
export const BLOCKED_PHONE_NUMBERS = new Set([
  "8317001690",
  "9634949589",
  "9154242252",
  "9165010083",
  "7042111086",
  "7042111085",
  "8447302576",
  "8750996993",
  "6395687260",
  "7908117847",
  "9647575095",
  "8318851733",
  "9924040902",
  "8320202852",
  "8087080121",
]);

/**
 * Checks whether a phone number matches any blocked phone number
 * (handles country codes +91, 91, or clean 10-digit formats).
 */
export function isBlockedPhoneNumber(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return false;
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
  return BLOCKED_PHONE_NUMBERS.has(digits) || BLOCKED_PHONE_NUMBERS.has(last10);
}
