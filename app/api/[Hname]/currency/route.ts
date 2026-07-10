import { NextResponse } from "next/server";
import { getHospitalCurrency } from "../../../../lib/currency";

export const runtime = "nodejs";

/**
 * GET /api/[Hname]/currency
 * Returns the ISO 4217 currency configured for this hospital.
 * Used by the frontend HospitalCurrencyContext to format all monetary values.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ Hname: string }> },
) {
  try {
    const { Hname } = await params;
    const hname = decodeURIComponent(Hname);
    const currency = await getHospitalCurrency(hname);
    return NextResponse.json(currency, {
      headers: {
        // Cache for 5 minutes on CDN/browser — same as timezone endpoint
        "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        code: "INR",
        name: "Indian Rupee",
        symbol: "₹",
        error: error instanceof Error ? error.message : "Failed.",
      },
      { status: 200 }, // always return a usable currency even on error
    );
  }
}
