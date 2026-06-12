"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getCurrentUser, getCurrentUserRole } from "../../actions/user";
import { BlankPage } from "../../../components/blank-page";
import { CalenderIcon } from "../../../components/icons";
import PatientProfilePage from "../../../components/profile/page";
import { tableNameFromCardTitle } from "../../../lib/master-form-table";

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
  doctor?: string | null;
  department?: string | null;
  status?: string | null;
};
type DoctorProfileRow = {
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  department?: string | null;
};

const SCHEDULE_TABLE = tableNameFromCardTitle("Consultant / Doctor Schedule");
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
    id: row.id ? Number(row.id) : undefined,
    appointment_date: normalizeDateKey(readText(row, ["appointment_date", "appointmentDate"])),
    appointment_time: readText(row, ["appointment_time", "appointmentTime"]) || null,
    appointment_end_time: readText(row, ["appointment_end_time", "appointmentEndTime"]) || null,
    patient_id: readText(row, ["patient_id", "patientId"]) || null,
    patient_name: readText(row, ["patient_name", "patientName"]) || null,
    patient_phone: readText(row, ["patient_phone", "patientPhone"]) || null,
    doctor: readText(row, ["doctor"]) || null,
    department: readText(row, ["department"]) || null,
    status: readText(row, ["status"]) || null,
  };
}

function normalizeDoctorProfileRow(row: RawRow | null): DoctorProfileRow | null {
  if (!row) return null;
  return {
    username: readText(row, ["username"]) || null,
    first_name: readText(row, ["first_name", "firstName"]) || null,
    last_name: readText(row, ["last_name", "lastName"]) || null,
    department: readText(row, ["department"]) || null,
  };
}

function normalizeMatchKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
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

function formatWeekRange(start: Date, end: Date) {
  return `${new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(start)} - ${new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(end)}`;
}

function formatDisplayDate(value: string) {
  const normalized = normalizeDateKey(value);
  if (!normalized) return value;
  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "2-digit", month: "short", year: "numeric" }).format(date);
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

function normalizeDateKey(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : text;
}

async function loadRows(hname: string, url: string) {
  const response = await fetch(`/api/${encodeURIComponent(hname)}${url}`, { cache: "no-store" });
  const data = (await response.json()) as { rows?: RawRow[]; error?: string };
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data.rows ?? [];
}

async function loadDoctorProfile(hname: string, username: string) {
  const response = await fetch(
    `/api/${encodeURIComponent(hname)}/doctor-profile?username=${encodeURIComponent(username)}`,
    { cache: "no-store" },
  );
  const data = (await response.json().catch(() => ({}))) as { row?: RawRow | null; error?: string };
  if (!response.ok) throw new Error(data.error ?? "Failed to load doctor profile.");
  return normalizeDoctorProfileRow(data.row ?? null);
}

function sameDay(left: Date | null, right: Date) {
  return left ? toKey(left) === toKey(right) : false;
}

