import { NextResponse } from "next/server";
import { getTenantDB } from "../../../../lib/db";
import { quoteIdentifier } from "../../../../lib/master-form-table";

export const runtime = "nodejs";

const TABLE_NAME = "patient_registration";

function normalizePhone(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").trim();
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

async function ensurePatientTable(pool: Awaited<ReturnType<typeof getTenantDB>>) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(TABLE_NAME)} (
      id BIGSERIAL PRIMARY KEY,
      patient_id TEXT,
      patient_name TEXT,
      address TEXT,
      country TEXT,
      state TEXT,
      city TEXT,
      zip_code TEXT,
      email TEXT,
      phone_office TEXT,
      phone_resi TEXT,
      mobile TEXT UNIQUE,
      hn_number TEXT,
      number_of_visits NUMERIC,
      last_visit_date_time TIMESTAMP,
      last_visit_doctor_name TEXT,
      profession TEXT,
      patient_type TEXT,
      preferred_payment_type TEXT,
      mediclaim_policy_available TEXT,
      policy_details TEXT,
      linked_patient_id TEXT,
      relationship_ship_linked_patient TEXT,
      active_from TIMESTAMP,
      inactive_from TIMESTAMP,
      inactive_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ Hname: string }> },
) {
  try {
    const { Hname } = await params;
    const decodedHname = decodeURIComponent(Hname);
    const pool = await getTenantDB(decodedHname);
    await ensurePatientTable(pool);

    const body = (await request.json()) as {
      action?: "signin" | "signup";
      phone?: string;
      patient?: Record<string, unknown>;
    };

    const phone = normalizePhone(body.phone);

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required." }, { status: 400 });
    }

    if (body.action === "signin") {
      const result = await pool.query(
        `SELECT * FROM ${quoteIdentifier(TABLE_NAME)} WHERE mobile = $1 LIMIT 1`,
        [phone],
      );

      return NextResponse.json({
        exists: (result.rowCount ?? 0) > 0,
        row: result.rows[0] ?? null,
        patientId: result.rows[0]?.id ?? null,
      });
    }

    const patient = body.patient ?? {};
    const existing = await pool.query(
      `SELECT id FROM ${quoteIdentifier(TABLE_NAME)} WHERE mobile = $1 LIMIT 1`,
      [phone],
    );

    if ((existing.rowCount ?? 0) > 0) {
      return NextResponse.json({ error: "Phone number already exists." }, { status: 409 });
    }

    const inserted = await pool.query(
      `
        INSERT INTO ${quoteIdentifier(TABLE_NAME)} (
          patient_id,
          patient_name,
          address,
          country,
          state,
          city,
          zip_code,
          email,
          phone_office,
          phone_resi,
          mobile,
          hn_number,
          number_of_visits,
          last_visit_date_time,
          last_visit_doctor_name,
          profession,
          patient_type,
          preferred_payment_type,
          mediclaim_policy_available,
          policy_details,
          linked_patient_id,
          relationship_ship_linked_patient,
          active_from,
          inactive_from,
          inactive_reason
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25
        )
        RETURNING *
      `,
      [
        normalizeText(patient.patientId),
        normalizeText(patient.patientName),
        normalizeText(patient.address),
        normalizeText(patient.country),
        normalizeText(patient.state),
        normalizeText(patient.city),
        normalizeText(patient.zipCode),
        normalizeText(patient.email),
        normalizeText(patient.phoneOffice),
        normalizeText(patient.phoneResi),
        phone,
        normalizeText(patient.hnNumber),
        patient.numberOfVisits ? Number(patient.numberOfVisits) : null,
        normalizeText(patient.lastVisitDateTime) || null,
        normalizeText(patient.lastVisitDoctorName),
        normalizeText(patient.profession),
        normalizeText(patient.patientType),
        normalizeText(patient.preferredPaymentType),
        normalizeText(patient.mediclaimPolicyAvailable),
        normalizeText(patient.policyDetails),
        normalizeText(patient.linkedPatientId),
        normalizeText(patient.relationshipShipLinkedPatient),
        normalizeText(patient.activeFrom) || null,
        normalizeText(patient.inactiveFrom) || null,
        normalizeText(patient.inactiveReason),
      ],
    );

    return NextResponse.json({
      exists: true,
      row: inserted.rows[0],
      patientId: inserted.rows[0]?.id ?? null,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process patient.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ Hname: string }> },
) {
  try {
    const { Hname } = await params;
    const decodedHname = decodeURIComponent(Hname);
    const pool = await getTenantDB(decodedHname);
    await ensurePatientTable(pool);

    const body = (await request.json()) as {
      phone?: string;
      patient?: Record<string, unknown>;
    };

    const phone = normalizePhone(body.phone);
    const patient = body.patient ?? {};

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required." }, { status: 400 });
    }

    const existing = await pool.query(
      `SELECT id FROM ${quoteIdentifier(TABLE_NAME)} WHERE mobile = $1 LIMIT 1`,
      [phone],
    );

    if ((existing.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "Patient not found." }, { status: 404 });
    }

    const updated = await pool.query(
      `
        UPDATE ${quoteIdentifier(TABLE_NAME)}
        SET
          patient_id = $1,
          patient_name = $2,
          address = $3,
          country = $4,
          state = $5,
          city = $6,
          zip_code = $7,
          email = $8,
          phone_office = $9,
          phone_resi = $10,
          hn_number = $11,
          number_of_visits = $12,
          last_visit_date_time = $13,
          last_visit_doctor_name = $14,
          profession = $15,
          patient_type = $16,
          preferred_payment_type = $17,
          mediclaim_policy_available = $18,
          policy_details = $19,
          linked_patient_id = $20,
          relationship_ship_linked_patient = $21,
          active_from = $22,
          inactive_from = $23,
          inactive_reason = $24,
          updated_at = NOW()
        WHERE mobile = $25
        RETURNING *
      `,
      [
        normalizeText(patient.patientId),
        normalizeText(patient.patientName),
        normalizeText(patient.address),
        normalizeText(patient.country),
        normalizeText(patient.state),
        normalizeText(patient.city),
        normalizeText(patient.zipCode),
        normalizeText(patient.email),
        normalizeText(patient.phoneOffice),
        normalizeText(patient.phoneResi),
        normalizeText(patient.hnNumber),
        patient.numberOfVisits ? Number(patient.numberOfVisits) : null,
        normalizeText(patient.lastVisitDateTime) || null,
        normalizeText(patient.lastVisitDoctorName),
        normalizeText(patient.profession),
        normalizeText(patient.patientType),
        normalizeText(patient.preferredPaymentType),
        normalizeText(patient.mediclaimPolicyAvailable),
        normalizeText(patient.policyDetails),
        normalizeText(patient.linkedPatientId),
        normalizeText(patient.relationshipShipLinkedPatient),
        normalizeText(patient.activeFrom) || null,
        normalizeText(patient.inactiveFrom) || null,
        normalizeText(patient.inactiveReason),
        phone,
      ],
    );

    return NextResponse.json({
      exists: true,
      row: updated.rows[0] ?? null,
      patientId: updated.rows[0]?.id ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process patient.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
