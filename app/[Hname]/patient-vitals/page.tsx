"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

import { CalenderIcon, CheckCircleIcon } from "../../../components/icons";

type DoctorRow = { doctor?: string; first_time?: string | null; total?: number };
type VitalsRow = Record<string, unknown>;

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
  };
}

function text(row: VitalsRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return "";
}

function isCompleted(row: VitalsRow) {
  return Boolean(row.vitals_id || row.vitals_status);
}

export default function PatientVitalsPage() {
  const params = useParams();
  const hname = params?.Hname as string;
  const [date, setDate] = useState("");
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [rows, setRows] = useState<VitalsRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<VitalsRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  const dateLabel = useMemo(() => {
    if (!date) return "All dates";
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
    async function loadDoctors() {
      if (!hname) return;
      const response = await fetch(buildVitalsUrl(date, ""), { cache: "no-store" });
      const data = (await response.json()) as { rows?: DoctorRow[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to load doctors.");
      const nextDoctors = data.rows ?? [];
      setDoctors(nextDoctors);
      const nextSelectedDoctor = String(nextDoctors[0]?.doctor ?? "");
      if (!nextDoctors.some((doctor) => String(doctor.doctor ?? "") === selectedDoctor)) {
        setSelectedDoctor(nextSelectedDoctor);
      }
    }
    void loadDoctors().catch((err) => setError(err instanceof Error ? err.message : "Failed to load doctors."));
  }, [buildVitalsUrl, date, hname, selectedDoctor]);

  useEffect(() => {
    async function loadPatients() {
      if (!hname || !selectedDoctor) return;
      setLoading(true);
      try {
        const response = await fetch(buildVitalsUrl(date, selectedDoctor), { cache: "no-store" });
        const data = (await response.json()) as { rows?: VitalsRow[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Failed to load patients.");
        setRows(data.rows ?? []);
      } finally {
        setLoading(false);
      }
    }
    void loadPatients().catch((err) => setError(err instanceof Error ? err.message : "Failed to load patients."));
  }, [buildVitalsUrl, date, hname, selectedDoctor]);

  const selectedSummary = useMemo(() => {
    if (!selectedRow) return null;
    return {
      name: text(selectedRow, ["registration_patient_name", "appointment_patient_name", "patient_name"]),
      type: text(selectedRow, ["patient_type"]) || (selectedRow.appointment_id ? "Appointment" : "Walk in"),
      time: text(selectedRow, ["appointment_time"]),
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
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to save vitals.");
      setMessage("Vitals saved.");
      setSelectedRow(null);
      setForm(emptyForm());
      const refreshed = await fetch(buildVitalsUrl(date, selectedDoctor), { cache: "no-store" });
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
            <button
              type="button"
              onClick={() => dateInputRef.current?.showPicker?.()}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-500 dark:bg-brand-500/[0.12] dark:text-brand-400"
              aria-label="Open date picker"
            >
              <CalenderIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="grid gap-6 p-4 sm:p-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="space-y-3">
            {doctors.map((doctor) => {
              const name = String(doctor.doctor ?? "");
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSelectedDoctor(name)}
                  className={`w-full rounded-xl border px-4 py-4 text-left ${selectedDoctor === name ? "border-brand-300 bg-brand-50" : "border-gray-200 bg-white"}`}
                >
                  <div className="text-sm font-semibold text-gray-800">{name}</div>
                  <div className="mt-1 text-xs text-gray-500">{doctor.first_time ? `First patient ${doctor.first_time}` : "Today"}</div>
                  <div className="mt-1 text-xs text-gray-500">{doctor.total ?? 0} patients</div>
                </button>
              );
            })}
          </aside>
          <div className="space-y-6">
            {message ? <div className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">{message}</div> : null}
            {error ? <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div> : null}

            {selectedDoctor ? (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left">Patient</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-left">Time</th>
                      <th className="px-4 py-3 text-left">Slot</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr><td className="px-4 py-6 text-gray-500" colSpan={6}>Loading...</td></tr>
                    ) : rows.length === 0 ? (
                      <tr><td className="px-4 py-6 text-gray-500" colSpan={6}>No patients for this doctor today.</td></tr>
                    ) : rows.map((row) => {
                      const done = isCompleted(row);
                      const name = text(row, ["registration_patient_name", "appointment_patient_name", "patient_name"]);
                      return (
                        <tr key={String(row.appointment_id ?? row.registration_id ?? name)}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-800">{name}</div>
                            <div className="text-xs text-gray-500">{text(row, ["patient_type"]) || (row.appointment_id ? "Appointment" : "Walk in")}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{text(row, ["patient_type"]) || (row.appointment_id ? "Appointment" : "Walk in")}</td>
                          <td className="px-4 py-3 text-gray-600">{text(row, ["appointment_time"]) || "-"}</td>
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
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRow(row);
                                setForm({
                                  patientId: text(row, ["registration_id", "appointment_patient_id", "patient_id"]),
                                  patientName: text(row, ["registration_patient_name", "appointment_patient_name", "patient_name"]),
                                  dob: text(row, ["dob"]).slice(0, 10),
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
                              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700"
                            >
                              {done ? "View / Update" : "Enter Vitals"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}

            {selectedRow ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <div className="mb-4">
                  <div className="text-lg font-semibold text-gray-800">{selectedSummary?.name}</div>
                  <div className="mt-1 text-sm text-gray-500">
                    {selectedSummary?.type}
                    {selectedSummary?.time ? ` • ${selectedSummary.time}` : ""}
                    {selectedSummary?.slot ? ` • ${selectedSummary.slot} min` : ""}
                  </div>
                </div>

                <form onSubmit={saveVitals} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {[
                    ["patientName", "Patient Name", "text"],
                    ["dob", "DOB", "date"],
                    ["age", "Age", "text"],
                    ["gender", "Gender", "select"],
                    ["heightCm", "Height (cm)", "text"],
                    ["weightKg", "Weight (kg)", "text"],
                    ["temperature", "Temperature (°C/F)", "text"],
                    ["pulseRate", "Pulse Rate (BPM)", "text"],
                    ["respiratoryRate", "Respiratory Rate", "text"],
                    ["systolicBp", "Systolic BP", "text"],
                    ["diastolicBp", "Diastolic BP", "text"],
                    ["spo2", "SpO2 (%)", "text"],
                    ["bloodSugar", "Blood Sugar (Optional)", "text"],
                    ["remarks", "Remarks", "textarea"],
                    ["status", "Status", "select"],
                  ].map(([key, label, type]) => (
                    <div key={key} className={key === "remarks" ? "md:col-span-2 xl:col-span-3" : ""}>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
                      {type === "select" ? (
                        <select
                          value={form[key as keyof FormState]}
                          onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))}
                          className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm"
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
                          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm"
                        />
                      ) : (
                        <input
                          type={type}
                          value={form[key as keyof FormState]}
                          onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))}
                          className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm"
                        />
                      )}
                    </div>
                  ))}

                  <div className="md:col-span-2 xl:col-span-3 flex gap-3">
                    <button type="submit" disabled={saving} className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white">
                      {saving ? "Saving..." : "Save Vitals"}
                    </button>
                    <button type="button" onClick={() => setSelectedRow(null)} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700">
                      Close
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      </section>

  );
}