export default function DoctorSchedulePage() {
  const params = useParams();
  const hname = params?.Hname as string;
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - date.getDay());
    return date;
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentUser, setCurrentUser] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfileRow | null>(null);
  const [allScheduleRows, setAllScheduleRows] = useState<ScheduleRow[]>([]);
  const [weekAppointments, setWeekAppointments] = useState<AppointmentRow[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AppointmentRow | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingWeek, setIsLoadingWeek] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDoctorContext() {
      setIsLoading(true);
      try {
        const [user, role] = await Promise.all([getCurrentUser(hname), getCurrentUserRole(hname)]);
        if (cancelled) return;
        setCurrentUser(user ?? "");
        setCurrentRole(role ?? "");

        if (user) {
          const profile = await loadDoctorProfile(hname, user);
          if (!cancelled) setDoctorProfile(profile);
        } else {
          setDoctorProfile(null);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to load doctor session.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadDoctorContext();
    return () => {
      cancelled = true;
    };
  }, [hname]);

  useEffect(() => {
    let cancelled = false;

    async function loadSchedule() {
      try {
        const rows = await loadRows(hname, `/forms/${SCHEDULE_TABLE}`);
        if (!cancelled) {
          setAllScheduleRows(rows.map(normalizeScheduleRow).filter((row) => row.consultantDoctorName));
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to load doctor schedule.");
        }
      }
    }

    void loadSchedule();
    return () => {
      cancelled = true;
    };
  }, [hname]);

  const doctorCandidateNames = useMemo(() => {
    const names = new Set<string>();
    const firstName = doctorProfile?.first_name?.trim() ?? "";
    const lastName = doctorProfile?.last_name?.trim() ?? "";
    const fullName = `${firstName} ${lastName}`.trim();

    if (currentUser) names.add(currentUser);
    if (firstName) names.add(firstName);
    if (lastName) names.add(lastName);
    if (fullName) names.add(fullName);

    return Array.from(names);
  }, [currentUser, doctorProfile]);

  const matchedDoctorNames = useMemo(() => {
    if (doctorCandidateNames.length === 0) return [];

    const candidateKeys = doctorCandidateNames.map(normalizeMatchKey).filter(Boolean);
    const scheduleMatches = allScheduleRows
      .filter((row) => {
        const rowKey = normalizeMatchKey(row.consultantDoctorName);
        return candidateKeys.some((candidateKey) => rowKey === candidateKey || rowKey.includes(candidateKey) || candidateKey.includes(rowKey));
      })
      .map((row) => row.consultantDoctorName);

    const source = scheduleMatches.length > 0 ? scheduleMatches : doctorCandidateNames;
    return Array.from(new Set(source.map((item) => item.trim()).filter(Boolean)));
  }, [allScheduleRows, doctorCandidateNames]);

  const doctorScheduleRows = useMemo(
    () =>
      allScheduleRows.filter((row) =>
        matchedDoctorNames.some(
          (doctorName) => row.consultantDoctorName.trim().toLowerCase() === doctorName.trim().toLowerCase(),
        ),
      ),
    [allScheduleRows, matchedDoctorNames],
  );

  const weekDaysList = useMemo(() => buildWeek(selectedWeekStart), [selectedWeekStart]);

  const doctorLabel = useMemo(() => {
    const firstName = doctorProfile?.first_name?.trim() ?? "";
    const lastName = doctorProfile?.last_name?.trim() ?? "";
    return `${firstName} ${lastName}`.trim() || matchedDoctorNames[0] || currentUser || "Doctor";
  }, [currentUser, doctorProfile, matchedDoctorNames]);

  function isDoctorScheduledOn(date: Date) {
    const dayName = weekDayNames[date.getDay()];
    return doctorScheduleRows.some((row) => {
      const from = row.appointmentFromDate ? parseKey(row.appointmentFromDate) : null;
      const to = row.appointmentToDate ? parseKey(row.appointmentToDate) : null;
      if (from && date < from) return false;
      if (to && date > to) return false;
      return row.daysAvailable.length === 0 || row.daysAvailable.includes(dayName);
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadWeekAppointments() {
      if (!hname || matchedDoctorNames.length === 0 || weekDaysList.length === 0) {
        setWeekAppointments([]);
        return;
      }

      setIsLoadingWeek(true);
      try {
        const rows = await loadRows(
          hname,
          `/appointments?start=${encodeURIComponent(toKey(weekDaysList[0]))}&end=${encodeURIComponent(toKey(weekDaysList[6]))}&doctorNames=${encodeURIComponent(matchedDoctorNames.join(","))}`,
        );
        if (!cancelled) {
          setWeekAppointments(rows.map(normalizeAppointmentRow));
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to load appointments.");
        }
      } finally {
        if (!cancelled) setIsLoadingWeek(false);
      }
    }

    void loadWeekAppointments();
    return () => {
      cancelled = true;
    };
  }, [hname, matchedDoctorNames, weekDaysList]);

  const defaultSelectedDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return (
      weekDaysList.find((day) => sameDay(today, day)) ??
      weekDaysList.find((day) => {
        const dayName = weekDayNames[day.getDay()];
        return doctorScheduleRows.some((row) => {
          const from = row.appointmentFromDate ? parseKey(row.appointmentFromDate) : null;
          const to = row.appointmentToDate ? parseKey(row.appointmentToDate) : null;
          if (from && day < from) return false;
          if (to && day > to) return false;
          return row.daysAvailable.length === 0 || row.daysAvailable.includes(dayName);
        });
      }) ??
      weekDaysList[0] ??
      null
    );
  }, [weekDaysList, doctorScheduleRows]);
  const effectiveSelectedDate = useMemo(() => {
    if (selectedDate && weekDaysList.some((day) => sameDay(selectedDate, day))) {
      return selectedDate;
    }
    return defaultSelectedDate;
  }, [defaultSelectedDate, selectedDate, weekDaysList]);
  const selectedDateKey = effectiveSelectedDate ? toKey(effectiveSelectedDate) : "";
  const selectedDayAppointments = useMemo(
    () => weekAppointments.filter((row) => normalizeDateKey(row.appointment_date) === selectedDateKey),
    [selectedDateKey, weekAppointments],
  );
  const selectedDaySchedules = useMemo(() => {
    if (!effectiveSelectedDate) return [];
    const dayName = weekDayNames[effectiveSelectedDate.getDay()];
    return doctorScheduleRows.filter((row) => {
      const from = row.appointmentFromDate ? parseKey(row.appointmentFromDate) : null;
      const to = row.appointmentToDate ? parseKey(row.appointmentToDate) : null;
      if (from && effectiveSelectedDate < from) return false;
      if (to && effectiveSelectedDate > to) return false;
      return row.daysAvailable.length === 0 || row.daysAvailable.includes(dayName);
    });
  }, [doctorScheduleRows, effectiveSelectedDate]);
  const appointmentCountByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of weekAppointments) {
      const key = normalizeDateKey(row.appointment_date);
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [weekAppointments]);
  const currentDepartment = useMemo(
    () => doctorProfile?.department || selectedDayAppointments[0]?.department || "-",
    [doctorProfile?.department, selectedDayAppointments],
  );

  async function cancelAppointment() {
    if (!cancelTarget?.id) return;

    setIsCancelling(true);
    setErrorMessage("");
    setMessage("");
    try {
      const response = await fetch(`/api/${encodeURIComponent(hname)}/appointments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: cancelTarget.id,
          cancelledByRole: "doctor",
          cancelledByName: doctorLabel,
          cancelledByUsername: currentUser,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to cancel appointment.");

      setWeekAppointments((current) => current.filter((row) => row.id !== cancelTarget.id));
      setMessage(`Appointment cancelled for ${cancelTarget.patient_name ?? "patient"}.`);
      setCancelTarget(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to cancel appointment.");
    } finally {
      setIsCancelling(false);
    }
  }

  if (selectedPatientId) {
    return <PatientProfilePage searchParams={{ patientId: selectedPatientId }} onClose={() => setSelectedPatientId(null)} />;
  }

  if (isLoading) {
    return (
      <BlankPage title="Doctor Schedule">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading doctor schedule...</div>
      </BlankPage>
    );
  }

  if (!currentUser) {
    return (
      <BlankPage title="Doctor Schedule">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">Please sign in to view the doctor schedule.</div>
      </BlankPage>
    );
  }

  if (currentRole && currentRole.toLowerCase() !== "doctor") {
    return (
      <BlankPage title="Doctor Schedule">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">Only doctor accounts can access this schedule view.</div>
      </BlankPage>
    );
  }

  return (
    <BlankPage title="Doctor Schedule">
      <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-800 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Doctor Schedule</p>
            <h2 className="mt-1 text-2xl font-semibold text-gray-800 dark:text-white/90">{doctorLabel}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Department: {currentDepartment}</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-600">
            <CalenderIcon className="h-5 w-5" />
            Weekly calendar
          </div>
        </div>

        <div className="space-y-6 p-4 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Week Appointments</p>
              <p className="mt-3 text-2xl font-semibold text-gray-800">{weekAppointments.length}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Selected Day</p>
              <p className="mt-3 text-2xl font-semibold text-gray-800">{selectedDayAppointments.length}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Doctor Availability</p>
              <p className="mt-3 text-sm font-medium text-gray-700">
                {selectedDaySchedules.length > 0
                  ? selectedDaySchedules.map((s) => `${formatDisplayTime(s.availableTimeFrom)} - ${formatDisplayTime(s.availableTimeTo)}`).join(", ")
                  : "No schedule for this day"}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setSelectedWeekStart(new Date(selectedWeekStart.getFullYear(), selectedWeekStart.getMonth(), selectedWeekStart.getDate() - 7))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700"
            >
              Prev
            </button>
            <div className="text-sm font-medium text-gray-600">{formatWeekRange(weekDaysList[0], weekDaysList[6])}</div>
            <button
              type="button"
              onClick={() => setSelectedWeekStart(new Date(selectedWeekStart.getFullYear(), selectedWeekStart.getMonth(), selectedWeekStart.getDate() + 7))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700"
            >
              Next
            </button>
          </div>

          <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-gray-200">
            {weekDays.map((day, index) => {
              const current = weekDaysList[index];
              const dateKey = toKey(current);
              const count = appointmentCountByDate.get(dateKey) ?? 0;
              const isSelected = sameDay(effectiveSelectedDate, current);
              const isScheduled = isDoctorScheduledOn(current);

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => {
                    setSelectedDate(current);
                    setMessage("");
                    setErrorMessage("");
                  }}
                  className={`min-h-28 border-r border-b p-3 text-left last:border-r-0 ${isSelected ? "bg-brand-50" : "bg-white"} ${!isScheduled ? "text-gray-400" : "text-gray-800"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs font-semibold uppercase">{day}</div>
                    {count > 0 ? <span className="rounded-full bg-brand-500 px-2 py-1 text-[11px] font-semibold text-white">{count}</span> : null}
                  </div>
                  <div className="mt-3 text-lg font-semibold">{current.getDate()}</div>
                  <div className="mt-2 text-xs text-gray-500">{isScheduled ? "Available" : "No schedule"}</div>
                </button>
              );
            })}
          </div>

          <section className="rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Booked Patients</p>
                <h3 className="mt-1 text-lg font-semibold text-gray-800">{selectedDateKey ? formatDisplayDate(selectedDateKey) : "Select a day"}</h3>
              </div>
              {isLoadingWeek ? <span className="text-xs text-gray-500">Refreshing...</span> : null}
            </div>

            {selectedDayAppointments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3 text-left">Time</th>
                      <th className="px-4 py-3 text-left">Patient</th>
                      <th className="px-4 py-3 text-left">Patient Type</th>
                      <th className="px-4 py-3 text-left">Gender</th>
                      <th className="px-4 py-3 text-left">Remarks</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedDayAppointments.map((appointment) => (
                      <tr key={appointment.id ?? `${appointment.patient_id}-${appointment.appointment_time}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-800">
                          {appointment.appointment_time ? formatTimeRange(appointment.appointment_time, appointment.appointment_end_time) : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => appointment.patient_id && setSelectedPatientId(appointment.patient_id)}
                            disabled={!appointment.patient_id}
                            className="font-medium text-gray-800 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {appointment.patient_name ?? "-"}
                          </button>
                          <p className="text-xs text-gray-500">{appointment.patient_phone ?? ""}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{appointment.department ?? "-"}</td>
                        <td className="px-4 py-3 text-gray-600">-</td>
                        <td className="px-4 py-3 text-gray-600">{appointment.status ?? "-"}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => appointment.patient_id && setSelectedPatientId(appointment.patient_id)}
                              disabled={!appointment.patient_id}
                              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              View Profile
                            </button>
                            <button
                              type="button"
                              onClick={() => setCancelTarget(appointment)}
                              className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-sm text-gray-500">No booked patients for this day.</div>
            )}
          </section>

          {message ? <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div> : null}
          {errorMessage ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div> : null}
        </div>
      </section>

      {cancelTarget ? (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Cancel appointment</h3>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
              Cancel the appointment for {cancelTarget.patient_name ?? "this patient"}
              {cancelTarget.appointment_time ? ` at ${formatTimeRange(cancelTarget.appointment_time, cancelTarget.appointment_end_time)}` : ""}?
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700"
              >
                Keep
              </button>
              <button
                type="button"
                onClick={() => void cancelAppointment()}
                disabled={isCancelling}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {isCancelling ? "Cancelling..." : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </BlankPage>
  );
}
