"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

import { CheckCircleIcon, PencilIcon } from "../../../components/icons";
import { useHospitalTimezone } from "../../../components/context/HospitalTimezoneContext";

type DoctorRow = { doctor?: string; first_time?: string | null; total?: number };
type VitalsRow = Record<string, unknown> & { appointment_end_time?: string | null };

type FormState = {
  patientId: string;
  patientName: string;
  dob: string;
  age: string;
  gender: string;
  heightCm: string;
  weightKg: string;
  temperature: string;
  pulseRate: string;
  respiratoryRate: string;
  systolicBp: string;
  diastolicBp: string;
  spo2: string;
  bloodSugar: string;
  remarks: string;
  status: string;
  mobile: string;
};

function emptyForm(): FormState {
  return {
    patientId: "",
    patientName: "",
    dob: "",
    age: "",
    gender: "",
    heightCm: "",
    weightKg: "",
    temperature: "",
    pulseRate: "",
    respiratoryRate: "",
    systolicBp: "",
    diastolicBp: "",
    spo2: "",
    bloodSugar: "",
    remarks: "",
    status: "Active",
    mobile: "",
  };
}

function text(row: VitalsRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return "";
}

function formatDisplayTime(value: string) {
  const [hoursText, minutesText = "00"] = value.split(":");
  const date = new Date();
  date.setHours(Number(hoursText), Number(minutesText), 0, 0);
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(date).replace(/\s/g, "");
}

function formatTimeRange(start: string, end?: string | null) {
  const endText = end ? formatDisplayTime(end) : "";
  return endText ? `${formatDisplayTime(start)} - ${endText}` : formatDisplayTime(start);
}

function calculateAge(dob: string) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const diff = Date.now() - birth.getTime();
  const age = new Date(diff).getUTCFullYear() - 1970;
  return isFinite(age) && age >= 0 ? age : null;
}

function isCompleted(row: VitalsRow) {
  return Boolean(row.vitals_id || row.vitals_status);
}

