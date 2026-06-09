import { NextResponse } from "next/server";
import { getTenantDB } from "../../../../lib/db";
import { quoteIdentifier } from "../../../../lib/master-form-table";

export const runtime = "nodejs";

const TABLE_NAME = "appointments";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ Hname: string }> },
) {
  try {
    const { Hname } = await params;
    const decodedHname = decodeURIComponent(Hname);
    const pool = await getTenantDB(decodedHname);

    const body = await request.json();
    const { patientName, patientPhone, department, doctor, patientId, isWalkIn } = body;

    // First ensure the appointments table has check_in_time and status altered/supported
    await pool.query(`
      ALTER TABLE ${quoteIdentifier(TABLE_NAME)}
      ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMPTZ
    `);

    // Walk-in Registration Completion Flow
    if (isWalkIn) {
      if (!patientId || !patientName || !department || !doctor) {
        return NextResponse.json(
          { error: "Walk-in registration requires patientId, patientName, department, and doctor." },
          { status: 400 },
        );
      }

      const today = new Date().toISOString().split("T")[0];
      const dayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
      const currentTime = new Date().toTimeString().split(" ")[0];

      await pool.query(
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
        `,
        [
          today,
          dayName,
          department,
          doctor,
          patientName,
          patientId,
          patientPhone || null,
          currentTime,
          "walk-in"
        ]
      );

      return NextResponse.json({ success: true });
    }

    // Regular Check-in/Verification Flow (Scheduled Check)
    if (!patientName || !department || !doctor) {
      return NextResponse.json(
        { error: "Patient name, department, and doctor are required for check-in check." },
        { status: 400 },
      );
    }

    const today = new Date().toISOString().split("T")[0];

    // Query for a scheduled appointment today with this doctor and department
    let query = `
      SELECT id, patient_id, patient_name, patient_phone
      FROM ${quoteIdentifier(TABLE_NAME)}
      WHERE LOWER(patient_name) = LOWER($1)
        AND appointment_date = $2
        AND LOWER(doctor) = LOWER($3)
        AND LOWER(department) = LOWER($4)
        AND status IN ('Scheduled', 'Rescheduled')
    `;
    const queryParams: any[] = [patientName.trim(), today, doctor.trim(), department.trim()];

    if (patientPhone && patientPhone.trim()) {
      query += ` AND (patient_phone = $5 OR regexp_replace(patient_phone, '\\D', '', 'g') = regexp_replace($5, '\\D', '', 'g'))`;
      queryParams.push(patientPhone.trim());
    }

    query += ` ORDER BY appointment_time ASC LIMIT 1`;

    const result = await pool.query(query, queryParams);

    if (result.rowCount && result.rowCount > 0) {
      const appointment = result.rows[0];
      // Mark check_in_time and update record
      await pool.query(
        `
          UPDATE ${quoteIdentifier(TABLE_NAME)}
          SET check_in_time = NOW(),
              updated_at = NOW()
          WHERE id = $1
        `,
        [appointment.id]
      );

      return NextResponse.json({
        type: "scheduled",
        appointmentId: appointment.id,
        patientId: appointment.patient_id,
        patientName: appointment.patient_name,
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
