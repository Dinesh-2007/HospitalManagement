import { NextResponse } from "next/server";
import { getTenantDB } from "../../../../lib/db";
import { quoteIdentifier } from "../../../../lib/master-form-table";

export const runtime = "nodejs";

const CONSULTATION_TABLE = "doctor_consultation_entry";
const APPOINTMENTS_TABLE = "appointments";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ Hname: string }> }
) {
    try {
        const { Hname } = await params;
        const pool = await getTenantDB(decodeURIComponent(Hname));
        const { searchParams } = new URL(request.url);

        const page = Math.max(1, Number(searchParams.get("page") ?? 1));
        const pageSize = Math.max(1, Math.min(100, Number(searchParams.get("pageSize") ?? 10)));
        const doctor = searchParams.get("doctor") ?? "";
        const department = searchParams.get("department") ?? "";
        const search = searchParams.get("search") ?? "";
        const patientNameFilter = searchParams.get("patientName") ?? ""; // To get visits for a specific patient

        const offset = (page - 1) * pageSize;

        if (patientNameFilter) {
            // Get all appointments (visits) for a specific patient
            // JOIN with consultation to show status and record availability
            const sql = `
        SELECT 
          a.id as app_id,
          a.appointment_date,
          a.appointment_time,
          a.doctor as app_doctor,
          a.department as app_department,
          a.status as app_status,
          a.patient_name as app_patient_name,
          a.patient_id as app_patient_id,
          a.id as app_id,
          c.id as consultation_id,
          c.status as consultation_status,
          v.id as vitals_id,
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
          v.remarks as vitals_remarks,
          EXISTS(SELECT 1 FROM ${quoteIdentifier("pharmacy_dispensing")} ph WHERE ph.token_number = a.id::text) as has_pharmacy,
          c.* 
        FROM ${quoteIdentifier(APPOINTMENTS_TABLE)} a
        LEFT JOIN ${quoteIdentifier(CONSULTATION_TABLE)} c ON a.id = (CASE WHEN c.token_number ~ '^[0-9]+$' THEN CAST(c.token_number AS BIGINT) ELSE NULL END)
        LEFT JOIN ${quoteIdentifier("vitals")} v ON v.patient_id = a.patient_id
        WHERE a.patient_name = $1
        ORDER BY a.appointment_date DESC, a.appointment_time DESC
      `;
            const result = await pool.query(sql, [patientNameFilter]);
            return NextResponse.json({ rows: result.rows });
        }

        // Main query: Unique patients who have had at least one appointment
        const values: any[] = [];
        let whereClause = "WHERE 1=1";

        if (doctor) {
            values.push(doctor);
            whereClause += ` AND a.doctor = $${values.length}`;
        }
        if (department) {
            values.push(department);
            whereClause += ` AND a.department = $${values.length}`;
        }
        if (search) {
            values.push(`%${search.toLowerCase()}%`);
            whereClause += ` AND (LOWER(a.patient_name) LIKE $${values.length} OR LOWER(COALESCE(a.patient_id, '')) LIKE $${values.length})`;
        }

        const countSql = `
      SELECT COUNT(DISTINCT a.patient_name) as total
      FROM ${quoteIdentifier(APPOINTMENTS_TABLE)} a
      ${whereClause}
    `;
        const countResult = await pool.query(countSql, values);
        const totalCount = Number(countResult.rows[0]?.total ?? 0);

        const mainSql = `
      SELECT 
        a.patient_name,
        MAX(a.patient_id) as patient_id,
        MAX(a.patient_phone) as patient_phone,
        COUNT(a.id) as total_visits,
        MAX(a.appointment_date) as last_visit,
        MAX(a.department) as department,
        MAX(a.status) as last_appointment_status
      FROM ${quoteIdentifier(APPOINTMENTS_TABLE)} a
      ${whereClause}
      GROUP BY a.patient_name
      ORDER BY last_visit DESC, a.patient_name ASC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;

        const mainValues = [...values, pageSize, offset];
        const result = await pool.query(mainSql, mainValues);

        return NextResponse.json({
            rows: result.rows,
            totalCount,
            page,
            pageSize
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch patient records.";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
