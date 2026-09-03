import { NextResponse } from "next/server";
import { getTenantDB } from "../../../../lib/db";
import { quoteIdentifier } from "../../../../lib/master-form-table";
import type { Pool } from "pg";
import { getHospitalTimezone, getDateCompactInTimezone } from "../../../../lib/timezone";

export const runtime = "nodejs";

const INVOICE_TABLE = "billing_invoice";
const DISPENSING_TABLE = "pharmacy_dispensing";
const CONSULTATION_TABLE = "doctor_consultation_entry";

async function ensureBillingInvoiceTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(INVOICE_TABLE)} (
      id BIGSERIAL PRIMARY KEY,
      invoice_number TEXT UNIQUE NOT NULL,
      patient_name TEXT NOT NULL,
      patient_phone TEXT,
      token_number TEXT NOT NULL,
      billing_type TEXT NOT NULL, -- 'Pharmacy' or 'Consultation'
      subtotal NUMERIC NOT NULL,
      registration_fee NUMERIC DEFAULT 0,
      tax_amount NUMERIC DEFAULT 0,
      discount_amount NUMERIC DEFAULT 0,
      payable_amount NUMERIC NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'Pending', -- 'Paid' or 'Pending'
      payment_method TEXT, -- 'Card', 'UPI', 'Cash', 'Insurance'
      transaction_id TEXT,
      doctor_name TEXT,
      details TEXT, -- JSON structure of line items
      remarks TEXT,
      patient_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE ${quoteIdentifier(INVOICE_TABLE)} ADD COLUMN IF NOT EXISTS registration_fee NUMERIC DEFAULT 0`);
  await pool.query(`ALTER TABLE ${quoteIdentifier(INVOICE_TABLE)} ADD COLUMN IF NOT EXISTS remarks TEXT`);
  await pool.query(`ALTER TABLE ${quoteIdentifier(INVOICE_TABLE)} ADD COLUMN IF NOT EXISTS patient_id TEXT`);

  try {
    await pool.query(`ALTER TABLE ${quoteIdentifier(CONSULTATION_TABLE)} ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'Unbilled'`);
  } catch (err) {
    // Ignore if table doesn't exist yet
  }
}

// Helper to format date into YYYYMMDD in the hospital's timezone
function getFormattedDateCompact(timezone: string): string {
  return getDateCompactInTimezone(timezone);
}

async function generateInvoiceNumber(pool: Pool, timezone: string): Promise<string> {
  const dateStr = getFormattedDateCompact(timezone);
  const likePattern = `INV-${dateStr}-%`;
  const result = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*) as cnt FROM ${quoteIdentifier(INVOICE_TABLE)} WHERE invoice_number LIKE $1`,
    [likePattern]
  );
  const count = (Number(result.rows[0]?.cnt) || 0) + 1;
  return `INV-${dateStr}-${String(count).padStart(4, "0")}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ Hname: string }> }
) {
  try {
    const { Hname } = await params;
    const pool = await getTenantDB(decodeURIComponent(Hname));
    const { searchParams } = new URL(request.url);

    await ensureBillingInvoiceTable(pool);

    const action = searchParams.get("action");
    const patientPhone = searchParams.get("patientPhone");
    const patientName = searchParams.get("patientName");

    const search = searchParams.get("search");

    // Action 1: Get past billing history for a patient
    if (action === "history") {
      let queryStr = `SELECT * FROM ${quoteIdentifier(INVOICE_TABLE)} WHERE 1=1`;
      let paramsArr: any[] = [];
      let nextParam = 1;

      if (search) {
        queryStr += ` AND (LOWER(invoice_number) LIKE LOWER($${nextParam}) OR LOWER(patient_name) LIKE LOWER($${nextParam}) OR patient_phone LIKE $${nextParam} OR LOWER(doctor_name) LIKE LOWER($${nextParam}) OR LOWER(patient_id) LIKE LOWER($${nextParam}))`;
        paramsArr.push(`%${search}%`);
        nextParam++;
      } else if (patientName || patientPhone) {
        queryStr += ` AND (LOWER(patient_name) = LOWER($${nextParam}) OR patient_phone = $${nextParam + 1})`;
        paramsArr.push(patientName || "", patientPhone || "");
        nextParam += 2;
      }

      queryStr += ` ORDER BY created_at DESC LIMIT 100`;

      const invoices = await pool.query(queryStr, paramsArr);

      return NextResponse.json({ invoices: invoices.rows });
    }

    // Action 2: Check consultation visit history to determine if First Visit or Follow-up
    if (action === "check-followup") {
      const doctor = searchParams.get("doctor");
      const diagnosis = searchParams.get("diagnosis");

      if (!patientName || !doctor || !diagnosis) {
        return NextResponse.json({ error: "patientName, doctor, and diagnosis are required for follow-up check." }, { status: 400 });
      }

      // Query past completed consultations
      const pastConsultations = await pool.query(
        `
          SELECT * FROM ${quoteIdentifier(CONSULTATION_TABLE)}
          WHERE 
            LOWER(patient_details) = LOWER($1)
            AND doctor = $2
            AND LOWER(diagnosis_name) = LOWER($3)
            AND status = 'Completed'
          ORDER BY created_at ASC
        `,
        [patientName, doctor, diagnosis]
      );

      const isFollowUp = (pastConsultations.rowCount ?? 0) > 0;
      const originalVisit = isFollowUp ? pastConsultations.rows[0] : null;

      return NextResponse.json({
        isFollowUp,
        originalVisitDate: originalVisit ? originalVisit.created_at : null,
        pastVisitsCount: pastConsultations.rowCount ?? 0,
      });
    }

    // Action 3: Fetch pending (uninvoiced) consultations & dispensings
    if (action === "pending") {
      // 3a. Uninvoiced consultations
      const consultations = await pool.query(
        `
          SELECT c.*, a.patient_id, a.patient_phone, a.patient_type as visit_type, a.department, a.appointment_date, a.appointment_time
          FROM ${quoteIdentifier(CONSULTATION_TABLE)} c
          LEFT JOIN appointments a ON a.id = (CASE WHEN c.token_number ~ '^[0-9]+$' THEN CAST(c.token_number AS BIGINT) ELSE NULL END)
          LEFT JOIN ${quoteIdentifier(INVOICE_TABLE)} b ON b.token_number = c.token_number AND b.billing_type = 'Consultation'
          WHERE c.status = 'Completed' AND (c.billing_status = 'Unbilled' OR c.billing_status IS NULL) AND b.id IS NULL
          ORDER BY c.created_at DESC
        `
      );

      // 3b. Uninvoiced pharmacy dispensings
      const dispensings = await pool.query(
        `
          SELECT d.*,
                 COALESCE(
                   NULLIF(d.patient_phone, ''),
                   appt.patient_phone
                 ) AS patient_phone,
                 appt.patient_id
          FROM ${quoteIdentifier(DISPENSING_TABLE)} d
          LEFT JOIN ${quoteIdentifier(INVOICE_TABLE)} b ON b.token_number = d.token_number AND b.billing_type = 'Pharmacy'
          LEFT JOIN appointments appt ON appt.id::text = d.token_number::text
          WHERE b.id IS NULL
          ORDER BY d.created_at DESC
        `
      );

      // 3c. Uninvoiced discharge room billings
      let dischargesRows: any[] = [];
      try {
        const tableCheck = await pool.query(
          `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bed_allocation')`
        );
        if (Boolean(tableCheck.rows[0]?.exists)) {
          const discharges = await pool.query(
            `
              SELECT ba.*,
                     COALESCE(
                       (SELECT appt.patient_phone FROM appointments appt WHERE appt.patient_id = ba.patient_id LIMIT 1),
                       ''
                     ) AS patient_phone,
                     COALESCE(
                       (SELECT SUM(COALESCE(bbl.total_amount, 0)) FROM bed_billing_line bbl WHERE bbl.patient_id = ba.patient_id),
                       500
                     ) AS billing_amount
              FROM bed_allocation ba
              LEFT JOIN ${quoteIdentifier(INVOICE_TABLE)} b ON (b.patient_id = ba.patient_id OR b.token_number = ba.patient_id) AND b.billing_type = 'Discharge'
              WHERE b.id IS NULL
              ORDER BY ba.allocated_at DESC
            `
          );
          dischargesRows = discharges.rows;
        }
      } catch (err) {
        console.error("Failed to fetch pending discharges:", err);
      }

      return NextResponse.json({
        pendingConsultations: consultations.rows,
        pendingDispensings: dispensings.rows,
        pendingDischarges: dischargesRows,
      });
    }

    // Default action: get all invoices
    let allInvoices;
    if (search) {
      allInvoices = await pool.query(
        `SELECT * FROM ${quoteIdentifier(INVOICE_TABLE)}
         WHERE 
           LOWER(invoice_number) LIKE LOWER($1) OR
           LOWER(patient_name) LIKE LOWER($1) OR
           patient_phone LIKE $1 OR
           LOWER(doctor_name) LIKE LOWER($1) OR
           LOWER(patient_id) LIKE LOWER($1)
         ORDER BY created_at DESC LIMIT 100`,
        [`%${search}%`]
      );
    } else {
      allInvoices = await pool.query(
        `SELECT * FROM ${quoteIdentifier(INVOICE_TABLE)} ORDER BY created_at DESC LIMIT 100`
      );
    }

    return NextResponse.json({ invoices: allInvoices.rows });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch invoices.";
    console.error("[billing GET] failed:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ Hname: string }> }
) {
  try {
    const { Hname } = await params;
    const decodedHname = decodeURIComponent(Hname);
    const pool = await getTenantDB(decodedHname);
    const tz = await getHospitalTimezone(decodedHname);
    const body = await request.json();

    const {
      patientName,
      patientPhone,
      tokenNumber,
      billingType,
      subtotal,
      registrationFee,
      taxAmount,
      discountAmount,
      payableAmount,
      paymentStatus,
      paymentMethod,
      transactionId,
      doctorName,
      details,
      remarks,
      patientId,
    } = body;

    if (!patientName || !tokenNumber || !billingType || subtotal === undefined || payableAmount === undefined) {
      return NextResponse.json({ error: "Missing required billing details." }, { status: 400 });
    }

    await ensureBillingInvoiceTable(pool);

    // Rule: check if visit-level discount is already applied to this visit (same token_number)
    if (discountAmount > 0) {
      const existingDiscountResult = await pool.query(
        `SELECT COUNT(*) as cnt FROM ${quoteIdentifier(INVOICE_TABLE)} WHERE token_number = $1 AND discount_amount > 0`,
        [tokenNumber]
      );
      const discountCount = Number(existingDiscountResult.rows[0]?.cnt || 0);
      if (discountCount > 0) {
        return NextResponse.json({
          error: "A visit-level discount has already been applied to another invoice for this visit (Token: " + tokenNumber + "). To prevent double-discounting, you cannot apply another discount to this invoice."
        }, { status: 400 });
      }
    }

    // Generate invoice number (uses hospital timezone so date prefix is local, not UTC)
    const invoiceNumber = await generateInvoiceNumber(pool, tz.timezone);

    const result = await pool.query(
      `
        INSERT INTO ${quoteIdentifier(INVOICE_TABLE)} (
          invoice_number,
          patient_name,
          patient_phone,
          token_number,
          billing_type,
          subtotal,
          registration_fee,
          tax_amount,
          discount_amount,
          payable_amount,
          payment_status,
          payment_method,
          transaction_id,
          doctor_name,
          details,
          remarks,
          patient_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *
      `,
      [
        invoiceNumber,
        patientName,
        patientPhone || null,
        tokenNumber,
        billingType,
        subtotal,
        registrationFee || 0,
        taxAmount || 0,
        discountAmount || 0,
        payableAmount,
        paymentStatus || "Pending",
        paymentMethod || null,
        transactionId || null,
        doctorName || null,
        typeof details === "object" ? JSON.stringify(details) : details || null,
        remarks || null,
        patientId || null,
      ]
    );

    const newInvoice = result.rows[0];

    if (billingType === "Pharmacy") {
      await pool.query(
        `
          UPDATE ${quoteIdentifier(DISPENSING_TABLE)}
          SET payment_status = $1
          WHERE token_number = $2
        `,
        [paymentStatus || "Pending", tokenNumber]
      );
    }
    
    // Sync status: update original doctor_consultation_entry record if it's a Consultation invoice
    if (billingType === "Consultation") {
      try {
        await pool.query(
          `
            UPDATE ${quoteIdentifier(CONSULTATION_TABLE)}
            SET billing_status = $1
            WHERE token_number = $2
          `,
          [paymentStatus === "Paid" ? "Billed" : "Unbilled", tokenNumber]
        );
      } catch (err) {
        console.error("Could not update doctor_consultation_entry billing_status:", err);
      }
    }

    return NextResponse.json({ invoice: newInvoice }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to create invoice.";
    console.error("[billing POST] failed:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ Hname: string }> }
) {
  try {
    const { Hname } = await params;
    const pool = await getTenantDB(decodeURIComponent(Hname));
    const body = await request.json();

    const {
      id,
      paymentStatus,
      paymentMethod,
      transactionId,
    } = body;

    if (!id || !paymentStatus) {
      return NextResponse.json({ error: "Invoice ID and paymentStatus are required." }, { status: 400 });
    }

    await ensureBillingInvoiceTable(pool);

    const result = await pool.query(
      `
        UPDATE ${quoteIdentifier(INVOICE_TABLE)}
        SET 
          payment_status = $1,
          payment_method = COALESCE($2, payment_method),
          transaction_id = COALESCE($3, transaction_id),
          updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `,
      [paymentStatus, paymentMethod || null, transactionId || null, id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    }

    const updatedInvoice = result.rows[0];

    if (updatedInvoice.billing_type === "Pharmacy") {
      await pool.query(
        `
          UPDATE ${quoteIdentifier(DISPENSING_TABLE)}
          SET payment_status = $1
          WHERE token_number = $2
        `,
        [paymentStatus, updatedInvoice.token_number]
      );
    }

    if (updatedInvoice.billing_type === "Consultation") {
      try {
        await pool.query(
          `
            UPDATE ${quoteIdentifier(CONSULTATION_TABLE)}
            SET billing_status = $1
            WHERE token_number = $2
          `,
          [paymentStatus === "Paid" ? "Billed" : "Unbilled", updatedInvoice.token_number]
        );
      } catch (err) {
        console.error("Could not update doctor_consultation_entry billing_status:", err);
      }
    }

    return NextResponse.json({ invoice: updatedInvoice });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to process payment.";
    console.error("[billing PUT] failed:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
