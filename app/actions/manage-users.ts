"use server";

import { cookies } from "next/headers";
import { getTenantDB } from "../../lib/db";
import bcrypt from "bcrypt";
import { ensureRBACTables } from "./rbac";

async function ensureUsersTable(hname: string) {
  const pool = await getTenantDB(hname);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(100) NOT NULL DEFAULT 'User',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role VARCHAR(100) NOT NULL DEFAULT 'User'
  `);
  // Ensure RBAC tables and columns exist
  await ensureRBACTables(hname);
  return pool;
}

export async function checkIsAdmin(hname: string) {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get(`auth_${hname.replace(/[^a-zA-Z0-9]/g, '_')}`);
  if (!authCookie?.value) return false;

  const pool = await getTenantDB(hname);
  try {
    const res = await pool.query(
      "SELECT role FROM users WHERE username = $1 LIMIT 1",
      [authCookie.value]
    );
    return res.rows[0]?.role?.toLowerCase() === "admin";
  } catch (error) {
    return false;
  }
}

export type UserRow = {
  id: number;
  username: string;
  role: string;
  role_id: number | null;
  role_name: string | null;
  created_at?: string;
};

export async function fetchUsers(hname: string): Promise<UserRow[]> {
  if (!(await checkIsAdmin(hname))) throw new Error("Unauthorized");
  
  const pool = await ensureUsersTable(hname);
  const res = await pool.query<UserRow>(`
    SELECT u.id, u.username, u.role, u.role_id, r.name AS role_name, u.created_at
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    ORDER BY u.id ASC
  `);
  return res.rows;
}

export async function addUser(hname: string, formData: FormData) {
  if (!(await checkIsAdmin(hname))) throw new Error("Unauthorized");
  
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const roleId = formData.get("role_id") ? Number(formData.get("role_id")) : null;
  const roleName = String(formData.get("role") ?? "User").trim() || "User";
  
  if (!username || !password) throw new Error("Missing fields");
  
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const pool = await ensureUsersTable(hname);
  try {
    await pool.query(
      "INSERT INTO users (username, password, role, role_id) VALUES ($1, $2, $3, $4)",
      [username, hashedPassword, roleName, roleId]
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "23505") {
      throw new Error("Username already exists");
    }
    throw error;
  }
}

export async function removeUser(hname: string, formData: FormData) {
  if (!(await checkIsAdmin(hname))) throw new Error("Unauthorized");
  
  const idStr = String(formData.get("id") ?? "");
  const id = parseInt(idStr, 10);
  if (isNaN(id)) throw new Error("Invalid id");
  
  const pool = await ensureUsersTable(hname);
  const userRes = await pool.query("SELECT username, role FROM users WHERE id = $1", [id]);
  if (userRes.rows[0]?.role?.toLowerCase() === "admin") {
    throw new Error("Cannot remove admin user");
  }
  
  await pool.query("DELETE FROM users WHERE id = $1", [id]);
}

export async function changeUserPassword(hname: string, formData: FormData) {
  if (!(await checkIsAdmin(hname))) throw new Error("Unauthorized");
  
  const idStr = String(formData.get("id") ?? "");
  const id = parseInt(idStr, 10);
  const password = String(formData.get("password") ?? "").trim();
  
  if (isNaN(id) || !password) throw new Error("Missing fields");
  
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const pool = await ensureUsersTable(hname);
  await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashedPassword, id]);
}

export async function updateUserRole(hname: string, formData: FormData) {
  if (!(await checkIsAdmin(hname))) throw new Error("Unauthorized");

  const idStr = String(formData.get("id") ?? "");
  const id = parseInt(idStr, 10);
  const role = String(formData.get("role") ?? "").trim();
  const roleIdStr = formData.get("role_id");
  const roleId = roleIdStr && String(roleIdStr).trim() ? Number(roleIdStr) : null;

  if (isNaN(id) || !role) throw new Error("Missing fields");

  const pool = await ensureUsersTable(hname);
  await pool.query(
    "UPDATE users SET role = $1, role_id = $2 WHERE id = $3",
    [role, roleId, id]
  );
}