export default function PatientVitalsPage() {
  const params = useParams();
  const hname = params?.Hname as string;
  const { todayDate } = useHospitalTimezone();
  const [date, setDate] = useState(() => todayDate);
  const [searchQuery, setSearchQuery] = useState("");
  const [rows, setRows] = useState<VitalsRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<VitalsRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isEditing, setIsEditing] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);
  const [doctorsList, setDoctorsList] = useState<{ name: string, department: string }[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  const dateLabel = useMemo(() => {
    if (!date) return "Select date";
    const [year, month, day] = date.split("-");
    return `${day}-${month}-${year}`;
  }, [date]);

  const buildVitalsUrl = useCallback((selectedDate: string, selectedDoctorName: string) => {
    const url = new URL(`/api/${encodeURIComponent(hname)}/vitals`, window.location.origin);
    if (selectedDate) url.searchParams.set("date", selectedDate);
    if (selectedDoctorName) url.searchParams.set("doctor", selectedDoctorName);
    return url.toString();
  }, [hname]);

  useEffect(() => {
    async function loadPatients() {
      if (!hname) return;
      setLoading(true);
      try {
        const response = await fetch(buildVitalsUrl(date, "all"), { cache: "no-store" });
        const data = (await response.json()) as { rows?: VitalsRow[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Failed to load patients.");
        setRows(data.rows ?? []);
      } finally {
        setLoading(false);
      }
    }
    void loadPatients().catch((err) => setError(err instanceof Error ? err.message : "Failed to load patients."));
  }, [buildVitalsUrl, date, hname]);

  useEffect(() => {
    async function loadOptions() {
      if (!hname) return;
      try {
        const [depRes, docRes] = await Promise.all([
          fetch(`/api/${encodeURIComponent(hname)}/forms/department_master`, { cache: "no-store" }),
          fetch(`/api/${encodeURIComponent(hname)}/forms/consultant_doctor_master`, { cache: "no-store" })
        ]);
        const depData = await depRes.json();
        const docData = await docRes.json();

        const deps = (depData.rows || []).map((r: any) => String(r.department_type || r.departmentType || r.department_name || r.name || r.code || "")).filter(Boolean);
        setDepartments(Array.from(new Set(deps)) as string[]);

        const docs = (docData.rows || []).map((r: any) => ({
          name: String(r.doctor_consultant_name || r.doctorConsultantName || r.consultant_doctor_name || r.name || ""),
          department: String(r.clinic || r.department || r.department_type || r.departmentType || "")
        })).filter((r: any) => r.name);
        setDoctorsList(docs);
      } catch (err) {
        console.error(err);
      }
    }
    void loadOptions();
  }, [hname]);

  const filteredRows = useMemo(() => {
    let result = rows.filter(row => !!row.appointment_check_in_time);
    if (selectedDepartment) {
      result = result.filter((row) => text(row, ["department"]) === selectedDepartment);
    }
    if (selectedDoctor) {
      result = result.filter((row) => text(row, ["doctor"]) === selectedDoctor);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((row) => {
        const pName = text(row, ["registration_patient_name", "appointment_patient_name", "patient_name"]).toLowerCase();
        const dName = text(row, ["doctor"]).toLowerCase();
        return pName.includes(q) || dName.includes(q);
      });
    }
    result = [...result].sort((a, b) => {
      const timeA = text(a, ["appointment_time"]);
      const timeB = text(b, ["appointment_time"]);
      if (!timeA && !timeB) return 0;
      if (!timeA) return 1;
      if (!timeB) return -1;
      return timeA.localeCompare(timeB);
    });
    return result;
  }, [rows, searchQuery, selectedDepartment, selectedDoctor]);

  const selectedSummary = useMemo(() => {
    if (!selectedRow) return null;
    return {
      name: text(selectedRow, ["registration_patient_name", "appointment_patient_name", "patient_name"]),
      type: text(selectedRow, ["patient_type"]) || (selectedRow.appointment_id ? "Appointment" : "Walk in"),
      time: text(selectedRow, ["appointment_time"]),
      endTime: text(selectedRow, ["appointment_end_time"]),
      slot: text(selectedRow, ["time_slot_minutes"]),
      completed: isCompleted(selectedRow),
    };
  }, [selectedRow]);

  async function saveVitals(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/${encodeURIComponent(hname)}/vitals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, appointmentId: selectedRow?.appointment_id }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to save vitals.");
      setMessage("Vitals saved.");
      setSelectedRow(null);
      setForm(emptyForm());
      const refreshed = await fetch(buildVitalsUrl(date, "all"), { cache: "no-store" });
      const refreshedData = (await refreshed.json()) as { rows?: VitalsRow[] };
      setRows(refreshedData.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save vitals.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-800 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-medium text-gray-800 dark:text-white/90">Patient Vitals</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Today&apos;s doctors, patients, and vitals entry.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => dateInputRef.current?.showPicker?.()}
            className="flex h-11 min-w-[160px] items-center justify-between rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-800"
          >
            <span>{dateLabel}</span>
            <span className="text-xs text-gray-400">{date ? "Change" : "Choose"}</span>
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="sr-only"
            aria-label="Select appointment date"
          />
        </div>
      </div>
      <div className="p-4 sm:p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <input
              type="text"
              placeholder="Search by patient or doctor name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full max-w-md rounded-lg border border-gray-300 px-4 text-sm focus:border-brand-500 focus:ring-brand-500"
            />
            <div className="flex flex-1 items-center gap-3 justify-end">
              <select
                value={selectedDepartment}
                onChange={(e) => { setSelectedDepartment(e.target.value); setSelectedDoctor(""); }}
                className="h-11 w-full max-w-[200px] rounded-lg border border-gray-300 bg-white px-4 text-sm"
              >
                <option value="">All Departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select
                value={selectedDoctor}
                onChange={(e) => setSelectedDoctor(e.target.value)}
                className="h-11 w-full max-w-[200px] rounded-lg border border-gray-300 bg-white px-4 text-sm"
              >
                <option value="">All Doctors</option>
                {doctorsList
                  .filter(d => !selectedDepartment || d.department === selectedDepartment)
                  .map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
              </select>
            </div>
          </div>

          {message ? <div className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">{message}</div> : null}
          {error ? <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div> : null}

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">Patient</th>
                  <th className="px-4 py-3 text-left">Patient ID</th>
                  <th className="px-4 py-3 text-left">Appt. No.</th>
                  <th className="px-4 py-3 text-left">Doctor</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">Slot</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td className="px-4 py-6 text-gray-500 text-center" colSpan={10}>Loading...</td></tr>
                ) : filteredRows.length === 0 ? (
                  <tr><td className="px-4 py-6 text-gray-500 text-center" colSpan={10}>No patients found.</td></tr>
                ) : filteredRows.map((row) => {
                  const done = isCompleted(row);
                  const name = text(row, ["registration_patient_name", "appointment_patient_name", "patient_name"]);
                  const rawPid = text(row, ["registration_patient_id", "appointment_patient_id", "patient_id"]);
                  const displayPatientId = rawPid && isNaN(Number(rawPid)) ? rawPid : "";
                  const pType = text(row, ["patient_type"]) || (row.appointment_id ? "Appointment" : "Walk in");
                  const isWalkInPatient = String(pType).toLowerCase() === "walk-in" || String(pType).toLowerCase() === "walk in";
                  const apptDate = text(row, ["appointment_date"]);
                  const dateCompact = apptDate ? apptDate.slice(0, 10).replace(/-/g, "") : "";
                  const appointmentNum = row.appointment_number
                    ? (isWalkInPatient
                      ? (dateCompact ? `WK-${dateCompact}-${String(row.appointment_number).padStart(4, "0")}` : `WK-${String(row.appointment_number).padStart(4, "0")}`)
                      : (dateCompact ? `APT-${dateCompact}-${String(row.appointment_number).padStart(4, "0")}` : `APT-${String(row.appointment_number).padStart(4, "0")}`))
                    : "-";
                  return (
                    <tr key={String(row.appointment_id ?? row.registration_id ?? name)}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{name}</div>
                        <div className="text-xs text-gray-500">{text(row, ["patient_type"]) || (row.appointment_id ? "Appointment" : "Walk in")}</div>
                      </td>
                      <td className="px-4 py-3">
                        {displayPatientId
                          ? <span className="font-mono text-xs text-brand-700 bg-brand-50 rounded px-2 py-0.5">{displayPatientId}</span>
                          : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-gray-600">{appointmentNum}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-medium">{text(row, ["doctor"])}</td>
                      <td className="px-4 py-3 text-gray-600">{text(row, ["patient_type"]) || (row.appointment_id ? "Appointment" : "Walk in")}</td>
                      <td className="px-4 py-3 text-gray-600">{text(row, ["appointment_date"])}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {text(row, ["appointment_time"])
                          ? formatTimeRange(text(row, ["appointment_time"]), text(row, ["appointment_end_time"]) || null)
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{text(row, ["time_slot_minutes"]) ? `${text(row, ["time_slot_minutes"])} min` : "-"}</td>
                      <td className="px-4 py-3">
                        {done ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-xs font-medium text-success-700">
                            <CheckCircleIcon className="h-4 w-4" />
                            Vitals completed
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRow(row);
                              setIsEditing(!done);
                              setForm({
                                patientId: text(row, ["registration_patient_id", "appointment_patient_id", "patient_id", "registration_id"]),
                                patientName: text(row, ["registration_patient_name", "appointment_patient_name", "patient_name"]),
                                mobile: text(row, ["mobile", "patient_phone"]),
                                dob: text(row, ["registration_dob", "dob"]).slice(0, 10),
                                age: text(row, ["age"]),
                                gender: text(row, ["gender"]),
                                heightCm: text(row, ["height_cm"]),
                                weightKg: text(row, ["weight_kg"]),
                                temperature: text(row, ["temperature"]),
                                pulseRate: text(row, ["pulse_rate"]),
                                respiratoryRate: text(row, ["respiratory_rate"]),
                                systolicBp: text(row, ["systolic_bp"]),
                                diastolicBp: text(row, ["diastolic_bp"]),
                                spo2: text(row, ["spo2"]),
                                bloodSugar: text(row, ["blood_sugar"]),
                                remarks: text(row, ["remarks"]),
                                status: text(row, ["vitals_status"]) || "Active",
                              });
                            }}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
                          >
                            {done ? "View" : "Enter Vitals"}
                          </button>
                          {done ? <CheckCircleIcon className="h-5 w-5 text-success-500" /> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedRow ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
                <div className="mb-6 flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
                  <div>
                    <div className="text-lg font-semibold text-gray-800 dark:text-white/90">{selectedSummary?.name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <span>{selectedSummary?.type}</span>
                      {selectedSummary?.time ? <span>• {selectedSummary.time}</span> : null}
                      {selectedSummary?.slot ? <span>• {selectedSummary.slot} min</span> : null}
                      {form.patientId ? (
                        <span className="inline-flex items-center gap-1 rounded bg-brand-50 px-2 py-0.5 text-xs font-mono font-semibold text-brand-700">
                          ID: {form.patientId}
                        </span>
                      ) : null}
                      {selectedRow?.appointment_id ? (
                        <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-600">
                          {selectedRow.appointment_number
                            ? (() => {
                              const apptDate = text(selectedRow, ["appointment_date"]);
                              const dateCompact = apptDate ? apptDate.slice(0, 10).replace(/-/g, "") : "";
                              const isWalkIn = String(text(selectedRow, ["patient_type"])).toLowerCase() === "walk-in" || String(text(selectedRow, ["patient_type"])).toLowerCase() === "walk in";
                              return isWalkIn
                                ? (dateCompact ? `WK-${dateCompact}-${String(selectedRow.appointment_number).padStart(4, "0")}` : `WK-${String(selectedRow.appointment_number).padStart(4, "0")}`)
                                : (dateCompact ? `APT-${dateCompact}-${String(selectedRow.appointment_number).padStart(4, "0")}` : `APT-${String(selectedRow.appointment_number).padStart(4, "0")}`);
                            })()
                            : "-"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedSummary?.completed && !isEditing ? (
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white transition"
                        title="Edit Vitals"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                    ) : null}
                    <button type="button" onClick={() => setSelectedRow(null)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white transition">
                      <span className="sr-only">Close</span>
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {!isEditing ? (
                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {[
                      ["patientId", "Patient ID"],
                      ["patientName", "Patient Name"],
                      ["mobile", "Mobile Number"],
                      ["dob", "DOB"],
                      ["age", "Age"],
                      ["gender", "Gender"],
                      ["heightCm", "Height (cm)"],
                      ["weightKg", "Weight (kg)"],
                      ["temperature", "Temperature (F/C)"],
                      ["pulseRate", "Pulse Rate (beats/min)"],
                      ["respiratoryRate", "Respiratory Rate (breaths/min)"],
                      ["systolicBp", "Systolic BP"],
                      ["diastolicBp", "Diastolic BP"],
                      ["spo2", "SpO2 (%)"],
                      ["bloodSugar", "Blood Sugar (Optional)"],
                      ["remarks", "Remarks"],
                      ["status", "Status"],
                    ].map(([key, label]) => {
                      let value = form[key as keyof FormState];
                      // Format date nicely if it's DOB
                      if (key === "dob" && value) {
                        try {
                          const [y, m, d] = value.split("-");
                          if (y && m && d) value = `${d}-${m}-${y}`;
                        } catch { }
                      }
                      return (
                        <div key={key} className={`rounded-xl border border-gray-100 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-white/[0.02] ${key === "remarks" ? "md:col-span-2 xl:col-span-3" : ""}`}>
                          <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{label}</div>
                          <div className="mt-1.5 text-sm font-semibold text-gray-800 dark:text-white/90">
                            {value || <span className="text-gray-300 dark:text-gray-600">—</span>}
                          </div>
                        </div>
                      );
                    })}

                    <div className="md:col-span-2 xl:col-span-3 flex gap-3 pt-4 border-t border-gray-100 pt-5 dark:border-gray-800">
                      <button type="button" onClick={() => setSelectedRow(null)} className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                        Close
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={saveVitals} className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {[
                      ["patientId", "Patient ID", "text", "Leave blank to auto-generate"],
                      ["patientName", "Patient Name", "text", ""],
                      ["mobile", "Mobile Number", "text", ""],
                      ["dob", "DOB", "date", ""],
                      ["age", "Age", "text", ""],
                      ["gender", "Gender", "select", ""],
                      ["heightCm", "Height (cm)", "text", ""],
                      ["weightKg", "Weight (kg)", "text", ""],
                      ["temperature", "Temperature (F/C)", "text", ""],
                      ["pulseRate", "Pulse Rate (beats/min)", "text", ""],
                      ["respiratoryRate", "Respiratory Rate (breaths/min)", "text", ""],
                      ["systolicBp", "Systolic BP", "text", ""],
                      ["diastolicBp", "Diastolic BP", "text", ""],
                      ["spo2", "SpO2 (%)", "text", ""],
                      ["bloodSugar", "Blood Sugar (Optional)", "text", ""],
                      ["remarks", "Remarks", "textarea", ""],
                      ["status", "Status", "select", ""],
                    ].map(([key, label, type, placeholder]) => {
                      const isDemographic = ["patientId", "patientName", "mobile", "age", "gender"].includes(key);
                      return (
                        <div key={key} className={key === "remarks" ? "md:col-span-2 xl:col-span-3" : ""}>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            {label}
                          </label>
                          {type === "select" ? (
                            <select
                              value={form[key as keyof FormState]}
                              onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))}
                              disabled={isDemographic}
                              className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm dark:border-gray-700 dark:bg-gray-800 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-default dark:disabled:bg-gray-800/30 dark:disabled:text-gray-500 transition"
                            >
                              {key === "gender"
                                ? ["", "Male", "Female", "Other"].map((option) => (
                                  <option key={option} value={option}>
                                    {option || "Select Gender"}
                                  </option>
                                ))
                                : ["Active", "Inactive"].map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                            </select>
                          ) : type === "textarea" ? (
                            <textarea
                              value={form[key as keyof FormState]}
                              onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))}
                              rows={4}
                              placeholder={placeholder}
                              disabled={isDemographic}
                              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-default dark:disabled:bg-gray-800/30 dark:disabled:text-gray-500 transition"
                            />
                          ) : (
                            <input
                              type={type}
                              value={form[key as keyof FormState]}
                              onChange={(e) => {
                                const val = e.target.value;
                                setForm((current) => {
                                  const updated = { ...current, [key]: val };
                                  if (key === "dob") {
                                    const computedAge = calculateAge(val);
                                    if (computedAge !== null) {
                                      updated.age = String(computedAge);
                                    }
                                  }
                                  return updated;
                                });
                              }}
                              placeholder={placeholder}
                              disabled={isDemographic}
                              className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm dark:border-gray-700 dark:bg-gray-800 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-default dark:disabled:bg-gray-800/30 dark:disabled:text-gray-500 transition"
                            />
                          )}
                        </div>
                      );
                    })}

                    <div className="md:col-span-2 xl:col-span-3 flex gap-3 pt-4 border-t border-gray-100 pt-5 dark:border-gray-800">
                      <button type="submit" disabled={saving} className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition disabled:opacity-50">
                        {saving ? "Saving..." : "Save Vitals"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedSummary?.completed) {
                            setForm({
                              patientId: text(selectedRow!, ["registration_patient_id", "appointment_patient_id", "patient_id", "registration_id"]),
                              patientName: text(selectedRow!, ["registration_patient_name", "appointment_patient_name", "patient_name"]),
                              mobile: text(selectedRow!, ["mobile", "patient_phone"]),
                              dob: text(selectedRow!, ["registration_dob", "dob"]).slice(0, 10),
                              age: text(selectedRow!, ["age"]),
                              gender: text(selectedRow!, ["gender"]),
                              heightCm: text(selectedRow!, ["height_cm"]),
                              weightKg: text(selectedRow!, ["weight_kg"]),
                              temperature: text(selectedRow!, ["temperature"]),
                              pulseRate: text(selectedRow!, ["pulse_rate"]),
                              respiratoryRate: text(selectedRow!, ["respiratory_rate"]),
                              systolicBp: text(selectedRow!, ["systolic_bp"]),
                              diastolicBp: text(selectedRow!, ["diastolic_bp"]),
                              spo2: text(selectedRow!, ["spo2"]),
                              bloodSugar: text(selectedRow!, ["blood_sugar"]),
                              remarks: text(selectedRow!, ["remarks"]),
                              status: text(selectedRow!, ["vitals_status"]) || "Active",
                            });
                            setIsEditing(false);
                          } else {
                            setSelectedRow(null);
                          }
                        }}
                        className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
