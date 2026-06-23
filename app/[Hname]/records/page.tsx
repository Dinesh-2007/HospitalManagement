"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { getCurrentUserRole } from "../../actions/user";
import { DatePicker } from "../../../components/date-picker";
import { tableNameFromCardTitle } from "../../../lib/master-form-table";

type RawRow = Record<string, unknown>;
type ConsultationRow = {
    id: number;
    status: string;
    doctor: string;
    department: string;
    tokenNumber: string;
    patientDetails: string;
    diagnosisName: string;
    symptoms: string;
    remarks: string;
    followUpDays: string;
    consultationAmount: string;
    patientType: string;
    prescriptionData: string;
    patientId: string;
    vitals?: VitalsRow | null;
    hasPharmacy: boolean;
    createdAt: string;
    updatedAt: string;
};
type DoctorMasterRow = { name: string; department: string };
type VitalsRow = Record<string, string | number | null>;
type AppointmentRow = Record<string, string | number | null>;

type DetailTab = "Patient Details" | "Vitals" | "Consultation Form" | "Pharmacy" | "History";
const DETAIL_TABS: DetailTab[] = ["Patient Details", "Vitals", "Consultation Form", "Pharmacy", "History"];

const DOCTOR_TABLE = tableNameFromCardTitle("Consultant / Doctor Master");

function text(row: RawRow, keys: string[]) {
    for (const key of keys) {
        const value = row[key];
        if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
    }
    return "";
}

function toKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDisplayDate(value: string) {
    const dateText = value.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return value;
    const [year, month, day] = dateText.split("-").map(Number);
    return new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "2-digit", month: "short", year: "numeric" }).format(new Date(year, month - 1, day));
}

function formatDisplayTime(value: string) {
    const [h, m = "00"] = value.split(":");
    const d = new Date();
    d.setHours(Number(h), Number(m), 0, 0);
    return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(d).replace(/\s/g, "");
}

function normalizeRow(row: RawRow): ConsultationRow {
    // If join fails, row.id (from c.id) will be null, but we have consultation_id as well
    const consId = Number(row.consultation_id || row.id || 0);
    return {
        id: consId,
        status: text(row, ["consultation_status", "status"]),
        doctor: text(row, ["doctor", "app_doctor"]),
        department: text(row, ["department", "app_department"]),
        patientId: text(row, ["app_patient_id", "patient_id", "patientId"]),
        tokenNumber: text(row, ["tokenNumber", "token_number", "app_id"]),
        patientDetails: text(row, ["patientDetails", "patient_details", "app_patient_name"]),
        diagnosisName: text(row, ["diagnosisName", "diagnosis_name"]),
        symptoms: text(row, ["symptoms"]),
        remarks: text(row, ["remarks"]),
        followUpDays: text(row, ["followUpDays", "follow_up_days"]),
        consultationAmount: text(row, ["consultationAmount", "consultation_amount"]),
        patientType: text(row, ["patientType", "patient_type"]),
        prescriptionData: text(row, ["prescriptionData", "prescription_data"]),
        vitals: row.vitals_id ? {
            age: row.age as string | number | null,
            height_cm: row.height_cm as string | number | null,
            weight_kg: row.weight_kg as string | number | null,
            bmi: row.bmi as string | number | null,
            temperature: row.temperature as string | number | null,
            pulse_rate: row.pulse_rate as string | number | null,
            respiratory_rate: row.respiratory_rate as string | number | null,
            systolic_bp: row.systolic_bp as string | number | null,
            diastolic_bp: row.diastolic_bp as string | number | null,
            spo2: row.spo2 as string | number | null,
            blood_sugar: row.blood_sugar as string | number | null,
            remarks: row.vitals_remarks as string | null,
        } : null,
        hasPharmacy: Boolean(row.has_pharmacy),
        createdAt: text(row, ["createdAt", "created_at", "appointment_date"]),
        updatedAt: text(row, ["updatedAt", "updated_at", "appointment_date"]),
    };
}

