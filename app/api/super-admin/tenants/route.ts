import { NextResponse } from "next/server";
import { getAllTenants, getSuperAdminSession } from "../../../../lib/super-admin";
import { createTenantAction } from "../../../actions/super-admin";

async function assertSuperAdmin() {
  const username = await getSuperAdminSession();
  if (!username) throw new Error("Unauthorized");
  return username;
}

export async function GET() {
  try {
    await assertSuperAdmin();
    const tenants = await getAllTenants();
    return NextResponse.json({ tenants });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: error instanceof Error && error.message === "Unauthorized" ? 401 : 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await assertSuperAdmin();
    const body = await request.json();
    const result = await createTenantAction(body);
    return NextResponse.json({ ok: true, siteName: result.siteName });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create tenant" },
      { status: 400 }
    );
  }
}
