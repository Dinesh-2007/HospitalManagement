"use server";

import pool, { createTenantDbIfNotExists, getTenantDB } from "../../lib/db";
import { redirect } from "next/navigation";
import bcrypt from "bcrypt";

export async function createAccountAction(formData: FormData) {
  const hospitalName = String(formData.get("hospitalName") ?? "").trim();
  const adminMail = String(formData.get("adminMail") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const creatorName = String(formData.get("creatorName") ?? "").trim();
  const siteName = String(formData.get("siteName") ?? "").trim();
  const phoneNumber = String(formData.get("phoneNumber") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "Asia/Kolkata").trim() || "Asia/Kolkata";

  // Currency fields — defaults to INR if not provided (backwards compatible)
  const currencyCode   = String(formData.get("currency_code")   ?? "INR").trim()           || "INR";
  const currencyName   = String(formData.get("currency_name")   ?? "Indian Rupee").trim()   || "Indian Rupee";
  const currencySymbol = String(formData.get("currency_symbol") ?? "₹").trim()             || "₹";

  if (!hospitalName || !siteName) {
    throw new Error("Hospital name and site name are required.");
  }

  if (!adminMail || !password) {
    throw new Error("Admin email and password are required.");
  }

  // Create table in the main DB if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS hospitals (
      id SERIAL PRIMARY KEY,
      hospital_name VARCHAR(255) NOT NULL,
      admin_mail VARCHAR(255) NOT NULL,
      creator_name VARCHAR(255) NOT NULL,
      site_name VARCHAR(255) UNIQUE NOT NULL,
      phone_number VARCHAR(100) NOT NULL,
      country VARCHAR(255),
      timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
      currency_code   VARCHAR(10)  NOT NULL DEFAULT 'INR',
      currency_name   VARCHAR(255) NOT NULL DEFAULT 'Indian Rupee',
      currency_symbol VARCHAR(10)  NOT NULL DEFAULT '₹',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Ensure all columns exist for existing databases (idempotent migrations)
  await pool.query(`ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS country VARCHAR(255)`);
  await pool.query(`ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata'`);
  await pool.query(`ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS currency_code   VARCHAR(10)  NOT NULL DEFAULT 'INR'`);
  await pool.query(`ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS currency_name   VARCHAR(255) NOT NULL DEFAULT 'Indian Rupee'`);
  await pool.query(`ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(10)  NOT NULL DEFAULT '₹'`);

  // Insert hospital details into main DB
  await pool.query(`
    INSERT INTO hospitals (hospital_name, admin_mail, creator_name, site_name, phone_number, country, timezone, currency_code, currency_name, currency_symbol)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (site_name) DO NOTHING
  `, [hospitalName, adminMail, creatorName, siteName, phoneNumber, country || null, timezone, currencyCode, currencyName, currencySymbol]);

  // Generate DB based on siteName safely
  await createTenantDbIfNotExists(siteName);

  // Connect to the new tenant DB to create users table and insert admin
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

  // Insert admin (if not exists) using the adminMail as username
  await tenantPool.query(`
    INSERT INTO users (username, password, role) 
    VALUES ($1, $2, 'admin')
    ON CONFLICT (username) DO NOTHING
  `, [adminMail, hashedPassword]);

  // Use the desired siteName as the routing identifier
  const tenantRoute = encodeURIComponent(siteName);

  // Redirect user to the new site's login page
  redirect(`/${tenantRoute}`);
}
