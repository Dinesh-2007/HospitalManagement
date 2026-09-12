/**
 * Super Admin utilities
 * =====================
 * Handles super admin table setup, session management, and main-DB operations.
 * All functions operate on the main (neondb) pool, not tenant pools.
 */

import pool from "./db";
import { cookies } from "next/headers";
import { signPermissionJWT, verifyPermissionJWT, type PermissionPayload } from "./jwt";

// ─── Table setup ─────────────────────────────────────────────────────────────

export async function ensureSuperAdminTables(): Promise<void> {
  // Super admin accounts
  await pool.query(`
    CREATE TABLE IF NOT EXISTS super_admins (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Hospitals table (might already exist — idempotent)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS hospitals (
      id SERIAL PRIMARY KEY,
      hospital_name VARCHAR(255) NOT NULL,
      admin_mail VARCHAR(255) NOT NULL,
      creator_name VARCHAR(255) NOT NULL DEFAULT '',
      site_name VARCHAR(255) UNIQUE NOT NULL,
      phone_number VARCHAR(100) NOT NULL DEFAULT '',
      country VARCHAR(255),
      timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
      currency_code VARCHAR(10) NOT NULL DEFAULT 'INR',
      currency_name VARCHAR(255) NOT NULL DEFAULT 'Indian Rupee',
      currency_symbol VARCHAR(10) NOT NULL DEFAULT '₹',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Per-tenant settings (enable/disable, user limits, notes)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenant_settings (
      site_name VARCHAR(255) PRIMARY KEY REFERENCES hospitals(site_name) ON DELETE CASCADE,
      is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      max_users INTEGER,
      notes TEXT,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Per-tenant feature gates (which pages are enabled for this tenant)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenant_feature_gates (
      id SERIAL PRIMARY KEY,
      site_name VARCHAR(255) NOT NULL REFERENCES hospitals(site_name) ON DELETE CASCADE,
      page_key VARCHAR(500) NOT NULL,
      UNIQUE(site_name, page_key)
    )
  `);

  // Predefined page group bundles (super admin creates these for easy assignment)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS page_groups (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      description TEXT,
      page_keys TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// ─── Session helpers ──────────────────────────────────────────────────────────

export const SUPER_ADMIN_COOKIE = "super_admin_session";

export async function signSuperAdminJWT(username: string): Promise<string> {
  // Reuse the permission JWT infrastructure with a special marker
  return signPermissionJWT({ sub: username, pages: ["__super_admin__"] });
}

export async function verifySuperAdminJWT(token: string): Promise<string | null> {
  const payload = await verifyPermissionJWT(token);
  if (!payload) return null;
  if (!payload.pages.includes("__super_admin__")) return null;
  return payload.sub;
}

export async function getSuperAdminSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SUPER_ADMIN_COOKIE);
  if (!cookie?.value) return null;
  return verifySuperAdminJWT(cookie.value);
}

export async function requireSuperAdmin(): Promise<string> {
  const username = await getSuperAdminSession();
  if (!username) throw new Error("Unauthorized: Super admin access required");
  return username;
}

// ─── Tenant queries ───────────────────────────────────────────────────────────

export type TenantRow = {
  id: number;
  hospital_name: string;
  admin_mail: string;
  creator_name: string;
  site_name: string;
  phone_number: string;
  country: string | null;
  timezone: string;
  currency_code: string;
  currency_name: string;
  currency_symbol: string;
  created_at: string;
  // From tenant_settings (left join)
  is_enabled: boolean;
  max_users: number | null;
  notes: string | null;
  // Computed
  user_count?: number;
  feature_gate_count?: number;
};

export async function getAllTenants(): Promise<TenantRow[]> {
  await ensureSuperAdminTables();

  const res = await pool.query<TenantRow>(`
    SELECT
      h.*,
      COALESCE(ts.is_enabled, TRUE) AS is_enabled,
      ts.max_users,
      ts.notes,
      (SELECT COUNT(*) FROM tenant_feature_gates tfg WHERE tfg.site_name = h.site_name)::int AS feature_gate_count
    FROM hospitals h
    LEFT JOIN tenant_settings ts ON ts.site_name = h.site_name
    ORDER BY h.created_at DESC
  `);

  return res.rows;
}

export async function getTenantSettings(siteName: string): Promise<{
  is_enabled: boolean;
  max_users: number | null;
  notes: string | null;
}> {
  await ensureSuperAdminTables();
  const res = await pool.query(
    `SELECT is_enabled, max_users, notes FROM tenant_settings WHERE site_name = $1`,
    [siteName]
  );
  return res.rows[0] ?? { is_enabled: true, max_users: null, notes: null };
}

