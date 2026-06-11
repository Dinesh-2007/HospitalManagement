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
      nationality TEXT,
      profile_photo TEXT,
      mobile_number TEXT,
      alternate_mobile_number TEXT,
      email_id TEXT,
      personal_email TEXT,
      address TEXT,
      country TEXT,
      state TEXT,
      city TEXT,
      pincode TEXT,
      registration_number TEXT,
      medical_council_name TEXT,
      registration_date DATE,
      license_expiry_date DATE,
      mbbs_college_name TEXT,
      mbbs_university TEXT,
      mbbs_graduation_year TEXT,
      higher_qualification TEXT,
      higher_qualification_institution TEXT,
      higher_qualification_completion_year TEXT,
      specialization TEXT,
      department TEXT,
      designation TEXT,
      license_number TEXT,
      experience_years TEXT,
      employee_type TEXT,
      shift TEXT,
      bank_name TEXT,
      account_holder_name TEXT,
      account_number TEXT,
      ifsc_code TEXT,
      pan_number TEXT,
      aadhaar_number TEXT,
      documents TEXT,
      document_name TEXT,
      document_attachment TEXT,
      emergency_contacts TEXT,
      work_experiences TEXT,
      certifications TEXT,
      username TEXT UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ Hname: string }> },
) {
  try {
    const { Hname } = await params;
    const hname = decodeURIComponent(Hname);
    const pool = await getTenantDB(hname);
    await ensureTable(pool);
    const { searchParams } = new URL(request.url);
    const username = String(searchParams.get("username") ?? "").trim();
    const doctorId = String(searchParams.get("doctorId") ?? "").trim();
    const doctorCode = String(searchParams.get("doctorCode") ?? "").trim();
    const doctorName = String(searchParams.get("doctorName") ?? "").trim();
    const rows = username
      ? await pool.query(
          `SELECT * FROM ${quoteIdentifier(TABLE_NAME)} WHERE username = $1 LIMIT 1`,
          [username],
        )
      : doctorId
        ? await pool.query(
            `SELECT * FROM ${quoteIdentifier(TABLE_NAME)} WHERE doctor_id = $1 LIMIT 1`,
            [doctorId],
          )
        : doctorCode
          ? await pool.query(
              `SELECT * FROM ${quoteIdentifier(TABLE_NAME)} WHERE doctor_code = $1 LIMIT 1`,
              [doctorCode],
            )
      : doctorName
        ? await pool.query(
            `
              SELECT *
              FROM ${quoteIdentifier(TABLE_NAME)}
              WHERE lower(trim(first_name)) = lower(trim($1))
                 OR lower(trim(first_name)) LIKE lower(trim($1)) || '%'
                 OR lower(concat_ws(' ', first_name, last_name)) = lower(trim($1))
                 OR lower(concat_ws(' ', first_name, last_name)) LIKE lower(trim($1)) || '%'
                 OR lower(trim(last_name)) = lower(trim($1))
                 OR lower(doctor_id) = lower(trim($1))
                 OR lower(doctor_code) = lower(trim($1))
              ORDER BY id DESC
              LIMIT 1
            `,
            [doctorName],
          )
      : await pool.query(`SELECT * FROM ${quoteIdentifier(TABLE_NAME)} ORDER BY id DESC LIMIT 1`);
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
      String(body.nationality ?? ""),
      String(body.profilePhoto ?? ""),
      String(body.mobileNumber ?? ""),
      String(body.alternateMobileNumber ?? ""),
      String(body.emailId ?? ""),
      String(body.personalEmail ?? ""),
      String(body.address ?? ""),
      String(body.country ?? ""),
      String(body.state ?? ""),
      String(body.city ?? ""),
      String(body.pincode ?? ""),
      String(body.registrationNumber ?? ""),
      String(body.medicalCouncilName ?? ""),
      body.registrationDate ? String(body.registrationDate) : null,
      body.licenseExpiryDate ? String(body.licenseExpiryDate) : null,
      String(body.mbbsCollegeName ?? ""),
      String(body.mbbsUniversity ?? ""),
      String(body.mbbsGraduationYear ?? ""),
      String(body.higherQualification ?? ""),
      String(body.higherQualificationInstitution ?? ""),
      String(body.higherQualificationCompletionYear ?? ""),
      String(body.specialization ?? ""),
      String(body.department ?? ""),
      String(body.designation ?? ""),
      String(body.licenseNumber ?? ""),
      String(body.experienceYears ?? ""),
      String(body.employeeType ?? ""),
      String(body.shift ?? ""),
      String(body.bankName ?? ""),
      String(body.accountHolderName ?? ""),
      String(body.accountNumber ?? ""),
      String(body.ifscCode ?? ""),
      String(body.panNumber ?? ""),
      String(body.aadhaarNumber ?? ""),
      String(body.documents ?? ""),
      String(body.documentName ?? ""),
      String(body.documentAttachment ?? ""),
      String(body.emergencyContacts ?? ""),
      String(body.workExperiences ?? ""),
      String(body.certifications ?? ""),
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
              nationality = $9,
              profile_photo = $10,
              mobile_number = $11,
              alternate_mobile_number = $12,
              email_id = $13,
              personal_email = $14,
              address = $15,
              country = $16,
              state = $17,
              city = $18,
              pincode = $19,
              registration_number = $20,
              medical_council_name = $21,
              registration_date = $22,
              license_expiry_date = $23,
              mbbs_college_name = $24,
              mbbs_university = $25,
              mbbs_graduation_year = $26,
              higher_qualification = $27,
              higher_qualification_institution = $28,
              higher_qualification_completion_year = $29,
              specialization = $30,
              department = $31,
              designation = $32,
              license_number = $33,
              experience_years = $34,
              employee_type = $35,
              shift = $36,
              bank_name = $37,
              account_holder_name = $38,
              account_number = $39,
              ifsc_code = $40,
              pan_number = $41,
              aadhaar_number = $42,
              documents = $43,
              document_name = $44,
              document_attachment = $45,
              emergency_contacts = $46,
              work_experiences = $47,
              certifications = $48,
              updated_at = NOW()
          WHERE username = $49
        `,
        values,
      );
    } else {
      await pool.query(
        `
          INSERT INTO ${quoteIdentifier(TABLE_NAME)} (
            doctor_id, doctor_code, first_name, last_name, gender, date_of_birth,
            blood_group, marital_status, nationality, profile_photo, mobile_number,
            alternate_mobile_number, email_id, personal_email, address,
            country, state, city, pincode, registration_number,
            medical_council_name, registration_date, license_expiry_date,
            mbbs_college_name, mbbs_university, mbbs_graduation_year,
            higher_qualification, higher_qualification_institution,
            higher_qualification_completion_year, specialization, department,
            designation, license_number, experience_years, employee_type, shift,
            bank_name, account_holder_name, account_number, ifsc_code, pan_number,
            aadhaar_number, documents, document_name, document_attachment,
            emergency_contacts, work_experiences, certifications, username
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
            $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
            $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
            $31,$32,$33,$34,$35,$36,$37,$38,$39,$40,
            $41,$42,$43,$44,$45,$46,$47,$48,$49
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
