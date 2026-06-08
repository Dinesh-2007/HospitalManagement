import { NextResponse } from "next/server";
import { getTenantDB } from "../../../../lib/db";
import { quoteIdentifier } from "../../../../lib/master-form-table";

export const runtime = "nodejs";

const TABLE_NAME = "doctor_profile";

async function ensureTable(pool: Awaited<ReturnType<typeof getTenantDB>>) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(TABLE_NAME)} (
      id BIGSERIAL PRIMARY KEY,
      doctor_id TEXT,
      doctor_code TEXT,
      first_name TEXT,
      last_name TEXT,
      gender TEXT,
      date_of_birth DATE,
      blood_group TEXT,
      marital_status TEXT,
      profile_photo TEXT,
      mobile_number TEXT,
      alternate_mobile_number TEXT,
      email_id TEXT,
      emergency_contact_number TEXT,
      address TEXT,
      country TEXT,
      state TEXT,
      city TEXT,
      pincode TEXT,
      registration_number TEXT,
      specialization TEXT,
      department TEXT,
      qualification TEXT,
      experience_years TEXT,
      designation TEXT,
      license_number TEXT,
      employee_type TEXT,
      shift TEXT,
      bank_name TEXT,
      account_number TEXT,
      ifsc_code TEXT,
      pan_number TEXT,
      aadhaar_number TEXT,
      username TEXT UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ Hname: string }> },
) {
  try {
    const { Hname } = await params;
    const hname = decodeURIComponent(Hname);
    const pool = await getTenantDB(hname);
    await ensureTable(pool);
    const rows = await pool.query(`SELECT * FROM ${quoteIdentifier(TABLE_NAME)} ORDER BY id DESC LIMIT 1`);
    return NextResponse.json({ row: rows.rows[0] ?? null });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load profile." },
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
    const hname = decodeURIComponent(Hname);
    const pool = await getTenantDB(hname);
    await ensureTable(pool);

    const body = (await request.json()) as Record<string, unknown>;
    const values = [
      String(body.doctorId ?? ""),
      String(body.doctorCode ?? ""),
      String(body.firstName ?? ""),
      String(body.lastName ?? ""),
      String(body.gender ?? ""),
      body.dateOfBirth ? String(body.dateOfBirth) : null,
      String(body.bloodGroup ?? ""),
      String(body.maritalStatus ?? ""),
      String(body.profilePhoto ?? ""),
      String(body.mobileNumber ?? ""),
      String(body.alternateMobileNumber ?? ""),
      String(body.emailId ?? ""),
      String(body.emergencyContactNumber ?? ""),
      String(body.address ?? ""),
      String(body.country ?? ""),
      String(body.state ?? ""),
      String(body.city ?? ""),
      String(body.pincode ?? ""),
      String(body.registrationNumber ?? ""),
      String(body.specialization ?? ""),
      String(body.department ?? ""),
      String(body.qualification ?? ""),
      String(body.experienceYears ?? ""),
      String(body.designation ?? ""),
      String(body.licenseNumber ?? ""),
      String(body.employeeType ?? ""),
      String(body.shift ?? ""),
      String(body.bankName ?? ""),
      String(body.accountNumber ?? ""),
      String(body.ifscCode ?? ""),
      String(body.panNumber ?? ""),
      String(body.aadhaarNumber ?? ""),
      String(body.username ?? ""),
    ];

    const existing = await pool.query(
      `SELECT id FROM ${quoteIdentifier(TABLE_NAME)} WHERE username = $1 LIMIT 1`,
      [String(body.username ?? "")],
    );

    if ((existing.rowCount ?? 0) > 0) {
      await pool.query(
        `
          UPDATE ${quoteIdentifier(TABLE_NAME)}
          SET doctor_id = $1,
              doctor_code = $2,
              first_name = $3,
              last_name = $4,
              gender = $5,
              date_of_birth = $6,
              blood_group = $7,
              marital_status = $8,
              profile_photo = $9,
              mobile_number = $10,
              alternate_mobile_number = $11,
              email_id = $12,
              emergency_contact_number = $13,
              address = $14,
              country = $15,
              state = $16,
              city = $17,
              pincode = $18,
              registration_number = $19,
              specialization = $20,
              department = $21,
              qualification = $22,
              experience_years = $23,
              designation = $24,
              license_number = $25,
              employee_type = $26,
              shift = $27,
              bank_name = $28,
              account_number = $29,
              ifsc_code = $30,
              pan_number = $31,
              aadhaar_number = $32,
              updated_at = NOW()
          WHERE username = $33
        `,
        values,
      );
    } else {
      await pool.query(
        `
          INSERT INTO ${quoteIdentifier(TABLE_NAME)} (
            doctor_id, doctor_code, first_name, last_name, gender, date_of_birth,
            blood_group, marital_status, profile_photo, mobile_number,
            alternate_mobile_number, email_id, emergency_contact_number, address,
            country, state, city, pincode, registration_number, specialization,
            department, qualification, experience_years, designation, license_number,
            employee_type, shift, bank_name, account_number, ifsc_code, pan_number,
            aadhaar_number, username
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
            $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
            $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
            $31,$32,$33
          )
        `,
        values,
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save profile." },
      { status: 400 },
    );
  }
}
