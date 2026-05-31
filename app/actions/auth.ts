"use server";

import { cookies } from "next/headers";
import { getTenantDB } from "../../lib/db";
import { redirect } from "next/navigation";
import bcrypt from "bcrypt";

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

  // Set auth cookie
  const cookieStore = await cookies();
  cookieStore.set(`auth_${hname.replace(/[^a-zA-Z0-9]/g, '_')}`, username, { path: "/", httpOnly: true });

  redirect(`/${encodeURIComponent(hname)}/masters`);
}

export async function logoutAction(hname: string) {
  const cookieStore = await cookies();
  cookieStore.delete(`auth_${hname.replace(/[^a-zA-Z0-9]/g, '_')}`);
}
