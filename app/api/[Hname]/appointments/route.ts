import { NextResponse } from "next/server";
import { getTenantDB } from "../../../../lib/db";
import { quoteIdentifier } from "../../../../lib/master-form-table";

export const runtime = "nodejs";

type AppointmentRecord = {
  appointmentDate?: string;
  department?: string;
  doctor?: string;
  patientName?: string;
  patientPhone?: string;
  appointmentTime?: string;
  reason?: string;
};

const TABLE_NAME = "appointments";

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function ensureAppointmentsTable(pool: Awaited<ReturnType<typeof getTenantDB>>) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(TABLE_NAME)} (
      id BIGSERIAL PRIMARY KEY,
      appointment_date DATE NOT NULL,
      department TEXT NOT NULL,
      doctor TEXT NOT NULL,
      patient_name TEXT NOT NULL,
      patient_phone TEXT,
      appointment_time TIME,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'Scheduled',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS appointments_unique_slot_idx
    ON ${quoteIdentifier(TABLE_NAME)} (appointment_date, department, doctor, appointment_time)
  `);
}

function isValidTime(value: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ Hname: string }> },
) {
  try {
    const { Hname } = await params;
    const decodedHname = decodeURIComponent(Hname);
    const pool = await getTenantDB(decodedHname);
    await ensureAppointmentsTable(pool);

    const { searchParams } = new URL(request.url);
    const appointmentDate = searchParams.get("date") ?? "";
    const department = searchParams.get("department") ?? "";
    const doctor = searchParams.get("doctor") ?? "";

    if (!appointmentDate || !department || !doctor) {
      return NextResponse.json(
        { error: "Date, department and doctor are required." },
        { status: 400 },
      );
    }

    if (!isValidDate(appointmentDate)) {
      return NextResponse.json(
        { error: "Invalid appointment date." },
        { status: 400 },
      );
    }

    const result = await pool.query(
      `
        SELECT *
        FROM ${quoteIdentifier(TABLE_NAME)}
        WHERE appointment_date = $1
          AND department = $2
          AND doctor = $3
        ORDER BY appointment_time NULLS LAST, created_at DESC
      `,
      [appointmentDate, department, doctor],
    );

    return NextResponse.json({ rows: result.rows });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load appointments.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ Hname: string }> },
) {
  try {
    const { Hname } = await params;
    const decodedHname = decodeURIComponent(Hname);
    const pool = await getTenantDB(decodedHname);
    await ensureAppointmentsTable(pool);

    const body = (await request.json()) as AppointmentRecord;
    const appointmentDate = String(body.appointmentDate ?? "").trim();
    const department = String(body.department ?? "").trim();
    const doctor = String(body.doctor ?? "").trim();
    const patientName = String(body.patientName ?? "").trim();
    const patientPhone = String(body.patientPhone ?? "").trim();
    const appointmentTime = String(body.appointmentTime ?? "").trim();
    const reason = String(body.reason ?? "").trim();

    if (!appointmentDate || !department || !doctor || !patientName || !appointmentTime) {
      return NextResponse.json(
        {
          error:
            "Appointment date, department, doctor, patient name and appointment time are required.",
        },
        { status: 400 },
      );
    }

    if (!isValidDate(appointmentDate)) {
      return NextResponse.json(
        { error: "Invalid appointment date." },
        { status: 400 },
      );
    }

    if (!isValidTime(appointmentTime)) {
      return NextResponse.json(
        { error: "Invalid appointment time." },
        { status: 400 },
      );
    }

    const existingSlot = await pool.query(
      `
        SELECT id
        FROM ${quoteIdentifier(TABLE_NAME)}
        WHERE appointment_date = $1
          AND department = $2
          AND doctor = $3
          AND appointment_time = $4
        LIMIT 1
      `,
      [appointmentDate, department, doctor, appointmentTime],
    );

    if (existingSlot.rowCount && existingSlot.rowCount > 0) {
      return NextResponse.json(
        { error: "This appointment time is already booked." },
        { status: 409 },
      );
    }

    const inserted = await pool.query(
      `
        INSERT INTO ${quoteIdentifier(TABLE_NAME)} (
          appointment_date,
          department,
          doctor,
          patient_name,
          patient_phone,
          appointment_time,
          reason
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [
        appointmentDate,
        department,
        doctor,
        patientName,
        patientPhone || null,
        appointmentTime || null,
        reason || null,
      ],
    );

    return NextResponse.json({ row: inserted.rows[0] }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    ) {
      return NextResponse.json(
        { error: "This appointment time is already booked." },
        { status: 409 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to save appointment.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
