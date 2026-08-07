"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { PageLayout } from "../../../components/page-layout";
import { PhoneInputField } from "../../../components/ui/phone-input";
import { isValidPhoneNumber } from "libphonenumber-js";

// ─── Types ───────────────────────────────────────────────────────────────────

type ConsultationRecord = {
  id: number;
  token_number?: string | null;
  patient_details?: string | null;
  prescription_lines?: string | null;
  prescription_data?: string | null;
  status?: string | null;
  patient_type?: string | null;
};

type DispensingBillRecord = {
  id: number;
  token_number?: string | null;
  patient_name?: string | null;
  payment_status?: string | null;
  billing_amount?: string | number | null;
  medicine_lines?: string | null;
  created_at?: string | null;
  pharmacy_only?: string | null;
  patient_phone?: string | null;
};

type PricingRecord = {
  product_name?: string | null;
  selling_price?: string | number | null;
};

type MedicineRow = {
  id: number;
  medicineName: string;
  prescribedQty: string;
  receivedQty: string;
  medicineAmount: string;
};

type DispensingField = {
  id: string;
  type: "text" | "number" | "select" | "textarea";
};

type SerializedPrescriptionLine = {
  medicineName?: string;
  genericName?: string;
  totalQty?: string;
  prescribedQty?: string;
};

