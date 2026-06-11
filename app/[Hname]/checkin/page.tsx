"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircleIcon } from "../../../components/icons";

type VitalsRow = Record<string, unknown> & { appointment_end_time?: string | null, appointment_check_in_time?: string | null };

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

export default function CheckInPage() {
  const params = useParams();
  const router = useRouter();
  const hname = params?.Hname as string;
  const [date, setDate] = useState(() => {
    const today = new Date();
    const offset = today.getTimezoneOffset() * 60000;
    return new Date(today.getTime() - offset).toISOString().split("T")[0];
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [rows, setRows] = useState<VitalsRow[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [doctorsList, setDoctorsList] = useState<{ name: string, department: string }[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingIn, setCheckingIn] = useState<string | number | null>(null);
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

  const loadPatients = useCallback(async () => {
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
  }, [buildVitalsUrl, date, hname]);

  useEffect(() => {
    void loadPatients().catch((err) => setError(err instanceof Error ? err.message : "Failed to load patients."));
  }, [loadPatients]);

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
    // Only show records of type scheduled
    let result = rows.filter(row => text(row, ["patient_type"]).toLowerCase() !== "walk-in");

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
      const aChecked = !!a.appointment_check_in_time;
      const bChecked = !!b.appointment_check_in_time;

      if (aChecked !== bChecked) {
        return aChecked ? 1 : -1;
      }

      const timeA = text(a, ["appointment_time"]);
      const timeB = text(b, ["appointment_time"]);
      if (!timeA && !timeB) return 0;
      if (!timeA) return 1;
      if (!timeB) return -1;
      return timeA.localeCompare(timeB);
    });
    return result;
  }, [rows, searchQuery, selectedDepartment, selectedDoctor]);

  const handleCheckIn = async (row: VitalsRow) => {
    const patientName = text(row, ["registration_patient_name", "appointment_patient_name", "patient_name"]);
    const doctor = text(row, ["doctor"]);
    const department = text(row, ["department"]);
    const patientPhone = text(row, ["patient_phone", "mobile"]);
    const id = row.appointment_id as string | number;

    setCheckingIn(id);
    setError("");

    try {
      const res = await fetch(`/api/${encodeURIComponent(hname)}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName,
          patientPhone,
          department,
          doctor,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to check-in.");
      }

      await loadPatients();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setCheckingIn(null);
    }
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-800 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-medium text-gray-800 dark:text-white/90">Check-in Portal</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">View scheduled patients and mark their check-in status.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/${hname}/patient-registration?mode=form_only`)}
            className="h-11 rounded-lg bg-brand-500 px-6 text-sm font-medium text-white transition hover:bg-brand-600 focus:outline-hidden focus:ring-3 focus:ring-brand-500/25"
          >
            Add Walk-in
          </button>
        </div>
      </div>
      <div className="p-4 sm:p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Removed Walked-in and Back buttons from here */}
            </div>
            <div className="flex flex-1 items-center gap-3 justify-end">
              <input
                type="text"
                placeholder="Search patient..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 w-full max-w-xs rounded-lg border border-gray-300 px-4 text-sm focus:border-brand-500 focus:ring-brand-500"
              />
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

          {error ? <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div> : null}

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">Patient</th>
                  <th className="px-4 py-3 text-left">Doctor</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">Slot</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td className="px-4 py-6 text-gray-500 text-center" colSpan={7}>Loading...</td></tr>
                ) : filteredRows.length === 0 ? (
                  <tr><td className="px-4 py-6 text-gray-500 text-center" colSpan={7}>No scheduled patients found.</td></tr>
                ) : filteredRows.map((row) => {
                  const name = text(row, ["registration_patient_name", "appointment_patient_name", "patient_name"]);
                  const isCheckedIn = !!row.appointment_check_in_time;
                  const rowId = row.appointment_id as string | number;
                  const isRowCheckingIn = checkingIn === rowId;

                  return (
                    <tr key={String(row.appointment_id ?? row.registration_id ?? name)}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{name}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-medium">{text(row, ["doctor"])}</td>
                      <td className="px-4 py-3 text-gray-600">Scheduled</td>
                      <td className="px-4 py-3 text-gray-600">{text(row, ["appointment_date"])}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {text(row, ["appointment_time"])
                          ? formatTimeRange(text(row, ["appointment_time"]), text(row, ["appointment_end_time"]) || null)
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{text(row, ["time_slot_minutes"]) ? `${text(row, ["time_slot_minutes"])} min` : "-"}</td>
                      <td className="px-4 py-3">
                        {isCheckedIn ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-4 py-1.5 text-sm font-medium text-success-700">
                            <CheckCircleIcon className="h-4 w-4" />
                            Checked In
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleCheckIn(row)}
                            disabled={isRowCheckingIn}
                            className="rounded-full border border-brand-300 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100 transition disabled:opacity-50"
                          >
                            {isRowCheckingIn ? "Checking..." : "Check-in"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
