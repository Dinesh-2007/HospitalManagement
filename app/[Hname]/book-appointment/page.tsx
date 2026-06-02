"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { BlankPage } from "../../../components/blank-page";
import { CalenderIcon, UserCircleIcon } from "../../../components/icons";
import { tableNameFromCardTitle } from "../../../lib/master-form-table";

type MasterRow = Record<string, unknown>;

const DEPARTMENT_TABLE = tableNameFromCardTitle("Department Master");
const DOCTOR_TABLE = tableNameFromCardTitle("Consultant / Doctor Master");

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

export default function BookAppointmentPage() {
  const params = useParams();
  const router = useRouter();
  const hname = params?.Hname as string;
  const [departments, setDepartments] = useState<string[]>([]);
  const [doctorRows, setDoctorRows] = useState<MasterRow[]>([]);
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

        setDepartments(
          uniqueValues(
            departmentRows.map((row) =>
              readText(row, [
                "department_type",
                "departmentType",
                "department_name",
                "name",
                "code",
              ]),
            ),
          ).sort((left, right) => left.localeCompare(right)),
        );
        setDoctorRows(doctorRows);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load appointment options.";
        setErrorMessage(message);
      } finally {
        setIsLoading(false);
      }
    }

    void loadOptions();
  }, [hname]);

  const doctorOptions = useMemo(() => {
    const matchingRows = selectedDepartment
      ? doctorRows.filter((row) => {
          const doctorDepartment = readText(row, [
            "clinic",
            "department",
            "department_type",
            "departmentType",
          ]);

          return !doctorDepartment || doctorDepartment === selectedDepartment;
        })
      : doctorRows;

    return uniqueValues(
      matchingRows.map((row) =>
        readText(row, [
          "doctor_consultant_name",
          "doctorConsultantName",
          "consultant_doctor_name",
          "name",
          "code",
        ]),
      ),
    );
  }, [doctorRows, selectedDepartment]);

  const selectedDoctorValue = doctorOptions.includes(selectedDoctor)
    ? selectedDoctor
    : "";

  function handleViewSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const query = new URLSearchParams({
      department: selectedDepartment,
      doctor: selectedDoctorValue,
    });

    router.push(
      `/${encodeURIComponent(hname)}/book-appointment/calendar?${query.toString()}`,
    );
  }

  return (
    <BlankPage title="Book Appointment">
      <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-800 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
              Book Appointment
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Select a department and doctor to view available schedule dates.
            </p>
          </div>
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-500 dark:bg-brand-500/[0.12] dark:text-brand-400">
            <CalenderIcon className="h-5 w-5" />
          </span>
        </div>

        <form className="space-y-6 p-4 sm:p-6" onSubmit={handleViewSchedule}>
          {errorMessage ? (
            <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
              {errorMessage}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <label
                htmlFor="department"
                className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400"
              >
                Choose Department
              </label>
              <select
                id="department"
                name="department"
                value={selectedDepartment}
                onChange={(event) => {
                  setSelectedDepartment(event.target.value);
                  setSelectedDoctor("");
                }}
                required
                disabled={isLoading}
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pr-10 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:disabled:bg-gray-800 dark:focus:border-brand-800"
              >
                <option value="" disabled>
                  {isLoading ? "Loading departments..." : "Choose Department"}
                </option>
                {departments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="doctor"
                className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400"
              >
                Choose Doctor
              </label>
              <select
                id="doctor"
                name="doctor"
                value={selectedDoctorValue}
                onChange={(event) => setSelectedDoctor(event.target.value)}
                required
                disabled={isLoading || !selectedDepartment}
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pr-10 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:disabled:bg-gray-800 dark:focus:border-brand-800"
              >
                <option value="" disabled>
                  {isLoading
                    ? "Loading doctors..."
                    : selectedDepartment
                      ? "Choose Doctor"
                      : "Choose department first"}
                </option>
                {doctorOptions.map((doctor) => (
                  <option key={doctor} value={doctor}>
                    {doctor}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-100 pt-5 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <UserCircleIcon className="h-5 w-5 text-gray-400" />
              <span>{doctorOptions.length} doctor option(s) available</span>
            </div>
            <button
              type="submit"
              disabled={!selectedDepartment || !selectedDoctorValue}
              className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 focus:outline-hidden focus:ring-3 focus:ring-brand-500/25 disabled:cursor-not-allowed disabled:bg-brand-300 disabled:opacity-70"
            >
              View Schedule
            </button>
          </div>
        </form>
      </section>
    </BlankPage>
  );
}
