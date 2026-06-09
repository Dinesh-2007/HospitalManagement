"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { tableNameFromCardTitle } from "../../lib/master-form-table";

type RawRow = Record<string, unknown>;
type PatientRow = {
  id?: number;
  patient_name?: string;
  mobile?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  patient_type?: string | null;
  profession?: string | null;
  last_visit_doctor_name?: string | null;
};
type AppointmentRow = {
  id?: number;
  appointment_date?: string;
  appointment_time?: string | null;
  appointment_end_time?: string | null;
  patient_id?: string | null;
  patient_name?: string | null;
  patient_phone?: string | null;
  doctor?: string | null;
  department?: string | null;
  reschedule_count?: number | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  cancelled_by_role?: string | null;
  cancelled_by_name?: string | null;
  cancelled_reason?: string | null;
  cancelled_at?: string | null;
  reschedule_history?: Array<{
    fromDate?: string;
    fromTime?: string;
    toDate?: string;
    toTime?: string;
    updatedAt?: string;
  }> | null;
};

type HistoryItem = {
  key: string;
  label: string;
  status: string;
  date: string;
  time?: string;
  endTime?: string;
  note: string;
};

const PATIENT_TABLE = tableNameFromCardTitle("Patient Registration");

function readText(row: RawRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return "";
}

function normalizePatientRow(row: RawRow): PatientRow {
  return {
    id: row.id ? Number(row.id) : undefined,
    patient_name: readText(row, ["patient_name", "patientName"]) || undefined,
    mobile: readText(row, ["mobile"]) || null,
    email: readText(row, ["email"]) || null,
    address: readText(row, ["address"]) || null,
    city: readText(row, ["city"]) || null,
    state: readText(row, ["state"]) || null,
    country: readText(row, ["country"]) || null,
    patient_type: readText(row, ["patient_type", "patientType"]) || null,
    profession: readText(row, ["profession"]) || null,
    last_visit_doctor_name: readText(row, ["last_visit_doctor_name", "lastVisitDoctorName"]) || null,
  };
}

