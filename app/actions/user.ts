"use server";

import { cookies } from "next/headers";

export async function getCurrentUser(hname: string) {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get(`auth_${hname.replace(/[^a-zA-Z0-9]/g, '_')}`);
  return authCookie?.value || null;
}
