"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { BlankPage } from "../../../../components/blank-page";
import { CalenderIcon } from "../../../../components/icons";
import { tableNameFromCardTitle } from "../../../../lib/master-form-table";

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
type AppointmentRow = { appointment_date?: string; appointment_time?: string | null };
type Slot = { value: string; label: string };
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
  return {
    appointment_date: readText(row, ["appointment_date", "appointmentDate"]),
    appointment_time: readText(row, ["appointment_time", "appointmentTime"]) || null,
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

function addMinutes(value: string, minutesToAdd: number) {
  const [hoursText, minutesText = "00"] = value.split(":");
  const date = new Date();
  date.setHours(Number(hoursText), Number(minutesText) + minutesToAdd, 0, 0);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function buildHourBlocks(fromTime: string, toTime: string) {
  const blocks: Slot[] = [];
  let cursor = fromTime;
  while (cursor < toTime) {
    const nextHour = addMinutes(cursor, 60);
    const end = nextHour > toTime ? toTime : nextHour;
    blocks.push({ value: `${cursor}|${end}`, label: `${formatDisplayTime(cursor)}-${formatDisplayTime(end)}` });
    cursor = end;
  }
  return blocks;
}

function buildSubSlots(fromTime: string, toTime: string, step: 10 | 20) {
  const slots: Slot[] = [];
  let cursor = fromTime;
  while (cursor < toTime) {
    const next = addMinutes(cursor, step);
    if (next > toTime) break;
    slots.push({ value: cursor, label: `${formatDisplayTime(cursor)}-${formatDisplayTime(next)}` });
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
  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - date.getDay());
    return date;
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedStep, setSelectedStep] = useState<10 | 20>(10);
  const [selectedHour, setSelectedHour] = useState<Slot | null>(null);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([]);
  const [appointmentRows, setAppointmentRows] = useState<AppointmentRow[]>([]);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

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
    if (!selectedDate || !doctor) return;
    const dateKey = toKey(selectedDate);
    void loadRows(hname, `/appointments?date=${encodeURIComponent(dateKey)}&department=${encodeURIComponent(department)}&doctor=${encodeURIComponent(doctor)}`)
      .then((rows) => setAppointmentRows(rows.map(normalizeAppointmentRow)))
      .catch((error) => setErrorMessage(error instanceof Error ? error.message : "Failed to load appointments."));
  }, [department, doctor, hname, selectedDate]);

  const weekDaysList = useMemo(() => buildWeek(selectedWeekStart), [selectedWeekStart]);
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
    const values = selectedDaySchedules
      .map((row) => row.timeSlotMinutes)
      .filter((value) => value === 10 || value === 20);

    return values[0] ?? 10;
  }, [selectedDaySchedules]);

  useEffect(() => {
    setSelectedStep(scheduleSlotMinutes as 10 | 20);
  }, [scheduleSlotMinutes]);

  const availableHours = useMemo(() => {
    if (!effectiveSelectedDate) return [];
    const taken = new Set(
      appointmentRows
        .filter((row) => row.appointment_date === toKey(effectiveSelectedDate))
        .map((row) => row.appointment_time ?? "")
        .filter(Boolean),
    );
    const hours = new Map<string, string>();
    for (const schedule of selectedDaySchedules) {
      const hourBlocks = buildHourBlocks(schedule.availableTimeFrom, schedule.availableTimeTo);
      for (const block of hourBlocks) {
        const [start, end] = block.value.split("|");
        const anyFree = buildSubSlots(start, end, selectedStep).some((slot) => !taken.has(slot.value));
        if (anyFree && !hours.has(block.value)) hours.set(block.value, block.label);
      }
    }
    return Array.from(hours.entries()).map(([value, label]) => ({ value, label }));
  }, [appointmentRows, effectiveSelectedDate, selectedDaySchedules, selectedStep]);

  const availableSubSlots = useMemo(() => {
    if (!selectedHour || !effectiveSelectedDate) return [];
    const taken = new Set(
      appointmentRows
        .filter((row) => row.appointment_date === toKey(effectiveSelectedDate))
        .map((row) => row.appointment_time ?? "")
        .filter(Boolean),
    );
    const [start, end] = selectedHour.value.split("|");
    return buildSubSlots(start, end, selectedStep).filter((slot) => !taken.has(slot.value));
  }, [appointmentRows, effectiveSelectedDate, selectedHour, selectedStep]);

  async function bookSlot() {
    if (!effectiveSelectedDate || !selectedSlot || !patient) return;
    setErrorMessage("");
    const response = await fetch(`/api/${encodeURIComponent(hname)}/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentDate: toKey(effectiveSelectedDate),
        appointmentDay: weekDayNames[effectiveSelectedDate.getDay()],
        department,
        doctor,
        patientId: String(patient.id ?? ""),
        patientName: patient.patient_name ?? "",
        patientPhone: patient.mobile ?? "",
        appointmentTime: selectedSlot,
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(data.error ?? "Failed to save appointment.");
    alert("appointment as fixed");
    setMessage("Appointment saved.");
    setSelectedSlot("");
    setSelectedHour(null);
    const rows = await loadRows(hname, `/appointments?date=${encodeURIComponent(toKey(effectiveSelectedDate))}&department=${encodeURIComponent(department)}&doctor=${encodeURIComponent(doctor)}`);
    setAppointmentRows(rows.map(normalizeAppointmentRow));
  }

  return (
    <BlankPage title="Appointment Calendar">
      <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5 dark:border-gray-800">
          <div>
            <h3 className="text-base font-medium text-gray-800 dark:text-white/90">Appointments</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{department} - {doctor}</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-600">
            <CalenderIcon className="h-5 w-5" />
            Weekly
          </div>
        </div>
        <div className="space-y-5 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <button type="button" disabled className="rounded-lg border px-3 py-2 text-sm opacity-40">Prev</button>
            <div className="text-sm text-gray-600">{formatDay(weekDaysList[0])} - {formatDay(weekDaysList[6])}</div>
            <button type="button" onClick={() => setSelectedWeekStart(new Date(selectedWeekStart.getFullYear(), selectedWeekStart.getMonth(), selectedWeekStart.getDate() + 7))} className="rounded-lg border px-3 py-2 text-sm">Next</button>
          </div>

          <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-gray-200">
            {weekDays.map((day, index) => {
              const current = weekDaysList[index];
              const isPast = current < new Date(new Date().setHours(0, 0, 0, 0));
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    if (!isPast) {
                      setSelectedDate(current);
                      setSelectedHour(null);
                      setSelectedSlot("");
                    }
                  }}
                  className={`min-h-24 border-r border-b p-3 text-left last:border-r-0 ${effectiveSelectedDate?.toDateString() === current.toDateString() ? "bg-brand-50" : "bg-white"} ${isPast ? "bg-red-50 text-red-400" : ""}`}
                >
                  <div className="text-xs font-semibold uppercase">{day}</div>
                  <div className="mt-3 text-sm font-medium">{current.getDate()}</div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Slot size</span>
            <select value={selectedStep} onChange={(event) => setSelectedStep(Number(event.target.value) as 10 | 20)} className="h-11 rounded-lg border border-gray-300 px-4 text-sm">
              <option value={10}>10 minutes</option>
              <option value={20}>20 minutes</option>
            </select>
            <span className="text-xs text-gray-500">From doctor schedule</span>
          </div>

          {effectiveSelectedDate ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-gray-200 p-4">
                <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Hour Slots</div>
                <div className="flex flex-wrap gap-3">
                  {availableHours.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">No available hours.</div>
                  ) : (
                    availableHours.map((hour) => (
                      <button key={hour.value} type="button" onClick={() => { setSelectedHour(hour); setSelectedSlot(""); }} className={`rounded-full border px-4 py-2 text-sm ${selectedHour?.value === hour.value ? "bg-brand-500 text-white" : "bg-white text-gray-700"}`}>
                        {hour.label}
                      </button>
                    ))
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
                      availableSubSlots.map((slot) => (
                        <button key={slot.value} type="button" onClick={() => setSelectedSlot(slot.value)} className={`rounded-full border px-4 py-2 text-sm ${selectedSlot === slot.value ? "bg-brand-500 text-white" : "bg-white text-gray-700"}`}>
                          {slot.label}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-gray-200 p-4">
                <div className="text-sm text-gray-600">Selected: {selectedSlot ? formatDisplayTime(selectedSlot) : "-"}</div>
                <button type="button" onClick={() => void bookSlot().catch((error) => setErrorMessage(error instanceof Error ? error.message : "Failed to save appointment."))} className="mt-4 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white">
                  Book Appointment
                </button>
              </div>
            </div>
          ) : null}

          {message ? <div className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">{message}</div> : null}
          {errorMessage ? <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{errorMessage}</div> : null}
        </div>
      </section>
    </BlankPage>
  );
}
