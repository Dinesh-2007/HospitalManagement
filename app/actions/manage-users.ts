"use server";

import { cookies } from "next/headers";
import { getTenantDB } from "../../lib/db";
import bcrypt from "bcrypt";

export async function checkIsAdmin(hname: string) {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get(`auth_${hname.replace(/[^a-zA-Z0-9]/g, '_')}`);
  return authCookie?.value === "admin";
}

export async function fetchUsers(hname: string) {
  if (!(await checkIsAdmin(hname))) throw new Error("Unauthorized");
  
  const pool = await getTenantDB(hname);
  const res = await pool.query("SELECT id, username, created_at FROM users ORDER BY id ASC");
  return res.rows;
}

export async function addUser(hname: string, formData: FormData) {
  if (!(await checkIsAdmin(hname))) throw new Error("Unauthorized");
  
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  
  if (!username || !password) throw new Error("Missing fields");
  
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const pool = await getTenantDB(hname);
  try {
    await pool.query(
      "INSERT INTO users (username, password) VALUES ($1, $2)",
      [username, hashedPassword]
    );
  } catch (e: any) {
    if (e.code === '23505') { // Unique violation
      throw new Error("Username already exists");
    }
    throw e;
  }
}

export async function removeUser(hname: string, formData: FormData) {
  if (!(await checkIsAdmin(hname))) throw new Error("Unauthorized");
  
  const idStr = String(formData.get("id") ?? "");
  const id = parseInt(idStr, 10);
  if (isNaN(id)) throw new Error("Invalid id");
  
  const pool = await getTenantDB(hname);
  const userRes = await pool.query("SELECT username FROM users WHERE id = $1", [id]);
  if (userRes.rows[0]?.username === "admin") {
    throw new Error("Cannot remove root admin");
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

  const pool = await getTenantDB(hname);
  await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashedPassword, id]);
}
