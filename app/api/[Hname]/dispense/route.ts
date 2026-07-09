import { NextResponse } from "next/server";
import { getTenantDB } from "../../../../lib/db";
import { quoteIdentifier } from "../../../../lib/master-form-table";
import { getHospitalTimezone, getDateCompactInTimezone } from "../../../../lib/timezone";

export const runtime = "nodejs";

const DISPENSING_TABLE = "pharmacy_dispensing";
const PATIENT_TABLE = "patient_registration";

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizePhone(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "").trim();
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

type Pool = Awaited<ReturnType<typeof getTenantDB>>;

/** Ensure pharmacy_dispensing table exists with all required columns */
async function ensureDispensingTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(DISPENSING_TABLE)} (
      id BIGSERIAL PRIMARY KEY,
      token_number TEXT,
      patient_name TEXT,
      payment_status TEXT,
      billing_amount NUMERIC,
      medicine_lines TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Migration: add new columns if they don't exist yet
  const newColumns: Array<[string, string]> = [
    ["pharmacy_only", "TEXT"],
    ["patient_phone", "TEXT"],
    ["patient_dob", "TEXT"],
  ];

  for (const [col, type] of newColumns) {
    await pool.query(
      `ALTER TABLE ${quoteIdentifier(DISPENSING_TABLE)} ADD COLUMN IF NOT EXISTS ${quoteIdentifier(col)} ${type}`
    );
  }
}

/** Ensure patient_registration table exists (minimal) */
async function ensurePatientTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(PATIENT_TABLE)} (
      id BIGSERIAL PRIMARY KEY,
      patient_id TEXT,
      patient_name TEXT,
      dob DATE,
      mobile TEXT UNIQUE,
      patient_type TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Ensure optional columns used by this flow exist
  await pool.query(`ALTER TABLE ${quoteIdentifier(PATIENT_TABLE)} ADD COLUMN IF NOT EXISTS dob DATE`);
  await pool.query(`ALTER TABLE ${quoteIdentifier(PATIENT_TABLE)} ADD COLUMN IF NOT EXISTS patient_type TEXT`);
}

/** Generate a PH-YYYYMMDD-XXXX token for pharmacy-only bills */
async function generatePharmacyToken(pool: Pool, timezone: string): Promise<string> {
  const dateCompact = getDateCompactInTimezone(timezone);
  const likePrefix = `PH-${dateCompact}-%`;

  const result = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM ${quoteIdentifier(DISPENSING_TABLE)} WHERE token_number LIKE $1`,
    [likePrefix]
  );
  const seq = (Number(result.rows[0]?.cnt) || 0) + 1;
  return `PH-${dateCompact}-${String(seq).padStart(4, "0")}`;
}

// ─── GET /api/[Hname]/dispense?phone=XXXXXXXXXX ──────────────────────────────

export async function GET(
  request: Request,
  { params }: { params: Promise<{ Hname: string }> }
) {
  try {
    const { Hname } = await params;
    const pool = await getTenantDB(decodeURIComponent(Hname));
    const { searchParams } = new URL(request.url);
    const phone = normalizePhone(searchParams.get("phone"));

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required." }, { status: 400 });
    }

    await ensurePatientTable(pool);
    await ensureDispensingTable(pool);

    // 1. Look up patient by phone
    const patientResult = await pool.query(
      `SELECT * FROM ${quoteIdentifier(PATIENT_TABLE)} WHERE mobile = $1 LIMIT 1`,
      [phone]
    );

    const exists = (patientResult.rowCount ?? 0) > 0;
    const patientRow = patientResult.rows[0] ?? null;

    if (!exists) {
      return NextResponse.json({ exists: false, patient: null, dispensingHistory: [] });
    }

    // 2. Fetch all past pharmacy_dispensing records for this patient (by name or phone)
    const patientName = normalizeText(patientRow.patient_name);
    const historyResult = await pool.query(
      `
        SELECT * FROM ${quoteIdentifier(DISPENSING_TABLE)}
        WHERE
          patient_phone = $1
          OR LOWER(COALESCE(patient_name, '')) = LOWER($2)
        ORDER BY created_at DESC
        LIMIT 50
      `,
      [phone, patientName]
    );

    return NextResponse.json({
      exists: true,
      patient: patientRow,
      dispensingHistory: historyResult.rows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to look up patient.";
    console.error("[dispense GET] failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── POST /api/[Hname]/dispense ───────────────────────────────────────────────

type PostBody = {
  patientName?: string;
  patientPhone?: string;
  patientDob?: string;
  paymentStatus?: string;
  billingAmount?: string | number;
  medicineLines?: string; // JSON-serialized MedicineRow[]
  /** Optional: id of a past dispensing record that was clicked to pre-fill */
  sourceDispensingId?: number | null;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ Hname: string }> }
) {
  try {
    const { Hname } = await params;
    const decodedHname = decodeURIComponent(Hname);
    const pool = await getTenantDB(decodedHname);
    const tz = await getHospitalTimezone(decodedHname);
    const body = (await request.json()) as PostBody;

    const patientName = normalizeText(body.patientName);
    const patientPhone = normalizePhone(body.patientPhone);
    const patientDob = normalizeText(body.patientDob);
    const paymentStatus = normalizeText(body.paymentStatus) || "Pending";
    const billingAmount = body.billingAmount != null ? Number(body.billingAmount) : null;
    const medicineLines = normalizeText(body.medicineLines);

    if (!patientName) {
      return NextResponse.json({ error: "Patient name is required." }, { status: 400 });
    }

    await ensurePatientTable(pool);
    await ensureDispensingTable(pool);

    // 1. Ensure patient exists in patient_registration (create minimal record if not)
    if (patientPhone) {
      const existing = await pool.query(
        `SELECT id FROM ${quoteIdentifier(PATIENT_TABLE)} WHERE mobile = $1 LIMIT 1`,
        [patientPhone]
      );

      if ((existing.rowCount ?? 0) === 0) {
        // Create a minimal patient record
        await pool.query(
          `
            INSERT INTO ${quoteIdentifier(PATIENT_TABLE)}
              (patient_name, dob, mobile, patient_type)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (mobile) DO NOTHING
          `,
          [
            patientName,
            patientDob || null,
            patientPhone,
            "Pharmacy Only",
          ]
        );
      }
    }

    // 2. Auto-generate pharmacy token (using hospital timezone for correct date prefix)
    const tokenNumber = await generatePharmacyToken(pool, tz);

    // 3. Insert pharmacy_dispensing record with pharmacy_only flag
    const insertResult = await pool.query(
      `
        INSERT INTO ${quoteIdentifier(DISPENSING_TABLE)} (
          token_number,
          patient_name,
          patient_phone,
          patient_dob,
          payment_status,
          billing_amount,
          medicine_lines,
          pharmacy_only
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [
        tokenNumber,
        patientName,
        patientPhone || null,
        patientDob || null,
        paymentStatus,
        Number.isFinite(billingAmount) ? billingAmount : null,
        medicineLines || null,
        "Yes",
      ]
    );

    return NextResponse.json({ row: insertResult.rows[0] }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save dispense record.";
    console.error("[dispense POST] failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
