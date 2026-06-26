"use server";

import { cookies } from "next/headers";
import { getTenantDB } from "../../lib/db";

export async function getCurrentUser(hname: string) {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get(`auth_${hname.replace(/[^a-zA-Z0-9]/g, '_')}`);
  return authCookie?.value || null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientDbError(error: unknown) {
  if (!(error instanceof Error)) return false;

  // pg can surface:
  // - ETIMEDOUT / ENETUNREACH (network layer)
  // - AggregateError with underlying connect errors
  const msg = error.message || "";
  const name = (error as any).name;

  return (
    msg.includes("ETIMEDOUT") ||
    msg.includes("ENETUNREACH") ||
    name === "AggregateError" ||
    msg.includes("connect") // broad guard; still only used for retries
  );
}

export async function getCurrentUserRole(hname: string) {
  const username = await getCurrentUser(hname);

  if (!username) {
    return null;
  }

  const pool = await getTenantDB(hname);

  const queryOnce = async () => {
    const result = await pool.query<{ role: string | null }>(
      "SELECT role FROM users WHERE username = $1 LIMIT 1",
      [username],
    );
    return result.rows[0]?.role ?? null;
  };

  // Retry a couple times for cold-start / transient network connect failures.
  const maxAttempts = 3; // initial + 2 retries
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await queryOnce();
    } catch (error) {
      lastError = error;

      if (!isTransientDbError(error) || attempt === maxAttempts) {
        throw error;
      }

      // small backoff: 200ms, then 500ms
      const backoffMs = attempt === 1 ? 200 : 500;
      await sleep(backoffMs);
    }
  }

  // Should never reach here, but keeps TS happy.
  throw lastError;
}
