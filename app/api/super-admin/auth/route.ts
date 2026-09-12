import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcrypt";
import {
  getSuperAdminCount,
  superAdminExists,
  createSuperAdmin,
  signSuperAdminJWT,
  verifySuperAdminJWT,
  SUPER_ADMIN_COOKIE,
} from "../../../../lib/super-admin";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const username = (body.username ?? "").trim();
    const password = (body.password ?? "").trim();

    if (!username || !password) throw new Error("Missing credentials");

    const count = await getSuperAdminCount();
    if (count === 0) {
      // First-time setup — create the first super admin
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
      maxAge: 60 * 60 * 8,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Login failed" },
      { status: 401 }
    );
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(SUPER_ADMIN_COOKIE);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(SUPER_ADMIN_COOKIE);
    if (!cookie?.value) return NextResponse.json({ authenticated: false });

    const username = await verifySuperAdminJWT(cookie.value);
    if (!username) return NextResponse.json({ authenticated: false });

    const count = await getSuperAdminCount();
    return NextResponse.json({ authenticated: true, username, firstTime: count === 0 });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}
