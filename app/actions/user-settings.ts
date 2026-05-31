"use server";

import { cookies } from "next/headers";
import { getTenantDB } from "../../lib/db";
import bcrypt from "bcrypt";

export async function changePasswordAction(hname: string, formData: FormData) {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get(`auth_${hname.replace(/[^a-zA-Z0-9]/g, '_')}`);
  if (!authCookie) throw new Error("Not logged in");

  const username = authCookie.value;
  const oldPassword = String(formData.get("oldPassword") ?? "").trim();
  const newPassword = String(formData.get("newPassword") ?? "").trim();

  if (!oldPassword || !newPassword) throw new Error("Missing password fields");

  const pool = await getTenantDB(hname);

  // Validate old password
  const res = await pool.query(
    "SELECT id, password FROM users WHERE username = $1",
    [username]
  );

  if (res.rowCount === 0) {
    throw new Error("User not found");
  }

  const user = res.rows[0];
  const isMatch = await bcrypt.compare(oldPassword, user.password);

  if (!isMatch) {
    throw new Error("Incorrect old password");
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  // Update to new password
  await pool.query(
    "UPDATE users SET password = $1 WHERE username = $2",
    [hashedPassword, username]
  );

  return { success: true };
}
