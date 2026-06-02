"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { BlankPage } from "../../../../components/blank-page";
import { CalenderIcon } from "../../../../components/icons";
import { tableNameFromCardTitle } from "../../../../lib/master-form-table";

type AppointmentRow = {
  id?: number;
  appointment_date?: string;
  department?: string;
  doctor?: string;
  patient_name?: string;
  patient_phone?: string | null;
  appointment_time?: string | null;
  reason?: string | null;
  status?: string | null;
  created_at?: string;
};

type RawAppointmentRow = Record<string, unknown>;

type RawScheduleRow = Record<string, unknown>;

type ScheduleRow = {
  appointmentFromDate: string;
  appointmentToDate: string;
  availableTimeFrom: string;
  availableTimeTo: string;
  daysAvailable: string[];
  consultantDoctorName: string;
};

type AppointmentFormState = {
  patientName: string;
  patientPhone: string;
  appointmentTime: string;
  reason: string;
};

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekDayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const SCHEDULE_TABLE = tableNameFromCardTitle("Consultant / Doctor Schedule");

function buildCalendarDays(year: number, month: number) {
  const today = new Date();
  const firstDay = new Date(year, month, 1);
  const startDate = new Date(year, month, 1 - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);

    return {
      date,
      dayNumber: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
      isToday:
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate(),
    };
  });
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatTimeLabel(value?: string | null) {
  if (!value) {
    return "Any time";
  }

  const [hoursText, minutesText = "00"] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return value;
  }

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function readText(row: RawAppointmentRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];

    if (value !== null && value !== undefined) {
      const text = String(value).trim();

      if (text) {
        return text;
      }
    }
  }

  return "";
}

function normalizeAppointmentRow(row: RawAppointmentRow): AppointmentRow {
  const idValue = readText(row, ["id"]);

  return {
    id: idValue ? Number(idValue) : undefined,
    appointment_date: readText(row, ["appointment_date", "appointmentDate"]),
    department: readText(row, ["department"]) || undefined,
    doctor: readText(row, ["doctor"]) || undefined,
    patient_name: readText(row, ["patient_name", "patientName"]) || undefined,
    patient_phone: readText(row, ["patient_phone", "patientPhone"]) || null,
    appointment_time: readText(row, ["appointment_time", "appointmentTime"]) || null,
    reason: readText(row, ["reason"]) || null,
    status: readText(row, ["status"]) || null,
    created_at: readText(row, ["created_at", "createdAt"]) || undefined,
  };
}

