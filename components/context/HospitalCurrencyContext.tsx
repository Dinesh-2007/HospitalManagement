"use client";

import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CurrencyContextType = {
  /** ISO 4217 currency code, e.g. "INR" */
  currencyCode: string;
  /** Full currency name, e.g. "Indian Rupee" */
  currencyName: string;
  /** Currency symbol, e.g. "₹" */
  currencySymbol: string;
  /**
   * Format an amount with the currency symbol and 2 decimal places.
   * @example formatCurrency(500) → "₹500.00"
   */
  formatCurrency(amount: number): string;
  /**
   * Format an amount with the currency symbol and no decimal places.
   * Useful for whole-number displays (e.g. dashboard cards).
   * @example formatCurrencyWithoutDecimals(500) → "₹500"
   */
  formatCurrencyWithoutDecimals(amount: number): string;
  /** Whether the currency has been loaded from the server */
  isLoaded: boolean;
};

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_CODE   = "INR";
const DEFAULT_NAME   = "Indian Rupee";
const DEFAULT_SYMBOL = "₹";

function makeFormatCurrency(symbol: string) {
  return (amount: number) => `${symbol}${Number(amount).toFixed(2)}`;
}

function makeFormatCurrencyWithoutDecimals(symbol: string) {
  return (amount: number) => `${symbol}${Math.round(Number(amount))}`;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const HospitalCurrencyContext = createContext<CurrencyContextType>({
  currencyCode:   DEFAULT_CODE,
  currencyName:   DEFAULT_NAME,
  currencySymbol: DEFAULT_SYMBOL,
  formatCurrency:                makeFormatCurrency(DEFAULT_SYMBOL),
  formatCurrencyWithoutDecimals: makeFormatCurrencyWithoutDecimals(DEFAULT_SYMBOL),
  isLoaded: false,
});

// ─── Provider ─────────────────────────────────────────────────────────────────

type ProviderProps = {
  hname: string;
  children: React.ReactNode;
};

export function HospitalCurrencyProvider({ hname, children }: ProviderProps) {
  const [currencyCode,   setCurrencyCode]   = useState(DEFAULT_CODE);
  const [currencyName,   setCurrencyName]   = useState(DEFAULT_NAME);
  const [currencySymbol, setCurrencySymbol] = useState(DEFAULT_SYMBOL);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!hname) return;

    async function fetchCurrency() {
      try {
        const res  = await fetch(`/api/${encodeURIComponent(hname)}/currency`, { cache: "force-cache" });
        const data = (await res.json()) as { code?: string; name?: string; symbol?: string };
        if (data.code)   setCurrencyCode(data.code);
        if (data.name)   setCurrencyName(data.name);
        if (data.symbol) setCurrencySymbol(data.symbol);
      } catch {
        // Keep default on failure — don't break the app
      } finally {
        setIsLoaded(true);
      }
    }

    void fetchCurrency();
  }, [hname]);

  const value: CurrencyContextType = {
    currencyCode,
    currencyName,
    currencySymbol,
    formatCurrency:                makeFormatCurrency(currencySymbol),
    formatCurrencyWithoutDecimals: makeFormatCurrencyWithoutDecimals(currencySymbol),
    isLoaded,
  };

  return (
    <HospitalCurrencyContext.Provider value={value}>
      {children}
    </HospitalCurrencyContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the hospital's currency configuration and formatting helpers.
 *
 * @example
 * const { currencySymbol, formatCurrency } = useHospitalCurrency();
 * // formatCurrency(500) → "₹500.00"   (for INR hospital)
 * // formatCurrency(500) → "$500.00"   (for USD hospital)
 */
export function useHospitalCurrency(): CurrencyContextType {
  return useContext(HospitalCurrencyContext);
}
