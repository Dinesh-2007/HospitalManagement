"use server";

import { cookies } from "next/headers";
import { getTenantDB } from "../../lib/db";

export async function getCurrentUser(hname: string) {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get(`auth_${hname.replace(/[^a-zA-Z0-9]/g, '_')}`);
  return authCookie?.value || null;
}

export async function getCurrentUserRole(hname: string) {
  const username = await getCurrentUser(hname);

  if (!username) {
    return null;
  }

  const pool = await getTenantDB(hname);
  const result = await pool.query<{ role: string | null }>(
    "SELECT role FROM users WHERE username = $1 LIMIT 1",
    [username],
  );

  return result.rows[0]?.role ?? null;
}