import { NextResponse } from "next/server";
import { getTenantDB } from "../../../../lib/db";
import { quoteIdentifier } from "../../../../lib/master-form-table";

export const runtime = "nodejs";

const PATIENTS_TABLE = "patient_registration";

/**
 * GET /api/[Hname]/patient-search?q=<query>
 *
 * Searches patient_registration by patient_id, mobile, or patient_name.
 * Returns up to 20 matches for the admission desk lookup dropdown.
 * Reuses the same field names and phone-normalisation pattern as check-in/route.ts.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ Hname: string }> }
) {
  try {
    const { Hname } = await params;
    const pool = await getTenantDB(decodeURIComponent(Hname));
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();

    if (!q || q.length < 1) {
      return NextResponse.json({ rows: [] });
    }

    // Search by patient_id (exact prefix), mobile (digit-normalised), or patient_name (ilike)
    const result = await pool.query(
      `SELECT patient_id, patient_name, mobile, phone_office, phone_resi, dob, patient_type
       FROM ${quoteIdentifier(PATIENTS_TABLE)}
       WHERE
         LOWER(COALESCE(patient_id, '')) LIKE LOWER($1)
          OR regexp_replace(COALESCE(mobile, ''), '\\D', '', 'g') LIKE '%' || regexp_replace($2, '\\D', '', 'g') || '%'
          OR regexp_replace($2, '\\D', '', 'g') LIKE '%' || regexp_replace(COALESCE(mobile, ''), '\\D', '', 'g')
         OR LOWER(COALESCE(patient_name, '')) LIKE LOWER($3)
       ORDER BY patient_id
       LIMIT 20`,
      [`${q}%`, `${q}%`, `%${q}%`]
    );

    return NextResponse.json({ rows: result.rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed.";
    console.error("[patient-search GET]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
