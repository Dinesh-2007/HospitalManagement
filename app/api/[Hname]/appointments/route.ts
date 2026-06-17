import { NextResponse } from "next/server";
import type { Pool, PoolClient } from "pg";
import { getTenantDB } from "../../../../lib/db";
import { quoteIdentifier, tableNameFromCardTitle } from "../../../../lib/master-form-table";

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
  cancelledByRole?: string;
  cancelledByName?: string;
  cancelledByUsername?: string;
  cancellationReason?: string;
  transferToDoctor?: string;
  transferredByName?: string;
  transferredByUsername?: string;
};

type CancellationMeta = {
  cancelledByRole: string | null;
  cancelledByName: string | null;
  cancelledByUsername: string | null;
  cancellationReason: string | null;
};

type AppointmentRow = {
  id: number;
  appointment_date: string;
  appointment_day: string | null;
  department: string;
  doctor: string;
  patient_id: string | null;
  patient_name: string;
  patient_phone: string | null;
  appointment_time: string | null;
  appointment_end_time: string | null;
  time_slot_minutes: number | null;
  reason: string | null;
  status: string;
};

type ScheduleRow = {
  doctorName: string;
  fromDate: string;
  toDate: string;
  fromTime: string;
  toTime: string;
  days: string[];
  slotMinutes: number;
};

type Slot = {
  start: string;
  end: string;
};

