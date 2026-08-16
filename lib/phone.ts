// Uses libphonenumber-js for accurate country calling code detection

import { parsePhoneNumber } from "libphonenumber-js";

/**
 * Splits a phone number into its country calling code and local subscriber digits.
 * Uses libphonenumber-js for accurate parsing of real-world country codes.
 * For example: "+919876543210" -> { countryCode: "+91", phoneNumber: "9876543210" }
 * If there is no country code/not standard E.164, countryCode is empty and phoneNumber is all digits.
 */
export function splitPhoneNumber(phone?: string | null): { countryCode: string; phoneNumber: string } {
  if (!phone) return { countryCode: "", phoneNumber: "" };

  const trimmed = phone.trim();

  // Try libphonenumber-js first for accurate country code extraction
  if (trimmed.startsWith("+")) {
    try {
      const parsed = parsePhoneNumber(trimmed);
      if (parsed && parsed.countryCallingCode) {
        const countryCode = `+${parsed.countryCallingCode}`;
        // nationalNumber is the subscriber number without the country calling code
        const phoneNumber = parsed.nationalNumber;
        return { countryCode, phoneNumber };
      }
    } catch {
      // Fall through to regex fallback below
    }

    // Regex fallback if libphonenumber-js cannot parse (e.g. partial/unknown number)
    const match = trimmed.match(/^(\+\d{1,4})(.*)$/);
    if (match) {
      const countryCode = match[1];
      const phoneNumber = match[2].replace(/\D/g, "");
      return { countryCode, phoneNumber };
    }
  }

  // Fallback: no country code dial code prefix found
  const cleanDigits = trimmed.replace(/\D/g, "");
  return { countryCode: "", phoneNumber: cleanDigits };
}

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

