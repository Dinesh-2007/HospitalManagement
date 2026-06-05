import { NextResponse } from "next/server";
import {
  addUser,
  changeUserPassword,
  checkIsAdmin,
  fetchUsers,
  removeUser,
  updateUserRole,
} from "../../../actions/manage-users";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ Hname: string }> },
) {
  try {
    const { Hname } = await params;
    const hname = decodeURIComponent(Hname);

    if (!(await checkIsAdmin(hname))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const rows = await fetchUsers(hname);
    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load users." },
      { status: 400 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ Hname: string }> },
) {
  try {
    const { Hname } = await params;
    const hname = decodeURIComponent(Hname);
    const body = (await request.json()) as Record<string, unknown>;
    const formData = new FormData();
    formData.set("username", String(body.username ?? ""));
    formData.set("password", String(body.password ?? ""));
    formData.set("role", String(body.role ?? ""));
    await addUser(hname, formData);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save user." },
      { status: 400 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ Hname: string }> },
) {
  try {
    const { Hname } = await params;
    const hname = decodeURIComponent(Hname);
    const body = (await request.json()) as Record<string, unknown>;

    if (!(await checkIsAdmin(hname))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const password = String(body.password ?? "").trim();

    if (password) {
      const passwordFormData = new FormData();
      passwordFormData.set("id", String(body.id ?? ""));
      passwordFormData.set("password", password);
      await changeUserPassword(hname, passwordFormData);
    }

    const roleFormData = new FormData();
    roleFormData.set("id", String(body.id ?? ""));
    roleFormData.set("role", String(body.role ?? ""));
    await updateUserRole(hname, roleFormData);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update user." },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ Hname: string }> },
) {
  try {
    const { Hname } = await params;
    const hname = decodeURIComponent(Hname);
    const body = (await request.json()) as Record<string, unknown>;
    const formData = new FormData();
    formData.set("id", String(body.id ?? ""));
    await removeUser(hname, formData);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete user." },
      { status: 400 },
    );
  }
}
