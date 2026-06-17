"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getCurrentUser, getCurrentUserRole } from "../../actions/user";
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
    createdAt: string;
    updatedAt: string;
};

type DoctorMasterRow = {
    name: string;
    department: string;
};

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

    // Load role and doctor master list
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
                        const doctors = drRows.map(row => ({
                            name: text(row, ["doctor_consultant_name", "doctorConsultantName", "consultant_doctor_name", "name"]),
                            department: text(row, ["clinic", "department", "department_type", "departmentType"]),
                        })).filter(doc => doc.name && doc.department);
                        setAllDoctors(doctors);
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
                // Fetch all consultation_entry records and filter
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
                        // Filter by date using createdAt or updatedAt
                        const dateField = r.updatedAt || r.createdAt;
                        if (!dateField) return true; // include if no date
                        return dateField.slice(0, 10) === selectedDate;
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

    if (isLoading) {
        return (
            <div>
                <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading...</div>
            </div>
        );
    }

    if (!currentRole) {
        return (
            <div>
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">Please sign in to view records.</div>
            </div>
        );
    }

    if (currentRole.toLowerCase() !== "admin") {
        return (
            <div>
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">Only admin accounts can access this page.</div>
            </div>
        );
    }

    const depts = Array.from(new Set(allDoctors.map(d => d.department).filter(Boolean))).sort();
    const doctorsInDept = selectedDept
        ? Array.from(new Set(allDoctors.filter(d => d.department === selectedDept).map(d => d.name))).sort()
        : Array.from(new Set(allDoctors.map(d => d.name))).sort();

    return (
        <div>
            <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
                <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-800 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Completed Consultations</p>
                        <h2 className="mt-1 text-2xl font-semibold text-gray-800 dark:text-white/90">Records</h2>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <DatePicker
                            value={selectedDate}
                            onChange={(val) => setSelectedDate(val)}
                            className="z-[100]"
                        />
                        <select
                            value={selectedDept}
                            onChange={(e) => {
                                setSelectedDept(e.target.value);
                                setSelectedDoctor("");
                            }}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        >
                            <option value="">All Departments</option>
                            {depts.map((dept) => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))}
                        </select>
                        <select
                            value={selectedDoctor}
                            onChange={(e) => setSelectedDoctor(e.target.value)}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        >
                            <option value="">All Doctors</option>
                            {doctorsInDept.map((doc) => (
                                <option key={doc} value={doc}>{doc}</option>
                            ))}
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
                                            onClick={() => {/* no-op: rows are clickable but do nothing */ }}
                                            className="cursor-pointer hover:bg-gray-50 transition"
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
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${row.patientType === "IP"
                                                        ? "bg-purple-100 text-purple-700"
                                                        : "bg-blue-100 text-blue-700"
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
    );
}
