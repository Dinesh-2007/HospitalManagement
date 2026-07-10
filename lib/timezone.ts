/**
 * Hospital Timezone Utility
 *
 * All date/time calculations in the HMS must go through these helpers instead
 * of calling `new Date().toISOString()` or `new Date().toLocaleString()`.
 *
 * This ensures every module (Vitals, Doctor Consultation, Check-in, Billing,
 * Pharmacy, etc.) uses the hospital's configured IANA timezone as the single
 * source of truth — regardless of the server's system clock timezone or the
 * browser user's local timezone.
 */

import pool from "./db";

// ─── Core timezone helpers ────────────────────────────────────────────────────

/**
 * Returns today's date string (YYYY-MM-DD) in the given IANA timezone.
 * Example: "Asia/Kolkata" → "2026-07-09" even when server UTC is "2026-07-08"
 */
export function getTodayInTimezone(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Returns the current time string (HH:MM:SS) in the given IANA timezone.
 */
export function getNowTimeInTimezone(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("hour")}:${get("minute")}:${get("second")}`;
}

/**
 * Returns the current time as HH:MM (no seconds) in the given IANA timezone.
 */
export function getNowTimeShortInTimezone(timezone: string): string {
  return getNowTimeInTimezone(timezone).slice(0, 5);
}

/**
 * Returns a compact date string YYYYMMDD in the given timezone.
 * Useful for generating invoice/token numbers.
 */
export function getDateCompactInTimezone(timezone: string): string {
  return getTodayInTimezone(timezone).replace(/-/g, "");
}

/**
 * Returns the day name (e.g. "Monday") in the given timezone.
 */
export function getDayNameInTimezone(timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
  }).format(new Date());
}

// ─── Hospital timezone resolver ───────────────────────────────────────────────

const DEFAULT_TIMEZONE = "Asia/Kolkata";

/** In-memory cache so we don't query the DB on every request */
const timezoneCache = new Map<string, { value: { timezone: string; country: string }; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Retrieves the IANA timezone configured for the hospital.
 * Falls back to "Asia/Kolkata" if not set.
 *
 * @param hname - The site_name / Hname identifier (decoded, lowercase)
 */
export async function getHospitalTimezone(hname: string): Promise<{ timezone: string; country: string }> {
  const key = hname.toLowerCase();
  const cached = timezoneCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    // Ensure the timezone column exists before querying
    await pool.query(
      `ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT '${DEFAULT_TIMEZONE}'`
    );

    const result = await pool.query<{ timezone: string; country: string }>(
      `SELECT timezone, country FROM hospitals WHERE LOWER(site_name) = LOWER($1) LIMIT 1`,
      [hname]
    );

    const row = result.rows[0];
    const tz = row?.timezone || DEFAULT_TIMEZONE;
    const country = row?.country || "India";
    const data = { timezone: tz, country };
    timezoneCache.set(key, { value: data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  } catch {
    return { timezone: DEFAULT_TIMEZONE, country: "India" };
  }
}

/**
 * Clears the timezone cache for a specific hospital (call after timezone update).
 */
export function clearTimezoneCache(hname: string) {
  timezoneCache.delete(hname.toLowerCase());
}
