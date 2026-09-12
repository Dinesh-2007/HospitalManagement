"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcrypt";
import {
  createSuperAdmin,
  createPageGroup,
  deletePageGroup,
  ensureSuperAdminTables,
  getAllTenants,
  getPageGroups,
  getTenantFeatureGates,
  getTenantSettings,
  requireSuperAdmin,
  SUPER_ADMIN_COOKIE,
  signSuperAdminJWT,
  superAdminExists,
  updatePageGroup,
  upsertTenantSettings,
  setTenantFeatureGates,
  getSuperAdminCount,
  tenantGatesCookieName,
  signTenantGatesJWT,
  type TenantRow,
  type PageGroupRow,
} from "../../lib/super-admin";
import pool, { createTenantDbIfNotExists, getTenantDB } from "../../lib/db";
import { ensureRBACTables } from "./rbac";

// ─── Authentication ───────────────────────────────────────────────────────────

export async function superAdminLoginAction(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!username || !password) throw new Error("Missing credentials");

  await ensureSuperAdminTables();

  // First-time setup: if no super admins exist, create one
  const count = await getSuperAdminCount();
  if (count === 0) {
    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(password, salt);
    await createSuperAdmin(username, hash);
  }

  const record = await superAdminExists(username);
  if (!record) throw new Error("Invalid credentials");

  const isMatch = await bcrypt.compare(password, record.password_hash);
  if (!isMatch) throw new Error("Invalid credentials");

  const token = await signSuperAdminJWT(username);
  const cookieStore = await cookies();
  cookieStore.set(SUPER_ADMIN_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 8, // 8 hours
  });

  redirect("/SuperAdmin/tenants");
}

export async function superAdminLogoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SUPER_ADMIN_COOKIE);
  redirect("/SuperAdmin/login");
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

export async function getTenantsAction(): Promise<TenantRow[]> {
  await requireSuperAdmin();
  return getAllTenants();
}

export async function updateTenantSettingsAction(
  siteName: string,
  settings: { is_enabled?: boolean; max_users?: number | null; notes?: string | null }
): Promise<void> {
  await requireSuperAdmin();
  await upsertTenantSettings(siteName, settings);
}

export async function getTenantFeatureGatesAction(siteName: string): Promise<string[]> {
  await requireSuperAdmin();
  return getTenantFeatureGates(siteName);
}

export async function setTenantFeatureGatesAction(
  siteName: string,
  pageKeys: string[]
): Promise<void> {
  await requireSuperAdmin();
  await setTenantFeatureGates(siteName, pageKeys);
}

/**
 * Create a new tenant from the super admin panel.
 * Mirrors createAccountAction but does NOT redirect and does NOT require a form.
 */
export async function createTenantAction(data: {
  hospitalName: string;
  adminMail: string;
  password: string;
  creatorName?: string;
  siteName: string;
  phoneNumber?: string;
  country?: string;
  timezone?: string;
  currencyCode?: string;
  currencyName?: string;
  currencySymbol?: string;
  maxUsers?: number | null;
  notes?: string;
}): Promise<{ siteName: string }> {
  await requireSuperAdmin();

  const {
    hospitalName,
    adminMail,
    password,
    creatorName = "",
    siteName,
    phoneNumber = "",
    country = null,
    timezone = "Asia/Kolkata",
    currencyCode = "INR",
    currencyName = "Indian Rupee",
    currencySymbol = "₹",
    maxUsers = null,
    notes = null,
  } = data;

  if (!hospitalName || !siteName || !adminMail || !password) {
    throw new Error("Hospital name, site name, admin email and password are required.");
  }

  // Hospitals table
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

  await pool.query(`
    INSERT INTO hospitals (hospital_name, admin_mail, creator_name, site_name, phone_number, country, timezone, currency_code, currency_name, currency_symbol)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (site_name) DO NOTHING
  `, [hospitalName, adminMail, creatorName, siteName, phoneNumber, country, timezone, currencyCode, currencyName, currencySymbol]);

  // Create tenant DB
  await createTenantDbIfNotExists(siteName);

  // Setup tenant DB
  const tenantPool = await getTenantDB(siteName);
  await tenantPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(100) NOT NULL DEFAULT 'User',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  await tenantPool.query(`
    INSERT INTO users (username, password, role)
    VALUES ($1, $2, 'admin')
    ON CONFLICT (username) DO NOTHING
  `, [adminMail, hashedPassword]);

  await ensureRBACTables(siteName);

  // Apply tenant settings
  await ensureSuperAdminTables();
  await upsertTenantSettings(siteName, { is_enabled: true, max_users: maxUsers, notes });

  return { siteName };
}

export async function deleteTenantAction(siteName: string): Promise<void> {
  await requireSuperAdmin();
  // Remove from main DB (cascade deletes settings and feature gates)
  await pool.query(`DELETE FROM hospitals WHERE site_name = $1`, [siteName]);
}

// ─── Page Groups ──────────────────────────────────────────────────────────────

export async function getPageGroupsAction(): Promise<PageGroupRow[]> {
  await requireSuperAdmin();
  return getPageGroups();
}

export async function createPageGroupAction(
  name: string,
  description: string,
  pageKeys: string[]
): Promise<PageGroupRow> {
  await requireSuperAdmin();
  return createPageGroup(name, description, pageKeys);
}

export async function updatePageGroupAction(
  id: number,
  name: string,
  description: string,
  pageKeys: string[]
): Promise<void> {
  await requireSuperAdmin();
  await updatePageGroup(id, name, description, pageKeys);
}

export async function deletePageGroupAction(id: number): Promise<void> {
  await requireSuperAdmin();
  await deletePageGroup(id);
}
