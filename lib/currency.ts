/**
 * Hospital Currency Utility
 *
 * All monetary formatting in the HMS must go through these helpers instead of
 * using hardcoded currency symbols such as ₹, $, or €.
 *
 * This ensures every module (Billing, Pharmacy, Records, Invoice, etc.) uses
 * the hospital's configured ISO 4217 currency as the single source of truth —
 * regardless of which hospital (tenant) is being accessed.
 *
 * Architecture mirrors lib/timezone.ts exactly.
 */

import pool from "./db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type HospitalCurrency = {
  code: string;   // ISO 4217, e.g. "INR"
  name: string;   // e.g. "Indian Rupee"
  symbol: string; // e.g. "₹"
};

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_CURRENCY: HospitalCurrency = {
  code: "INR",
  name: "Indian Rupee",
  symbol: "₹",
};

// ─── In-memory cache ──────────────────────────────────────────────────────────

/** Cache so we don't query the DB on every request */
const currencyCache = new Map<string, { value: HospitalCurrency; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── DB resolver ──────────────────────────────────────────────────────────────

/**
 * Retrieves the ISO 4217 currency configured for the hospital.
 * Falls back to INR / Indian Rupee / ₹ if not set.
 *
 * @param hname - The site_name / Hname identifier (decoded, any case)
 */
export async function getHospitalCurrency(hname: string): Promise<HospitalCurrency> {
  const key = hname.toLowerCase();
  const cached = currencyCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    // Ensure the currency columns exist before querying (idempotent migration)
    await pool.query(`
      ALTER TABLE hospitals
        ADD COLUMN IF NOT EXISTS currency_code   VARCHAR(10)  NOT NULL DEFAULT 'INR',
        ADD COLUMN IF NOT EXISTS currency_name   VARCHAR(255) NOT NULL DEFAULT 'Indian Rupee',
        ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(10)  NOT NULL DEFAULT '₹'
    `);

    const result = await pool.query<{
      currency_code: string;
      currency_name: string;
      currency_symbol: string;
    }>(
      `SELECT currency_code, currency_name, currency_symbol
         FROM hospitals
        WHERE LOWER(site_name) = LOWER($1)
        LIMIT 1`,
      [hname],
    );

    const row = result.rows[0];
    const currency: HospitalCurrency = row
      ? {
          code:   row.currency_code   || DEFAULT_CURRENCY.code,
          name:   row.currency_name   || DEFAULT_CURRENCY.name,
          symbol: row.currency_symbol || DEFAULT_CURRENCY.symbol,
        }
      : DEFAULT_CURRENCY;

    currencyCache.set(key, { value: currency, expiresAt: Date.now() + CACHE_TTL_MS });
    return currency;
  } catch {
    return DEFAULT_CURRENCY;
  }
}

/**
 * Clears the currency cache for a specific hospital (call after currency update).
 */
export function clearCurrencyCache(hname: string) {
  currencyCache.delete(hname.toLowerCase());
}
