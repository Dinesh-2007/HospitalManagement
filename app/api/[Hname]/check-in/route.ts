import { NextResponse } from "next/server";
import { getTenantDB } from "../../../../lib/db";
import { quoteIdentifier } from "../../../../lib/master-form-table";

export const runtime = "nodejs";

const TABLE_NAME = "appointments";
const PATIENTS_TABLE = "patient_registration";

/** Generate a unique Patient ID in the format P<YYYYMMDD><4-digit-seq> */
async function generatePatientId(pool: Awaited<ReturnType<typeof getTenantDB>>): Promise<string> {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const prefix = `P${yyyy}${mm}${dd}`;

  // Count patients whose patient_id starts with today's prefix to get the next sequence
  const result = await pool.query(
    `SELECT COUNT(*) AS cnt FROM ${quoteIdentifier(PATIENTS_TABLE)} WHERE patient_id LIKE $1`,
    [`${prefix}%`]
  );
  const count = Number(result.rows[0]?.cnt ?? 0);
  const seq = String(count + 1).padStart(4, "0");
  return `${prefix}${seq}`;
}

async function ensurePatientTable(pool: Awaited<ReturnType<typeof getTenantDB>>) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(PATIENTS_TABLE)} (
      id BIGSERIAL PRIMARY KEY,
      patient_id TEXT UNIQUE,
      patient_name TEXT,
      address TEXT,
      country TEXT,
      state TEXT,
      city TEXT,
      zip_code TEXT,
      email TEXT,
      phone_office TEXT,
      phone_resi TEXT,
      mobile TEXT,
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
      dob DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE ${quoteIdentifier(PATIENTS_TABLE)} ADD COLUMN IF NOT EXISTS patient_id TEXT`);
  try {
    await pool.query(`ALTER TABLE ${quoteIdentifier(PATIENTS_TABLE)} ADD CONSTRAINT patient_registration_patient_id_unique UNIQUE (patient_id)`);
  } catch {
    // constraint already exists — ignore
  }
  await pool.query(`ALTER TABLE ${quoteIdentifier(PATIENTS_TABLE)} ADD COLUMN IF NOT EXISTS mobile TEXT`);
  await pool.query(`ALTER TABLE ${quoteIdentifier(PATIENTS_TABLE)} ADD COLUMN IF NOT EXISTS dob DATE`);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ Hname: string }> },
) {
  try {
    const { Hname } = await params;
    const decodedHname = decodeURIComponent(Hname);
    const pool = await getTenantDB(decodedHname);

    const body = await request.json();
    const { patientName, patientPhone, department, doctor, patientId: bodyPatientId, isWalkIn, appointmentId: bodyAppointmentId } = body;

    // Ensure the appointments table has check_in_time column
    await pool.query(`
      ALTER TABLE ${quoteIdentifier(TABLE_NAME)}
      ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMPTZ
    `);

    await ensurePatientTable(pool);

    // Walk-in Registration Completion Flow
    if (isWalkIn) {
      if (!patientName || !department || !doctor) {
        return NextResponse.json(
          { error: "Walk-in registration requires patientName, department, and doctor." },
          { status: 400 },
        );
      }

      // Find or create the patient_registration record
      let resolvedPatientId = bodyPatientId as string | undefined;

      if (patientPhone) {
        // Check if patient exists by phone
        const existingByPhone = await pool.query(
          `SELECT patient_id FROM ${quoteIdentifier(PATIENTS_TABLE)} WHERE regexp_replace(COALESCE(mobile, ''), '\\D', '', 'g') = regexp_replace($1, '\\D', '', 'g') LIMIT 1`,
          [patientPhone]
        );
        if ((existingByPhone.rowCount ?? 0) > 0) {
          resolvedPatientId = String(existingByPhone.rows[0].patient_id ?? resolvedPatientId ?? "");
        }
      }

      if (!resolvedPatientId) {
        resolvedPatientId = await generatePatientId(pool);
        // Insert into patient_registration
        await pool.query(
          `INSERT INTO ${quoteIdentifier(PATIENTS_TABLE)} (patient_id, patient_name, mobile)
           VALUES ($1, $2, $3)
           ON CONFLICT (patient_id) DO NOTHING`,
          [resolvedPatientId, patientName, patientPhone || null]
        );
      }

      const today = new Date().toISOString().split("T")[0];
      const dayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
      const currentTime = new Date().toTimeString().split(" ")[0];

      const apptResult = await pool.query(
        `
          INSERT INTO ${quoteIdentifier(TABLE_NAME)} (
            appointment_date,
            appointment_day,
            department,
            doctor,
            patient_name,
            patient_id,
            patient_phone,
            appointment_time,
            patient_type,
            check_in_time,
            status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 'Scheduled')
          RETURNING id
        `,
        [
          today,
          dayName,
          department,
          doctor,
          patientName,
          resolvedPatientId,
          patientPhone || null,
          currentTime,
          "walk-in"
        ]
      );

      const apptId = apptResult.rows[0]?.id;
      return NextResponse.json({
        success: true,
        patientId: resolvedPatientId,
        appointmentId: apptId,
        appointmentNumber: apptId ? `APT-${String(apptId).padStart(4, "0")}` : null,
      });
    }

    // Regular Check-in/Verification Flow (Scheduled Check)
    if (!patientName || !department || !doctor) {
      return NextResponse.json(
        { error: "Patient name, department, and doctor are required for check-in check." },
        { status: 400 },
      );
    }

    const today = new Date().toISOString().split("T")[0];

    type ApptRecordType = { id: number; patient_id: string | null; patient_name: string; patient_phone: string | null };
    // If we have the direct appointment ID, use it
    let apptRecord: ApptRecordType | null = null;

    if (bodyAppointmentId) {
      const directResult = await pool.query(
        `SELECT id, patient_id, patient_name, patient_phone FROM ${quoteIdentifier(TABLE_NAME)} WHERE id = $1 LIMIT 1`,
        [bodyAppointmentId]
      );
      if ((directResult.rowCount ?? 0) > 0) {
        apptRecord = directResult.rows[0] as ApptRecordType;
      }
    }

    // Fall back to search by name/doctor/department
    if (!apptRecord) {
      let query = `
        SELECT id, patient_id, patient_name, patient_phone
        FROM ${quoteIdentifier(TABLE_NAME)}
        WHERE LOWER(patient_name) = LOWER($1)
          AND appointment_date = $2
          AND LOWER(doctor) = LOWER($3)
          AND LOWER(department) = LOWER($4)
          AND status IN ('Scheduled', 'Rescheduled')
      `;
      const queryParams: unknown[] = [patientName.trim(), today, doctor.trim(), department.trim()];

      if (patientPhone && patientPhone.trim()) {
        query += ` AND (patient_phone = $5 OR regexp_replace(patient_phone, '\\D', '', 'g') = regexp_replace($5, '\\D', '', 'g'))`;
        queryParams.push(patientPhone.trim());
      }
      query += ` ORDER BY appointment_time ASC LIMIT 1`;

      const result = await pool.query(query, queryParams);
      if ((result.rowCount ?? 0) > 0) {
        apptRecord = result.rows[0] as ApptRecordType;
      }
    }

    if (apptRecord) {
      // Mark check_in_time
      await pool.query(
        `UPDATE ${quoteIdentifier(TABLE_NAME)} SET check_in_time = NOW(), updated_at = NOW() WHERE id = $1`,
        [apptRecord.id]
      );

      // Resolve Patient ID — check if already has one
      let resolvedPatientId = apptRecord.patient_id ?? "";

      // Try to find existing patient_registration by patient_id or phone
      if (resolvedPatientId) {
        const existingByPid = await pool.query(
          `SELECT patient_id FROM ${quoteIdentifier(PATIENTS_TABLE)} WHERE patient_id = $1 LIMIT 1`,
          [resolvedPatientId]
        );
        if ((existingByPid.rowCount ?? 0) === 0) {
          // patient_id set in appointments but no registration — generate new one
          resolvedPatientId = "";
        }
      }

      if (!resolvedPatientId && apptRecord.patient_phone) {
        const existingByPhone = await pool.query(
          `SELECT patient_id FROM ${quoteIdentifier(PATIENTS_TABLE)} WHERE regexp_replace(COALESCE(mobile, ''), '\\D', '', 'g') = regexp_replace($1, '\\D', '', 'g') LIMIT 1`,
          [apptRecord.patient_phone]
        );
        if ((existingByPhone.rowCount ?? 0) > 0) {
          resolvedPatientId = String(existingByPhone.rows[0].patient_id ?? "");
        }
      }

      if (!resolvedPatientId) {
        // Generate a brand-new patient ID and create registration record
        resolvedPatientId = await generatePatientId(pool);
        await pool.query(
          `INSERT INTO ${quoteIdentifier(PATIENTS_TABLE)} (patient_id, patient_name, mobile)
           VALUES ($1, $2, $3)
           ON CONFLICT (patient_id) DO NOTHING`,
          [resolvedPatientId, apptRecord.patient_name, apptRecord.patient_phone || null]
        );
      }

      // Back-fill patient_id on the appointments row if it was missing
      if (!apptRecord.patient_id || apptRecord.patient_id !== resolvedPatientId) {
        await pool.query(
          `UPDATE ${quoteIdentifier(TABLE_NAME)} SET patient_id = $1, updated_at = NOW() WHERE id = $2`,
          [resolvedPatientId, apptRecord.id]
        );
      }

      return NextResponse.json({
        type: "scheduled",
        appointmentId: apptRecord.id,
        appointmentNumber: `APT-${String(apptRecord.id).padStart(4, "0")}`,
        patientId: resolvedPatientId,
        patientName: apptRecord.patient_name,
      });
    } else {
      return NextResponse.json({
        type: "walk-in",
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to perform check-in.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
