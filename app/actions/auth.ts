"use server";

import { cookies } from "next/headers";
import { getTenantDB } from "../../lib/db";
import { redirect } from "next/navigation";
import bcrypt from "bcrypt";
import { signPermissionJWT, permsCookieName } from "../../lib/jwt";
import { resolveUserPermissions, ensureRBACTables } from "./rbac";
import {
  isTenantEnabled,
  getTenantFeatureGates,
  tenantGatesCookieName,
  signTenantGatesJWT,
  ensureSuperAdminTables,
} from "../../lib/super-admin";

export async function loginAction(formData: FormData) {
  const hname = String(formData.get("hname") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!hname || !username || !password) {
    throw new Error("Missing credentials");
  }

  // ── Tenant enabled check ────────────────────────────────────────────────────
  await ensureSuperAdminTables();
  const enabled = await isTenantEnabled(hname);
  if (!enabled) {
    throw new Error("This account has been suspended. Please contact support.");
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

  // ── Tenant feature gates cookie ─────────────────────────────────────────────
  // Bake the tenant's feature gates into a signed cookie so the middleware can
  // check them without a DB call.
  const featureGateKeys = await getTenantFeatureGates(hname);
  const tenantGatesJWT = await signTenantGatesJWT(hname, featureGateKeys);

  // Set all cookies
  const cookieStore = await cookies();
  const cookieKey = `auth_${hname.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const cookieOpts = { path: "/", httpOnly: true, sameSite: "lax" as const };
  const cookieOptsWithMaxAge = { ...cookieOpts, maxAge: 60 * 60 * 24 };

  cookieStore.set(cookieKey, username, cookieOpts);
  cookieStore.set(permsCookieName(hname), permJWT, cookieOptsWithMaxAge);
  cookieStore.set(tenantGatesCookieName(hname), tenantGatesJWT, cookieOptsWithMaxAge);

  redirect(`/${encodeURIComponent(hname)}/masters`);
}

export async function logoutAction(hname: string) {
  const cookieStore = await cookies();
  cookieStore.delete(`auth_${hname.replace(/[^a-zA-Z0-9]/g, "_")}`);
  cookieStore.delete(permsCookieName(hname));
  cookieStore.delete(tenantGatesCookieName(hname));
}

/**
 * Refresh the permission cookie for the currently logged-in user.
 * Called when an admin updates a user's role or overrides while that user may still be logged in.
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
