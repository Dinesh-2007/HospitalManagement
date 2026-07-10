// Uses validation functions from react-international-phone or libphonenumber-js

/**
 * Compare two phone numbers.
 * Compares full E.164 numbers when available.
 * Falls back to legacy matching (last 10 digits) only for older records.
 */
export function comparePhoneNumbers(phone1?: string | null, phone2?: string | null): boolean {
  if (!phone1 || !phone2) return false;
  
  const clean1 = phone1.replace(/\D/g, "");
  const clean2 = phone2.replace(/\D/g, "");

  // If both start with '+', they are E.164. Compare exactly.
  if (phone1.startsWith("+") && phone2.startsWith("+")) {
    return phone1 === phone2;
  }
  
  // If one or both are legacy (no '+'), fallback to comparing last 10 digits
  // This allows +919876543210 to match legacy 9876543210
  const end1 = clean1.slice(-10);
  const end2 = clean2.slice(-10);
  
  if (end1.length === 10 && end2.length === 10) {
      return end1 === end2;
  }

  // If they are shorter than 10 digits (edge cases), just compare raw digits
  return clean1 === clean2;
}
