import { NextResponse } from "next/server";
import { getUserOverrides, setUserOverrides } from "../../../actions/rbac";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ Hname: string }> }
) {
  try {
    const { Hname } = await params;
    const hname = decodeURIComponent(Hname);
    const url = new URL(request.url);
    const userId = parseInt(url.searchParams.get("userId") ?? "", 10);
    if (isNaN(userId)) throw new Error("Invalid userId");
    const pageKeys = await getUserOverrides(hname, userId);
    return NextResponse.json({ pageKeys });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load overrides" },
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
    const body = (await request.json()) as { userId?: number; pageKeys?: string[] };
    if (!body.userId) throw new Error("Missing userId");
    if (!Array.isArray(body.pageKeys)) throw new Error("pageKeys must be an array");
    await setUserOverrides(hname, body.userId, body.pageKeys);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save overrides" },
      { status: 400 }
    );
  }
}
