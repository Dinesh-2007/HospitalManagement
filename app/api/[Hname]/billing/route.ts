import { NextResponse } from "next/server";
import { getTenantDB } from "../../../../lib/db";
import { quoteIdentifier } from "../../../../lib/master-form-table";
import type { Pool } from "pg";

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
      tax_amount NUMERIC DEFAULT 0,
      discount_amount NUMERIC DEFAULT 0,
      payable_amount NUMERIC NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'Pending', -- 'Paid' or 'Pending'
      payment_method TEXT, -- 'Card', 'UPI', 'Cash', 'Insurance'
      transaction_id TEXT,
      doctor_name TEXT,
      details TEXT, -- JSON structure of line items
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

// Helper to format date into YYYYMMDD
function getFormattedDateCompact(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

async function generateInvoiceNumber(pool: Pool): Promise<string> {
  const dateStr = getFormattedDateCompact();
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

    // Action 1: Get past billing history for a patient
    if (action === "history") {
      if (!patientName && !patientPhone) {
        return NextResponse.json({ error: "Patient name or phone is required for history." }, { status: 400 });
      }
      
      const invoices = await pool.query(
        `
          SELECT * FROM ${quoteIdentifier(INVOICE_TABLE)}
          WHERE 
            LOWER(patient_name) = LOWER($1)
            OR patient_phone = $2
          ORDER BY created_at DESC
        `,
        [patientName || "", patientPhone || ""]
      );

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
          SELECT c.*
          FROM ${quoteIdentifier(CONSULTATION_TABLE)} c
          LEFT JOIN ${quoteIdentifier(INVOICE_TABLE)} b ON b.token_number = c.token_number AND b.billing_type = 'Consultation'
          WHERE c.status = 'Completed' AND b.id IS NULL
          ORDER BY c.created_at DESC
        `
      );

      // 3b. Uninvoiced pharmacy dispensings
      const dispensings = await pool.query(
        `
          SELECT d.*
          FROM ${quoteIdentifier(DISPENSING_TABLE)} d
          LEFT JOIN ${quoteIdentifier(INVOICE_TABLE)} b ON b.token_number = d.token_number AND b.billing_type = 'Pharmacy'
          WHERE b.id IS NULL
          ORDER BY d.created_at DESC
        `
      );

      return NextResponse.json({
        pendingConsultations: consultations.rows,
        pendingDispensings: dispensings.rows,
      });
    }

    // Default action: get all invoices
    const allInvoices = await pool.query(
      `SELECT * FROM ${quoteIdentifier(INVOICE_TABLE)} ORDER BY created_at DESC LIMIT 100`
    );

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
    const pool = await getTenantDB(decodeURIComponent(Hname));
    const body = await request.json();

    const {
      patientName,
      patientPhone,
      tokenNumber,
      billingType,
      subtotal,
      taxAmount,
      discountAmount,
      payableAmount,
      paymentStatus,
      paymentMethod,
      transactionId,
      doctorName,
      details,
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

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(pool);

    const result = await pool.query(
      `
        INSERT INTO ${quoteIdentifier(INVOICE_TABLE)} (
          invoice_number,
          patient_name,
          patient_phone,
          token_number,
          billing_type,
          subtotal,
          tax_amount,
          discount_amount,
          payable_amount,
          payment_status,
          payment_method,
          transaction_id,
          doctor_name,
          details
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `,
      [
        invoiceNumber,
        patientName,
        patientPhone || null,
        tokenNumber,
        billingType,
        subtotal,
        taxAmount || 0,
        discountAmount || 0,
        payableAmount,
        paymentStatus || "Pending",
        paymentMethod || null,
        transactionId || null,
        doctorName || null,
        typeof details === "object" ? JSON.stringify(details) : details || null,
      ]
    );

    const newInvoice = result.rows[0];

    // Sync status: update original pharmacy dispensing record if it's a pharmacy invoice
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

    // Sync status: update original pharmacy dispensing record if it's a pharmacy invoice
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

    return NextResponse.json({ invoice: updatedInvoice });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to process payment.";
    console.error("[billing PUT] failed:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
