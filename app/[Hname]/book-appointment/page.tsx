"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BlankPage } from "../../../components/blank-page";
import { CalenderIcon } from "../../../components/icons";
import { tableNameFromCardTitle } from "../../../lib/master-form-table";

type MasterRow = Record<string, unknown>;

type ScheduleRow = {
  scheduleNo: string;
  consultantDoctorName: string;
  appointmentFromDate: string;
  appointmentToDate: string;
  availableTimeFrom: string;
  availableTimeTo: string;
  daysAvailable: string[];
  timeSlotMinutes: string;
};

const DEPARTMENT_TABLE = tableNameFromCardTitle("Department Master");
const DOCTOR_TABLE = tableNameFromCardTitle("Consultant / Doctor Master");
const SCHEDULE_TABLE = tableNameFromCardTitle("Consultant / Doctor Schedule");

function readText(row: MasterRow, keys: string[]) {
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

function readDaysAvailable(row: MasterRow) {
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

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

async function fetchMasterRows(hname: string, tableName: string) {
  const response = await fetch(`/api/${encodeURIComponent(hname)}/forms/${tableName}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${tableName.replace(/_/g, " ")}.`);
  }

  const data = (await response.json()) as { rows?: MasterRow[] };
  return data.rows ?? [];
}

function normalizeDepartment(row: MasterRow) {
  return readText(row, ["department_type", "departmentType", "department_name", "name", "code"]);
}

function normalizeDoctor(row: MasterRow) {
  const name = readText(row, ["doctor_consultant_name", "doctorConsultantName", "consultant_doctor_name", "name"]);

  return {
    name,
    department: readText(row, ["clinic", "department", "department_type", "departmentType"]),
    specialization: readText(row, ["specialization"]),
    clinic: readText(row, ["clinic"]),
    phone: readText(row, ["mobile", "phoneOffice", "phoneResi"]),
    email: readText(row, ["email"]),
    roomNo: readText(row, ["roomNo"]),
    registrationNumber: readText(row, ["registrationNumber"]),
    appointmentScheduleLimit: readText(row, ["appointmentScheduleLimit"]),
  };
}

function toScheduleRow(row: MasterRow): ScheduleRow {
  return {
    scheduleNo: readText(row, ["schedule_no", "scheduleNo"]),
    consultantDoctorName: readText(row, ["consultant_doctor_name", "consultantDoctorName"]),
    appointmentFromDate: readText(row, ["appointment_from_date", "appointmentFromDate"]),
    appointmentToDate: readText(row, ["appointment_to_date", "appointmentToDate"]),
    availableTimeFrom: readText(row, ["available_time_from", "availableTimeFrom"]),
    availableTimeTo: readText(row, ["available_time_to", "availableTimeTo"]),
    daysAvailable: readDaysAvailable(row),
    timeSlotMinutes: readText(row, ["time_slot_minutes", "timeSlotMinutes"]),
  };
}

export default function BookAppointmentPage() {
  const params = useParams();
  const router = useRouter();
  const hname = params?.Hname as string;

  const [departments, setDepartments] = useState<string[]>([]);
  const [doctorRows, setDoctorRows] = useState<MasterRow[]>([]);
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadOptions() {
      if (!hname) {
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [departmentRows, doctorRows] = await Promise.all([
          fetchMasterRows(hname, DEPARTMENT_TABLE),
          fetchMasterRows(hname, DOCTOR_TABLE),
        ]);

        setDepartments(uniqueValues(departmentRows.map(normalizeDepartment)).sort((left, right) => left.localeCompare(right)));
        setDoctorRows(doctorRows);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load appointment options.";
        setErrorMessage(message);
      } finally {
        setIsLoading(false);
      }
    }

    void loadOptions();
  }, [hname]);

  const doctorOptions = useMemo(() => {
    return doctorRows
      .map(normalizeDoctor)
      .filter((doctor) => {
        if (!selectedDepartment) {
          return true;
        }

        return !doctor.department || doctor.department === selectedDepartment;
      })
      .filter((doctor) => doctor.name);
  }, [doctorRows, selectedDepartment]);

  const selectedDoctorDetails = useMemo(() => {
    return doctorOptions.find((doctor) => doctor.name === selectedDoctor) ?? null;
  }, [doctorOptions, selectedDoctor]);

  useEffect(() => {
    async function loadSchedule() {
      if (!selectedDoctor) {
        setScheduleRows([]);
        return;
      }

      try {
        const rows = await fetchMasterRows(hname, SCHEDULE_TABLE);
        setScheduleRows(
          rows
            .map(toScheduleRow)
            .filter((row) => row.consultantDoctorName === selectedDoctor),
        );
      } catch (error) {
        console.error("Failed to load doctor schedule", error);
        setScheduleRows([]);
      }
    }

    void loadSchedule();
  }, [hname, selectedDoctor]);

  function handleContinue() {
    if (!selectedDepartment || !selectedDoctor) {
      return;
    }

    const query = new URLSearchParams({
      department: selectedDepartment,
      doctor: selectedDoctor,
    });

    router.push(`/${encodeURIComponent(hname)}/book-appointment/calendar?${query.toString()}`);
  }

  const scheduleSummary = scheduleRows[0];

  return (
    <BlankPage title="Book Appointment">
      <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-800 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-medium text-gray-800 dark:text-white/90">Book Appointment</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Pick a department, then a doctor, then continue to the calendar.
            </p>
          </div>
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-500 dark:bg-brand-500/[0.12] dark:text-brand-400">
            <CalenderIcon className="h-5 w-5" />
          </span>
        </div>

        <div className="space-y-8 p-4 sm:p-6">
          {errorMessage ? (
            <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
              {errorMessage}
            </div>
          ) : null}

          <div>
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Select Department
              </h4>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {isLoading ? "Loading..." : `${departments.length} departments`}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {departments.map((department) => {
                const isActive = department === selectedDepartment;

                return (
                  <button
                    key={department}
                    type="button"
                    onClick={() => {
                      setSelectedDepartment(department);
                      setSelectedDoctor("");
                      setScheduleRows([]);
                    }}
                    className={`rounded-2xl border px-5 py-5 text-left transition ${
                      isActive
                        ? "border-brand-300 bg-brand-50 shadow-theme-xs dark:border-brand-500/40 dark:bg-brand-500/[0.12]"
                        : "border-gray-200 bg-white hover:border-brand-200 hover:bg-brand-50/40 dark:border-gray-800 dark:bg-gray-900/40 dark:hover:border-brand-700 dark:hover:bg-brand-500/[0.08]"
                    }`}
                  >
                    <p className="text-base font-semibold text-gray-800 dark:text-white/90">
                      {department}
                    </p>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      Tap to view doctors in this department
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedDepartment ? (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Select Doctor
                </h4>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {doctorOptions.length} doctors
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {doctorOptions.map((doctor) => {
                  const isActive = doctor.name === selectedDoctor;

                  return (
                    <button
                      key={doctor.name}
                      type="button"
                      onClick={() => setSelectedDoctor(doctor.name)}
                      className={`rounded-2xl border px-5 py-5 text-left transition ${
                        isActive
                          ? "border-brand-300 bg-brand-50 shadow-theme-xs dark:border-brand-500/40 dark:bg-brand-500/[0.12]"
                          : "border-gray-200 bg-white hover:border-brand-200 hover:bg-brand-50/40 dark:border-gray-800 dark:bg-gray-900/40 dark:hover:border-brand-700 dark:hover:bg-brand-500/[0.08]"
                      }`}
                    >
                      <p className="text-base font-semibold text-gray-800 dark:text-white/90">
                        {doctor.name}
                      </p>
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        {doctor.specialization || doctor.department || "Doctor"}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {selectedDoctorDetails ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-900/40">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                    {selectedDoctorDetails.name}
                  </h4>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {selectedDoctorDetails.department || selectedDepartment}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleContinue}
                  className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 focus:outline-hidden focus:ring-3 focus:ring-brand-500/25"
                >
                  Choose Doctor
                </button>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950/30">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Specialization
                  </p>
                  <p className="mt-2 text-sm text-gray-800 dark:text-white/90">
                    {selectedDoctorDetails.specialization || "-"}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950/30">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Contact
                  </p>
                  <p className="mt-2 text-sm text-gray-800 dark:text-white/90">
                    {selectedDoctorDetails.phone || selectedDoctorDetails.email || "-"}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950/30">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Room / Registration
                  </p>
                  <p className="mt-2 text-sm text-gray-800 dark:text-white/90">
                    {selectedDoctorDetails.roomNo || "-"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {selectedDoctorDetails.registrationNumber || "-"}
                  </p>
                </div>
              </div>

              {scheduleSummary ? (
                <div className="mt-5 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950/30">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Schedule
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">From</p>
                      <p className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">
                        {scheduleSummary.appointmentFromDate || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">To</p>
                      <p className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">
                        {scheduleSummary.appointmentToDate || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Time</p>
                      <p className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">
                        {scheduleSummary.availableTimeFrom || "-"} - {scheduleSummary.availableTimeTo || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Days</p>
                      <p className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">
                        {scheduleSummary.daysAvailable.length > 0
                          ? scheduleSummary.daysAvailable.join(", ")
                          : "-"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </BlankPage>
  );
}
