"use server";

import { cookies } from "next/headers";
import { getTenantDB } from "../../lib/db";
import { redirect } from "next/navigation";
import bcrypt from "bcrypt";
import { signPermissionJWT, permsCookieName } from "../../lib/jwt";
import { resolveUserPermissions, ensureRBACTables } from "./rbac";

export async function loginAction(formData: FormData) {
  const hname = String(formData.get("hname") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!hname || !username || !password) {
    throw new Error("Missing credentials");
  }

  const pool = await getTenantDB(hname);

  const res = await pool.query(
    `SELECT * FROM users WHERE username = $1`,
    [username]
  );

  if (res.rowCount === 0) {
    throw new Error("Invalid username or password");
  }

  const user = res.rows[0];
  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new Error("Invalid username or password");
  }

  // Ensure RBAC tables exist (for tenants created before RBAC was added)
  await ensureRBACTables(hname);

  // Resolve this user's permissions
  const { allowedPages } = await resolveUserPermissions(hname, username);

  // Sign a permission JWT and store it as a cookie
  const permJWT = await signPermissionJWT({ sub: username, pages: allowedPages });

  // Set auth cookie
  const cookieStore = await cookies();
  const cookieKey = `auth_${hname.replace(/[^a-zA-Z0-9]/g, "_")}`;
  cookieStore.set(cookieKey, username, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });

  // Set permission cookie (httpOnly so it can be read by middleware / server)
  cookieStore.set(permsCookieName(hname), permJWT, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    // Max age matches JWT expiry (24h)
    maxAge: 60 * 60 * 24,
  });

  redirect(`/${encodeURIComponent(hname)}/masters`);
}

export async function logoutAction(hname: string) {
  const cookieStore = await cookies();
  cookieStore.delete(`auth_${hname.replace(/[^a-zA-Z0-9]/g, "_")}`);
  cookieStore.delete(permsCookieName(hname));
}

/**
 * Refresh the permission cookie for the currently logged-in user.
 * Called when an admin updates a user's role or overrides while that user may still be logged in.
 * (Primarily used when the current user is editing their own perms — not a hard requirement.)
 */
export async function refreshPermissionsAction(hname: string, username: string): Promise<void> {
  await ensureRBACTables(hname);
  const { allowedPages } = await resolveUserPermissions(hname, username);
  const permJWT = await signPermissionJWT({ sub: username, pages: allowedPages });

  const cookieStore = await cookies();
  cookieStore.set(permsCookieName(hname), permJWT, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
  });
}
