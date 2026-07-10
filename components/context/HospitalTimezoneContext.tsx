"use client";

import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type TimezoneContextType = {
  /** IANA timezone string, e.g. "Asia/Kolkata" */
  timezone: string;
  /**
   * Today's date as YYYY-MM-DD calculated in the hospital timezone.
   * Use this everywhere instead of `new Date().toISOString().slice(0,10)`.
   */
  /** Today's date as YYYY-MM-DD calculated in the hospital timezone. */
  todayDate: string;
  /** The hospital's registered country name, e.g. "India" or "United States" */
  country: string;
  /** Whether the timezone has been loaded from the server */
  isLoaded: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_TIMEZONE = "Asia/Kolkata";

function computeTodayInTimezone(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    // Fallback using browser offset if Intl fails
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split("T")[0];
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const HospitalTimezoneContext = createContext<TimezoneContextType>({
  timezone: DEFAULT_TIMEZONE,
  todayDate: computeTodayInTimezone(DEFAULT_TIMEZONE),
  country: "India",
  isLoaded: false,
});

// ─── Provider ─────────────────────────────────────────────────────────────────

type ProviderProps = {
  hname: string;
  children: React.ReactNode;
};

export function HospitalTimezoneProvider({ hname, children }: ProviderProps) {
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [todayDate, setTodayDate] = useState(() => computeTodayInTimezone(DEFAULT_TIMEZONE));
  const [country, setCountry] = useState("India");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!hname) return;

    async function fetchTimezone() {
      try {
        const res = await fetch(`/api/${encodeURIComponent(hname)}/timezone`, { cache: "force-cache" });
        const data = await res.json() as { timezone?: string; country?: string };
        const tz = data.timezone || DEFAULT_TIMEZONE;
        setTimezone(tz);
        setCountry(data.country || "India");
        setTodayDate(computeTodayInTimezone(tz));
      } catch {
        // Keep default on failure — don't break the app
      } finally {
        setIsLoaded(true);
      }
    }

    void fetchTimezone();
  }, [hname]);

  return (
    <HospitalTimezoneContext.Provider value={{ timezone, todayDate, country, isLoaded }}>
      {children}
    </HospitalTimezoneContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the hospital's timezone and today's date.
 *
 * @example
 * const { todayDate, timezone } = useHospitalTimezone();
 * // todayDate: "2026-07-09" (in hospital local time)
 */
export function useHospitalTimezone(): TimezoneContextType {
  return useContext(HospitalTimezoneContext);
}
