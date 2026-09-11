import { NextResponse } from "next/server";
import { getRolePermissions, setRolePermissions } from "../../../../../actions/rbac";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ Hname: string; roleId: string }> }
) {
  try {
    const { Hname, roleId } = await params;
    const hname = decodeURIComponent(Hname);
    const id = parseInt(roleId, 10);
    if (isNaN(id)) throw new Error("Invalid role id");
    const pageKeys = await getRolePermissions(hname, id);
    return NextResponse.json({ pageKeys });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load permissions" },
      { status: 400 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ Hname: string; roleId: string }> }
) {
  try {
    const { Hname, roleId } = await params;
    const hname = decodeURIComponent(Hname);
    const id = parseInt(roleId, 10);
    if (isNaN(id)) throw new Error("Invalid role id");
    const body = (await request.json()) as { pageKeys?: string[] };
    if (!Array.isArray(body.pageKeys)) throw new Error("pageKeys must be an array");
    await setRolePermissions(hname, id, body.pageKeys);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save permissions" },
      { status: 400 }
    );
  }
}
