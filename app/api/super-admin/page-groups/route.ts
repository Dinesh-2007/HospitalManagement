import { NextResponse } from "next/server";
import {
  getPageGroups,
  createPageGroup,
  updatePageGroup,
  deletePageGroup,
  getSuperAdminSession,
} from "../../../../lib/super-admin";

async function assertSuperAdmin() {
  const username = await getSuperAdminSession();
  if (!username) throw new Error("Unauthorized");
}

export async function GET() {
  try {
    await assertSuperAdmin();
    const groups = await getPageGroups();
    return NextResponse.json({ groups });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await assertSuperAdmin();
    const body = (await request.json()) as {
      name?: string;
      description?: string;
      pageKeys?: string[];
    };
    const group = await createPageGroup(
      body.name ?? "",
      body.description ?? "",
      body.pageKeys ?? []
    );
    return NextResponse.json({ group });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create group" },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    await assertSuperAdmin();
    const body = (await request.json()) as {
      id?: number;
      name?: string;
      description?: string;
      pageKeys?: string[];
    };
    if (!body.id) throw new Error("Missing id");
    await updatePageGroup(body.id, body.name ?? "", body.description ?? "", body.pageKeys ?? []);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update group" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await assertSuperAdmin();
    const body = (await request.json()) as { id?: number };
    if (!body.id) throw new Error("Missing id");
    await deletePageGroup(body.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete group" },
      { status: 400 }
    );
  }
}
