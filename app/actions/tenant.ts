"use server";

import { createTenantDbIfNotExists, getTenantDB } from "../../lib/db";
import { redirect } from "next/navigation";
import bcrypt from "bcrypt";

export async function createAccountAction(formData: FormData) {
  const hospitalName = String(formData.get("hospitalName") ?? "").trim();
  const siteName = String(formData.get("siteName") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!hospitalName || !siteName) {
    throw new Error("Hospital name and site name are required.");
  }

  if (!password) {
    throw new Error("Password is required to create the admin user.");
  }

  // Generate DB based on siteName safely
  await createTenantDbIfNotExists(siteName);

  // Connect to the new tenant DB to create users table and insert admin
  const pool = await getTenantDB(siteName);

  await pool.query(`
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

  // Insert admin (if not exists)
  await pool.query(`
    INSERT INTO users (username, password, role) 
    VALUES ('admin', $1, 'admin')
    ON CONFLICT (username) DO NOTHING
  `, [hashedPassword]);

  // Use the desired siteName as the routing identifier
  const tenantRoute = encodeURIComponent(siteName);

  // Redirect user to the new site's login page
  redirect(`/${tenantRoute}`);
}