function StepTracer({ row }: { row: ConsultationRow }) {
    const steps = [
        { label: "Vitals", done: !!row.vitals },
        { label: "Consultation", done: row.status === "Completed" },
        { label: "Lab", done: false }, // Placeholder
        { label: "Pharmacy", done: row.hasPharmacy },
    ];

    return (
        <div className="flex items-center w-full justify-between">
            {steps.map((step, i) => (
                <div key={step.label} className="relative flex flex-col items-center">
                    <div className={`z-10 flex h-10 w-10 items-center justify-center rounded-full border-4 transition-all duration-300 ${step.done
                        ? "border-brand-50 bg-brand-500 text-white shadow-lg shadow-brand-200 dark:border-brand-900/50"
                        : "border-white bg-gray-100 text-gray-400 dark:border-gray-900 dark:bg-gray-800"
                        }`}>
                        {step.done ? (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        ) : (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        )}
                    </div>
                    <div className="absolute -bottom-6 w-max text-[10px] font-bold uppercase tracking-wider">
                        <span className={step.done ? "text-brand-600 dark:text-brand-400" : "text-gray-400 dark:text-gray-600"}>
                            {step.label}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}

async function loadRows(hname: string, path: string): Promise<RawRow[]> {
    const res = await fetch(`/api/${encodeURIComponent(hname)}${path}`, { cache: "no-store" });
    const data = (await res.json()) as { rows?: RawRow[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Failed to load.");
    return data.rows ?? [];
}

function display(value: string | null | undefined) {
    return value || "-";
}

function InfoField({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="rounded-xl bg-gray-50 p-4 border border-gray-100 dark:bg-gray-800/40 dark:border-gray-700/50 flex flex-col justify-center">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</label>
            <div className="text-base font-semibold text-gray-900 dark:text-gray-100 break-words">
                {display(value)}
            </div>
        </div>
    );
}

interface PrescriptionItem {
    medicine?: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
}

function PrescriptionView({ data }: { data: string }) {
    let items: PrescriptionItem[] = [];
    try { items = JSON.parse(data) as PrescriptionItem[]; } catch { /* ignore */ }
    if (!items.length) return <p className="text-sm text-gray-500">No prescription data.</p>;
    return (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-200">
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">Medicine</th>
                        <th className="px-3 py-2 text-left">Dosage</th>
                        <th className="px-3 py-2 text-left">Frequency</th>
                        <th className="px-3 py-2 text-left">Duration</th>
                        <th className="px-3 py-2 text-left">Instructions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {items.map((item, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                            <td className="px-3 py-2 font-medium text-gray-800">{item.medicine || "—"}</td>
                            <td className="px-3 py-2 text-gray-600">{item.dosage || "—"}</td>
                            <td className="px-3 py-2 text-gray-600">{item.frequency || "—"}</td>
                            <td className="px-3 py-2 text-gray-600">{item.duration || "—"}</td>
                            <td className="px-3 py-2 text-gray-600">{item.instructions || "—"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

interface DetailPanelProps {
    row: ConsultationRow;
    hname: string;
    onClose: () => void;
}

function DetailPanel({ row, hname, onClose }: DetailPanelProps) {
    const [tab, setTab] = useState<DetailTab>("Patient Details");
    const [vitalsData, setVitalsData] = useState<VitalsRow | null>(null);
    const [historyRows, setHistoryRows] = useState<AppointmentRow[]>([]);
    const [pharmacyRecords, setPharmacyRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const appointmentId = row.id;
    const patientIdentifier = row.patientId || row.patientDetails;

    const fetchDetails = useCallback(async () => {
        if (!appointmentId && !row.patientDetails) return;
        setIsLoading(true);
        try {
            // Use appointmentId for consultation-specific records (pharmacy)
            // Use patientIdentifier (patientId or Name) for global history
            const [histRes, pharmRes] = await Promise.all([
                patientIdentifier ? loadRows(hname, `/appointments?patientId=${encodeURIComponent(patientIdentifier)}`) : Promise.resolve([]),
                appointmentId ? loadRows(hname, `/forms/pharmacy_dispensing?token_number=${encodeURIComponent(appointmentId)}`) : Promise.resolve([])
            ]);

            setHistoryRows(histRes as AppointmentRow[]);
            setPharmacyRecords(pharmRes);
        } catch {
            // ignore errors silently
        } finally {
            setIsLoading(false);
        }
    }, [hname, appointmentId, patientIdentifier, row]);

    useEffect(() => {
        if (row.vitals) {
            setVitalsData(row.vitals);
        }
    }, [row.vitals]);

    useEffect(() => { void fetchDetails(); }, [fetchDetails]);

    // Prevent body scroll when panel is open
    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = ""; };
    }, []);

    const vitalsFields = vitalsData ? [
        ["Age", String(vitalsData.age ?? "")],
        ["Height (cm)", String(vitalsData.height_cm ?? "")],
        ["Weight (kg)", String(vitalsData.weight_kg ?? "")],
        ["BMI", String(vitalsData.bmi ?? "")],
        ["Temperature", String(vitalsData.temperature ?? "")],
        ["Pulse Rate", String(vitalsData.pulse_rate ?? "")],
        ["Respiratory Rate", String(vitalsData.respiratory_rate ?? "")],
        ["Systolic BP", String(vitalsData.systolic_bp ?? "")],
        ["Diastolic BP", String(vitalsData.diastolic_bp ?? "")],
        ["SpO2", String(vitalsData.spo2 ?? "")],
        ["Blood Sugar", String(vitalsData.blood_sugar ?? "")],
        ["Remarks", String(vitalsData.remarks ?? "")],
    ] : [];

    return (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 sm:p-6 lg:p-8">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Centered modal */}
            <div className="relative flex w-full max-w-4xl max-h-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900 ring-1 ring-black/5 dark:ring-white/10 animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5 dark:border-gray-800">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Consultation Record</p>
                        <h3 className="mt-1 text-xl font-semibold text-gray-800 dark:text-white/90">{row.patientDetails || "Patient"}</h3>
                        <p className="mt-0.5 text-sm text-gray-500">{row.doctor} · {row.department}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Step Tracer */}
                <div className="px-10 py-2 pb-8 border-b border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/10 flex items-center justify-between">
                    <StepTracer row={row} />

                </div>

                {/* Detail Tabs */}
                <div className="px-6 py-4 flex-none">
                    <div className="flex gap-2 p-1 overflow-x-auto no-scrollbar justify-between">
                        {DETAIL_TABS.map(t => (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                className={`rounded-lg px-4 py-2 text-xs font-bold transition-all uppercase tracking-wider whitespace-nowrap ${tab === t
                                    ? "bg-brand-500 text-white shadow-md shadow-brand-200 dark:shadow-none"
                                    : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                                    }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-gray-900">
                    {isLoading ? (
                        <div className="flex h-32 items-center justify-center text-sm text-gray-500">Loading details...</div>
                    ) : (
                        <div className="mb-2">
                            {/* ── Patient Details ── */}
                            {tab === "Patient Details" && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <InfoField label="Patient Name" value={row.patientDetails} />
                                    <InfoField label="Appointment / Token" value={row.tokenNumber ? `APT-${String(row.tokenNumber).padStart(4, "0")}` : undefined} />
                                    <InfoField label="Doctor" value={row.doctor} />
                                    <InfoField label="Department" value={row.department} />
                                    <InfoField label="Patient Type" value={row.patientType === "IP" ? "IP — Inpatient" : "OP — Outpatient"} />
                                    <InfoField label="Consultation Amount" value={row.consultationAmount ? `₹${row.consultationAmount}` : undefined} />
                                    <InfoField label="Follow-up Days" value={row.followUpDays ? `${row.followUpDays} day(s)` : undefined} />
                                    <InfoField label="Date" value={row.updatedAt ? formatDisplayDate(row.updatedAt.slice(0, 10)) : undefined} />
                                    {/* Additional info from vitals record */}
                                    {vitalsData && (
                                        <>
                                            <InfoField label="Gender" value={String(vitalsData.gender ?? "")} />
                                            <InfoField label="Date of Birth" value={vitalsData.dob ? String(vitalsData.dob).slice(0, 10) : undefined} />
                                            <InfoField label="Address" value={String(vitalsData.address ?? "")} />
                                            <InfoField label="Mobile" value={String(vitalsData.mobile ?? "")} />
                                        </>
                                    )}
                                </div>
                            )}

                            {/* ── Vitals ── */}
                            {tab === "Vitals" && (
                                vitalsData ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                        {vitalsFields.map(([label, val]) => (
                                            <InfoField key={label} label={label} value={val} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                                        No vitals data found for this patient on the consultation date.
                                    </div>
                                )
                            )}

                            {/* ── Consultation ── */}
                            {tab === "Consultation Form" && (
                                row.id ? (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                            <InfoField label="Diagnosis" value={row.diagnosisName} />
                                            <InfoField label="Symptoms" value={row.symptoms} />
                                            <div className="sm:col-span-2">
                                                <InfoField label="Remarks" value={row.remarks} />
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Prescription</h4>
                                            <PrescriptionView data={row.prescriptionData} />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="mb-4 rounded-full bg-gray-50 p-4">
                                            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        <h4 className="text-lg font-medium text-gray-900">No Digital Record</h4>
                                        <p className="mt-1 text-sm text-gray-500 max-w-xs">
                                            The doctor has not yet documented the consultation for this visit. You can still check vitals and history.
                                        </p>
                                    </div>
                                )
                            )}

                            {/* ── Pharmacy ── */}
                            {tab === "Pharmacy" && (
                                pharmacyRecords.length > 0 ? (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                                                <div className="text-xs font-medium text-gray-500 uppercase">Total Amount</div>
                                                <div className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                                                    Rs. {pharmacyRecords.reduce((sum, r) => sum + Number(r.billing_amount || 0), 0).toFixed(2)}
                                                </div>
                                            </div>
                                            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                                                <div className="text-xs font-medium text-gray-500 uppercase">Bills Generated</div>
                                                <div className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{pharmacyRecords.length}</div>
                                            </div>
                                        </div>

                                        <div className="overflow-hidden rounded-xl border border-gray-200">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                    <tr>
                                                        <th className="px-4 py-3">Medicine Details</th>
                                                        <th className="px-4 py-3 text-right">Amount</th>
                                                        <th className="px-4 py-3">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {pharmacyRecords.map((r, i) => {
                                                        const medicines = JSON.parse(r.medicine_lines || "[]");
                                                        return (
                                                            <tr key={i} className="hover:bg-gray-50/50 transition">
                                                                <td className="px-4 py-3">
                                                                    <div className="space-y-1">
                                                                        {medicines.map((m: any, j: number) => (
                                                                            <div key={j} className="text-gray-700 dark:text-gray-300">
                                                                                • {m.medicineName} (Qty: {m.receivedQty})
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                                                                    Rs. {Number(r.billing_amount || 0).toFixed(2)}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <span className={`inline-flex rounded-full px-2 text-[10px] font-semibold leading-5 ${r.payment_status === "Paid" ? "bg-emerald-100 text-emerald-800" : "bg-brand-100 text-brand-800"
                                                                        }`}>
                                                                        {r.payment_status || "Pending"}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="mb-4 rounded-full bg-gray-50 p-4">
                                            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                            </svg>
                                        </div>
                                        <h4 className="text-lg font-medium text-gray-900">No Pharmacy Activity</h4>
                                        <p className="mt-1 text-sm text-gray-500 max-w-xs">
                                            No pharmacy dispensing records were found for this visit.
                                        </p>
                                    </div>
                                )
                            )}

                            {/* ── History ── */}
                            {tab === "History" && (
                                historyRows.length > 0 ? (
                                    <div className="space-y-3">
                                        {[...historyRows]
                                            .sort((a, b) =>
                                                `${String(b.appointment_date ?? "")} ${String(b.appointment_time ?? "")}`.localeCompare(
                                                    `${String(a.appointment_date ?? "")} ${String(a.appointment_time ?? "")}`
                                                )
                                            )
                                            .map((r, i) => (
                                                <div key={String(r.id ?? i)} className="flex gap-4 items-center text-sm border border-gray-100 bg-white p-3 rounded-lg shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
                                                    <div className="font-medium whitespace-nowrap text-gray-900 dark:text-gray-100">
                                                        {r.appointment_date ? formatDisplayDate(String(r.appointment_date).slice(0, 10)) : "—"} {r.appointment_time ? formatDisplayTime(String(r.appointment_time)) : ""}
                                                    </div>
                                                    <div className="flex-1 text-gray-700 dark:text-gray-300">{String(r.doctor ?? "Unknown Doctor")}</div>
                                                    <div className="text-gray-500 whitespace-nowrap flex-1">{String(r.department ?? "")}</div>
                                                    <div className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 font-medium dark:bg-gray-800 dark:text-gray-300">{String(r.status ?? "Completed")}</div>
                                                </div>
                                            ))}
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-500">
                                        No appointment history found for this patient.
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Main Records Page ────────────────────────────────────────────────────────

export default function RecordsPage() {
    const params = useParams();
    const hname = decodeURIComponent(params?.Hname as string);

    const [currentRole, setCurrentRole] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [allDoctors, setAllDoctors] = useState<DoctorMasterRow[]>([]);
    const [selectedDept, setSelectedDept] = useState("");
    const [selectedDoctor, setSelectedDoctor] = useState("");

    // Pagination and Mode States
    const [viewMode, setViewMode] = useState<"patients" | "visits">("patients");
    const [selectedPatientName, setSelectedPatientName] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    const [rows, setRows] = useState<any[]>([]); // Unique Patients
    const [visitRows, setVisitRows] = useState<ConsultationRow[]>([]); // Visits for a patient
    const [isLoadingRows, setIsLoadingRows] = useState(false);
    const [isLoadingVisits, setIsLoadingVisits] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [selectedRow, setSelectedRow] = useState<ConsultationRow | null>(null);

    // Load role and doctor list
    useEffect(() => {
        let cancelled = false;
        async function init() {
            setIsLoading(true);
            try {
                const role = await getCurrentUserRole(hname);
                if (cancelled) return;
                setCurrentRole(role ?? "");
                if (role?.toLowerCase() === "admin") {
                    const drRows = await loadRows(hname, `/forms/${DOCTOR_TABLE}`);
                    if (!cancelled) {
                        setAllDoctors(
                            drRows.map(r => ({
                                name: text(r, ["doctor_consultant_name", "doctorConsultantName", "consultant_doctor_name", "name"]),
                                department: text(r, ["clinic", "department", "department_type", "departmentType"]),
                            })).filter(d => d.name && d.department)
                        );
                    }
                }
            } catch (err) {
                if (!cancelled) setErrorMessage(err instanceof Error ? err.message : "Failed to load.");
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }
        void init();
        return () => { cancelled = true; };
    }, [hname]);

    // Load unique patients with pagination
    useEffect(() => {
        if (viewMode !== "patients") return;
        let cancelled = false;
        async function fetchPatientRecords() {
            if (currentRole?.toLowerCase() !== "admin") return;
            setIsLoadingRows(true);
            setErrorMessage("");
            try {
                const url = `/patient-records?page=${page}&pageSize=${pageSize}&department=${encodeURIComponent(selectedDept)}&doctor=${encodeURIComponent(selectedDoctor)}`;
                const res = await fetch(`/api/${encodeURIComponent(hname)}${url}`, { cache: "no-store" });
                const data = await res.json();
                if (cancelled) return;
                if (!res.ok) throw new Error(data.error || "Failed to load patient records.");

                setRows(data.rows || []);
                setTotalCount(data.totalCount || 0);
            } catch (err) {
                if (!cancelled) setErrorMessage(err instanceof Error ? err.message : "Failed to load records.");
            } finally {
                if (!cancelled) setIsLoadingRows(false);
            }
        }
        void fetchPatientRecords();
        return () => { cancelled = true; };
    }, [hname, currentRole, selectedDept, selectedDoctor, page, pageSize, viewMode]);

    // Load visits for selected patient
    const loadVisits = async (pName: string) => {
        setIsLoadingVisits(true);
        setSelectedPatientName(pName);
        setViewMode("visits");
        try {
            const res = await fetch(`/api/${encodeURIComponent(hname)}/patient-records?patientName=${encodeURIComponent(pName)}`, { cache: "no-store" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to load visits.");
            setVisitRows(data.rows.map(normalizeRow));
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : "Failed to load visits.");
        } finally {
            setIsLoadingVisits(false);
        }
    };

    if (isLoading) return <div><div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading...</div></div>;
    if (!currentRole) return <div><div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">Please sign in.</div></div>;
    if (currentRole.toLowerCase() !== "admin") return <div><div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">Admin only.</div></div>;

    const depts = Array.from(new Set(allDoctors.map(d => d.department).filter(Boolean))).sort();
    const doctorsInDept = selectedDept
        ? Array.from(new Set(allDoctors.filter(d => d.department === selectedDept).map(d => d.name))).sort()
        : Array.from(new Set(allDoctors.map(d => d.name))).sort();

    const totalPages = Math.ceil(totalCount / pageSize);

    const handleVisitClick = (row: ConsultationRow) => {
        setSelectedRow(row);
    };

    return (
        <>
            {selectedRow && (
                <DetailPanel
                    row={selectedRow}
                    hname={hname}
                    onClose={() => setSelectedRow(null)}
                />
            )}

            <div>
                <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
                    <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-800 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                {viewMode === "visits" && (
                                    <button
                                        onClick={() => setViewMode("patients")}
                                        className="mr-2 p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-brand-500"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                                    </button>
                                )}
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        {viewMode === "patients" ? "Master Patient Records" : `Visits for ${selectedPatientName}`}
                                    </p>
                                    <h2 className="mt-1 text-2xl font-semibold text-gray-800 dark:text-white/90">Hospital Records</h2>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-3 items-center">
                            {viewMode === "patients" && (
                                <>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500 font-medium">Show</span>
                                        <select
                                            value={pageSize}
                                            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                                            className="rounded-lg border border-gray-300 px-2 py-2 text-sm bg-white font-medium"
                                        >
                                            {[10, 20, 50, 100].map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div className="h-4 w-px bg-gray-200 mx-1" />
                                </>
                            )}
                            <select
                                value={selectedDept}
                                onChange={(e) => { setSelectedDept(e.target.value); setSelectedDoctor(""); setPage(1); }}
                                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            >
                                <option value="">All Departments</option>
                                {depts.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <select
                                value={selectedDoctor}
                                onChange={(e) => { setSelectedDoctor(e.target.value); setPage(1); }}
                                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            >
                                <option value="">All Doctors</option>
                                {doctorsInDept.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="p-4 sm:p-6">
                        {isLoadingRows || isLoadingVisits ? (
                            <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 animate-pulse">Loading data...</div>
                        ) : viewMode === "patients" ? (
                            rows.length > 0 ? (
                                <div className="space-y-4">
                                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                    <th className="px-5 py-4 text-left">Patient Name</th>
                                                    <th className="px-5 py-4 text-left">Patient ID</th>
                                                    <th className="px-5 py-4 text-left">Total Visits</th>
                                                    <th className="px-5 py-4 text-left">Last Visit</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {rows.map((row, i) => (
                                                    <tr
                                                        key={row.patient_name + i}
                                                        onClick={() => loadVisits(row.patient_name)}
                                                        className="group cursor-pointer hover:bg-brand-50/50 transition-colors"
                                                    >
                                                        <td className="px-5 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 font-bold text-lg group-hover:bg-brand-500 group-hover:text-white transition">
                                                                    {row.patient_name?.[0]?.toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <div className="font-semibold text-gray-900 group-hover:text-brand-700">{row.patient_name}</div>
                                                                    <div className="text-xs text-gray-500">{row.patient_phone || "No Phone"}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-4 text-gray-600">
                                                            {row.patient_id ? (
                                                                <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-700">{row.patient_id}</span>
                                                            ) : "-"}
                                                        </td>
                                                        <td className="px-5 py-4">
                                                            <span className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                                                                {row.total_visits} visit(s)
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-4 text-gray-600 font-medium">
                                                            {row.last_visit ? formatDisplayDate(String(row.last_visit).slice(0, 10)) : "-"}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Pagination Controls */}
                                    <div className="flex items-center justify-between border-t border-gray-100 pt-4 px-2">
                                        <p className="text-xs text-gray-500 font-medium whitespace-nowrap">
                                            Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} records
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                                disabled={page === 1}
                                                className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
                                            >
                                                <svg className="mr-1.5 w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                                Previous
                                            </button>
                                            <div className="flex items-center px-1">
                                                <span className="text-xs font-semibold text-gray-900 bg-brand-50 px-3 py-2 rounded-lg border border-brand-100">Page {page} of {totalPages}</span>
                                            </div>
                                            <button
                                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                                disabled={page === totalPages}
                                                className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
                                            >
                                                Next
                                                <svg className="ml-1.5 w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-xl border border-dashed border-gray-300 px-4 py-12 text-center text-sm text-gray-500 bg-gray-50/30">
                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 mb-4">
                                        <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                    </div>
                                    No patients found matching the criteria.
                                </div>
                            )
                        ) : (
                            /* Visit History Mode */
                            visitRows.length > 0 ? (
                                <div className="overflow-x-auto rounded-xl border border-gray-200">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                <th className="px-5 py-4 text-left">Visit Date</th>
                                                <th className="px-5 py-4 text-left">Doctor/Dept</th>
                                                <th className="px-5 py-4 text-left">Diagnosis</th>
                                                <th className="px-5 py-4 text-left">Cons. Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {visitRows.map((row, i) => {
                                                const d = row.updatedAt || row.createdAt || (row as any).appointment_date;
                                                return (
                                                    <tr
                                                        key={`${row.id || "v"}-${i}`}
                                                        onClick={() => handleVisitClick(row)}
                                                        className={`transition cursor-pointer ${row.id ? "hover:bg-brand-50/80" : "bg-gray-50/30 opacity-70 hover:bg-gray-100/50"}`}
                                                    >
                                                        <td className="px-5 py-4 text-gray-800 font-medium">
                                                            {d ? formatDisplayDate(String(d).slice(0, 10)) : "-"}
                                                        </td>
                                                        <td className="px-5 py-4">
                                                            <div className="font-medium text-gray-700">{row.doctor}</div>
                                                            <div className="text-[10px] text-gray-400 uppercase">{row.department}</div>
                                                        </td>
                                                        <td className="px-5 py-4 text-gray-600 max-w-[300px] truncate">{row.diagnosisName || "N/A"}</td>
                                                        <td className="px-5 py-4">
                                                            {row.id ? (
                                                                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${row.status === "Completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                                                                    {row.status}
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-500">
                                                                    No Record
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">No visits recorded for this patient.</div>
                            )
                        )}
                        {errorMessage ? (
                            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">{errorMessage}</div>
                        ) : null}
                    </div>
                </section>
            </div>
        </>
    );
}
