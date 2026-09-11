import { NextResponse } from "next/server";
import { getRoles, createRole, updateRole, deleteRole } from "../../../actions/rbac";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ Hname: string }> }
) {
  try {
    const { Hname } = await params;
    const hname = decodeURIComponent(Hname);
    const roles = await getRoles(hname);
    return NextResponse.json({ roles });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load roles" },
      { status: 400 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ Hname: string }> }
) {
  try {
    const { Hname } = await params;
    const hname = decodeURIComponent(Hname);
    const body = (await request.json()) as { name?: string; description?: string };
    const role = await createRole(hname, body.name ?? "", body.description ?? "");
    return NextResponse.json({ role });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create role" },
      { status: 400 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ Hname: string }> }
) {
  try {
    const { Hname } = await params;
    const hname = decodeURIComponent(Hname);
    const body = (await request.json()) as { id?: number; name?: string; description?: string };
    if (!body.id) throw new Error("Missing role id");
    await updateRole(hname, body.id, body.name ?? "", body.description ?? "");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update role" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ Hname: string }> }
) {
  try {
    const { Hname } = await params;
    const hname = decodeURIComponent(Hname);
    const body = (await request.json()) as { id?: number };
    if (!body.id) throw new Error("Missing role id");
    await deleteRole(hname, body.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete role" },
      { status: 400 }
    );
  }
}
