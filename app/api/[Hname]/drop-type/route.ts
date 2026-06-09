import { NextResponse } from "next/server";
import pool from "../../../../lib/db";
import { quoteIdentifier } from "../../../../lib/master-form-table";

export async function GET(request: Request) {
  try {
    await pool.query(`ALTER TABLE ${quoteIdentifier('patient_registration')} DROP COLUMN IF EXISTS type`);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
