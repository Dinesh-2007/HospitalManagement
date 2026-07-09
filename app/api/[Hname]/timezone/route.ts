import { NextResponse } from "next/server";
import { getHospitalTimezone } from "../../../../lib/timezone";

export const runtime = "nodejs";

/**
 * GET /api/[Hname]/timezone
 * Returns the IANA timezone configured for this hospital.
 * Used by the frontend HospitalTimezoneContext to get the correct "today" date.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ Hname: string }> },
) {
  try {
    const { Hname } = await params;
    const hname = decodeURIComponent(Hname);
    const timezone = await getHospitalTimezone(hname);
    return NextResponse.json({ timezone }, {
      headers: {
        // Cache for 5 minutes on CDN/browser
        "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { timezone: "Asia/Kolkata", error: error instanceof Error ? error.message : "Failed." },
      { status: 200 }, // always return a usable timezone even on error
    );
  }
}
