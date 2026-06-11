import { NextResponse } from "next/server";
import { getTenantDB } from "../../../../lib/db";
import { quoteIdentifier } from "../../../../lib/master-form-table";

export const runtime = "nodejs";

const APPOINTMENTS_TABLE = "appointments";
const PATIENTS_TABLE = "patient_registration";
const VITALS_TABLE = "vitals";

type VitalsBody = {
  patientId?: string | number;
  patientName?: string;
  dob?: string;
  age?: string | number;
  gender?: string;
  heightCm?: string | number;
  weightKg?: string | number;
  temperature?: string | number;
  pulseRate?: string | number;
  respiratoryRate?: string | number;
  systolicBp?: string | number;
  diastolicBp?: string | number;
  spo2?: string | number;
  bloodSugar?: string | number;
  remarks?: string;
  status?: string;
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeNumber(value: unknown) {
  const text = normalizeText(value);
  if (!text) return null;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeDate(value: unknown) {
  const text = normalizeText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

async function ensureTables(pool: Awaited<ReturnType<typeof getTenantDB>>) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(VITALS_TABLE)} (
      id BIGSERIAL PRIMARY KEY,
      patient_id TEXT UNIQUE NOT NULL,
      patient_name TEXT NOT NULL,
      dob DATE,
      age NUMERIC,
      gender TEXT,
      height_cm NUMERIC,
      weight_kg NUMERIC,
      registration_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      temperature NUMERIC,
      pulse_rate INTEGER,
      respiratory_rate INTEGER,
      systolic_bp INTEGER,
      diastolic_bp INTEGER,
      spo2 INTEGER,
      blood_sugar NUMERIC,
      bmi NUMERIC,
      remarks TEXT,
      status TEXT NOT NULL DEFAULT 'Active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`ALTER TABLE ${quoteIdentifier(VITALS_TABLE)} ADD COLUMN IF NOT EXISTS dob DATE`);
  await pool.query(`ALTER TABLE ${quoteIdentifier(VITALS_TABLE)} ADD COLUMN IF NOT EXISTS age NUMERIC`);
  await pool.query(`ALTER TABLE ${quoteIdentifier(VITALS_TABLE)} ADD COLUMN IF NOT EXISTS gender TEXT`);
  await pool.query(`ALTER TABLE ${quoteIdentifier(VITALS_TABLE)} ADD COLUMN IF NOT EXISTS height_cm NUMERIC`);
  await pool.query(`ALTER TABLE ${quoteIdentifier(VITALS_TABLE)} ADD COLUMN IF NOT EXISTS weight_kg NUMERIC`);
  await pool.query(`ALTER TABLE ${quoteIdentifier(VITALS_TABLE)} ADD COLUMN IF NOT EXISTS registration_date TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
  await pool.query(`ALTER TABLE ${quoteIdentifier(VITALS_TABLE)} ADD COLUMN IF NOT EXISTS temperature NUMERIC`);
  await pool.query(`ALTER TABLE ${quoteIdentifier(VITALS_TABLE)} ADD COLUMN IF NOT EXISTS pulse_rate INTEGER`);
  await pool.query(`ALTER TABLE ${quoteIdentifier(VITALS_TABLE)} ADD COLUMN IF NOT EXISTS respiratory_rate INTEGER`);
  await pool.query(`ALTER TABLE ${quoteIdentifier(VITALS_TABLE)} ADD COLUMN IF NOT EXISTS systolic_bp INTEGER`);
  await pool.query(`ALTER TABLE ${quoteIdentifier(VITALS_TABLE)} ADD COLUMN IF NOT EXISTS diastolic_bp INTEGER`);
  await pool.query(`ALTER TABLE ${quoteIdentifier(VITALS_TABLE)} ADD COLUMN IF NOT EXISTS spo2 INTEGER`);
  await pool.query(`ALTER TABLE ${quoteIdentifier(VITALS_TABLE)} ADD COLUMN IF NOT EXISTS blood_sugar NUMERIC`);
  await pool.query(`ALTER TABLE ${quoteIdentifier(VITALS_TABLE)} ADD COLUMN IF NOT EXISTS bmi NUMERIC`);
  await pool.query(`ALTER TABLE ${quoteIdentifier(VITALS_TABLE)} ADD COLUMN IF NOT EXISTS remarks TEXT`);
  await pool.query(`ALTER TABLE ${quoteIdentifier(VITALS_TABLE)} ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active'`);
}

async function ensureAppointmentsTable(pool: Awaited<ReturnType<typeof getTenantDB>>) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(APPOINTMENTS_TABLE)} (
      id BIGSERIAL PRIMARY KEY,
      appointment_date DATE NOT NULL,
      appointment_day TEXT,
      department TEXT NOT NULL,
      doctor TEXT NOT NULL,
      patient_id TEXT,
      patient_name TEXT NOT NULL,
      patient_phone TEXT,
      appointment_time TIME,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'Scheduled',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      time_slot_minutes INTEGER,
      reschedule_count INTEGER NOT NULL DEFAULT 0,
      reschedule_history JSONB NOT NULL DEFAULT '[]'::jsonb
    )
  `);
}

async function ensurePatientTable(pool: Awaited<ReturnType<typeof getTenantDB>>) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(PATIENTS_TABLE)} (
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
  await pool.query(`ALTER TABLE ${quoteIdentifier(PATIENTS_TABLE)} ADD COLUMN IF NOT EXISTS dob DATE`);
}

function calculateBmi(heightCm: number | null, weightKg: number | null) {
  if (!heightCm || !weightKg || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(2));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ Hname: string }> },
) {
  try {
    const { Hname } = await params;
    const pool = await getTenantDB(decodeURIComponent(Hname));
    await ensureTables(pool);
    await ensureAppointmentsTable(pool);
    await ensurePatientTable(pool);

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const doctor = searchParams.get("doctor") ?? "";
    if (!doctor) {
      const doctors = date
        ? await pool.query(
            `
              SELECT doctor, MIN(appointment_time) AS first_time, COUNT(*)::int AS total
              FROM ${quoteIdentifier(APPOINTMENTS_TABLE)}
              WHERE appointment_date = $1
                AND status IN ('Scheduled', 'Rescheduled')
              GROUP BY doctor
              ORDER BY MIN(appointment_time) NULLS LAST, doctor ASC
            `,
            [date],
          )
        : await pool.query(
            `
              SELECT doctor, MIN(appointment_time) AS first_time, COUNT(*)::int AS total
              FROM ${quoteIdentifier(APPOINTMENTS_TABLE)}
              WHERE status IN ('Scheduled', 'Rescheduled')
              GROUP BY doctor
              ORDER BY MIN(appointment_time) NULLS LAST, doctor ASC
            `,
          );

      return NextResponse.json({ rows: doctors.rows });
    }

    const result = date
      ? await pool.query(
          `
            WITH appointment_rows AS (
              SELECT
                a.id AS appointment_id,
                a.appointment_date,
                a.appointment_time,
                a.time_slot_minutes,
                a.department,
                a.doctor,
                a.patient_id AS appointment_patient_id,
                a.patient_name AS appointment_patient_name,
                a.patient_phone,
                a.reason,
                a.status AS appointment_status,
                a.created_at AS appointment_created_at,
                a.updated_at AS appointment_updated_at,
                a.reschedule_count,
                a.check_in_time AS appointment_check_in_time,
                p.id AS registration_id,
                p.patient_id AS registration_patient_id,
                p.patient_name AS registration_patient_name,
                p.mobile,
                p.dob AS registration_dob,
                a.patient_type,
                p.address,
                p.country,
                p.state,
                p.city,
                p.zip_code,
                p.email,
                p.phone_office,
                p.phone_resi,
                p.hn_number,
                p.number_of_visits,
                p.last_visit_date_time,
                p.last_visit_doctor_name,
                p.profession,
                p.preferred_payment_type,
                p.mediclaim_policy_available,
                p.policy_details,
                p.linked_patient_id,
                p.relationship_ship_linked_patient,
                p.active_from,
                p.inactive_from,
                p.inactive_reason,
                v.id AS vitals_id,
                v.registration_date,
                v.height_cm,
                v.weight_kg,
                v.temperature,
                v.pulse_rate,
                v.respiratory_rate,
                v.systolic_bp,
                v.diastolic_bp,
                v.spo2,
                v.blood_sugar,
                v.bmi,
                v.remarks,
                v.status AS vitals_status,
                v.created_at AS vitals_created_at,
                v.updated_at AS vitals_updated_at
              FROM ${quoteIdentifier(APPOINTMENTS_TABLE)} a
              LEFT JOIN ${quoteIdentifier(PATIENTS_TABLE)} p
                ON (
                  (a.patient_id IS NOT NULL AND a.patient_id <> '' AND a.patient_id = p.patient_id)
                  OR (
                    (a.patient_id IS NULL OR a.patient_id = '')
                    AND a.patient_phone IS NOT NULL
                    AND a.patient_phone <> ''
                    AND regexp_replace(COALESCE(p.mobile, ''), '\D', '', 'g') = regexp_replace(a.patient_phone, '\D', '', 'g')
                  )
                )
              LEFT JOIN ${quoteIdentifier(VITALS_TABLE)} v
                ON v.patient_id = COALESCE(
                  NULLIF(a.patient_id, ''),
                  NULLIF(p.patient_id, ''),
                  NULLIF(p.id::text, '')
                )
              WHERE a.appointment_date = $1
                AND ($2 = 'all' OR a.doctor = $2)
                AND a.status IN ('Scheduled', 'Rescheduled')
              ORDER BY a.appointment_time NULLS LAST, a.created_at DESC
            )
            SELECT * FROM appointment_rows
          `,
          [date, doctor],
        )
      : await pool.query(
          `
            WITH appointment_rows AS (
          SELECT
            a.id AS appointment_id,
            a.appointment_date,
            a.appointment_time,
            a.time_slot_minutes,
            a.department,
            a.doctor,
            a.patient_id AS appointment_patient_id,
            a.patient_name AS appointment_patient_name,
            a.patient_phone,
            a.reason,
            a.status AS appointment_status,
            a.created_at AS appointment_created_at,
            a.updated_at AS appointment_updated_at,
            a.reschedule_count,
            a.check_in_time AS appointment_check_in_time,
            p.id AS registration_id,
            p.patient_id AS registration_patient_id,
            p.patient_name AS registration_patient_name,
            p.mobile,
            p.dob AS registration_dob,
            a.patient_type,
            p.address,
            p.country,
            p.state,
            p.city,
            p.zip_code,
            p.email,
            p.phone_office,
            p.phone_resi,
            p.hn_number,
            p.number_of_visits,
            p.last_visit_date_time,
            p.last_visit_doctor_name,
            p.profession,
            p.preferred_payment_type,
            p.mediclaim_policy_available,
            p.policy_details,
            p.linked_patient_id,
            p.relationship_ship_linked_patient,
            p.active_from,
            p.inactive_from,
            p.inactive_reason,
            v.id AS vitals_id,
            v.registration_date,
            v.height_cm,
            v.weight_kg,
            v.temperature,
            v.pulse_rate,
            v.respiratory_rate,
            v.systolic_bp,
            v.diastolic_bp,
            v.spo2,
            v.blood_sugar,
            v.bmi,
            v.remarks,
            v.status AS vitals_status,
            v.created_at AS vitals_created_at,
            v.updated_at AS vitals_updated_at
          FROM ${quoteIdentifier(APPOINTMENTS_TABLE)} a
          LEFT JOIN ${quoteIdentifier(PATIENTS_TABLE)} p
            ON (
              (a.patient_id IS NOT NULL AND a.patient_id <> '' AND a.patient_id = p.patient_id)
              OR (
                (a.patient_id IS NULL OR a.patient_id = '')
                AND a.patient_phone IS NOT NULL
                AND a.patient_phone <> ''
                AND regexp_replace(COALESCE(p.mobile, ''), '\D', '', 'g') = regexp_replace(a.patient_phone, '\D', '', 'g')
              )
            )
          LEFT JOIN ${quoteIdentifier(VITALS_TABLE)} v
            ON v.patient_id = COALESCE(
              NULLIF(a.patient_id, ''),
              NULLIF(p.patient_id, ''),
              NULLIF(p.id::text, '')
            )
          WHERE ($1 = 'all' OR a.doctor = $1)
            AND a.status IN ('Scheduled', 'Rescheduled')
          ORDER BY a.appointment_date DESC, a.appointment_time NULLS LAST, a.created_at DESC
        )
        SELECT * FROM appointment_rows
      `,
          [doctor],
        );

    return NextResponse.json({ rows: result.rows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load vitals." },
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
    const pool = await getTenantDB(decodeURIComponent(Hname));
    await ensureTables(pool);

    const body = (await request.json()) as VitalsBody;
    const patientId = normalizeText(body.patientId);
    const patientName = normalizeText(body.patientName);
    const dob = normalizeDate(body.dob);
    const age = normalizeNumber(body.age);
    const gender = normalizeText(body.gender);
    const heightCm = normalizeNumber(body.heightCm);
    const weightKg = normalizeNumber(body.weightKg);
    const temperature = normalizeNumber(body.temperature);
    const pulseRate = normalizeNumber(body.pulseRate);
    const respiratoryRate = normalizeNumber(body.respiratoryRate);
    const systolicBp = normalizeNumber(body.systolicBp);
    const diastolicBp = normalizeNumber(body.diastolicBp);
    const spo2 = normalizeNumber(body.spo2);
    const bloodSugar = normalizeNumber(body.bloodSugar);
    const remarks = normalizeText(body.remarks);
    const status = normalizeText(body.status) || "Active";

    if (!patientId || !patientName) {
      return NextResponse.json({ error: "Patient id and name are required." }, { status: 400 });
    }

    const bmi = calculateBmi(heightCm, weightKg);

    const existing = await pool.query(
      `SELECT id FROM ${quoteIdentifier(VITALS_TABLE)} WHERE patient_id = $1 LIMIT 1`,
      [patientId],
    );

    if ((existing.rowCount ?? 0) > 0) {
      const updated = await pool.query(
        `
          UPDATE ${quoteIdentifier(VITALS_TABLE)}
          SET patient_name = $1,
              dob = $2,
              age = $3,
              gender = $4,
              height_cm = $5,
              weight_kg = $6,
              temperature = $7,
              pulse_rate = $8,
              respiratory_rate = $9,
              systolic_bp = $10,
              diastolic_bp = $11,
              spo2 = $12,
              blood_sugar = $13,
              bmi = $14,
              remarks = $15,
              status = $16,
              updated_at = NOW()
          WHERE patient_id = $17
          RETURNING *
        `,
        [
          patientName,
          dob,
          age,
          gender || null,
          heightCm,
          weightKg,
          temperature,
          pulseRate ? Math.trunc(pulseRate) : null,
          respiratoryRate ? Math.trunc(respiratoryRate) : null,
          systolicBp ? Math.trunc(systolicBp) : null,
          diastolicBp ? Math.trunc(diastolicBp) : null,
          spo2 ? Math.trunc(spo2) : null,
          bloodSugar,
          bmi,
          remarks || null,
          status,
          patientId,
        ],
      );
      return NextResponse.json({ row: updated.rows[0], updated: true });
    }

    const inserted = await pool.query(
      `
        INSERT INTO ${quoteIdentifier(VITALS_TABLE)} (
          patient_id,
          patient_name,
          dob,
          age,
          gender,
          height_cm,
          weight_kg,
          temperature,
          pulse_rate,
          respiratory_rate,
          systolic_bp,
          diastolic_bp,
          spo2,
          blood_sugar,
          bmi,
          remarks,
          status
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        RETURNING *
      `,
      [
        patientId,
        patientName,
        dob,
        age,
        gender || null,
        heightCm,
        weightKg,
        temperature,
        pulseRate ? Math.trunc(pulseRate) : null,
        respiratoryRate ? Math.trunc(respiratoryRate) : null,
        systolicBp ? Math.trunc(systolicBp) : null,
        diastolicBp ? Math.trunc(diastolicBp) : null,
        spo2 ? Math.trunc(spo2) : null,
        bloodSugar,
        bmi,
        remarks || null,
        status,
      ],
    );

    return NextResponse.json({ row: inserted.rows[0], updated: false }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save vitals." },
      { status: 400 },
    );
  }
}