function normalizeAppointmentRow(row: RawRow): AppointmentRow {
  const history = row.reschedule_history;
  return {
    id: row.id ? Number(row.id) : undefined,
    appointment_date: readText(row, ["appointment_date", "appointmentDate"]),
    appointment_time: readText(row, ["appointment_time", "appointmentTime"]) || null,
    appointment_end_time: readText(row, ["appointment_end_time", "appointmentEndTime"]) || null,
    patient_id: readText(row, ["patient_id", "patientId"]) || null,
    patient_name: readText(row, ["patient_name", "patientName"]) || null,
    patient_phone: readText(row, ["patient_phone", "patientPhone"]) || null,
    doctor: readText(row, ["doctor"]) || null,
    department: readText(row, ["department"]) || null,
    reschedule_count: Number(readText(row, ["reschedule_count", "rescheduleCount"])) || 0,
    status: readText(row, ["status"]) || null,
    created_at: readText(row, ["created_at", "createdAt"]) || null,
    updated_at: readText(row, ["updated_at", "updatedAt"]) || null,
    cancelled_by_role: readText(row, ["cancelled_by_role", "cancelledByRole"]) || null,
    cancelled_by_name: readText(row, ["cancelled_by_name", "cancelledByName"]) || null,
    cancelled_reason: readText(row, ["cancelled_reason", "cancelledReason"]) || null,
    cancelled_at: readText(row, ["cancelled_at", "cancelledAt"]) || null,
    reschedule_history: Array.isArray(history)
      ? history.map((entry) => ({
          fromDate: String((entry as Record<string, unknown>).fromDate ?? ""),
          fromTime: String((entry as Record<string, unknown>).fromTime ?? ""),
          toDate: String((entry as Record<string, unknown>).toDate ?? ""),
          toTime: String((entry as Record<string, unknown>).toTime ?? ""),
          updatedAt: String((entry as Record<string, unknown>).updatedAt ?? ""),
        }))
      : null,
  };
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

function formatDisplayDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatDisplayDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function loadRows(hname: string, url: string) {
  const response = await fetch(`/api/${encodeURIComponent(hname)}${url}`, { cache: "no-store" });
  const data = (await response.json()) as { rows?: RawRow[]; error?: string };
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data.rows ?? [];
}

function buildCancellationNote(entry: AppointmentRow) {
  const cancelledByRole = (entry.cancelled_by_role ?? "").toLowerCase();
  const cancelledByName = entry.cancelled_by_name || entry.doctor || "Doctor";
  const cancelledAt = entry.cancelled_at ? ` on ${formatDisplayDateTime(entry.cancelled_at)}` : "";
  const reason = entry.cancelled_reason ? ` Reason: ${entry.cancelled_reason}` : "";

  if (cancelledByRole === "doctor") {
    return `${cancelledByName} cancelled this appointment${cancelledAt}.${reason}`;
  }

  if (cancelledByRole === "patient") {
    return `You cancelled this appointment${cancelledAt}.${reason}`;
  }

  return `Appointment cancelled${cancelledAt}.${reason}`;
}

function buildHistory(appointments: AppointmentRow[]) {
  const items: HistoryItem[] = [];

  for (const entry of appointments) {
    const baseKey = String(entry.id ?? `${entry.appointment_date}-${entry.appointment_time}`);
    items.push({
      key: `${baseKey}-scheduled`,
      label: "Scheduled",
      status: "Scheduled",
      date: entry.appointment_date ?? "",
      time: entry.appointment_time ?? undefined,
      endTime: entry.appointment_end_time ?? undefined,
      note: `${entry.doctor ? `Booked with ${entry.doctor}` : "Appointment booked"}${entry.department ? ` - ${entry.department}` : ""}`,
    });

    for (const historyEntry of entry.reschedule_history ?? []) {
      items.push({
        key: `${baseKey}-rescheduled-${historyEntry.updatedAt ?? historyEntry.toDate ?? ""}`,
        label: "Rescheduled",
        status: "Rescheduled",
        date: historyEntry.toDate ?? "",
        time: historyEntry.toTime ?? undefined,
        note: `Moved from ${formatDisplayDate(historyEntry.fromDate ?? "")}${historyEntry.fromTime ? ` at ${formatDisplayTime(historyEntry.fromTime)}` : ""}`,
      });
    }

    if ((entry.status ?? "").toLowerCase() === "cancelled") {
      items.push({
        key: `${baseKey}-cancelled`,
        label: "Cancelled",
        status: "Cancelled",
        date: entry.appointment_date ?? "",
        time: entry.appointment_time ?? undefined,
        endTime: entry.appointment_end_time ?? undefined,
        note: buildCancellationNote(entry),
      });
    }
  }

  return items.sort((left, right) => `${right.date} ${right.time ?? ""}`.localeCompare(`${left.date} ${left.time ?? ""}`));
}

export default function PatientProfilePage(props: { searchParams?: { patientId?: string }; onClose?: () => void }) {
  const params = useParams();
  const hname = params?.Hname as string;
  const patientId = props.searchParams?.patientId;
  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadProfile() {
      if (!patientId) return;
      const [patientRows, appointmentRows] = await Promise.all([
        loadRows(hname, `/forms/${PATIENT_TABLE}?id=${encodeURIComponent(patientId)}`),
        loadRows(hname, `/appointments?patientId=${encodeURIComponent(patientId)}`),
      ]);
      setPatient(patientRows.map(normalizePatientRow)[0] ?? null);
      setAppointments(appointmentRows.map(normalizeAppointmentRow));
    }

    void loadProfile().catch((error) => setErrorMessage(error instanceof Error ? error.message : "Failed to load profile."));
  }, [hname, patientId]);

  const history = useMemo(() => buildHistory(appointments), [appointments]);
  const doctorNotifications = useMemo(
    () =>
      appointments
        .filter(
          (entry) =>
            (entry.status ?? "").toLowerCase() === "cancelled" &&
            (entry.cancelled_by_role ?? "").toLowerCase() === "doctor",
        )
        .sort((left, right) => String(right.cancelled_at ?? right.updated_at ?? "").localeCompare(String(left.cancelled_at ?? left.updated_at ?? ""))),
    [appointments],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Patient Profile</p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-800 dark:text-white/90">{patient?.patient_name ?? "Patient"}</h1>
          <p className="mt-1 text-sm text-gray-500">{patient?.mobile ?? "-"}</p>
        </div>
        <button type="button" onClick={() => props.onClose?.()} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700">
          Back
        </button>
      </div>

      {errorMessage ? <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{errorMessage}</div> : null}

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section className="space-y-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="space-y-4 text-sm">
            <div><p className="text-gray-500">Patient ID</p><p className="font-medium text-gray-800 dark:text-white/90">{patient?.id ?? "-"}</p></div>
            <div><p className="text-gray-500">Email</p><p className="font-medium text-gray-800 dark:text-white/90">{patient?.email ?? "-"}</p></div>
            <div><p className="text-gray-500">Patient Type</p><p className="font-medium text-gray-800 dark:text-white/90">{patient?.patient_type ?? "-"}</p></div>
            <div><p className="text-gray-500">Profession</p><p className="font-medium text-gray-800 dark:text-white/90">{patient?.profession ?? "-"}</p></div>
            <div><p className="text-gray-500">Last Visit Doctor</p><p className="font-medium text-gray-800 dark:text-white/90">{patient?.last_visit_doctor_name ?? "-"}</p></div>
            <div><p className="text-gray-500">Appointments</p><p className="font-medium text-gray-800 dark:text-white/90">{appointments.length}</p></div>
          </div>

          <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Address</p>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{patient?.address ?? "-"}</p>
            <p className="mt-2 text-sm text-gray-500">
              {[patient?.city, patient?.state, patient?.country].filter(Boolean).join(", ") || "-"}
            </p>
          </div>
        </section>

        <section className="space-y-6">
          {doctorNotifications.length > 0 ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Notifications</p>
              <div className="mt-4 space-y-3">
                {doctorNotifications.map((entry) => (
                  <div key={`notification-${entry.id ?? entry.cancelled_at ?? entry.appointment_date}`} className="rounded-xl border border-red-200 bg-white p-4">
                    <p className="font-medium text-red-700">
                      {entry.cancelled_by_name || entry.doctor || "Doctor"} cancelled your appointment
                    </p>
                    <p className="mt-1 text-sm text-red-600">
                      {entry.appointment_date ? formatDisplayDate(entry.appointment_date) : "-"}
                      {entry.appointment_time ? ` at ${formatTimeRange(entry.appointment_time, entry.appointment_end_time)}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-red-600">{buildCancellationNote(entry)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Appointment History</p>
            <div className="mt-4 space-y-3">
              {history.length > 0 ? history.map((item) => (
                <div key={item.key} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-gray-800 dark:text-white/90">
                      {item.label} - {formatDisplayDate(item.date)}{item.time ? ` at ${formatTimeRange(item.time, item.endTime)}` : ""}
                    </p>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium uppercase text-gray-600">{item.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{item.note}</p>
                </div>
              )) : <p className="text-sm text-gray-500">No history yet.</p>}
            </div>
          </section>
        </section>
      </div>
    </div>
  );
}
