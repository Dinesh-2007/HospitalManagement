import { NextResponse } from "next/server";
import {
  upsertTenantSettings,
  getTenantSettings,
  getSuperAdminSession,
} from "../../../../../../lib/super-admin";

async function assertSuperAdmin() {
  const username = await getSuperAdminSession();
  if (!username) throw new Error("Unauthorized");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteName: string }> }
) {
  try {
    await assertSuperAdmin();
    const { siteName } = await params;
    const settings = await getTenantSettings(decodeURIComponent(siteName));
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ siteName: string }> }
) {
  try {
    await assertSuperAdmin();
    const { siteName } = await params;
    const body = (await request.json()) as {
      is_enabled?: boolean;
      max_users?: number | null;
      notes?: string | null;
    };
    await upsertTenantSettings(decodeURIComponent(siteName), body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 }
    );
  }
}