function readDaysAvailable(row: RawScheduleRow) {
  const value = row.daysAvailable ?? row.days_available;

  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(String).filter(Boolean);
      }
    } catch {
      return value
        .replace(/[\[\]"]/g, "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function normalizeDayName(value: string) {
  const trimmed = value.trim().toLowerCase();

  switch (trimmed) {
    case "sun":
    case "sunday":
      return "Sunday";
    case "mon":
    case "monday":
      return "Monday";
    case "tue":
    case "tues":
    case "tuesday":
      return "Tuesday";
    case "wed":
    case "wednesday":
      return "Wednesday";
    case "thu":
    case "thurs":
    case "thursday":
      return "Thursday";
    case "fri":
    case "friday":
      return "Friday";
    case "sat":
    case "saturday":
      return "Saturday";
    default:
      return value.trim();
  }
}

function normalizeScheduleRow(row: RawScheduleRow): ScheduleRow {
  return {
    appointmentFromDate: readText(row, ["appointment_from_date", "appointmentFromDate"]),
    appointmentToDate: readText(row, ["appointment_to_date", "appointmentToDate"]),
    availableTimeFrom: readText(row, ["available_time_from", "availableTimeFrom"]),
    availableTimeTo: readText(row, ["available_time_to", "availableTimeTo"]),
    daysAvailable: readDaysAvailable(row).map(normalizeDayName),
    consultantDoctorName: readText(row, ["consultant_doctor_name", "consultantDoctorName"]).trim(),
  };
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function parseDateKey(value: string) {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

async function loadAppointments(
  hname: string,
  dateKey: string,
  department: string,
  doctor: string,
) {
  const response = await fetch(
    `/api/${encodeURIComponent(hname)}/appointments?date=${encodeURIComponent(dateKey)}&department=${encodeURIComponent(department)}&doctor=${encodeURIComponent(doctor)}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  const data = (await response.json()) as {
    rows?: RawAppointmentRow[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? "Failed to load appointments.");
  }

  return (data.rows ?? []).map(normalizeAppointmentRow);
}

async function loadSchedules(hname: string) {
  const response = await fetch(
    `/api/${encodeURIComponent(hname)}/forms/${SCHEDULE_TABLE}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  const data = (await response.json()) as { rows?: RawScheduleRow[]; error?: string };

  if (!response.ok) {
    console.error("Schedule API Error:", response.status, data);
    throw new Error(data.error ?? "Failed to load schedule.");
  }

  return (data.rows ?? []).map(normalizeScheduleRow);
}

export default function AppointmentCalendarPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const hname = params?.Hname as string;
  const [today] = useState(() => new Date());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [appointmentRows, setAppointmentRows] = useState<AppointmentRow[]>([]);
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([]);
  const [appointmentError, setAppointmentError] = useState<string | null>(null);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);
  const [isFixFormOpen, setIsFixFormOpen] = useState(false);
  const [isSavingAppointment, setIsSavingAppointment] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<AppointmentFormState>({
    patientName: "",
    patientPhone: "",
    appointmentTime: "",
    reason: "",
  });

  const department = searchParams.get("department") ?? "";
  const doctor = searchParams.get("doctor") ?? "";
  const calendarDays = useMemo(
    () => buildCalendarDays(selectedYear, selectedMonth),
    [selectedMonth, selectedYear],
  );
  const yearOptions = useMemo(
    () =>
      Array.from({ length: 11 }, (_, index) => today.getFullYear() - 2 + index),
    [today],
  );

  useEffect(() => {
    async function loadSchedule() {
      if (!doctor) {
        setScheduleRows([]);
        return;
      }

      try {
        const rows = await loadSchedules(hname);
        setScheduleRows(
          rows.filter((row) => {
            const selected = doctor.trim().toLowerCase();
            const scheduleDoctor = row.consultantDoctorName.trim().toLowerCase();

            return (
              scheduleDoctor === selected ||
              scheduleDoctor.includes(selected) ||
              selected.includes(scheduleDoctor)
            );
          }),
        );
      } catch (error) {
        console.error("Failed to load doctor schedule", error);
        setScheduleRows([]);
      }
    }

    void loadSchedule();
  }, [doctor, hname]);

  const availableDates = useMemo(() => {
    const dates = new Set<string>();

    for (const schedule of scheduleRows) {
      const fromDate = schedule.appointmentFromDate ? parseDateKey(schedule.appointmentFromDate) : null;
      const toDate = schedule.appointmentToDate ? parseDateKey(schedule.appointmentToDate) : null;

      for (const day of calendarDays) {
        if (!day.isCurrentMonth) {
          continue;
        }

        if (fromDate && day.date < fromDate) {
          continue;
        }

        if (toDate && day.date > toDate) {
          continue;
        }

        if (schedule.daysAvailable.length > 0) {
          const dayName = weekDayNames[day.date.getDay()];
          if (!schedule.daysAvailable.includes(dayName)) {
            continue;
          }
        }

        dates.add(toDateKey(day.date));
      }
    }

    return dates;
  }, [calendarDays, scheduleRows]);

  function isSelectableDate(date: Date) {
    if (!doctor) {
      return false;
    }

    return availableDates.has(toDateKey(date));
  }

  async function openDate(date: Date) {
    const dateKey = formatDateKey(date);

    setSelectedDate(date);
    setIsFixFormOpen(false);
    setSubmitMessage(null);
    setAppointmentError(null);
    setAppointmentRows([]);
    setIsLoadingAppointments(true);

    try {
      const rows = await loadAppointments(hname, dateKey, department, doctor);
      setAppointmentRows(rows);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load appointments.";
      setAppointmentError(message);
      setAppointmentRows([]);
    } finally {
      setIsLoadingAppointments(false);
    }
  }

  function moveMonth(direction: -1 | 1) {
    const nextDate = new Date(selectedYear, selectedMonth + direction, 1);
    setSelectedMonth(nextDate.getMonth());
    setSelectedYear(nextDate.getFullYear());
  }

  function closeModal() {
    setSelectedDate(null);
    setIsFixFormOpen(false);
    setSubmitMessage(null);
    setAppointmentError(null);
    setFormValues({
      patientName: "",
      patientPhone: "",
      appointmentTime: "",
      reason: "",
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedDate) {
      return;
    }

    const dateKey = formatDateKey(selectedDate);
    setIsSavingAppointment(true);
    setAppointmentError(null);
    setSubmitMessage(null);

    try {
      const response = await fetch(`/api/${encodeURIComponent(hname)}/appointments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          appointmentDate: dateKey,
          department,
          doctor,
          patientName: formValues.patientName,
          patientPhone: formValues.patientPhone,
          appointmentTime: formValues.appointmentTime,
          reason: formValues.reason,
        }),
      });

      const data = (await response.json()) as {
        row?: AppointmentRow;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save appointment.");
      }

      setSubmitMessage("Appointment saved.");
      setFormValues({
        patientName: "",
        patientPhone: "",
        appointmentTime: "",
        reason: "",
      });
      setIsFixFormOpen(false);
      const rows = await loadAppointments(hname, dateKey, department, doctor);
      setAppointmentRows(rows);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save appointment.";
      setAppointmentError(message);
    } finally {
      setIsSavingAppointment(false);
    }
  }

  const selectedDateLabel = selectedDate ? formatDate(selectedDate) : "";

  return (
    <BlankPage title="Appointment Calendar">
      <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-800 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
              Appointment Calendar
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {department || doctor
                ? `${department || "Department"}${doctor ? ` - ${doctor}` : ""}`
                : "Choose a date to view appointments."}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href={`/${encodeURIComponent(hname)}/book-appointment`}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
            >
              Change Doctor
            </Link>
            <div className="inline-flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-600 dark:bg-brand-500/[0.12] dark:text-brand-400">
              <CalenderIcon className="h-5 w-5" />
              <span>
                {monthNames[selectedMonth]} {selectedYear}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-4 sm:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
              <select
                aria-label="Choose month"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(Number(event.target.value))}
                className="h-11 rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pr-10 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
              >
                {monthNames.map((month, index) => (
                  <option key={month} value={index}>
                    {month}
                  </option>
                ))}
              </select>

              <select
                aria-label="Choose year"
                value={selectedYear}
                onChange={(event) => setSelectedYear(Number(event.target.value))}
                className="h-11 rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pr-10 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => moveMonth(-1)}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-lg font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
              >
                &lt;
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => moveMonth(1)}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-lg font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
              >
                &gt;
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="px-2 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-gray-400"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {calendarDays.map((calendarDay) => (
                <button
                  key={calendarDay.date.toISOString()}
                  type="button"
                  onClick={() => {
                    if (isSelectableDate(calendarDay.date)) {
                      void openDate(calendarDay.date);
                    }
                  }}
                  className={`min-h-20 border-r border-b border-gray-200 p-2 text-left transition last:border-r-0 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 sm:min-h-24 ${
                    !calendarDay.isCurrentMonth
                      ? "bg-gray-50 text-gray-400 hover:bg-gray-100 dark:bg-gray-900/50 dark:text-gray-600 dark:hover:bg-gray-900"
                      : isSelectableDate(calendarDay.date)
                        ? "bg-white hover:bg-brand-50 dark:bg-transparent dark:hover:bg-brand-500/[0.12]"
                        : "bg-red-50 text-red-300 dark:bg-red-500/[0.08] dark:text-red-300/60 cursor-not-allowed hover:bg-red-50 dark:hover:bg-red-500/[0.08]"
                  }`}
                  disabled={!isSelectableDate(calendarDay.date)}
                >
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                      calendarDay.isToday
                        ? "bg-brand-500 text-white"
                        : !calendarDay.isCurrentMonth
                          ? "text-gray-400 dark:text-gray-600"
                          : isSelectableDate(calendarDay.date)
                          ? "text-gray-800 dark:text-white/90"
                          : "text-red-400 dark:text-red-300/70"
                    }`}
                  >
                    {calendarDay.dayNumber}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {selectedDate ? (
        <div className="fixed inset-0 z-99999 flex items-center justify-center bg-gray-900/50 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xl dark:border-gray-800 dark:bg-gray-900">
            <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
                    Appointments
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {selectedDateLabel}
                  </p>
                </div>
                <div className="inline-flex rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-600 dark:bg-brand-500/[0.12] dark:text-brand-400">
                  {department || "Department"} - {doctor || "Doctor"}
                </div>
              </div>
            </div>

            <div className="grid gap-0 lg:grid-cols-[1.4fr_1fr]">
              <div className="border-b border-gray-100 p-6 dark:border-gray-800 lg:border-b-0 lg:border-r">
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Scheduled Appointments
                  </h4>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {isLoadingAppointments ? "Loading..." : `${appointmentRows.length} found`}
                  </span>
                </div>

                {appointmentError ? (
                  <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
                    {appointmentError}
                  </div>
                ) : null}

                {submitMessage ? (
                  <div className="mb-4 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400">
                    {submitMessage}
                  </div>
                ) : null}

                <div className="space-y-3">
                  {!isLoadingAppointments && appointmentRows.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      No appointments found for this date.
                    </div>
                  ) : null}

                  {appointmentRows.map((row) => (
                    <div
                      key={row.id ?? `${row.patient_name ?? "appointment"}-${row.created_at ?? ""}`}
                      className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-800 dark:bg-gray-800/40"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-base font-semibold text-gray-800 dark:text-white/90">
                            {row.patient_name ?? "Unnamed patient"}
                          </p>
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {row.reason || "No reason entered"}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs font-medium sm:flex sm:flex-wrap">
                          <span className="rounded-full bg-white px-3 py-1 text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                            Date: {row.appointment_date || selectedDateLabel}
                          </span>
                          <span className="rounded-full bg-white px-3 py-1 text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                            {formatTimeLabel(row.appointment_time)}
                          </span>
                          <span className="rounded-full bg-white px-3 py-1 text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                            {row.patient_phone || "No phone"}
                          </span>
                          <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-600 dark:bg-brand-500/[0.12] dark:text-brand-400">
                            {row.status || "Scheduled"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 p-6">
                <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950/30">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Appointment Details
                  </h4>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-gray-500 dark:text-gray-400">Department</dt>
                      <dd className="font-medium text-gray-800 dark:text-white/90">
                        {department || "-"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-gray-500 dark:text-gray-400">Doctor</dt>
                      <dd className="font-medium text-gray-800 dark:text-white/90">
                        {doctor || "-"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-gray-500 dark:text-gray-400">Date</dt>
                      <dd className="font-medium text-gray-800 dark:text-white/90">
                        {selectedDateLabel}
                      </dd>
                    </div>
                  </dl>
                </div>

                {isFixFormOpen ? (
                  <form
                    onSubmit={(event) => void handleSubmit(event)}
                    className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950/30"
                  >
                    <div>
                      <label
                        htmlFor="patientName"
                        className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400"
                      >
                        Patient Name
                      </label>
                      <input
                        id="patientName"
                        value={formValues.patientName}
                        onChange={(event) =>
                          setFormValues((current) => ({
                            ...current,
                            patientName: event.target.value,
                          }))
                        }
                        required
                        className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="patientPhone"
                          className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400"
                        >
                          Phone Number
                        </label>
                        <input
                          id="patientPhone"
                          value={formValues.patientPhone}
                          onChange={(event) =>
                            setFormValues((current) => ({
                              ...current,
                              patientPhone: event.target.value,
                            }))
                          }
                          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="appointmentTime"
                          className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400"
                        >
                          Appointment Time
                        </label>
                        <input
                          id="appointmentTime"
                          type="time"
                          value={formValues.appointmentTime}
                          onChange={(event) =>
                            setFormValues((current) => ({
                              ...current,
                              appointmentTime: event.target.value,
                            }))
                          }
                          required
                          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Required to prevent duplicate booking for the same slot.
                        </p>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="reason"
                        className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400"
                      >
                        Reason / Notes
                      </label>
                      <textarea
                        id="reason"
                        value={formValues.reason}
                        onChange={(event) =>
                          setFormValues((current) => ({
                            ...current,
                            reason: event.target.value,
                          }))
                        }
                        rows={4}
                        className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                      />
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={() => setIsFixFormOpen(false)}
                        className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingAppointment}
                        className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 focus:outline-hidden focus:ring-3 focus:ring-brand-500/25 disabled:cursor-not-allowed disabled:bg-brand-300"
                      >
                        {isSavingAppointment ? "Saving..." : "Save Appointment"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Click Fix Appointment to open the booking form for the selected date.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsFixFormOpen(true)}
                      className="mt-4 inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 focus:outline-hidden focus:ring-3 focus:ring-brand-500/25"
                    >
                      Fix Appointment
                    </button>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </BlankPage>
  );
}
