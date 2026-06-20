"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { PageLayout } from "../../../../components/page-layout";
import { CalenderIcon } from "../../../../components/icons";
import { tableNameFromCardTitle } from "../../../../lib/master-form-table";
import PatientProfilePage from "../../../../components/profile/page";

type RawRow = Record<string, unknown>;
type ScheduleRow = {
  appointmentFromDate: string;
  appointmentToDate: string;
  availableTimeFrom: string;
  availableTimeTo: string;
  daysAvailable: string[];
  consultantDoctorName: string;
  timeSlotMinutes: number;
};
type AppointmentRow = {
  id?: number;
  appointment_date?: string;
  appointment_time?: string | null;
  appointment_end_time?: string | null;
  patient_id?: string | null;
  patient_name?: string | null;
  patient_phone?: string | null;
  reschedule_count?: number | null;
  time_slot_minutes?: number | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  reschedule_history?: Array<{
    fromDate?: string;
    fromTime?: string;
    toDate?: string;
    toTime?: string;
    updatedAt?: string;
  }> | null;
};
type Slot = { value: string; start: string; end: string; label: string };
type PatientRow = { id?: number; patient_name?: string; mobile?: string | null };

const SCHEDULE_TABLE = tableNameFromCardTitle("Consultant / Doctor Schedule");
const PATIENT_TABLE = tableNameFromCardTitle("Patient Registration");
const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekDayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function readText(row: RawRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function readDaysAvailable(row: RawRow) {
  const value = row.daysAvailable ?? row.days_available;
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return value.replace(/[\[\]"]/g, "").split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function normalizeScheduleRow(row: RawRow): ScheduleRow {
  return {
    appointmentFromDate: readText(row, ["appointment_from_date", "appointmentFromDate"]),
    appointmentToDate: readText(row, ["appointment_to_date", "appointmentToDate"]),
    availableTimeFrom: readText(row, ["available_time_from", "availableTimeFrom"]),
    availableTimeTo: readText(row, ["available_time_to", "availableTimeTo"]),
    daysAvailable: readDaysAvailable(row),
    consultantDoctorName: readText(row, ["consultant_doctor_name", "consultantDoctorName"]),
    timeSlotMinutes: Number(readText(row, ["time_slot_minutes", "timeSlotMinutes"])) || 10,
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
    reschedule_count: Number(readText(row, ["reschedule_count", "rescheduleCount"])) || 0,
    time_slot_minutes: Number(readText(row, ["time_slot_minutes", "timeSlotMinutes"])) || null,
    status: readText(row, ["status"]) || null,
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

function normalizePatientRow(row: RawRow): PatientRow {
  return {
    id: row.id ? Number(row.id) : undefined,
    patient_name: readText(row, ["patient_name", "patientName"]) || undefined,
    mobile: readText(row, ["mobile"]) || null,
  };
}

function buildWeek(date: Date) {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    return current;
  });
}

function toKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDay(date: Date) {
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "2-digit", month: "short" }).format(date);
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

function addMinutes(value: string, minutesToAdd: number) {
  const [hoursText, minutesText = "00"] = value.split(":");
  const date = new Date();
  date.setHours(Number(hoursText), Number(minutesText) + minutesToAdd, 0, 0);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function slotKey(start: string, end: string) {
  return `${start}|${end}`;
}

function normalizeTime(value: string) {
  const match = String(value ?? "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return "";
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return "";
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function buildHourBlocks(fromTime: string, toTime: string) {
  const blocks: Slot[] = [];
  let cursor = normalizeTime(fromTime);
  const endTime = normalizeTime(toTime);
  if (!cursor || !endTime) return blocks;
  while (cursor < endTime) {
    const nextHour = addMinutes(cursor, 60);
    const end = nextHour > endTime ? endTime : nextHour;
    blocks.push({
      value: slotKey(cursor, end),
      start: cursor,
      end,
      label: `${formatDisplayTime(cursor)}-${formatDisplayTime(end)}`,
    });
    cursor = end;
  }
  return blocks;
}

function buildSubSlots(fromTime: string, toTime: string, step: number) {
  const slots: Slot[] = [];
  // Guard: need a positive integer step
  const safeStep = Math.max(1, Math.round(step));
  let cursor = normalizeTime(fromTime);
  const endTime = normalizeTime(toTime);
  if (!cursor || !endTime) return slots;
  while (cursor < endTime) {
    const next = addMinutes(cursor, safeStep);
    if (next > endTime) break;
    slots.push({
      value: slotKey(cursor, next),
      start: cursor,
      end: next,
      label: `${formatDisplayTime(cursor)}-${formatDisplayTime(next)}`,
    });
    cursor = next;
  }
  return slots;
}

async function loadRows(hname: string, url: string) {
  const response = await fetch(`/api/${encodeURIComponent(hname)}${url}`, { cache: "no-store" });
  const data = (await response.json()) as { rows?: RawRow[]; error?: string };
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data.rows ?? [];
}

export default function AppointmentCalendarPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const hname = params?.Hname as string;
  const department = searchParams.get("department") ?? "";
  const doctor = searchParams.get("doctor") ?? "";
  const patientId = searchParams.get("patientId") ?? "";
  const todayWeekStart = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - date.getDay());
    return date;
  }, []);
  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => {
    return new Date(todayWeekStart);
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [selectedHour, setSelectedHour] = useState<Slot | null>(null);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([]);
  const [appointmentRows, setAppointmentRows] = useState<AppointmentRow[]>([]);
  const [patientAppointments, setPatientAppointments] = useState<AppointmentRow[]>([]);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [dialogMessage, setDialogMessage] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{ type: "book" | "reschedule" | "cancel" | null } | null>(null);

  useEffect(() => {
    async function loadPatient() {
      if (!patientId) return;
      const rows = await loadRows(hname, `/forms/${PATIENT_TABLE}`);
      const record = rows.map(normalizePatientRow).find((row) => String(row.id ?? "") === patientId);
      setPatient(record ?? null);
    }
    void loadPatient().catch((error) => setErrorMessage(error instanceof Error ? error.message : "Failed to load patient."));
  }, [hname, patientId]);

  useEffect(() => {
    async function loadSchedule() {
      if (!doctor) return;
      const rows = await loadRows(hname, `/forms/${SCHEDULE_TABLE}`);
      setScheduleRows(
        rows
          .map(normalizeScheduleRow)
          .filter((row) => row.consultantDoctorName.trim().toLowerCase() === doctor.trim().toLowerCase()),
      );
    }
    void loadSchedule().catch((error) => setErrorMessage(error instanceof Error ? error.message : "Failed to load schedule."));
  }, [doctor, hname]);

  useEffect(() => {
    async function loadPatientAppointments() {
      if (!patientId || !department || !doctor) return;
      const rows = await loadRows(
        hname,
        `/appointments?patientId=${encodeURIComponent(patientId)}&department=${encodeURIComponent(department)}&doctor=${encodeURIComponent(doctor)}`,
      );
      setPatientAppointments(rows.map(normalizeAppointmentRow));
    }
    void loadPatientAppointments().catch((error) => setErrorMessage(error instanceof Error ? error.message : "Failed to load patient appointments."));
  }, [department, doctor, hname, patientId]);

  useEffect(() => {
    if (!selectedDate || !doctor) return;
    const dateKey = toKey(selectedDate);
    void loadRows(hname, `/appointments?date=${encodeURIComponent(dateKey)}&department=${encodeURIComponent(department)}&doctor=${encodeURIComponent(doctor)}`)
      .then((rows) => setAppointmentRows(rows.map(normalizeAppointmentRow)))
      .catch((error) => setErrorMessage(error instanceof Error ? error.message : "Failed to load appointments."));
  }, [department, doctor, hname, selectedDate]);

  const weekDaysList = useMemo(() => buildWeek(selectedWeekStart), [selectedWeekStart]);
  const todayDate = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);
  const isDateAvailable = useMemo(() => {
    return (date: Date) => {
      if (date < todayDate) return false;
      const dayName = weekDayNames[date.getDay()];
      return scheduleRows.some((row) => {
        const from = row.appointmentFromDate ? parseKey(row.appointmentFromDate) : null;
        const to = row.appointmentToDate ? parseKey(row.appointmentToDate) : null;
        if (from && date < from) return false;
        if (to && date > to) return false;
        return row.daysAvailable.length === 0 || row.daysAvailable.includes(dayName);
      });
    };
  }, [scheduleRows, todayDate]);
  const selectedDaySchedules = useMemo(() => {
    if (!selectedDate) return [];
    const dayName = weekDayNames[selectedDate.getDay()];
    return scheduleRows.filter((row) => {
      const from = row.appointmentFromDate ? parseKey(row.appointmentFromDate) : null;
      const to = row.appointmentToDate ? parseKey(row.appointmentToDate) : null;
      if (from && selectedDate < from) return false;
      if (to && selectedDate > to) return false;
      return row.daysAvailable.length === 0 || row.daysAvailable.includes(dayName);
    });
  }, [scheduleRows, selectedDate]);

  const firstAvailableDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return weekDaysList.find((date) => {
      if (date < today) return false;
      const dayName = weekDayNames[date.getDay()];
      return scheduleRows.some((row) => {
        const from = row.appointmentFromDate ? parseKey(row.appointmentFromDate) : null;
        const to = row.appointmentToDate ? parseKey(row.appointmentToDate) : null;
        if (from && date < from) return false;
        if (to && date > to) return false;
        return row.daysAvailable.length === 0 || row.daysAvailable.includes(dayName);
      });
    }) ?? null;
  }, [scheduleRows, weekDaysList]);

  const effectiveSelectedDate = selectedDate ?? firstAvailableDate;
  const scheduleSlotMinutes = useMemo(() => {
    // Accept any positive integer from the schedule — not just 10 or 20
    const values = selectedDaySchedules
      .map((row) => row.timeSlotMinutes)
      .filter((value) => Number.isFinite(value) && value > 0);

    return values[0] ?? 10;
  }, [selectedDaySchedules]);

  const patientAppointment = useMemo(() => {
    return patientAppointments[0] ?? null;
  }, [patientAppointments]);

  const activeStep = selectedStep ?? scheduleSlotMinutes;
  const currentAppointmentId = patientAppointment?.id ?? null;
  const patientAvatarLabel =
    (patient?.patient_name ?? "User")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U";

  async function refreshPatientAppointments() {
    if (!patientId || !department || !doctor) return;
    const rows = await loadRows(
      hname,
      `/appointments?patientId=${encodeURIComponent(patientId)}&department=${encodeURIComponent(department)}&doctor=${encodeURIComponent(doctor)}`,
    );
    setPatientAppointments(rows.map(normalizeAppointmentRow));
  }

  function handlePreviousWeek() {
    setSelectedWeekStart((current) => {
      const previousWeek = new Date(current);
      previousWeek.setDate(previousWeek.getDate() - 7);
      return previousWeek < todayWeekStart ? todayWeekStart : previousWeek;
    });
  }

  function handleNextWeek() {
    setSelectedWeekStart(
      new Date(
        selectedWeekStart.getFullYear(),
        selectedWeekStart.getMonth(),
        selectedWeekStart.getDate() + 7,
      ),
    );
  }

  const availableHours = useMemo(() => {
    if (!effectiveSelectedDate) return [];
    const hours = new Map<string, Slot>();
    for (const schedule of selectedDaySchedules) {
      const hourBlocks = buildHourBlocks(schedule.availableTimeFrom, schedule.availableTimeTo);
      for (const block of hourBlocks) {
        if (!hours.has(block.value)) hours.set(block.value, block);
      }
    }
    return Array.from(hours.values());
  }, [effectiveSelectedDate, selectedDaySchedules]);

  const bookedSlots = useMemo(() => {
    if (!effectiveSelectedDate) return new Set<string>();
    return new Set(
      appointmentRows
        .filter((row) => row.appointment_date === toKey(effectiveSelectedDate))
        .filter((row) => !isRescheduling || String(row.id ?? "") !== String(currentAppointmentId ?? ""))
        .map((row) => {
          const start = normalizeTime(row.appointment_time ?? "");
          const end = normalizeTime(row.appointment_end_time ?? "") || (start ? addMinutes(start, row.time_slot_minutes ?? activeStep) : "");
          return start && end ? slotKey(start, end) : "";
        })
        .filter(Boolean),
    );
  }, [appointmentRows, effectiveSelectedDate, isRescheduling, currentAppointmentId, activeStep]);

  const currentPatientBookedSlots = useMemo(() => {
    if (!patientId || !effectiveSelectedDate) return new Set<string>();
    return new Set(
      appointmentRows
        .filter((row) => row.appointment_date === toKey(effectiveSelectedDate))
        .filter((row) => String(row.patient_id ?? "") === String(patientId))
        .map((row) => {
          const start = normalizeTime(row.appointment_time ?? "");
          const end = normalizeTime(row.appointment_end_time ?? "") || (start ? addMinutes(start, row.time_slot_minutes ?? activeStep) : "");
          return start && end ? slotKey(start, end) : "";
        })
        .filter(Boolean),
    );
  }, [appointmentRows, effectiveSelectedDate, patientId, activeStep]);

  const availableSubSlots = useMemo(() => {
    if (!selectedHour || !effectiveSelectedDate) return [];
    const [start, end] = selectedHour.value.split("|");
    return buildSubSlots(start, end, activeStep as 10 | 20);
  }, [activeStep, effectiveSelectedDate, selectedHour]);

  const isToday = useMemo(() => {
    if (!effectiveSelectedDate) return false;
    const today = new Date();
    return effectiveSelectedDate.getDate() === today.getDate() &&
      effectiveSelectedDate.getMonth() === today.getMonth() &&
      effectiveSelectedDate.getFullYear() === today.getFullYear();
  }, [effectiveSelectedDate]);

  const nowTime = new Date().toTimeString().slice(0, 5);
  async function bookSlot() {
    if (!effectiveSelectedDate || !selectedSlot || !patient) return;
    setErrorMessage("");
    const isReschedule = isRescheduling && Boolean(patientAppointment?.id);
    const response = await fetch(`/api/${encodeURIComponent(hname)}/appointments`, {
      method: isReschedule ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentId: patientAppointment?.id,
        appointmentDate: toKey(effectiveSelectedDate),
        appointmentDay: weekDayNames[effectiveSelectedDate.getDay()],
        department,
        doctor,
        patientId: String(patient.id ?? ""),
        patientName: patient.patient_name ?? "",
        patientPhone: patient.mobile ?? "",
        appointmentTime: selectedSlot,
        timeSlotMinutes: activeStep,
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(data.error ?? "Failed to save appointment.");
    setMessage(isReschedule ? "Appointment rescheduled." : "Appointment saved.");
    setDialogMessage(isReschedule ? "Appointment rescheduled." : "Appointment booked.");
    setIsRescheduling(false);
    setSelectedSlot("");
    setSelectedHour(null);
    setSelectedDate(effectiveSelectedDate);
    const rows = await loadRows(hname, `/appointments?date=${encodeURIComponent(toKey(effectiveSelectedDate))}&department=${encodeURIComponent(department)}&doctor=${encodeURIComponent(doctor)}`);
    setAppointmentRows(rows.map(normalizeAppointmentRow));
    await refreshPatientAppointments();
  }

  async function cancelAppointment() {
    setErrorMessage("");
    const response = await fetch(`/api/${encodeURIComponent(hname)}/appointments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentId: patientAppointment?.id,
        patientId,
        department,
        doctor,
        cancelledByRole: "patient",
        cancelledByName: patient?.patient_name ?? patientId,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) throw new Error(data.error ?? "Failed to cancel appointment.");

    setMessage("Appointment cancelled.");
    setDialogMessage("Appointment cancelled.");
    setIsRescheduling(false);
    setSelectedSlot("");
    setSelectedHour(null);
    setSelectedDate(null);

    if (effectiveSelectedDate) {
      const rows = await loadRows(
        hname,
        `/appointments?date=${encodeURIComponent(toKey(effectiveSelectedDate))}&department=${encodeURIComponent(department)}&doctor=${encodeURIComponent(doctor)}`,
      );
      setAppointmentRows(rows.map(normalizeAppointmentRow));
    }

    await refreshPatientAppointments();
  }

  function handleRescheduleClick() {
    if (!patientAppointment?.appointment_date) return;
    const targetDate = parseKey(patientAppointment.appointment_date);
    setIsRescheduling(true);
    if (targetDate) {
      setSelectedDate(targetDate);
      setSelectedHour(null);
      setSelectedSlot("");
    }
    document.getElementById("booking-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showBookConfirmation() {
    setConfirmDialog({ type: "book" });
  }

  function showRescheduleConfirmation() {
    setConfirmDialog({ type: "reschedule" });
  }

  function showCancelConfirmation() {
    setConfirmDialog({ type: "cancel" });
  }

  async function handleConfirmBook() {
    setConfirmDialog(null);
    try {
      await bookSlot();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save appointment.");
    }
  }

  async function handleConfirmReschedule() {
    setConfirmDialog(null);
    try {
      await bookSlot();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save appointment.");
    }
  }

  async function handleConfirmCancel() {
    setConfirmDialog(null);
    try {
      await cancelAppointment();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to cancel appointment.");
    }
  }

  const [show, setShow] = useState(false);
  if (show) {
    return <div className="justify-center items-center"><PatientProfilePage searchParams={{ patientId }} onClose={() => setShow(false)} /></div>
  }
  return (
    <PageLayout title="Appointment Calendar">
      <div className="grid gap-6 xl:grid-cols-1">
        <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5 dark:border-gray-800">
            <div>
              <h3 className="text-base font-medium text-gray-800 dark:text-white/90">Appointments</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{department} - {doctor}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShow(true)}
                className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm transition hover:bg-gray-50"
                aria-label="Open user profile"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white">
                  {patientAvatarLabel}
                </div>
                <div className="hidden text-left sm:block">
                  <p className="text-xs uppercase tracking-wide text-gray-500">User image</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">Profile</p>
                </div>
              </button>
              <div className="inline-flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-600">
                <CalenderIcon className="h-5 w-5" />
                Weekly
              </div>
            </div>
          </div>
          <div className="space-y-5 p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handlePreviousWeek}
                disabled={selectedWeekStart <= todayWeekStart}
                className="rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                Prev
              </button>
              <div className="text-sm text-gray-600">{formatDay(weekDaysList[0])} - {formatDay(weekDaysList[6])}</div>
              <button type="button" onClick={handleNextWeek} className="rounded-lg border px-3 py-2 text-sm">
                Next
              </button>
            </div>

            <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-gray-200">
              {weekDays.map((day, index) => {
                const current = weekDaysList[index];
                const isPast = current < todayDate;
                const isAvailable = isDateAvailable(current);
                const isSelected = effectiveSelectedDate?.toDateString() === current.toDateString();
                const dayColorClass = isAvailable ? "text-emerald-700" : "text-red-600";
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      if (!isPast && isAvailable) {
                        setSelectedDate(current);
                        setSelectedHour(null);
                        setSelectedSlot("");
                      }
                    }}
                    className={`min-h-24 border-r border-b p-3 text-left last:border-r-0 transition ${isSelected
                      ? "bg-emerald-50 ring-1 ring-emerald-200"
                      : isAvailable
                        ? "bg-white hover:bg-emerald-50/60"
                        : "bg-red-50 hover:bg-red-100/60"
                      } ${isPast ? "opacity-70" : ""}`}
                  >
                    <div className={`text-xs font-semibold uppercase ${dayColorClass}`}>{day}</div>
                    <div className={`mt-3 text-sm font-medium ${dayColorClass}`}>{current.getDate()}</div>
                  </button>
                );
              })}
            </div>



            {effectiveSelectedDate ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-gray-200 p-4">
                  <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Hour Slots</div>
                  <div className="flex flex-wrap gap-3">
                    {availableHours.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">No available hours.</div>
                    ) : (
                      availableHours.map((hour) => {
                        const isPast = isToday && hour.end <= nowTime;
                        return (
                          <button
                            key={hour.value}
                            type="button"
                            disabled={isPast}
                            onClick={() => { setSelectedHour(hour); setSelectedSlot(""); }}
                            className={`rounded-full border px-4 py-2 text-sm transition ${selectedHour?.value === hour.value
                              ? "bg-brand-500 text-white"
                              : isPast
                                ? "cursor-not-allowed opacity-40 bg-gray-100 text-gray-400"
                                : "bg-white text-gray-700 hover:bg-gray-50"
                              }`}
                          >
                            {hour.label}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {selectedHour ? (
                  <div className="rounded-2xl border border-gray-200 p-4">
                    <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Available Time Slots</div>
                    <div className="flex flex-wrap gap-3">
                      {availableSubSlots.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">No available slots.</div>
                      ) : (
                        availableSubSlots.map((slot) => {
                          const isPast = isToday && slot.start <= nowTime;
                          const isBooked = bookedSlots.has(slot.value) && !currentPatientBookedSlots.has(slot.value);
                          const isDisabled = isBooked || isPast;
                          return (
                            <button
                              key={slot.value}
                              type="button"
                              disabled={isDisabled}
                              onClick={() => !isDisabled && setSelectedSlot(slot.start)}
                              className={`rounded-full border px-4 py-2 text-sm transition ${selectedSlot === slot.start
                                ? "bg-brand-500 text-white"
                                : isBooked
                                  ? "cursor-not-allowed border-red-300 bg-red-100 text-red-700"
                                  : isPast
                                    ? "cursor-not-allowed opacity-40 bg-gray-100 text-gray-400"
                                    : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                }`}
                            >
                              {slot.label}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : null}

                <div id="booking-panel" className="rounded-2xl border border-brand-200 bg-brand-50/80 p-4 shadow-sm shadow-brand-100/50">
                  <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-white px-4 py-3 text-sm font-semibold text-brand-700 shadow-sm">
                    <span>Selected Slot Details</span>
                    <span className="rounded-full bg-brand-500 px-2.5 py-1 text-xs font-semibold text-white">{selectedSlot ? "Selected" : "None"}</span>
                  </div>
                  <div className="text-sm text-gray-700">
                    <span className="font-medium">Slot:</span> {selectedSlot ? formatTimeRange(selectedSlot, addMinutes(selectedSlot, activeStep)) : "Not selected"}
                  </div>
                  {patientAppointment ? (
                    <div className="mt-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
                      <div className="font-medium text-gray-800">Current booking</div>
                      <div>Time: {patientAppointment.appointment_time ? formatTimeRange(patientAppointment.appointment_time, patientAppointment.appointment_end_time) : "-"}</div>
                      <div>Reschedules: {patientAppointment.reschedule_count ?? 0}/3</div>
                    </div>
                  ) : null}
                  {!patientAppointment ? (
                    <div className="mt-4 flex gap-3">
                      <button type="button" onClick={showBookConfirmation} className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition">
                        Book Appointment
                      </button>
                      <button type="button" onClick={() => { setSelectedSlot(""); setSelectedHour(null); setMessage(""); setErrorMessage(""); }} className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                        Cancel
                      </button>
                    </div>
                  ) : isRescheduling ? (
                    <div className="mt-4 flex gap-3">
                      <button type="button" onClick={showRescheduleConfirmation} className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition">
                        Confirm Reschedule
                      </button>
                      <button type="button" onClick={() => { setIsRescheduling(false); setSelectedSlot(""); setSelectedHour(null); }} className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                        Cancel Reschedule
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 flex gap-3">
                      <button type="button" onClick={handleRescheduleClick} className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition">
                        Reschedule Appointment
                      </button>
                      <button type="button" onClick={showCancelConfirmation} className="rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition">
                        Cancel Appointment
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {message ? <div className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">{message}</div> : null}
            {errorMessage ? <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{errorMessage}</div> : null}
          </div>
        </section>

      </div>
      {dialogMessage ? (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Status</h2>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{dialogMessage}</p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setDialogMessage("")}
                className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {confirmDialog ? (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Confirmation</h2>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
              {confirmDialog.type === "book" && "ARE YOU CONFIRM TO BOOK"}
              {confirmDialog.type === "reschedule" && "ARE YOU CONFIRM TO RESCHEDULE"}
              {confirmDialog.type === "cancel" && "ARE YOU CONFIRM TO CANCEL"}
            </p>
            <div className="mt-5 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700"
              >
                No
              </button>
              <button
                type="button"
                onClick={
                  confirmDialog.type === "book"
                    ? handleConfirmBook
                    : confirmDialog.type === "reschedule"
                      ? handleConfirmReschedule
                      : handleConfirmCancel
                }
                className={`rounded-lg px-4 py-2.5 text-sm font-medium text-white ${confirmDialog.type === "cancel" ? "bg-red-500" : "bg-brand-500"
                  }`}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageLayout>
  );
}
