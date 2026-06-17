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
  transferred_from_doctor?: string | null;
  transferred_to_doctor?: string | null;
  transferred_by_name?: string | null;
  transferred_at?: string | null;
  reschedule_history?: Array<{
    fromDate?: string;
    fromTime?: string;
    toDate?: string;
    toTime?: string;
    updatedAt?: string;
  }> | null;
};
type NotificationRow = {
  id?: number;
  title?: string | null;
  message?: string | null;
  is_read?: boolean | null;
  created_at?: string | null;
};

type HistoryItem = {
  key: string;
  label: string;
  status: string;
  date: string;
  time?: string;
  endTime?: string;
  note: string;
  variant: "green" | "red" | "gray";
  doctor?: string | null;
  department?: string | null;
  isPreviewable?: boolean;
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
    transferred_from_doctor: readText(row, ["transferred_from_doctor", "transferredFromDoctor"]) || null,
    transferred_to_doctor: readText(row, ["transferred_to_doctor", "transferredToDoctor"]) || null,
    transferred_by_name: readText(row, ["transferred_by_name", "transferredByName"]) || null,
    transferred_at: readText(row, ["transferred_at", "transferredAt"]) || null,
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

function normalizeNotificationRow(row: RawRow): NotificationRow {
  return {
    id: row.id ? Number(row.id) : undefined,
    title: readText(row, ["title"]) || null,
    message: readText(row, ["message"]) || null,
    is_read: Boolean(row.is_read),
    created_at: readText(row, ["created_at", "createdAt"]) || null,
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
    const hasRescheduleHistory = Array.isArray(entry.reschedule_history) && entry.reschedule_history.length > 0;

    items.push({
      key: `${baseKey}-scheduled`,
      label: "Scheduled",
      status: "Scheduled",
      date: entry.appointment_date ?? "",
      time: entry.appointment_time ?? undefined,
      endTime: entry.appointment_end_time ?? undefined,
      note: `${entry.doctor ? `Booked with ${entry.doctor}` : "Appointment booked"}${entry.department ? ` - ${entry.department}` : ""}`,
      variant: hasRescheduleHistory ? "red" : "green",
      doctor: entry.doctor,
      department: entry.department,
      isPreviewable: true,
    });

    for (const historyEntry of entry.reschedule_history ?? []) {
      items.push({
        key: `${baseKey}-rescheduled-${historyEntry.updatedAt ?? historyEntry.toDate ?? ""}`,
        label: "Rescheduled",
        status: "Rescheduled",
        date: historyEntry.toDate ?? "",
        time: historyEntry.toTime ?? undefined,
        endTime: undefined,
        note: `Moved from ${formatDisplayDate(historyEntry.fromDate ?? "")}${historyEntry.fromTime ? ` at ${formatDisplayTime(historyEntry.fromTime)}` : ""}`,
        variant: "green",
        doctor: entry.doctor,
        department: entry.department,
        isPreviewable: true,
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
        variant: "red",
      });
    }

    if (entry.transferred_from_doctor || entry.transferred_to_doctor) {
      items.push({
        key: `${baseKey}-transferred`,
        label: "Transferred",
        status: "Transferred",
        date: entry.appointment_date ?? "",
        time: entry.appointment_time ?? undefined,
        endTime: entry.appointment_end_time ?? undefined,
        note: `Moved from ${entry.transferred_from_doctor || "previous doctor"} to ${entry.doctor || entry.transferred_to_doctor || "new doctor"}`,
        variant: "gray",
        doctor: entry.doctor,
        department: entry.department,
        isPreviewable: true,
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
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [previewItem, setPreviewItem] = useState<HistoryItem | null>(null);

  useEffect(() => {
    async function loadProfile() {
      if (!patientId) return;
      const [patientRows, appointmentRows, notificationRows] = await Promise.all([
        loadRows(hname, `/forms/${PATIENT_TABLE}?id=${encodeURIComponent(patientId)}`),
        loadRows(hname, `/appointments?patientId=${encodeURIComponent(patientId)}`),
        loadRows(hname, `/appointments?notificationsFor=${encodeURIComponent(patientId)}`),
      ]);
      const patientRow = patientRows.map(normalizePatientRow)[0] ?? null;
      const phoneNotifications =
        patientRow?.mobile && patientRow.mobile !== patientId
          ? await loadRows(hname, `/appointments?notificationsFor=${encodeURIComponent(patientRow.mobile)}`)
          : [];
      const notificationMap = new Map(
        [...notificationRows, ...phoneNotifications].map((row) => [String(row.id ?? `${row.title}-${row.created_at}`), row]),
      );
      setPatient(patientRow);
      setAppointments(appointmentRows.map(normalizeAppointmentRow));
      setNotifications(Array.from(notificationMap.values()).map(normalizeNotificationRow));
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
  const visibleNotifications = useMemo(
    () => [
      ...notifications,
      ...doctorNotifications.map((entry) => ({
        id: entry.id,
        title: `${entry.cancelled_by_name || entry.doctor || "Doctor"} cancelled your appointment`,
        message: `${entry.appointment_date ? formatDisplayDate(entry.appointment_date) : "-"}${entry.appointment_time ? ` at ${formatTimeRange(entry.appointment_time, entry.appointment_end_time)}` : ""}\n${buildCancellationNote(entry)}`,
        is_read: false,
        created_at: entry.cancelled_at ?? entry.updated_at ?? null,
      })),
    ].sort((left, right) => String(right.created_at ?? "").localeCompare(String(left.created_at ?? ""))),
    [doctorNotifications, notifications],
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
          {visibleNotifications.length > 0 ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Notifications</p>
              <div className="mt-4 space-y-3">
                {visibleNotifications.map((entry) => (
                  <div key={`notification-${entry.id ?? entry.created_at ?? entry.title}`} className="rounded-xl border border-red-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-red-700">{entry.title || "Notification"}</p>
                      {!entry.is_read ? <span className="rounded-full bg-red-100 px-2 py-1 text-[11px] font-semibold uppercase text-red-700">Unread</span> : null}
                    </div>
                    <p className="mt-2 whitespace-pre-line text-sm text-red-600">{entry.message || "-"}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Appointment History</p>
            <div className="mt-4 space-y-3">
              {history.length > 0 ? history.map((item) => {
                const badgeClasses = item.variant === "green"
                  ? "bg-emerald-100 text-emerald-700"
                  : item.variant === "red"
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-600";
                const isClickable = item.isPreviewable && (item.status === "Scheduled" || item.status === "Rescheduled");

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => isClickable && setPreviewItem(item)}
                    className={`w-full text-left rounded-xl border border-gray-200 p-4 dark:border-gray-800 ${isClickable ? "cursor-pointer hover:border-brand-300 hover:bg-brand-50/50" : ""}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-gray-800 dark:text-white/90">
                        {item.label} - {formatDisplayDate(item.date)}{item.time ? ` at ${formatTimeRange(item.time, item.endTime)}` : ""}
                      </p>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-medium uppercase ${badgeClasses}`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{item.note}</p>
                  </button>
                );
              }) : <p className="text-sm text-gray-500">No history yet.</p>}
            </div>
          </section>
        </section>
      </div>
      {previewItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Preview</p>
                <h2 className="mt-1 text-xl font-semibold text-gray-900 dark:text-white/90">{previewItem.status} Appointment</h2>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
            <div className="grid gap-4">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-sm uppercase tracking-wide text-gray-500">Doctor</p>
                <p className="mt-1 text-base font-medium text-gray-900 dark:text-white/90">{previewItem.doctor ?? "Not specified"}</p>
                <p className="mt-1 text-sm text-gray-500">{previewItem.department ?? "Department not available"}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-sm uppercase tracking-wide text-gray-500">Booked Slot</p>
                <p className="mt-1 text-base font-medium text-gray-900 dark:text-white/90">{formatDisplayDate(previewItem.date)}</p>
                {previewItem.time ? (
                  <p className="mt-1 text-sm text-gray-500">{formatTimeRange(previewItem.time, previewItem.endTime)}</p>
                ) : null}
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-sm uppercase tracking-wide text-gray-500">Note</p>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">{previewItem.note}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
