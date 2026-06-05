import { NextResponse } from "next/server";
import { getTenantDB } from "../../../../lib/db";
import { quoteIdentifier } from "../../../../lib/master-form-table";

export const runtime = "nodejs";

type AppointmentRecord = {
  appointmentId?: string | number;
  appointmentDate?: string;
  appointmentDay?: string;
  department?: string;
  doctor?: string;
  patientId?: string;
  patientName?: string;
  patientPhone?: string;
  appointmentTime?: string;
  timeSlotMinutes?: string | number;
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
      appointment_day TEXT,
      department TEXT NOT NULL,
      doctor TEXT NOT NULL,
      patient_id TEXT,
      patient_name TEXT NOT NULL,
      patient_phone TEXT,
      appointment_time TIME,
      time_slot_minutes INTEGER,
      patient_type TEXT NOT NULL DEFAULT 'scheduled',
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'Scheduled',
      reschedule_count INTEGER NOT NULL DEFAULT 0,
      reschedule_history JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE ${quoteIdentifier(TABLE_NAME)}
    ADD COLUMN IF NOT EXISTS time_slot_minutes INTEGER
  `);

  await pool.query(`
    ALTER TABLE ${quoteIdentifier(TABLE_NAME)}
    ADD COLUMN IF NOT EXISTS reschedule_count INTEGER NOT NULL DEFAULT 0
  `);

  await pool.query(`
    ALTER TABLE ${quoteIdentifier(TABLE_NAME)}
    ADD COLUMN IF NOT EXISTS reschedule_history JSONB NOT NULL DEFAULT '[]'::jsonb
  `);

  await pool.query(`
    ALTER TABLE ${quoteIdentifier(TABLE_NAME)}
    ADD COLUMN IF NOT EXISTS patient_type TEXT NOT NULL DEFAULT 'scheduled'
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS appointments_unique_slot_idx
    ON ${quoteIdentifier(TABLE_NAME)} (appointment_date, department, doctor, appointment_time)
  `);
}

function isValidTime(value: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function normalizeTime(value: string) {
  const match = String(value ?? "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return "";
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return "";
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
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
    const startDate = searchParams.get("start") ?? "";
    const endDate = searchParams.get("end") ?? "";
    const department = searchParams.get("department") ?? "";
    const doctor = searchParams.get("doctor") ?? "";
    const patientId = searchParams.get("patientId") ?? "";

    if (patientId && department && doctor) {
      const result = await pool.query(
        `
          SELECT *
          FROM ${quoteIdentifier(TABLE_NAME)}
          WHERE patient_id = $1
            AND department = $2
            AND doctor = $3
          ORDER BY updated_at DESC, appointment_date DESC, appointment_time DESC
        `,
        [patientId, department, doctor],
      );

      return NextResponse.json({ rows: result.rows });
    }

    if ((!appointmentDate && (!startDate || !endDate)) || !department || !doctor) {
      return NextResponse.json(
        { error: "Date range, department and doctor are required." },
        { status: 400 },
      );
    }

    if (appointmentDate && !isValidDate(appointmentDate)) {
      return NextResponse.json(
        { error: "Invalid appointment date." },
        { status: 400 },
      );
    }

    if (startDate && !isValidDate(startDate)) {
      return NextResponse.json({ error: "Invalid start date." }, { status: 400 });
    }

    if (endDate && !isValidDate(endDate)) {
      return NextResponse.json({ error: "Invalid end date." }, { status: 400 });
    }

    const result = await pool.query(
      appointmentDate
        ? `
          SELECT *
          FROM ${quoteIdentifier(TABLE_NAME)}
          WHERE appointment_date = $1
            AND department = $2
            AND doctor = $3
          ORDER BY appointment_time NULLS LAST, created_at DESC
        `
        : `
          SELECT *
          FROM ${quoteIdentifier(TABLE_NAME)}
          WHERE appointment_date BETWEEN $1 AND $2
            AND department = $3
            AND doctor = $4
          ORDER BY appointment_date, appointment_time NULLS LAST, created_at DESC
        `,
      appointmentDate ? [appointmentDate, department, doctor] : [startDate, endDate, department, doctor],
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
    const appointmentDay = String(body.appointmentDay ?? "").trim();
    const department = String(body.department ?? "").trim();
    const doctor = String(body.doctor ?? "").trim();
    const patientName = String(body.patientName ?? "").trim();
    const patientId = String(body.patientId ?? "").trim();
    const patientPhone = String(body.patientPhone ?? "").trim();
    const appointmentTime = normalizeTime(String(body.appointmentTime ?? ""));
    const timeSlotMinutes = Number(body.timeSlotMinutes ?? 0);
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
          appointment_day,
          department,
          doctor,
          patient_name,
          patient_id,
          patient_phone,
          appointment_time,
          time_slot_minutes,
          patient_type,
          reason
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `,
      [
        appointmentDate,
        appointmentDay || null,
        department,
        doctor,
        patientName,
        patientId || null,
        patientPhone || null,
        appointmentTime || null,
        Number.isFinite(timeSlotMinutes) && timeSlotMinutes > 0 ? timeSlotMinutes : null,
        "scheduled",
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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ Hname: string }> },
) {
  try {
    const { Hname } = await params;
    const decodedHname = decodeURIComponent(Hname);
    const pool = await getTenantDB(decodedHname);
    await ensureAppointmentsTable(pool);

    const body = (await request.json()) as AppointmentRecord;
    const appointmentId = Number(body.appointmentId ?? 0);
    const appointmentDate = String(body.appointmentDate ?? "").trim();
    const appointmentDay = String(body.appointmentDay ?? "").trim();
    const department = String(body.department ?? "").trim();
    const doctor = String(body.doctor ?? "").trim();
    const patientId = String(body.patientId ?? "").trim();
    const patientName = String(body.patientName ?? "").trim();
    const patientPhone = String(body.patientPhone ?? "").trim();
    const appointmentTime = normalizeTime(String(body.appointmentTime ?? ""));
    const timeSlotMinutes = Number(body.timeSlotMinutes ?? 0);
    const reason = String(body.reason ?? "").trim();

    if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
      return NextResponse.json({ error: "Appointment id is required." }, { status: 400 });
    }

    if (!appointmentDate || !department || !doctor || !patientName || !appointmentTime) {
      return NextResponse.json(
        { error: "Appointment date, department, doctor, patient name and appointment time are required." },
        { status: 400 },
      );
    }

    if (!isValidDate(appointmentDate)) {
      return NextResponse.json({ error: "Invalid appointment date." }, { status: 400 });
    }

    if (!isValidTime(appointmentTime)) {
      return NextResponse.json({ error: "Invalid appointment time." }, { status: 400 });
    }

    const current = await pool.query(
      `
        SELECT id, patient_id, reschedule_count, reschedule_history, appointment_date, appointment_time, department, doctor, patient_name, patient_phone, reason
        FROM ${quoteIdentifier(TABLE_NAME)}
        WHERE id = $1
        LIMIT 1
      `,
      [appointmentId],
    );

    if (current.rowCount === 0) {
      return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
    }

    const currentRow = current.rows[0] as {
      patient_id?: string | null;
      reschedule_count?: number | string | null;
      reschedule_history?: unknown;
      appointment_date?: string | null;
      appointment_time?: string | null;
      department?: string | null;
      doctor?: string | null;
    };
    const currentPatientId = String(currentRow.patient_id ?? "").trim();
    if (patientId && currentPatientId && currentPatientId !== patientId) {
      return NextResponse.json({ error: "You can only reschedule your own appointment." }, { status: 403 });
    }

    const hasScheduleChanged =
      String(currentRow.appointment_date ?? "").trim() !== appointmentDate ||
      String(currentRow.appointment_time ?? "").trim() !== appointmentTime ||
      String(currentRow.department ?? "").trim() !== department ||
      String(currentRow.doctor ?? "").trim() !== doctor;

    if (!hasScheduleChanged) {
      return NextResponse.json({ row: currentRow });
    }

    const rescheduleCount = Number(currentRow.reschedule_count ?? 0);
    if (rescheduleCount >= 3) {
      return NextResponse.json({ error: "Appointment can be rescheduled only 3 times." }, { status: 409 });
    }

    const existingSlot = await pool.query(
      `
        SELECT id
        FROM ${quoteIdentifier(TABLE_NAME)}
        WHERE appointment_date = $1
          AND department = $2
          AND doctor = $3
          AND appointment_time = $4
          AND id <> $5
        LIMIT 1
      `,
      [appointmentDate, department, doctor, appointmentTime, appointmentId],
    );

    if (existingSlot.rowCount && existingSlot.rowCount > 0) {
      return NextResponse.json(
        { error: "This appointment time is already booked." },
        { status: 409 },
      );
    }

    const updated = await pool.query(
      `
        UPDATE ${quoteIdentifier(TABLE_NAME)}
        SET appointment_date = $1::date,
            appointment_day = $2,
            department = $3,
            doctor = $4,
            patient_name = $5,
            patient_id = $6,
            patient_phone = $7,
            appointment_time = $8::time,
            time_slot_minutes = $9,
            patient_type = 'scheduled',
            reason = $10,
            status = 'Rescheduled',
            reschedule_history = COALESCE(reschedule_history, '[]'::jsonb) || jsonb_build_array(
              jsonb_build_object(
                'fromDate', appointment_date::text,
                'fromTime', appointment_time::text,
                'toDate', $1::text,
                'toTime', $8::text,
                'updatedAt', NOW()
              )
            ),
            reschedule_count = reschedule_count + 1,
            updated_at = NOW()
        WHERE id = $11
        RETURNING *
      `,
      [
        appointmentDate,
        appointmentDay || null,
        department,
        doctor,
        patientName,
        patientId || null,
        patientPhone || null,
        appointmentTime || null,
        Number.isFinite(timeSlotMinutes) && timeSlotMinutes > 0 ? timeSlotMinutes : null,
        reason || null,
        appointmentId,
      ],
    );

    return NextResponse.json({ row: updated.rows[0] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reschedule appointment.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
