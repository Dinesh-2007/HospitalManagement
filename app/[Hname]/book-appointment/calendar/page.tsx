"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { BlankPage } from "../../../../components/blank-page";
import { CalenderIcon } from "../../../../components/icons";

type CalendarDay = {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
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

function buildCalendarDays(year: number, month: number) {
  const today = new Date();
  const firstDay = new Date(year, month, 1);
  const startDate = new Date(year, month, 1 - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index): CalendarDay => {
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

export default function AppointmentCalendarPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const hname = params?.Hname as string;
  const [today] = useState(() => new Date());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [appointmentDate, setAppointmentDate] = useState<Date | null>(null);

  const department = searchParams.get("department") ?? "";
  const doctor = searchParams.get("doctor") ?? "";
  const calendarDays = useMemo(
    () => buildCalendarDays(selectedYear, selectedMonth),
    [selectedMonth, selectedYear],
  );
  const yearOptions = useMemo(
    () =>
      Array.from(
        { length: 11 },
        (_, index) => today.getFullYear() - 2 + index,
      ),
    [today],
  );

  function moveMonth(direction: -1 | 1) {
    const nextDate = new Date(selectedYear, selectedMonth + direction, 1);
    setSelectedMonth(nextDate.getMonth());
    setSelectedYear(nextDate.getFullYear());
  }

  const selectedDateLabel = appointmentDate ? formatDate(appointmentDate) : "";

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
                : "Choose a date to fix an appointment."}
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
                  onClick={() => setAppointmentDate(calendarDay.date)}
                  className={`min-h-20 border-r border-b border-gray-200 p-2 text-left transition last:border-r-0 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 sm:min-h-24 ${
                    calendarDay.isCurrentMonth
                      ? "bg-white hover:bg-brand-50 dark:bg-transparent dark:hover:bg-brand-500/[0.12]"
                      : "bg-gray-50 text-gray-400 hover:bg-gray-100 dark:bg-gray-900/50 dark:text-gray-600 dark:hover:bg-gray-900"
                  }`}
                >
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                      calendarDay.isToday
                        ? "bg-brand-500 text-white"
                        : calendarDay.isCurrentMonth
                          ? "text-gray-800 dark:text-white/90"
                          : "text-gray-400 dark:text-gray-600"
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

      {appointmentDate ? (
        <div className="fixed inset-0 z-99999 flex items-center justify-center bg-gray-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-theme-xl dark:border-gray-800 dark:bg-gray-900">
            <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800">
              <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
                Fix Appointment?
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {selectedDateLabel}
              </p>
            </div>
            <div className="space-y-3 p-6 text-sm text-gray-600 dark:text-gray-300">
              <p>
                {doctor ? `Doctor: ${doctor}` : "Doctor was not selected."}
              </p>
              <p>
                {department
                  ? `Department: ${department}`
                  : "Department was not selected."}
              </p>
            </div>
            <div className="flex flex-col gap-3 border-t border-gray-100 px-6 py-4 dark:border-gray-800 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setAppointmentDate(null)}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setAppointmentDate(null)}
                className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 focus:outline-hidden focus:ring-3 focus:ring-brand-500/25"
              >
                Fix Appointment
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </BlankPage>
  );
}