const TABLE_NAME = "appointments";
const PATIENT_TABLE = "patient_registration";
const DOCTOR_TABLE = tableNameFromCardTitle("Consultant / Doctor Master");
const SCHEDULE_TABLE = tableNameFromCardTitle("Consultant / Doctor Schedule");
const TRANSFER_TABLE = "appointment_transfer_history";
const NOTIFICATION_TABLE = "patient_notifications";
const AUDIT_TABLE = "appointment_audit_logs";

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeTime(value: string) {
  const match = String(value ?? "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return "";
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return "";
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function isValidTime(value: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function timeToMinutes(value: string) {
  const [hours, minutes] = normalizeTime(value).split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function addMinutes(value: string, minutesToAdd: number) {
  return minutesToTime(timeToMinutes(value) + minutesToAdd);
}

function parseDoctorNames(value: string) {
  return Array.from(new Set(value.split(",").map((item) => item.trim()).filter(Boolean)));
}

function normalizeDateKey(value: unknown) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : text;
}

function dayNameForDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date(year, month - 1, day));
}

function readText(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return "";
}

function readDays(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return value.replace(/[\[\]"]/g, "").split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function normalizeScheduleRow(row: Record<string, unknown>): ScheduleRow {
  return {
    doctorName: readText(row, ["consultant_doctor_name", "consultantDoctorName"]),
    fromDate: normalizeDateKey(readText(row, ["appointment_from_date", "appointmentFromDate"])),
    toDate: normalizeDateKey(readText(row, ["appointment_to_date", "appointmentToDate"])),
    fromTime: normalizeTime(readText(row, ["available_time_from", "availableTimeFrom"])),
    toTime: normalizeTime(readText(row, ["available_time_to", "availableTimeTo"])),
    days: readDays(row.days_available ?? row.daysAvailable),
    slotMinutes: Number(readText(row, ["time_slot_minutes", "timeSlotMinutes"])) || 10,
  };
}

function generateSlots(schedule: ScheduleRow, appointmentDate: string) {
  if (!schedule.fromTime || !schedule.toTime) return [];
  if (schedule.fromDate && appointmentDate < schedule.fromDate) return [];
  if (schedule.toDate && appointmentDate > schedule.toDate) return [];
  const dayName = dayNameForDate(appointmentDate);
  if (schedule.days.length > 0 && !schedule.days.includes(dayName)) return [];

  const slots: Slot[] = [];
  const end = timeToMinutes(schedule.toTime);
  for (let cursor = timeToMinutes(schedule.fromTime); cursor + schedule.slotMinutes <= end; cursor += schedule.slotMinutes) {
    slots.push({ start: minutesToTime(cursor), end: minutesToTime(cursor + schedule.slotMinutes) });
  }
  return slots;
}

function formatDateForMessage(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(year, month - 1, day));
}

function formatTimeForMessage(value: string) {
  const [hoursText, minutesText] = value.split(":");
  const date = new Date();
  date.setHours(Number(hoursText), Number(minutesText), 0, 0);
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(date).replace(/\s/g, " ");
}

async function tableExists(pool: Pool | PoolClient, tableName: string) {
  const result = await pool.query(
    `
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      ) AS exists
    `,
    [tableName],
  );
  return Boolean(result.rows[0]?.exists);
}

async function columnExists(pool: Pool | PoolClient, tableName: string, columnName: string) {
  const result = await pool.query(
    `
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
      ) AS exists
    `,
    [tableName, columnName],
  );
  return Boolean(result.rows[0]?.exists);
}

async function ensureAppointmentsTable(pool: Pool | PoolClient) {
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
      appointment_end_time TIME,
      time_slot_minutes INTEGER,
      patient_type TEXT NOT NULL DEFAULT 'scheduled',
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'Scheduled',
      reschedule_count INTEGER NOT NULL DEFAULT 0,
      reschedule_history JSONB NOT NULL DEFAULT '[]'::jsonb,
      transferred_from_doctor TEXT,
      transferred_to_doctor TEXT,
      transferred_by_name TEXT,
      transferred_by_username TEXT,
      transferred_at TIMESTAMPTZ,
      cancelled_by_role TEXT,
      cancelled_by_name TEXT,
      cancelled_by_username TEXT,
      cancelled_reason TEXT,
      cancelled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const columns: Array<[string, string]> = [
    ["time_slot_minutes", "INTEGER"],
    ["appointment_end_time", "TIME"],
    ["reschedule_count", "INTEGER NOT NULL DEFAULT 0"],
    ["reschedule_history", "JSONB NOT NULL DEFAULT '[]'::jsonb"],
    ["patient_type", "TEXT NOT NULL DEFAULT 'scheduled'"],
    ["transferred_from_doctor", "TEXT"],
    ["transferred_to_doctor", "TEXT"],
    ["transferred_by_name", "TEXT"],
    ["transferred_by_username", "TEXT"],
    ["transferred_at", "TIMESTAMPTZ"],
    ["cancelled_by_role", "TEXT"],
    ["cancelled_by_name", "TEXT"],
    ["cancelled_by_username", "TEXT"],
    ["cancelled_reason", "TEXT"],
    ["cancelled_at", "TIMESTAMPTZ"],
  ];

  for (const [column, type] of columns) {
    await pool.query(`ALTER TABLE ${quoteIdentifier(TABLE_NAME)} ADD COLUMN IF NOT EXISTS ${quoteIdentifier(column)} ${type}`);
  }

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS appointments_unique_slot_idx
    ON ${quoteIdentifier(TABLE_NAME)} (appointment_date, department, doctor, appointment_time)
    WHERE status IN ('Scheduled', 'Rescheduled')
  `);
}

async function ensureSupportTables(pool: Pool | PoolClient) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(TRANSFER_TABLE)} (
      id BIGSERIAL PRIMARY KEY,
      appointment_id BIGINT NOT NULL,
      patient_id TEXT,
      patient_name TEXT,
      patient_phone TEXT,
      department TEXT,
      old_doctor TEXT NOT NULL,
      new_doctor TEXT NOT NULL,
      appointment_date DATE NOT NULL,
      old_start_time TIME,
      old_end_time TIME,
      new_start_time TIME,
      new_end_time TIME,
      transferred_by_name TEXT,
      transferred_by_username TEXT,
      transferred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(NOTIFICATION_TABLE)} (
      id BIGSERIAL PRIMARY KEY,
      patient_id TEXT,
      patient_phone TEXT,
      appointment_id BIGINT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(AUDIT_TABLE)} (
      id BIGSERIAL PRIMARY KEY,
      appointment_id BIGINT,
      patient_id TEXT,
      patient_name TEXT,
      patient_phone TEXT,
      action TEXT NOT NULL,
      old_doctor TEXT,
      new_doctor TEXT,
      appointment_date DATE,
      old_start_time TIME,
      old_end_time TIME,
      new_start_time TIME,
      new_end_time TIME,
      performed_by_role TEXT,
      performed_by_name TEXT,
      performed_by_username TEXT,
      remarks TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function ensureAll(pool: Pool | PoolClient) {
  await ensureAppointmentsTable(pool);
  await ensureSupportTables(pool);
}

async function insertAudit(pool: Pool | PoolClient, values: {
  appointmentId?: number | null;
  patientId?: string | null;
  patientName?: string | null;
  patientPhone?: string | null;
  action: string;
  oldDoctor?: string | null;
  newDoctor?: string | null;
  appointmentDate?: string | null;
  oldStartTime?: string | null;
  oldEndTime?: string | null;
  newStartTime?: string | null;
  newEndTime?: string | null;
  performedByRole?: string | null;
  performedByName?: string | null;
  performedByUsername?: string | null;
  remarks?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await pool.query(
    `
      INSERT INTO ${quoteIdentifier(AUDIT_TABLE)} (
        appointment_id, patient_id, patient_name, patient_phone, action,
        old_doctor, new_doctor, appointment_date, old_start_time, old_end_time,
        new_start_time, new_end_time, performed_by_role, performed_by_name,
        performed_by_username, remarks, metadata
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb)
    `,
    [
      values.appointmentId ?? null,
      values.patientId ?? null,
      values.patientName ?? null,
      values.patientPhone ?? null,
      values.action,
      values.oldDoctor ?? null,
      values.newDoctor ?? null,
      values.appointmentDate ?? null,
      values.oldStartTime ?? null,
      values.oldEndTime ?? null,
      values.newStartTime ?? null,
      values.newEndTime ?? null,
      values.performedByRole ?? null,
      values.performedByName ?? null,
      values.performedByUsername ?? null,
      values.remarks ?? null,
      JSON.stringify(values.metadata ?? {}),
    ],
  );
}

async function getDoctorRows(pool: Pool | PoolClient) {
  if (!(await tableExists(pool, DOCTOR_TABLE))) return [];
  const result = await pool.query(`SELECT * FROM ${quoteIdentifier(DOCTOR_TABLE)} ORDER BY id DESC`);
  return result.rows.map((row) => ({
    name: readText(row, ["doctor_consultant_name", "doctorConsultantName", "consultant_doctor_name", "name"]),
    department: readText(row, ["clinic", "department", "department_type", "departmentType"]),
  })).filter((row) => row.name);
}

async function getScheduleRows(pool: Pool | PoolClient) {
  if (!(await tableExists(pool, SCHEDULE_TABLE))) return [];
  const result = await pool.query(`SELECT * FROM ${quoteIdentifier(SCHEDULE_TABLE)} ORDER BY id DESC`);
  return result.rows.map(normalizeScheduleRow).filter((row) => row.doctorName);
}

async function getAvailableTransferDoctors(pool: Pool | PoolClient, appointmentId: number) {
  const currentResult = await pool.query<AppointmentRow>(
    `
      SELECT *
      FROM ${quoteIdentifier(TABLE_NAME)}
      WHERE id = $1 AND status IN ('Scheduled', 'Rescheduled')
      LIMIT 1
    `,
    [appointmentId],
  );
  const current = currentResult.rows[0];
  if (!current) return { current: null, rows: [] };

  const appointmentDate = normalizeDateKey(current.appointment_date);
  const doctors = await getDoctorRows(pool);
  const schedules = await getScheduleRows(pool);
  const occupiedResult = await pool.query(
    `
      SELECT doctor, appointment_time
      FROM ${quoteIdentifier(TABLE_NAME)}
      WHERE appointment_date = $1
        AND status IN ('Scheduled', 'Rescheduled')
        AND appointment_time IS NOT NULL
    `,
    [appointmentDate],
  );
  const occupied = new Set(
    occupiedResult.rows.map((row) => `${String(row.doctor).trim().toLowerCase()}|${normalizeTime(String(row.appointment_time))}`),
  );

  const rows = doctors
    .filter((doctor) => doctor.department === current.department)
    .filter((doctor) => doctor.name.trim().toLowerCase() !== current.doctor.trim().toLowerCase())
    .map((doctor) => {
      const doctorSchedules = schedules.filter((schedule) => schedule.doctorName.trim().toLowerCase() === doctor.name.trim().toLowerCase());
      const allSlots = doctorSchedules.flatMap((schedule) => generateSlots(schedule, appointmentDate));
      const availableSlots = allSlots.filter((slot) => !occupied.has(`${doctor.name.trim().toLowerCase()}|${slot.start}`));
      const timing = doctorSchedules.map((schedule) => `${schedule.fromTime} - ${schedule.toTime}`).filter((value) => value !== " - ");
      return {
        doctor: doctor.name,
        department: doctor.department,
        availableTiming: Array.from(new Set(timing)).join(", "),
        availableSlots,
        nextSlot: availableSlots[0] ?? null,
      };
    })
    .filter((row) => row.availableSlots.length > 0);

  return { current, rows };
}

async function cancelAppointmentById(pool: Pool | PoolClient, appointmentId: number, meta: CancellationMeta) {
  const result = await pool.query<AppointmentRow>(
    `
      UPDATE ${quoteIdentifier(TABLE_NAME)}
      SET status = 'Cancelled',
          cancelled_by_role = $2,
          cancelled_by_name = $3,
          cancelled_by_username = $4,
          cancelled_reason = $5,
          cancelled_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [appointmentId, meta.cancelledByRole, meta.cancelledByName, meta.cancelledByUsername, meta.cancellationReason],
  );
  return result.rows[0] ?? null;
}

async function buildPatientSelect(pool: Pool | PoolClient) {
  const hasPatientTable = await tableExists(pool, PATIENT_TABLE);
  const hasGender = hasPatientTable && (await columnExists(pool, PATIENT_TABLE, "gender"));
  const hasDob = hasPatientTable && (await columnExists(pool, PATIENT_TABLE, "dob"));
  return {
    select: `${hasGender ? "MAX(p.gender)" : "NULL::text"} AS patient_gender, ${hasDob ? "MAX(p.dob)::text" : "NULL::text"} AS patient_dob`,
    join: hasPatientTable
      ? `
        LEFT JOIN ${quoteIdentifier(PATIENT_TABLE)} p
          ON (a.patient_id IS NOT NULL AND p.patient_id = a.patient_id)
          OR (
            a.patient_phone IS NOT NULL
            AND regexp_replace(COALESCE(p.mobile, ''), '\\D', '', 'g') = regexp_replace(a.patient_phone, '\\D', '', 'g')
          )
      `
      : "",
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ Hname: string }> }) {
  try {
    const { Hname } = await params;
    const pool = await getTenantDB(decodeURIComponent(Hname));
    await ensureAll(pool);

    const { searchParams } = new URL(request.url);
    const transferOptionsFor = Number(searchParams.get("transferOptionsFor") ?? 0);
    const recordsDate = searchParams.get("recordsDate") ?? "";
    const transferHistoryFor = Number(searchParams.get("transferHistoryFor") ?? 0);
    const auditLogsFor = Number(searchParams.get("auditLogsFor") ?? 0);
    const notificationsFor = searchParams.get("notificationsFor") ?? "";
    const appointmentDate = searchParams.get("date") ?? "";
    const startDate = searchParams.get("start") ?? "";
    const endDate = searchParams.get("end") ?? "";
    const department = searchParams.get("department") ?? "";
    const doctor = searchParams.get("doctor") ?? "";
    const patientId = searchParams.get("patientId") ?? "";
    const doctorNames = parseDoctorNames(searchParams.get("doctorNames") ?? "");
    const requestedDoctorNames = Array.from(new Set([doctor, ...doctorNames].map((value) => value.trim()).filter(Boolean)));

    if (transferOptionsFor > 0) {
      const result = await getAvailableTransferDoctors(pool, transferOptionsFor);
      return NextResponse.json(result.current ? { row: result.current, rows: result.rows } : { error: "Appointment not found." }, result.current ? undefined : { status: 404 });
    }

    if (transferHistoryFor > 0) {
      const result = await pool.query(
        `SELECT * FROM ${quoteIdentifier(TRANSFER_TABLE)} WHERE appointment_id = $1 ORDER BY transferred_at DESC`,
        [transferHistoryFor],
      );
      return NextResponse.json({ rows: result.rows });
    }

    if (auditLogsFor > 0) {
      const result = await pool.query(
        `SELECT * FROM ${quoteIdentifier(AUDIT_TABLE)} WHERE appointment_id = $1 ORDER BY created_at DESC`,
        [auditLogsFor],
      );
      return NextResponse.json({ rows: result.rows });
    }

    if (notificationsFor) {
      const result = await pool.query(
        `
          SELECT *
          FROM ${quoteIdentifier(NOTIFICATION_TABLE)}
          WHERE patient_id = $1 OR regexp_replace(COALESCE(patient_phone, ''), '\\D', '', 'g') = regexp_replace($1, '\\D', '', 'g')
          ORDER BY created_at DESC
          LIMIT 50
        `,
        [notificationsFor],
      );
      return NextResponse.json({ rows: result.rows });
    }

    if (recordsDate) {
      if (!isValidDate(recordsDate)) return NextResponse.json({ error: "Invalid records date." }, { status: 400 });
      if (requestedDoctorNames.length === 0) return NextResponse.json({ error: "Doctor is required." }, { status: 400 });

      const status = String(searchParams.get("status") ?? "All").trim();
      const search = String(searchParams.get("search") ?? "").trim();
      const page = Math.max(Number(searchParams.get("page") ?? 1), 1);
      const pageSize = Math.min(Math.max(Number(searchParams.get("pageSize") ?? 10), 1), 100);
      const patientSelect = await buildPatientSelect(pool);
      const values: unknown[] = [recordsDate, requestedDoctorNames.map((value) => value.toLowerCase())];
      const filters = [`a.appointment_date = $1`, `(LOWER(a.doctor) = ANY($2) OR LOWER(a.transferred_from_doctor) = ANY($2))`];

      if (search) {
        values.push(`%${search.toLowerCase()}%`);
        filters.push(`(LOWER(a.patient_name) LIKE $${values.length} OR LOWER(COALESCE(a.patient_phone, '')) LIKE $${values.length})`);
      }

      const statusSql = `
        CASE
          WHEN LOWER(COALESCE(a.transferred_from_doctor, '')) = ANY($2) THEN 'Transferred'
          WHEN a.status = 'Cancelled' THEN 'Cancelled'
          ELSE 'Scheduled'
        END
      `;
      if (["Scheduled", "Transferred", "Cancelled"].includes(status)) {
        filters.push(`${statusSql} = $${values.length + 1}`);
        values.push(status);
      }

      const countResult = await pool.query(
        `
          SELECT COUNT(*) AS total
          FROM ${quoteIdentifier(TABLE_NAME)} a
          WHERE ${filters.join(" AND ")}
        `,
        values,
      );

      values.push(pageSize, (page - 1) * pageSize);
      const result = await pool.query(
        `
          SELECT a.*, ${patientSelect.select}, ${statusSql} AS record_status
          FROM ${quoteIdentifier(TABLE_NAME)} a
          ${patientSelect.join}
          WHERE ${filters.join(" AND ")}
          GROUP BY a.id
          ORDER BY a.updated_at DESC, a.appointment_time NULLS LAST
          LIMIT $${values.length - 1} OFFSET $${values.length}
        `,
        values,
      );

      return NextResponse.json({ rows: result.rows, total: Number(countResult.rows[0]?.total ?? 0), page, pageSize });
    }

    if (patientId && !department && requestedDoctorNames.length === 0) {
      const result = await pool.query(
        `SELECT * FROM ${quoteIdentifier(TABLE_NAME)}
         WHERE patient_id = $1
            OR patient_phone = $1
            OR regexp_replace(COALESCE(patient_phone, ''), '\\D', '', 'g') = regexp_replace($1, '\\D', '', 'g')
         ORDER BY updated_at DESC, appointment_date DESC, appointment_time DESC`,
        [patientId],
      );
      return NextResponse.json({ rows: result.rows });
    }

    if (patientId && (department || requestedDoctorNames.length > 0)) {
      const filters = [
        `(patient_id = $1 OR patient_phone = $1 OR regexp_replace(COALESCE(patient_phone, ''), '\\D', '', 'g') = regexp_replace($1, '\\D', '', 'g'))`,
        `status IN ('Scheduled', 'Rescheduled')`
      ];
      const values: unknown[] = [patientId];
      let index = 2;
      if (department) {
        filters.push(`department = $${index}`);
        values.push(department);
        index += 1;
      }
      if (requestedDoctorNames.length === 1) {
        filters.push(`doctor = $${index}`);
        values.push(requestedDoctorNames[0]);
      } else if (requestedDoctorNames.length > 1) {
        filters.push(`LOWER(doctor) = ANY($${index})`);
        values.push(requestedDoctorNames.map((value) => value.toLowerCase()));
      }
      const result = await pool.query(
        `SELECT * FROM ${quoteIdentifier(TABLE_NAME)} WHERE ${filters.join(" AND ")} ORDER BY updated_at DESC, appointment_date DESC, appointment_time DESC`,
        values,
      );
      return NextResponse.json({ rows: result.rows });
    }

    if ((!appointmentDate && (!startDate || !endDate)) || requestedDoctorNames.length === 0) {
      return NextResponse.json({ error: "Date range and doctor are required." }, { status: 400 });
    }
    if (appointmentDate && !isValidDate(appointmentDate)) return NextResponse.json({ error: "Invalid appointment date." }, { status: 400 });
    if (startDate && !isValidDate(startDate)) return NextResponse.json({ error: "Invalid start date." }, { status: 400 });
    if (endDate && !isValidDate(endDate)) return NextResponse.json({ error: "Invalid end date." }, { status: 400 });

    const filters = [appointmentDate ? `appointment_date = $1` : `appointment_date BETWEEN $1 AND $2`];
    const values: unknown[] = appointmentDate ? [appointmentDate] : [startDate, endDate];
    let index = appointmentDate ? 2 : 3;
    if (department) {
      filters.push(`department = $${index}`);
      values.push(department);
      index += 1;
    }
    if (requestedDoctorNames.length === 1) {
      filters.push(`doctor = $${index}`);
      values.push(requestedDoctorNames[0]);
    } else {
      filters.push(`LOWER(doctor) = ANY($${index})`);
      values.push(requestedDoctorNames.map((value) => value.toLowerCase()));
    }
    filters.push(`status IN ('Scheduled', 'Rescheduled')`);

    const result = await pool.query(
      `SELECT * FROM ${quoteIdentifier(TABLE_NAME)} WHERE ${filters.join(" AND ")} ORDER BY appointment_date, appointment_time NULLS LAST, created_at DESC`,
      values,
    );
    return NextResponse.json({ rows: result.rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load appointments.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ Hname: string }> }) {
  try {
    const { Hname } = await params;
    const pool = await getTenantDB(decodeURIComponent(Hname));
    await ensureAll(pool);

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
    const appointmentEndTime = Number.isFinite(timeSlotMinutes) && timeSlotMinutes > 0 ? addMinutes(appointmentTime, timeSlotMinutes) : "";
    const reason = String(body.reason ?? "").trim();

    if (!appointmentDate || !department || !doctor || !patientName || !appointmentTime) {
      return NextResponse.json({ error: "Appointment date, department, doctor, patient name and appointment time are required." }, { status: 400 });
    }
    if (!isValidDate(appointmentDate)) return NextResponse.json({ error: "Invalid appointment date." }, { status: 400 });
    if (!isValidTime(appointmentTime)) return NextResponse.json({ error: "Invalid appointment time." }, { status: 400 });

    const existingSlot = await pool.query(
      `
        SELECT id FROM ${quoteIdentifier(TABLE_NAME)}
        WHERE appointment_date = $1 AND department = $2 AND doctor = $3 AND appointment_time = $4
          AND status IN ('Scheduled', 'Rescheduled')
        LIMIT 1
      `,
      [appointmentDate, department, doctor, appointmentTime],
    );
    if ((existingSlot.rowCount ?? 0) > 0) {
      return NextResponse.json({ error: "This appointment time is already booked." }, { status: 409 });
    }

    const inserted = await pool.query<AppointmentRow>(
      `
        INSERT INTO ${quoteIdentifier(TABLE_NAME)} (
          appointment_date, appointment_day, department, doctor, patient_name, patient_id,
          patient_phone, appointment_time, appointment_end_time, time_slot_minutes, patient_type, reason
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
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
        appointmentTime,
        appointmentEndTime || null,
        Number.isFinite(timeSlotMinutes) && timeSlotMinutes > 0 ? timeSlotMinutes : null,
        "scheduled",
        reason || null,
      ],
    );

    const row = inserted.rows[0];
    await insertAudit(pool, {
      appointmentId: row.id,
      patientId: row.patient_id,
      patientName: row.patient_name,
      patientPhone: row.patient_phone,
      action: "Scheduled",
      newDoctor: row.doctor,
      appointmentDate,
      newStartTime: appointmentTime,
      newEndTime: appointmentEndTime || null,
      remarks: reason || null,
    });

    return NextResponse.json({ row }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "This appointment time is already booked." }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Failed to save appointment.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ Hname: string }> }) {
  const { Hname } = await params;
  const pool = await getTenantDB(decodeURIComponent(Hname));
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensureAll(client);

    const body = (await request.json()) as AppointmentRecord;
    const appointmentId = Number(body.appointmentId ?? 0);
    const transferToDoctor = String(body.transferToDoctor ?? "").trim();
    const transferredByName = String(body.transferredByName ?? "").trim();
    const transferredByUsername = String(body.transferredByUsername ?? "").trim();

    if (!Number.isInteger(appointmentId) || appointmentId <= 0) throw new Error("Appointment id is required.");
    if (!transferToDoctor) throw new Error("Transfer doctor is required.");

    const currentResult = await client.query<AppointmentRow>(
      `
        SELECT *
        FROM ${quoteIdentifier(TABLE_NAME)}
        WHERE id = $1 AND status IN ('Scheduled', 'Rescheduled')
        FOR UPDATE
      `,
      [appointmentId],
    );
    const current = currentResult.rows[0];
    if (!current) throw new Error("Appointment not found.");
    if (current.doctor.trim().toLowerCase() === transferToDoctor.toLowerCase()) throw new Error("Select a different doctor.");

    const { rows: options } = await getAvailableTransferDoctors(client, appointmentId);
    const selectedDoctor = options.find((row) => row.doctor.trim().toLowerCase() === transferToDoctor.toLowerCase());
    const nextSlot = selectedDoctor?.nextSlot;
    if (!nextSlot) throw new Error("No available slots found for transfer on the selected date.");

    const conflict = await client.query(
      `
        SELECT id FROM ${quoteIdentifier(TABLE_NAME)}
        WHERE appointment_date = $1 AND department = $2 AND doctor = $3 AND appointment_time = $4::time
          AND id <> $5 AND status IN ('Scheduled', 'Rescheduled')
        LIMIT 1
      `,
      [current.appointment_date, current.department, transferToDoctor, nextSlot.start, appointmentId],
    );
    if ((conflict.rowCount ?? 0) > 0) throw new Error("Selected doctor already has a patient in this slot.");

    const updated = await client.query<AppointmentRow>(
      `
        UPDATE ${quoteIdentifier(TABLE_NAME)}
        SET doctor = $2,
            appointment_time = $3::time,
            appointment_end_time = $4::time,
            time_slot_minutes = $5,
            status = 'Scheduled',
            transferred_from_doctor = $6,
            transferred_to_doctor = $2,
            transferred_by_name = $7,
            transferred_by_username = $8,
            transferred_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        appointmentId,
        transferToDoctor,
        nextSlot.start,
        nextSlot.end,
        timeToMinutes(nextSlot.end) - timeToMinutes(nextSlot.start),
        current.doctor,
        transferredByName || null,
        transferredByUsername || null,
      ],
    );
    const row = updated.rows[0];

    await client.query(
      `
        INSERT INTO ${quoteIdentifier(TRANSFER_TABLE)} (
          appointment_id, patient_id, patient_name, patient_phone, department,
          old_doctor, new_doctor, appointment_date, old_start_time, old_end_time,
          new_start_time, new_end_time, transferred_by_name, transferred_by_username
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      `,
      [
        row.id,
        row.patient_id,
        row.patient_name,
        row.patient_phone,
        row.department,
        current.doctor,
        transferToDoctor,
        current.appointment_date,
        current.appointment_time,
        current.appointment_end_time,
        nextSlot.start,
        nextSlot.end,
        transferredByName || null,
        transferredByUsername || null,
      ],
    );

    const message = `Your appointment has been transferred from ${current.doctor} to ${transferToDoctor}.\n\nDate: ${formatDateForMessage(current.appointment_date)}\nTime: ${formatTimeForMessage(nextSlot.start)} - ${formatTimeForMessage(nextSlot.end)}\n\nPlease arrive at the updated appointment time.`;
    await client.query(
      `
        INSERT INTO ${quoteIdentifier(NOTIFICATION_TABLE)} (patient_id, patient_phone, appointment_id, type, title, message)
        VALUES ($1,$2,$3,$4,$5,$6)
      `,
      [row.patient_id, row.patient_phone, row.id, "appointment_transfer", "Appointment transferred", message],
    );

    await insertAudit(client, {
      appointmentId: row.id,
      patientId: row.patient_id,
      patientName: row.patient_name,
      patientPhone: row.patient_phone,
      action: "Transferred",
      oldDoctor: current.doctor,
      newDoctor: transferToDoctor,
      appointmentDate: current.appointment_date,
      oldStartTime: current.appointment_time,
      oldEndTime: current.appointment_end_time,
      newStartTime: nextSlot.start,
      newEndTime: nextSlot.end,
      performedByRole: "doctor",
      performedByName: transferredByName || null,
      performedByUsername: transferredByUsername || null,
    });

    await client.query("COMMIT");
    return NextResponse.json({ row, notification: { title: "Appointment transferred", message } });
  } catch (error) {
    await client.query("ROLLBACK");
    const message = error instanceof Error ? error.message : "Failed to transfer appointment.";
    return NextResponse.json({ error: message }, { status: 400 });
  } finally {
    client.release();
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ Hname: string }> }) {
  try {
    const { Hname } = await params;
    const pool = await getTenantDB(decodeURIComponent(Hname));
    await ensureAll(pool);
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
    const appointmentEndTime = Number.isFinite(timeSlotMinutes) && timeSlotMinutes > 0 ? addMinutes(appointmentTime, timeSlotMinutes) : "";
    const reason = String(body.reason ?? "").trim();

    if (!Number.isInteger(appointmentId) || appointmentId <= 0) return NextResponse.json({ error: "Appointment id is required." }, { status: 400 });
    if (!appointmentDate || !department || !doctor || !patientName || !appointmentTime) return NextResponse.json({ error: "Appointment date, department, doctor, patient name and appointment time are required." }, { status: 400 });
    if (!isValidDate(appointmentDate)) return NextResponse.json({ error: "Invalid appointment date." }, { status: 400 });
    if (!isValidTime(appointmentTime)) return NextResponse.json({ error: "Invalid appointment time." }, { status: 400 });

    const current = await pool.query(
      `SELECT * FROM ${quoteIdentifier(TABLE_NAME)} WHERE id = $1 LIMIT 1`,
      [appointmentId],
    );
    if (current.rowCount === 0) return NextResponse.json({ error: "Appointment not found." }, { status: 404 });

    const currentRow = current.rows[0] as AppointmentRow & { reschedule_count?: number | string | null };
    const currentPatientId = String(currentRow.patient_id ?? "").trim();
    if (patientId && currentPatientId && currentPatientId !== patientId) return NextResponse.json({ error: "You can only reschedule your own appointment." }, { status: 403 });

    const hasScheduleChanged =
      normalizeDateKey(currentRow.appointment_date) !== appointmentDate ||
      normalizeTime(String(currentRow.appointment_time ?? "")) !== appointmentTime ||
      String(currentRow.department ?? "").trim() !== department ||
      String(currentRow.doctor ?? "").trim() !== doctor;
    if (!hasScheduleChanged) return NextResponse.json({ row: currentRow });
    if (Number(currentRow.reschedule_count ?? 0) >= 3) return NextResponse.json({ error: "Appointment can be rescheduled only 3 times." }, { status: 409 });

    const existingSlot = await pool.query(
      `
        SELECT id FROM ${quoteIdentifier(TABLE_NAME)}
        WHERE appointment_date = $1 AND department = $2 AND doctor = $3 AND appointment_time = $4 AND id <> $5
          AND status IN ('Scheduled', 'Rescheduled')
        LIMIT 1
      `,
      [appointmentDate, department, doctor, appointmentTime, appointmentId],
    );
    if ((existingSlot.rowCount ?? 0) > 0) return NextResponse.json({ error: "This appointment time is already booked." }, { status: 409 });

    const updated = await pool.query(
      `
        UPDATE ${quoteIdentifier(TABLE_NAME)}
        SET appointment_date = $1::date, appointment_day = $2, department = $3, doctor = $4,
            patient_name = $5, patient_id = $6, patient_phone = $7, appointment_time = $8::time,
            appointment_end_time = $9::time, time_slot_minutes = $10, patient_type = 'scheduled',
            reason = $11, status = 'Rescheduled', cancelled_by_role = NULL, cancelled_by_name = NULL,
            cancelled_by_username = NULL, cancelled_reason = NULL, cancelled_at = NULL,
            transferred_from_doctor = NULL, transferred_to_doctor = NULL, transferred_by_name = NULL,
            transferred_by_username = NULL, transferred_at = NULL,
            reschedule_history = COALESCE(reschedule_history, '[]'::jsonb) || jsonb_build_array(
              jsonb_build_object('fromDate', appointment_date::text, 'fromTime', appointment_time::text, 'toDate', $1::text, 'toTime', $8::text, 'updatedAt', NOW())
            ),
            reschedule_count = reschedule_count + 1, updated_at = NOW()
        WHERE id = $12
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
        appointmentTime,
        appointmentEndTime || null,
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

export async function DELETE(request: Request, { params }: { params: Promise<{ Hname: string }> }) {
  try {
    const { Hname } = await params;
    const pool = await getTenantDB(decodeURIComponent(Hname));
    await ensureAll(pool);
    const body = (await request.json().catch(() => ({}))) as Partial<AppointmentRecord>;
    const appointmentId = Number(body.appointmentId ?? 0);
    const patientId = String(body.patientId ?? "").trim();
    const department = String(body.department ?? "").trim();
    const doctor = String(body.doctor ?? "").trim();
    const meta: CancellationMeta = {
      cancelledByRole: String(body.cancelledByRole ?? "").trim().toLowerCase() || null,
      cancelledByName: String(body.cancelledByName ?? "").trim() || null,
      cancelledByUsername: String(body.cancelledByUsername ?? "").trim() || null,
      cancellationReason: String(body.cancellationReason ?? "").trim() || null,
    };

    let targetId = appointmentId;
    if (!Number.isInteger(targetId) || targetId <= 0) {
      if (!patientId || !department || !doctor) return NextResponse.json({ error: "Appointment id or patient, department and doctor are required." }, { status: 400 });
      const existing = await pool.query(
        `
          SELECT id FROM ${quoteIdentifier(TABLE_NAME)}
          WHERE patient_id = $1 AND department = $2 AND doctor = $3 AND status IN ('Scheduled', 'Rescheduled')
          ORDER BY updated_at DESC, created_at DESC LIMIT 1
        `,
        [patientId, department, doctor],
      );
      if (existing.rowCount === 0) return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
      targetId = Number(existing.rows[0]?.id ?? 0);
    }

    const cancelled = await cancelAppointmentById(pool, targetId, meta);
    if (!cancelled) return NextResponse.json({ error: "Appointment not found." }, { status: 404 });

    await insertAudit(pool, {
      appointmentId: cancelled.id,
      patientId: cancelled.patient_id,
      patientName: cancelled.patient_name,
      patientPhone: cancelled.patient_phone,
      action: "Cancelled",
      oldDoctor: cancelled.doctor,
      appointmentDate: normalizeDateKey(cancelled.appointment_date),
      oldStartTime: cancelled.appointment_time,
      oldEndTime: cancelled.appointment_end_time,
      performedByRole: meta.cancelledByRole,
      performedByName: meta.cancelledByName,
      performedByUsername: meta.cancelledByUsername,
      remarks: meta.cancellationReason,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to cancel appointment.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