export async function upsertTenantSettings(
  siteName: string,
  settings: { is_enabled?: boolean; max_users?: number | null; notes?: string | null }
): Promise<void> {
  await ensureSuperAdminTables();

  await pool.query(`
    INSERT INTO tenant_settings (site_name, is_enabled, max_users, notes, updated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (site_name) DO UPDATE SET
      is_enabled = EXCLUDED.is_enabled,
      max_users = EXCLUDED.max_users,
      notes = EXCLUDED.notes,
      updated_at = NOW()
  `, [
    siteName,
    settings.is_enabled ?? true,
    settings.max_users ?? null,
    settings.notes ?? null
  ]);
}

// ─── Feature gates ────────────────────────────────────────────────────────────

/**
 * Get the feature-gated page keys for a tenant.
 * Returns empty array if no gates set (full access).
 */
export async function getTenantFeatureGates(siteName: string): Promise<string[]> {
  await ensureSuperAdminTables();

  const res = await pool.query<{ page_key: string }>(
    `SELECT page_key FROM tenant_feature_gates WHERE site_name = $1 ORDER BY page_key`,
    [siteName]
  );
  return res.rows.map((r) => r.page_key);
}

/**
 * Replace all feature gates for a tenant.
 * Passing an empty array removes all gates (grants full access).
 */
export async function setTenantFeatureGates(
  siteName: string,
  pageKeys: string[]
): Promise<void> {
  await ensureSuperAdminTables();

  await pool.query("BEGIN");
  try {
    await pool.query(`DELETE FROM tenant_feature_gates WHERE site_name = $1`, [siteName]);
    for (const key of pageKeys) {
      await pool.query(
        `INSERT INTO tenant_feature_gates (site_name, page_key) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [siteName, key]
      );
    }
    await pool.query("COMMIT");
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }
}

// ─── Page groups ──────────────────────────────────────────────────────────────

export type PageGroupRow = {
  id: number;
  name: string;
  description: string | null;
  page_keys: string[];
  created_at: string;
};

export async function getPageGroups(): Promise<PageGroupRow[]> {
  await ensureSuperAdminTables();
  const res = await pool.query<PageGroupRow>(
    `SELECT * FROM page_groups ORDER BY name ASC`
  );
  return res.rows;
}

export async function createPageGroup(
  name: string,
  description: string,
  pageKeys: string[]
): Promise<PageGroupRow> {
  await ensureSuperAdminTables();
  const res = await pool.query<PageGroupRow>(
    `INSERT INTO page_groups (name, description, page_keys) VALUES ($1, $2, $3) RETURNING *`,
    [name.trim(), description.trim() || null, pageKeys]
  );
  return res.rows[0];
}

export async function updatePageGroup(
  id: number,
  name: string,
  description: string,
  pageKeys: string[]
): Promise<void> {
  await ensureSuperAdminTables();
  await pool.query(
    `UPDATE page_groups SET name = $1, description = $2, page_keys = $3 WHERE id = $4`,
    [name.trim(), description.trim() || null, pageKeys, id]
  );
}

export async function deletePageGroup(id: number): Promise<void> {
  await pool.query(`DELETE FROM page_groups WHERE id = $1`, [id]);
}

// ─── Super admin count ────────────────────────────────────────────────────────

export async function getSuperAdminCount(): Promise<number> {
  await ensureSuperAdminTables();
  const res = await pool.query<{ count: string }>(`SELECT COUNT(*) FROM super_admins`);
  return parseInt(res.rows[0]?.count ?? "0", 10);
}

export async function superAdminExists(username: string): Promise<{ password_hash: string } | null> {
  await ensureSuperAdminTables();
  const res = await pool.query<{ password_hash: string }>(
    `SELECT password_hash FROM super_admins WHERE username = $1 LIMIT 1`,
    [username]
  );
  return res.rows[0] ?? null;
}

export async function createSuperAdmin(username: string, passwordHash: string): Promise<void> {
  await ensureSuperAdminTables();
  await pool.query(
    `INSERT INTO super_admins (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING`,
    [username, passwordHash]
  );
}

// ─── Tenant enable check (used at tenant login time) ─────────────────────────

export async function isTenantEnabled(siteName: string): Promise<boolean> {
  await ensureSuperAdminTables();
  const res = await pool.query<{ is_enabled: boolean }>(
    `SELECT is_enabled FROM tenant_settings WHERE site_name = $1 LIMIT 1`,
    [siteName]
  );
  // If no row → tenant has no settings → enabled by default
  return res.rows[0]?.is_enabled !== false;
}

// ─── Tenant gate cookie name ──────────────────────────────────────────────────

export function tenantGatesCookieName(hname: string): string {
  return `tgates_${hname.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

export type TenantGatesPayload = PermissionPayload;

/**
 * Sign a tenant feature gates JWT.
 * pages = ["*"] means full access (no gate restriction).
 * pages = ["/some/page", ...] means only those pages are enabled for the tenant.
 */
export async function signTenantGatesJWT(siteName: string, pageKeys: string[]): Promise<string> {
  return signPermissionJWT({
    sub: siteName,
    pages: pageKeys.length === 0 ? ["*"] : pageKeys,
  });
}