type PatientRow = {
  id?: number;
  patient_id?: string | null;
  patient_name?: string | null;
  mobile?: string | null;
  dob?: string | null;
  gender?: string | null;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const paymentStatusOptions = ["Pending", "Partially Paid", "Paid", "Cancelled"];

const DISPENSING_FIELDS: DispensingField[] = [
  { id: "tokenNumber", type: "text" },
  { id: "patientName", type: "text" },
  { id: "paymentStatus", type: "select" },
  { id: "billingAmount", type: "number" },
  { id: "medicineLines", type: "textarea" },
];

// ─── Utility functions ────────────────────────────────────────────────────────

function parsePrescriptionLines(value?: string | null): Omit<MedicineRow, "id">[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as SerializedPrescriptionLine[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((line) => ({
      medicineName: line.medicineName || line.genericName || "",
      prescribedQty: line.totalQty || line.prescribedQty || "",
      receivedQty: "",
      medicineAmount: "",
    }));
  } catch {
    return [];
  }
}

function normalizeMedicineName(value: string): string {
  return value.trim().toLowerCase();
}

function formatMoney(value: number): string {
  return value.toFixed(2);
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-IN");
  } catch {
    return value;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PharmacyDispensingPage() {
  const params = useParams();
  const hname = params?.Hname as string;

  // ── View state ──────────────────────────────────────────────────────────────
  // Extends the original "records" | "form" | "bills" with two new states
  const [activeView, setActiveView] = useState<
    "records" | "form" | "bills" | "add-dispense" | "dispense-history"
  >("records");

  // ── Existing data ───────────────────────────────────────────────────────────
  const [consultationRecords, setConsultationRecords] = useState<ConsultationRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [dispensingBills, setDispensingBills] = useState<DispensingBillRecord[]>([]);
  const [isLoadingBills, setIsLoadingBills] = useState(true);
  const [pricingMap, setPricingMap] = useState<Record<string, number>>({});
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Dispensing form fields ──────────────────────────────────────────────────
  const [selectedConsultationId, setSelectedConsultationId] = useState<number | null>(null);
  const [tokenNumber, setTokenNumber] = useState("");
  const [patientName, setPatientName] = useState("");
  const [paymentStatus, setPaymentStatus] = useState(paymentStatusOptions[0]);
  const [isPharmacyOnly, setIsPharmacyOnly] = useState(false);
  const [pharmacyPatientPhone, setPharmacyPatientPhone] = useState("");
  const [pharmacyPatientDob, setPharmacyPatientDob] = useState("");

  const nextRowId = useRef(2);

  const createMedicineRow = (overrides?: Partial<Omit<MedicineRow, "id">>): MedicineRow => ({
    id: nextRowId.current++,
    medicineName: "",
    prescribedQty: "",
    receivedQty: "",
    medicineAmount: "",
    ...overrides,
  });

  const [medicineRows, setMedicineRows] = useState<MedicineRow[]>([
    { id: 1, medicineName: "", prescribedQty: "", receivedQty: "", medicineAmount: "" },
  ]);

  // ── Add Dispense flow state ─────────────────────────────────────────────────
  const [addDispensePhone, setAddDispensePhone] = useState("");
  const [addDispenseName, setAddDispenseName] = useState("");
  const [addDispenseDob, setAddDispenseDob] = useState("");
  const [addDispenseStep, setAddDispenseStep] = useState<"phone" | "new-patient" | "found">("phone");
  const [addDispenseLoading, setAddDispenseLoading] = useState(false);
  const [addDispenseError, setAddDispenseError] = useState("");
  const [foundPatient, setFoundPatient] = useState<PatientRow | null>(null);
  const [dispenseHistory, setDispenseHistory] = useState<DispensingBillRecord[]>([]);

  // ─── Data loaders ────────────────────────────────────────────────────────────

  useEffect(() => {
    let isMounted = true;
    async function loadPricing() {
      try {
        const response = await fetch(`/api/${hname}/forms/pricing`, { method: "GET", cache: "no-store" });
        const data = (await response.json()) as { rows?: PricingRecord[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Failed to load pricing.");
        const nextPricingMap = (data.rows ?? []).reduce<Record<string, number>>((acc, row) => {
          const name = normalizeMedicineName(String(row.product_name ?? ""));
          const price = Number(row.selling_price);
          if (name && Number.isFinite(price)) acc[name] = price;
          return acc;
        }, {});
        if (isMounted) setPricingMap(nextPricingMap);
      } catch {
        if (isMounted) setPricingMap({});
      }
    }
    if (hname) void loadPricing();
    return () => { isMounted = false; };
  }, [hname]);

  useEffect(() => {
    let isMounted = true;
    async function loadConsultationRecords() {
      setIsLoadingRecords(true);
      setSubmitError(null);
      try {
        const response = await fetch(`/api/${hname}/forms/doctor_consultation_entry`, { method: "GET", cache: "no-store" });
        const data = (await response.json()) as { rows?: ConsultationRecord[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Failed to load doctor consultation records.");
        if (isMounted) {
          const sentRecords = (data.rows ?? []).filter((r: any) => r.sended === "Yes");
          setConsultationRecords(sentRecords);
        }
      } catch (error) {
        if (isMounted) setSubmitError(error instanceof Error ? error.message : "Failed to load doctor consultation records.");
      } finally {
        if (isMounted) setIsLoadingRecords(false);
      }
    }
    if (hname) void loadConsultationRecords();
    return () => { isMounted = false; };
  }, [hname]);

  useEffect(() => {
    let isMounted = true;
    async function loadDispensingBills() {
      setIsLoadingBills(true);
      try {
        const response = await fetch(`/api/${hname}/forms/pharmacy_dispensing`, { method: "GET", cache: "no-store" });
        const data = (await response.json()) as { rows?: DispensingBillRecord[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Failed to load dispensing bills.");
        if (isMounted) setDispensingBills(data.rows ?? []);
      } catch (error) {
        if (isMounted) setSubmitError(error instanceof Error ? error.message : "Failed to load dispensing bills.");
      } finally {
        if (isMounted) setIsLoadingBills(false);
      }
    }
    if (hname) void loadDispensingBills();
    return () => { isMounted = false; };
  }, [hname]);

  // ─── Medicine row helpers ─────────────────────────────────────────────────

  const billingAmount = useMemo(() => {
    const total = medicineRows.reduce((sum, row) => {
      const amount = Number(row.medicineAmount);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
    return total.toFixed(2);
  }, [medicineRows]);

  const medicineQtyTotals = useMemo(() => {
    return medicineRows.reduce(
      (totals, row) => {
        const prescribed = Number(row.prescribedQty);
        const received = Number(row.receivedQty);
        return {
          prescribed: totals.prescribed + (Number.isFinite(prescribed) ? prescribed : 0),
          received: totals.received + (Number.isFinite(received) ? received : 0),
        };
      },
      { prescribed: 0, received: 0 }
    );
  }, [medicineRows]);

  useEffect(() => {
    Promise.resolve().then(() => {
      setMedicineRows((currentRows) =>
        currentRows.map((row) => {
          const sellingPrice = pricingMap[normalizeMedicineName(row.medicineName)] ?? 0;
          const receivedQty = Number(row.receivedQty);
          return {
            ...row,
            medicineAmount:
              Number.isFinite(receivedQty) && receivedQty > 0 && sellingPrice > 0
                ? formatMoney(sellingPrice * receivedQty)
                : "",
          };
        })
      );
    });
  }, [pricingMap]);

  const updateMedicineRow = (rowId: number, field: keyof Omit<MedicineRow, "id">, value: string) => {
    setMedicineRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== rowId) return row;
        const nextRow = { ...row, [field]: value };
        const sellingPrice = pricingMap[normalizeMedicineName(nextRow.medicineName)] ?? 0;
        const receivedQty = Number(nextRow.receivedQty);
        return {
          ...nextRow,
          medicineAmount:
            Number.isFinite(receivedQty) && receivedQty > 0 && sellingPrice > 0
              ? formatMoney(sellingPrice * receivedQty)
              : "",
        };
      })
    );
  };

  const addMedicineRow = () => setMedicineRows((rows) => [...rows, createMedicineRow()]);
  const removeMedicineRow = (rowId: number) =>
    setMedicineRows((rows) => (rows.length > 1 ? rows.filter((r) => r.id !== rowId) : rows));

  // ─── Reset helpers ────────────────────────────────────────────────────────

  const resetForm = () => {
    nextRowId.current = 2;
    setSelectedConsultationId(null);
    setTokenNumber("");
    setPatientName("");
    setPaymentStatus(paymentStatusOptions[0]);
    setIsPharmacyOnly(false);
    setPharmacyPatientPhone("");
    setPharmacyPatientDob("");
    setMedicineRows([{ id: 1, medicineName: "", prescribedQty: "", receivedQty: "", medicineAmount: "" }]);
    setSubmitMessage(null);
    setSubmitError(null);
  };

  const resetAddDispense = () => {
    setAddDispensePhone("");
    setAddDispenseName("");
    setAddDispenseDob("");
    setAddDispenseStep("phone");
    setAddDispenseError("");
    setFoundPatient(null);
    setDispenseHistory([]);
  };

  // ─── Open consultation-based dispensing form ──────────────────────────────

  const openDispensingForm = (record: ConsultationRecord) => {
    const nextRows = parsePrescriptionLines(record.prescription_data ?? record.prescription_lines);
    nextRowId.current = 1;
    const hydratedRows = nextRows.map((row) => createMedicineRow(row));
    setSelectedConsultationId(record.id);
    setTokenNumber(record.token_number ?? "");
    setPatientName(record.patient_details ?? "");
    setPaymentStatus(paymentStatusOptions[0]);
    setIsPharmacyOnly(false);
    setPharmacyPatientPhone("");
    setPharmacyPatientDob("");
    setMedicineRows(hydratedRows.length > 0 ? hydratedRows : [createMedicineRow()]);
    setSubmitMessage(null);
    setSubmitError(null);
    setActiveView("form");
  };

  // ─── Open pharmacy-only dispensing form (from Add Dispense flow) ──────────

  const openPharmacyOnlyForm = (
    name: string,
    phone: string,
    dob: string,
    prefillMedicines?: Omit<MedicineRow, "id">[]
  ) => {
    nextRowId.current = 1;
    const rows = prefillMedicines && prefillMedicines.length > 0
      ? prefillMedicines.map((r) => createMedicineRow(r))
      : [createMedicineRow()];
    setIsPharmacyOnly(true);
    setPatientName(name);
    setPharmacyPatientPhone(phone);
    setPharmacyPatientDob(dob);
    setTokenNumber(""); // will be auto-generated on POST
    setPaymentStatus(paymentStatusOptions[0]);
    setMedicineRows(rows);
    setSelectedConsultationId(null);
    setSubmitMessage(null);
    setSubmitError(null);
    resetAddDispense();
    setActiveView("form");
  };

  // ─── Add Dispense: phone lookup ───────────────────────────────────────────

  const handleAddDispensePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddDispenseError("");
    const phone = addDispensePhone;
    if (!isValidPhoneNumber(phone)) {
      setAddDispenseError("Please enter a valid mobile number with country code.");
      return;
    }
    setAddDispenseLoading(true);
    try {
      const res = await fetch(`/api/${encodeURIComponent(hname)}/dispense?phone=${encodeURIComponent(phone)}`);
      const data = await res.json() as {
        exists?: boolean;
        patient?: PatientRow | null;
        dispensingHistory?: DispensingBillRecord[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to look up patient.");
      if (data.exists && data.patient) {
        setFoundPatient(data.patient);
        setDispenseHistory(data.dispensingHistory ?? []);
        setAddDispenseName(normalizeText(data.patient.patient_name));
        setAddDispenseDob(data.patient.dob ? String(data.patient.dob).slice(0, 10) : "");
        setAddDispenseStep("found");
      } else {
        setAddDispenseName("");
        setAddDispenseDob("");
        setAddDispenseStep("new-patient");
      }
    } catch (err: any) {
      setAddDispenseError(err.message ?? "Failed to look up patient.");
    } finally {
      setAddDispenseLoading(false);
    }
  };

  // ─── Add Dispense: click a history record to pre-fill the form ────────────

  const openHistoryRecord = (bill: DispensingBillRecord) => {
    const prefill = parsePrescriptionLines(bill.medicine_lines);
    openPharmacyOnlyForm(
      normalizeText(bill.patient_name ?? foundPatient?.patient_name),
      addDispensePhone,
      addDispenseDob,
      prefill
    );
  };

  // ─── Submit handlers ──────────────────────────────────────────────────────

  const refreshBills = async () => {
    const billsResponse = await fetch(`/api/${hname}/forms/pharmacy_dispensing`, { method: "GET", cache: "no-store" });
    const billsData = (await billsResponse.json()) as { rows?: DispensingBillRecord[]; error?: string };
    if (!billsResponse.ok) throw new Error(billsData.error ?? "Failed to refresh bills.");
    setDispensingBills(billsData.rows ?? []);
  };

  /** Standard consultation-based submit */
  const handleConsultationSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitMessage(null);
    setSubmitError(null);
    try {
      const response = await fetch(`/api/${hname}/forms/pharmacy_dispensing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardTitle: "Pharmacy Dispensing",
          fields: DISPENSING_FIELDS,
          values: {
            tokenNumber,
            patientName,
            paymentStatus,
            billingAmount,
            medicineLines: JSON.stringify(medicineRows),
          },
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to save dispensing record.");
      await refreshBills();
      resetForm();
      setSubmitMessage("Dispensing record saved successfully.");
      setActiveView("bills");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to save dispensing record.");
    }
  };

  /** Pharmacy-only submit */
  const handlePharmacyOnlySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitMessage(null);
    setSubmitError(null);
    try {
      const response = await fetch(`/api/${encodeURIComponent(hname)}/dispense`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName,
          patientPhone: pharmacyPatientPhone,
          patientDob: pharmacyPatientDob,
          paymentStatus,
          billingAmount,
          medicineLines: JSON.stringify(medicineRows),
        }),
      });
      const data = (await response.json()) as { row?: DispensingBillRecord; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to save dispense record.");
      // Update the token number display from server response
      if (data.row?.token_number) setTokenNumber(data.row.token_number);
      await refreshBills();
      resetForm();
      setSubmitMessage(`Pharmacy-only record saved. Token: ${data.row?.token_number ?? ""}`);
      setActiveView("bills");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to save dispense record.");
    }
  };

  // The form submit routes to the appropriate handler
  const handleSubmit = isPharmacyOnly ? handlePharmacyOnlySubmit : handleConsultationSubmit;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <PageLayout title="Pharmacy - Pharmacy Dispensing">
      <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">

          {/* ── Header toolbar ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 dark:border-gray-800 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white/90">
                Pharmacy Dispensing
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
                Pick a consultation record, then enter received quantity and medicine amount.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Add Dispense — primary CTA */}
              <button
                type="button"
                id="btn-add-dispense"
                onClick={() => {
                  resetAddDispense();
                  setActiveView("add-dispense");
                }}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition focus:outline-hidden focus:ring-3 ${activeView === "add-dispense" || activeView === "dispense-history"
                  ? "bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-500/25"
                  : "bg-brand-500 text-white hover:bg-brand-600 focus:ring-brand-500/25"
                  }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Dispense
              </button>

              {/* View Records */}
              <button
                type="button"
                onClick={() => setActiveView("bills")}
                className={`inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition focus:outline-hidden focus:ring-3 ${activeView === "bills"
                  ? "bg-brand-500 text-white hover:bg-brand-600 focus:ring-brand-500/25"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
              >
                View Records
              </button>

              {/* Dispense (consultation-based) */}
              {activeView !== "form" ? (
                <button
                  type="button"
                  onClick={() => setActiveView("records")}
                  className={`inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition focus:outline-hidden focus:ring-3 ${activeView === "records"
                    ? "bg-brand-500 text-white hover:bg-brand-600 focus:ring-brand-500/25"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                    }`}
                >
                  Dispense
                </button>
              ) : null}
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {/* ── Global messages ──────────────────────────────────────────── */}
            {submitMessage ? (
              <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700 dark:border-brand-900/40 dark:bg-brand-950/40 dark:text-brand-200">
                {submitMessage}
              </div>
            ) : null}
            {submitError ? (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
                {submitError}
              </div>
            ) : null}

            {/* ════════════════════════════════════════════════════════════════
                VIEW: Add Dispense — Step panel
            ════════════════════════════════════════════════════════════════ */}
            {activeView === "add-dispense" ? (
              <div className="mx-auto max-w-lg">
                {/* Step indicator */}
                <div className="mb-6">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">1</span>
                    <span className="text-sm font-semibold text-slate-700 dark:text-white/90">Customer Lookup</span>
                    {addDispenseStep !== "phone" && (
                      <>
                        <div className="h-px flex-1 bg-brand-400" />
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">2</span>
                        <span className="text-sm font-semibold text-slate-700 dark:text-white/90">
                          {addDispenseStep === "found" ? "Patient Found" : "New Customer"}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 dark:border-gray-700 dark:bg-gray-800/40">
                  {/* Error banner */}
                  {addDispenseError ? (
                    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
                      {addDispenseError}
                    </div>
                  ) : null}

                  {/* ── Step: phone lookup ───────────────────────────────── */}
                  {addDispenseStep === "phone" && (
                    <form onSubmit={handleAddDispensePhoneSubmit} className="space-y-5">
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-gray-200">
                          Customer Mobile Number <span className="text-red-500">*</span>
                        </label>
                        <p className="mb-3 text-xs text-slate-400 dark:text-gray-500">
                          Enter the customer's 10-digit mobile number to check if they are an existing patient.
                        </p>
                        <PhoneInputField
                          id="add-dispense-phone"
                          value={addDispensePhone}
                          onChange={setAddDispensePhone}
                          required
                          placeholder="e.g. +1 234 567 8900"
                        />
                      </div>
                      <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-gray-700">
                        <button
                          type="button"
                          onClick={() => setActiveView("records")}
                          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={addDispenseLoading || !isValidPhoneNumber(addDispensePhone)}
                          className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 focus:outline-hidden focus:ring-3 focus:ring-brand-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {addDispenseLoading ? "Searching…" : "Search Customer"}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* ── Step: new patient form ───────────────────────────── */}
                  {addDispenseStep === "new-patient" && (
                    <div className="space-y-5">
                      <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
                        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                        </svg>
                        <span>No patient found for <strong>{addDispensePhone}</strong>. Please enter their details below.</span>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">
                            Patient Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            id="new-patient-name"
                            type="text"
                            required
                            value={addDispenseName}
                            onChange={(e) => setAddDispenseName(e.target.value)}
                            placeholder="Full name"
                            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-700 focus:border-brand-400 focus:outline-hidden focus:ring-3 focus:ring-brand-400/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">
                            Date of Birth
                          </label>
                          <input
                            id="new-patient-dob"
                            type="date"
                            value={addDispenseDob}
                            onChange={(e) => setAddDispenseDob(e.target.value)}
                            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-700 focus:border-brand-400 focus:outline-hidden focus:ring-3 focus:ring-brand-400/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">
                            Mobile Number
                          </label>
                          <input
                            type="text"
                            readOnly
                            value={addDispensePhone}
                            className="h-11 w-full rounded-lg border border-slate-200 bg-slate-100 px-4 text-sm text-slate-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-gray-700">
                        <button
                          type="button"
                          onClick={() => setAddDispenseStep("phone")}
                          className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          ← Back
                        </button>
                        <button
                          type="button"
                          disabled={!addDispenseName.trim()}
                          onClick={() => {
                            if (!addDispenseName.trim()) {
                              setAddDispenseError("Patient name is required.");
                              return;
                            }
                            openPharmacyOnlyForm(
                              addDispenseName.trim(),
                              addDispensePhone,
                              addDispenseDob
                            );
                          }}
                          className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 focus:outline-hidden focus:ring-3 focus:ring-brand-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Proceed to Dispensing →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Step: patient found ──────────────────────────────── */}
                  {addDispenseStep === "found" && foundPatient && (
                    <div className="space-y-5">
                      {/* Patient card */}
                      <div className="flex items-start gap-4 rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-800/40 dark:bg-brand-950/30">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
                          {(foundPatient.patient_name ?? "P").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-brand-800 dark:text-brand-200">
                            {foundPatient.patient_name ?? "—"}
                          </p>
                          <p className="text-sm text-brand-600 dark:text-brand-400">
                            📱 {addDispensePhone}
                            {foundPatient.dob ? ` · DOB: ${formatDate(String(foundPatient.dob))}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-white/90">
                          Past Pharmacy Records
                        </h4>
                        <button
                          type="button"
                          onClick={() => openPharmacyOnlyForm(
                            normalizeText(foundPatient.patient_name),
                            addDispensePhone,
                            addDispenseDob
                          )}
                          className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-medium text-white transition hover:bg-brand-600"
                        >
                          + New Dispense
                        </button>
                      </div>

                      {dispenseHistory.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-gray-700 dark:bg-gray-950/40 dark:text-gray-400">
                          No past pharmacy records found. Click "New Dispense" to create the first one.
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                          <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-gray-800">
                            <thead className="bg-slate-50 dark:bg-gray-950">
                              <tr>
                                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">Token</th>
                                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">Date</th>
                                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">Status</th>
                                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">Amount</th>
                                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">Type</th>
                                <th className="px-4 py-3" />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-gray-800">
                              {dispenseHistory.map((bill) => (
                                <tr
                                  key={bill.id}
                                  className="cursor-pointer transition hover:bg-brand-50/60 dark:hover:bg-brand-900/10"
                                  onClick={() => openHistoryRecord(bill)}
                                >
                                  <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-gray-300">
                                    {bill.token_number || "—"}
                                  </td>
                                  <td className="px-4 py-3 text-slate-600 dark:text-gray-300">
                                    {bill.created_at ? new Date(bill.created_at).toLocaleDateString("en-IN") : "—"}
                                  </td>
                                  <td className="px-4 py-3 text-slate-600 dark:text-gray-300">
                                    {bill.payment_status || "—"}
                                  </td>
                                  <td className="px-4 py-3 text-slate-600 dark:text-gray-300">
                                    {bill.billing_amount != null ? `Rs. ${bill.billing_amount}` : "—"}
                                  </td>
                                  <td className="px-4 py-3">
                                    {bill.pharmacy_only === "Yes" ? (
                                      <span className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                                        Pharmacy Only
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-gray-800 dark:text-gray-400">
                                        Consultation
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <span className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
                                      Use →
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <div className="border-t border-slate-200 pt-4 dark:border-gray-700">
                        <button
                          type="button"
                          onClick={() => setAddDispenseStep("phone")}
                          className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          ← Search Again
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* ════════════════════════════════════════════════════════════════
                 VIEW: Dispensing Form (shared for consultation & pharmacy-only)
             ════════════════════════════════════════════════════════════════ */}
            {activeView === "form" ? (
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Pharmacy-Only badge */}
                {isPharmacyOnly && (
                  <div className="flex items-center gap-2.5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 dark:border-brand-800/40 dark:bg-brand-950/30">
                    <svg className="h-4 w-4 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium text-brand-700 dark:text-brand-300">
                      Pharmacy Only — This record will be tagged as Pharmacy Only in the patient's history.
                    </span>
                  </div>
                )}

                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">
                      Token Number
                    </label>
                    <input
                      type="text"
                      value={isPharmacyOnly ? (tokenNumber || "Auto-generated") : tokenNumber}
                      readOnly
                      className="h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 shadow-theme-xs dark:border-gray-700 dark:bg-gray-800/60 dark:text-white/90"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">
                      Patient Name
                    </label>
                    {isPharmacyOnly ? (
                      <input
                        type="text"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="Patient name"
                        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-theme-xs focus:border-brand-400 focus:outline-hidden focus:ring-3 focus:ring-brand-400/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                      />
                    ) : (
                      <input
                        type="text"
                        value={patientName}
                        readOnly
                        placeholder="Select a patient from records"
                        className="h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 shadow-theme-xs dark:border-gray-700 dark:bg-gray-800/60 dark:text-white/90"
                      />
                    )}
                  </div>

                  {isPharmacyOnly ? (
                    <>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">
                          Mobile
                        </label>
                        <input
                          type="text"
                          value={pharmacyPatientPhone}
                          readOnly
                          className="h-11 w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">
                          DOB
                        </label>
                        <input
                          type="text"
                          value={pharmacyPatientDob ? formatDate(pharmacyPatientDob) : "—"}
                          readOnly
                          className="h-11 w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">
                          Billing Amount
                        </label>
                        <div className="flex items-center rounded-lg border border-slate-300 bg-transparent shadow-theme-xs focus-within:border-brand-300 focus-within:ring-3 focus-within:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900">
                          <span className="px-4 text-sm text-slate-500 dark:text-gray-400">Rs.</span>
                          <input
                            type="number"
                            value={billingAmount}
                            readOnly
                            className="h-11 w-full rounded-r-lg border-0 bg-transparent px-0 py-2.5 text-sm text-slate-700 focus:outline-hidden dark:text-white/90"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">
                          Payment Status
                        </label>
                        <select
                          value={paymentStatus}
                          onChange={(e) => setPaymentStatus(e.target.value)}
                          className="h-11 w-full rounded-lg border border-slate-300 bg-transparent px-4 py-2.5 text-sm text-slate-700 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                        >
                          {paymentStatusOptions.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>

                {/* Billing amount + payment status for pharmacy-only (second row) */}
                {isPharmacyOnly && (
                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">
                        Billing Amount (auto-calculated)
                      </label>
                      <div className="flex items-center rounded-lg border border-slate-300 bg-transparent shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
                        <span className="px-4 text-sm text-slate-500 dark:text-gray-400">Rs.</span>
                        <input
                          type="number"
                          value={billingAmount}
                          readOnly
                          className="h-11 w-full rounded-r-lg border-0 bg-transparent px-0 py-2.5 text-sm text-slate-700 focus:outline-hidden dark:text-white/90"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">
                        Payment Status
                      </label>
                      <select
                        value={paymentStatus}
                        onChange={(e) => setPaymentStatus(e.target.value)}
                        className="h-11 w-full rounded-lg border border-slate-300 bg-transparent px-4 py-2.5 text-sm text-slate-700 shadow-theme-xs focus:border-brand-400 focus:outline-hidden focus:ring-3 focus:ring-brand-400/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                      >
                        {paymentStatusOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Medicine table */}
                <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-gray-800 dark:bg-gray-950/40">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white/90">
                        Medicine List
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-gray-400">
                        {isPharmacyOnly
                          ? "Enter medicines manually. Amounts are auto-calculated from pricing."
                          : "Medicine name and prescribed quantity come from Doctor Consultation."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addMedicineRow}
                      className="rounded-lg px-4 py-2.5 text-sm font-medium text-white transition focus:outline-hidden focus:ring-3 bg-brand-500 hover:bg-brand-600 focus:ring-brand-500/25"
                    >
                      Add Row
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-gray-800">
                      <thead className="bg-slate-100 dark:bg-gray-950">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">Medicine Name</th>
                          <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">Prescribed Qty</th>
                          <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">Received Qty</th>
                          <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">Medicine Amount</th>
                          <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-gray-800">
                        {medicineRows.map((row, index) => (
                          <tr key={row.id}>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={row.medicineName}
                                readOnly={!isPharmacyOnly && row.medicineName.trim().length > 0}
                                onChange={(e) => updateMedicineRow(row.id, "medicineName", e.target.value)}
                                placeholder={`Medicine ${index + 1}`}
                                className={`h-10 w-full rounded-lg border px-3 text-sm dark:border-gray-700 dark:text-white/90 ${!isPharmacyOnly && row.medicineName.trim().length > 0
                                  ? "border-slate-300 bg-slate-50 text-slate-700 dark:bg-gray-800/60"
                                  : "border-slate-300 bg-transparent text-slate-700 focus:border-brand-300 focus:outline-hidden"
                                  }`}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                value={row.prescribedQty}
                                readOnly={!isPharmacyOnly && row.prescribedQty.trim().length > 0}
                                onChange={(e) => updateMedicineRow(row.id, "prescribedQty", e.target.value)}
                                className={`h-10 w-full rounded-lg border px-3 text-sm dark:border-gray-700 dark:text-white/90 ${!isPharmacyOnly && row.prescribedQty.trim().length > 0
                                  ? "border-slate-300 bg-slate-50 text-slate-700 dark:bg-gray-800/60"
                                  : "border-slate-300 bg-transparent text-slate-700 focus:border-brand-300 focus:outline-hidden"
                                  }`}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                value={row.receivedQty}
                                onChange={(e) => updateMedicineRow(row.id, "receivedQty", e.target.value)}
                                className="h-10 w-full rounded-lg border border-slate-300 bg-transparent px-3 text-sm text-slate-700 focus:border-brand-300 focus:outline-hidden dark:border-gray-700 dark:text-white/90"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.medicineAmount}
                                readOnly
                                className="h-10 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-white/90"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => removeMedicineRow(row.id)}
                                className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                                disabled={medicineRows.length === 1}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-4 dark:border-gray-800">
                  <p className="text-sm text-slate-500 dark:text-gray-400">
                    Prescribed Qty: {medicineQtyTotals.prescribed} | Received Qty: {medicineQtyTotals.received}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      Reset
                    </button>
                    <button
                      type="submit"
                      disabled={isPharmacyOnly ? !patientName.trim() : (!tokenNumber || !patientName)}
                      className="rounded-lg px-5 py-2.5 text-sm font-medium text-white transition focus:outline-hidden focus:ring-3 disabled:cursor-not-allowed disabled:opacity-60 bg-brand-500 hover:bg-brand-600 focus:ring-brand-500/25"
                    >
                      {isPharmacyOnly ? "Save & Tag Pharmacy Only" : "Save Dispensing"}
                    </button>
                  </div>
                </div>
              </form>
            ) : null}

            {/* ════════════════════════════════════════════════════════════════
                VIEW: Bills / View Records
            ════════════════════════════════════════════════════════════════ */}
            {activeView === "bills" ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-medium text-gray-800 dark:text-white/90">View Bills</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Saved dispensing bills are listed here. "Pharmacy Only" records are highlighted.
                  </p>
                </div>

                {isLoadingBills ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 dark:border-gray-700 dark:bg-gray-950/40 dark:text-gray-400">
                    Loading bills…
                  </div>
                ) : dispensingBills.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 dark:border-gray-700 dark:bg-gray-950/40 dark:text-gray-400">
                    No bills saved yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-gray-800">
                      <thead className="bg-slate-100 dark:bg-gray-950">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">Token Number</th>
                          <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">Patient Name</th>
                          <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">Payment Status</th>
                          <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">Billing Amount</th>
                          <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">Type</th>
                          <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">Saved At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-gray-800">
                        {dispensingBills.map((bill) => (
                          <tr
                            key={bill.id}
                            className={bill.pharmacy_only === "Yes" ? "bg-brand-50/40 dark:bg-brand-950/10" : ""}
                          >
                            <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-gray-300">
                              {bill.token_number || "—"}
                            </td>
                            <td className="px-4 py-3 text-slate-700 dark:text-gray-300">
                              {bill.patient_name || "—"}
                            </td>
                            <td className="px-4 py-3 text-slate-700 dark:text-gray-300">
                              {bill.payment_status || "—"}
                            </td>
                            <td className="px-4 py-3 text-slate-700 dark:text-gray-300">
                              {bill.billing_amount != null ? `Rs. ${bill.billing_amount}` : "—"}
                            </td>
                            <td className="px-4 py-3">
                              {bill.pharmacy_only === "Yes" ? (
                                <span className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                                  Pharmacy Only
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-gray-800 dark:text-gray-400">
                                  Consultation
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-700 dark:text-gray-300">
                              {bill.created_at ? new Date(bill.created_at).toLocaleString("en-IN") : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}

            {/* ════════════════════════════════════════════════════════════════
                VIEW: Consultation Records (original "Dispense" tab)
            ════════════════════════════════════════════════════════════════ */}
            {activeView === "records" ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
                    Consultation Records
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Only patient details and token number are shown here. Click a row to open the dispensing form.
                  </p>
                </div>

                {isLoadingRecords ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 dark:border-gray-700 dark:bg-gray-950/40 dark:text-gray-400">
                    Loading consultation records…
                  </div>
                ) : consultationRecords.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 dark:border-gray-700 dark:bg-gray-950/40 dark:text-gray-400">
                    No doctor consultation records saved yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-gray-800">
                      <thead className="bg-slate-100 dark:bg-gray-950">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">Token Number</th>
                          <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">Patient Details</th>
                          <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">Type</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-gray-800">
                        {consultationRecords
                          .filter((record) => !dispensingBills.some((b) => b.token_number === record.token_number))
                          .map((record) => (
                            <tr
                              key={record.id}
                              onClick={() => openDispensingForm(record)}
                              className={`cursor-pointer transition hover:bg-brand-50/60 dark:hover:bg-brand-500/10 ${selectedConsultationId === record.id ? "bg-brand-50 dark:bg-brand-500/10" : ""
                                }`}
                            >
                              <td className="px-4 py-3 text-slate-700 dark:text-gray-300">
                                {record.token_number || "—"}
                              </td>
                              <td className="px-4 py-3 text-slate-700 dark:text-gray-300">
                                {record.patient_details || "—"}
                              </td>
                              <td className="px-4 py-3 text-slate-700 dark:text-gray-300">
                                {record.patient_type === "walk-in" ? "OP" : (record.patient_type || "OP").toUpperCase()}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}

          </div>
        </div>
      </div >
    </PageLayout >
  );
}

// ─── Utility (local only) ─────────────────────────────────────────────────────
function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}
