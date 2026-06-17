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
    createdAt: string;
    updatedAt: string;
};
type DoctorMasterRow = { name: string; department: string };
type VitalsRow = Record<string, string | number | null>;
type AppointmentRow = Record<string, string | number | null>;

type DetailTab = "Patient Details" | "Vitals" | "Consultation Form" | "History";
const DETAIL_TABS: DetailTab[] = ["Patient Details", "Vitals", "Consultation Form", "History"];

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
    return {
        id: Number(row.id ?? 0),
        status: text(row, ["status"]),
        doctor: text(row, ["doctor"]),
        department: text(row, ["department"]),
        tokenNumber: text(row, ["tokenNumber", "token_number"]),
        patientDetails: text(row, ["patientDetails", "patient_details"]),
        diagnosisName: text(row, ["diagnosisName", "diagnosis_name"]),
        symptoms: text(row, ["symptoms"]),
        remarks: text(row, ["remarks"]),
        followUpDays: text(row, ["followUpDays", "follow_up_days"]),
        consultationAmount: text(row, ["consultationAmount", "consultation_amount"]),
        patientType: text(row, ["patientType", "patient_type"]),
        prescriptionData: text(row, ["prescriptionData", "prescription_data"]),
        createdAt: text(row, ["createdAt", "created_at"]),
        updatedAt: text(row, ["updatedAt", "updated_at"]),
    };
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
    const [isLoading, setIsLoading] = useState(false);

    const patientId = row.tokenNumber; // token_number = appointment_id in consultation

    const fetchDetails = useCallback(async () => {
        if (!patientId && !row.patientDetails) return;
        setIsLoading(true);
        try {
            // Get vitals: query by doctor + date (approximated from updatedAt)
            const date = (row.updatedAt || row.createdAt).slice(0, 10);
            const [vitalsRes, histRes] = await Promise.all([
                // Fetch vitals, try to identify patient by name match
                loadRows(hname, `/vitals?doctor=${encodeURIComponent(row.doctor)}&date=${encodeURIComponent(date)}`),
                // Fetch appointment history by patientId
                patientId
                    ? loadRows(hname, `/appointments?patientId=${encodeURIComponent(patientId)}`)
                    : Promise.resolve([]),
            ]);

            // Find vitals row matching patient name or token
            const matched = vitalsRes.find(vr =>
                (patientId && text(vr, ["appointment_id"]) === patientId) ||
                text(vr, ["registration_patient_name", "appointment_patient_name", "patient_name"]).toLowerCase() === row.patientDetails.toLowerCase()
            );
            setVitalsData(matched ? (matched as VitalsRow) : null);
            setHistoryRows(histRes as AppointmentRow[]);
        } catch {
            // ignore errors silently
        } finally {
            setIsLoading(false);
        }
    }, [hname, patientId, row]);

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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 lg:p-8">
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

                {/* Tab bar with Next button */}
                <div className="border-b border-gray-100 px-6 pt-4 dark:border-gray-800 flex items-center justify-between shrink-0">
                    <div className="flex gap-6 overflow-x-auto no-scrollbar">
                        {DETAIL_TABS.map(t => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setTab(t)}
                                className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t
                                    ? "border-brand-500 text-brand-500 dark:border-brand-400 dark:text-brand-400"
                                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                    }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                    {tab !== "History" && (
                        <button
                            type="button"
                            onClick={() => {
                                const idx = DETAIL_TABS.indexOf(tab);
                                if (idx < DETAIL_TABS.length - 1) setTab(DETAIL_TABS[idx + 1]);
                            }}
                            className="mb-1 flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-500 px-3 py-1.5 text-xs font-semibold text-brand-500 hover:bg-brand-50 transition dark:hover:bg-brand-900/20"
                        >
                            Next
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    )}
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
    const [selectedDate, setSelectedDate] = useState(() => toKey(new Date()));
    const [rows, setRows] = useState<ConsultationRow[]>([]);
    const [isLoadingRows, setIsLoadingRows] = useState(false);
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

    // Load completed consultation records
    useEffect(() => {
        let cancelled = false;
        async function fetchRecords() {
            if (currentRole?.toLowerCase() !== "admin") return;
            setIsLoadingRows(true);
            setErrorMessage("");
            try {
                const all = await loadRows(hname, `/forms/doctor_consultation_entry`);
                if (cancelled) return;
                const doctorsInDept = selectedDept
                    ? allDoctors.filter(d => d.department === selectedDept).map(d => d.name.toLowerCase())
                    : allDoctors.map(d => d.name.toLowerCase());
                const targetDoctors = selectedDoctor
                    ? [selectedDoctor.toLowerCase()]
                    : doctorsInDept;
                const filtered = all
                    .map(normalizeRow)
                    .filter(r => r.status === "Completed")
                    .filter(r => targetDoctors.length === 0 || targetDoctors.includes(r.doctor.toLowerCase()))
                    .filter(r => {
                        const df = r.updatedAt || r.createdAt;
                        if (!df) return true;
                        return df.slice(0, 10) === selectedDate;
                    });
                setRows(filtered);
            } catch (err) {
                if (!cancelled) setErrorMessage(err instanceof Error ? err.message : "Failed to load records.");
            } finally {
                if (!cancelled) setIsLoadingRows(false);
            }
        }
        void fetchRecords();
        return () => { cancelled = true; };
    }, [hname, currentRole, selectedDept, selectedDoctor, selectedDate, allDoctors]);

    if (isLoading) return <div><div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading...</div></div>;
    if (!currentRole) return <div><div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">Please sign in.</div></div>;
    if (currentRole.toLowerCase() !== "admin") return <div><div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">Admin only.</div></div>;

    const depts = Array.from(new Set(allDoctors.map(d => d.department).filter(Boolean))).sort();
    const doctorsInDept = selectedDept
        ? Array.from(new Set(allDoctors.filter(d => d.department === selectedDept).map(d => d.name))).sort()
        : Array.from(new Set(allDoctors.map(d => d.name))).sort();

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
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Completed Consultations</p>
                            <h2 className="mt-1 text-2xl font-semibold text-gray-800 dark:text-white/90">Records</h2>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <DatePicker value={selectedDate} onChange={setSelectedDate} className="z-[100]" />
                            <select
                                value={selectedDept}
                                onChange={(e) => { setSelectedDept(e.target.value); setSelectedDoctor(""); }}
                                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            >
                                <option value="">All Departments</option>
                                {depts.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <select
                                value={selectedDoctor}
                                onChange={(e) => setSelectedDoctor(e.target.value)}
                                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            >
                                <option value="">All Doctors</option>
                                {doctorsInDept.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="p-4 sm:p-6">
                        {isLoadingRows ? (
                            <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">Loading records...</div>
                        ) : rows.length > 0 ? (
                            <div className="overflow-x-auto rounded-xl border border-gray-200">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            <th className="px-4 py-3 text-left">#</th>
                                            <th className="px-4 py-3 text-left">Patient</th>
                                            <th className="px-4 py-3 text-left">Doctor</th>
                                            <th className="px-4 py-3 text-left">Department</th>
                                            <th className="px-4 py-3 text-left">Diagnosis</th>
                                            <th className="px-4 py-3 text-left">Symptoms</th>
                                            <th className="px-4 py-3 text-left">Type</th>
                                            <th className="px-4 py-3 text-left">Follow-up</th>
                                            <th className="px-4 py-3 text-left">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {rows.map((row, i) => (
                                            <tr
                                                key={row.id}
                                                onClick={() => setSelectedRow(row)}
                                                className="cursor-pointer hover:bg-brand-50 transition"
                                            >
                                                <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                                                <td className="px-4 py-3 font-medium text-gray-800">
                                                    {row.patientDetails || "-"}
                                                    {row.tokenNumber ? (
                                                        <span className="ml-2 text-[10px] font-mono text-brand-600 bg-brand-50 rounded px-1.5 py-0.5">{row.tokenNumber}</span>
                                                    ) : null}
                                                </td>
                                                <td className="px-4 py-3 text-gray-700">{row.doctor || "-"}</td>
                                                <td className="px-4 py-3 text-gray-600">{row.department || "-"}</td>
                                                <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{row.diagnosisName || "-"}</td>
                                                <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">{row.symptoms || "-"}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${row.patientType === "IP" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                                                        }`}>
                                                        {row.patientType === "IP" ? "IP" : "OP"}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-600">{row.followUpDays ? `${row.followUpDays} day(s)` : "-"}</td>
                                                <td className="px-4 py-3 text-gray-600">{row.consultationAmount ? `₹${row.consultationAmount}` : "-"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                                No completed consultations for {formatDisplayDate(selectedDate)}.
                            </div>
                        )}
                        {errorMessage ? (
                            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
                        ) : null}
                    </div>
                </section>
            </div>
        </>
    );
}
