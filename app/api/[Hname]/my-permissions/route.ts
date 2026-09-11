import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveUserPermissions, ensureRBACTables } from "../../../actions/rbac";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ Hname: string }> }
) {
  try {
    const { Hname } = await params;
    const hname = decodeURIComponent(Hname);

    // Get current user from cookie
    const cookieStore = await cookies();
    const authCookie = cookieStore.get(`auth_${hname.replace(/[^a-zA-Z0-9]/g, "_")}`);

    if (!authCookie?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const username = authCookie.value;
    await ensureRBACTables(hname);
    const info = await resolveUserPermissions(hname, username);

    return NextResponse.json({
      isAdmin: info.isAdmin,
      allowedPages: info.allowedPages,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load permissions" },
      { status: 500 }
    );
  }
}
