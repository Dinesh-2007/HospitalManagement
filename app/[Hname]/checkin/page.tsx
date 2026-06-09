"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { BlankPage } from "../../../components/blank-page";

type DepartmentRow = {
  id?: number;
  departmentType?: string;
  department_type?: string;
  departmentName?: string;
  department_name?: string;
  name?: string;
};

type DoctorRow = {
  id?: number;
  doctorConsultantName?: string;
  doctor_consultant_name?: string;
  clinic?: string;
};

export default function CheckInPage() {
  const params = useParams();
  const router = useRouter();
  const hname = params?.Hname as string;

  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");

  const [departments, setDepartments] = useState<string[]>([]);
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load Departments
  useEffect(() => {
    async function fetchDepartments() {
      if (!hname) return;
      try {
        const res = await fetch(`/api/${hname}/forms/department_master`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load departments.");
        const data = await res.json();
        const deptNames = (data.rows ?? [])
          .map((row: DepartmentRow) =>
            String(row.departmentType ?? row.department_type ?? row.departmentName ?? row.department_name ?? row.name ?? "").trim()
          )
          .filter(Boolean);
        // De-duplicate
        setDepartments(Array.from(new Set(deptNames)) as string[]);
      } catch (err) {
        console.error(err);
      }
    }
    void fetchDepartments();
  }, [hname]);

  // Load Doctors
  useEffect(() => {
    async function fetchDoctors() {
      if (!hname) return;
      try {
        const res = await fetch(`/api/${hname}/forms/consultant_doctor_master`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load doctors.");
        const data = await res.json();
        setDoctors(data.rows ?? []);
      } catch (err) {
        console.error(err);
      }
    }
    void fetchDoctors();
  }, [hname]);

  // Filter Doctors by selected department (clinic column in doctor master matches department)
  const filteredDoctors = useMemo(() => {
    if (!selectedDept) return [];
    return doctors.filter(
      (doc) =>
        String(doc.clinic ?? "").trim().toLowerCase() === selectedDept.trim().toLowerCase()
    );
  }, [selectedDept, doctors]);

  // Reset selected doctor when department changes
  useEffect(() => {
    setSelectedDoctor("");
  }, [selectedDept]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!patientName.trim()) {
      setError("Patient Name is required.");
      return;
    }
    if (!selectedDept) {
      setError("Please select a Department.");
      return;
    }
    if (!selectedDoctor) {
      setError("Please select a Doctor.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/${hname}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: patientName.trim(),
          patientPhone: patientPhone.trim(),
          department: selectedDept,
          doctor: selectedDoctor,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to perform check-in lookup.");
      }

      const data = await res.json();

      if (data.type === "scheduled") {
        setSuccess(`Check-in successful! Redirecting to Patient Vitals for Dr. ${selectedDoctor}...`);
        setTimeout(() => {
          router.push(`/${hname}/patient-vitals?doctor=${encodeURIComponent(selectedDoctor)}`);
        }, 1500);
      } else {
        // Walk-in flow - redirect to patient registration form
        setSuccess("No scheduled appointment found. Redirecting to Patient Registration form...");
        setTimeout(() => {
          router.push(
            `/${hname}/patient-registration?mode=form_only&patientName=${encodeURIComponent(
              patientName.trim()
            )}&mobile=${encodeURIComponent(patientPhone.trim())}&department=${encodeURIComponent(
              selectedDept
            )}&doctor=${encodeURIComponent(selectedDoctor)}`
          );
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  };

  return (
    <BlankPage title="Patient Registration / Check-In">
      <div className="mx-auto max-w-xl">
        <section className="rounded-2xl border border-gray-200 bg-white shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
              Check-in Portal
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Enter patient details to check in or register a new walk-in patient.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 p-6">
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-600 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-400">
                {success}
              </div>
            ) : null}

            <div className="space-y-4">
              {/* Patient Name */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Patient Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Enter full name"
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-500 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                  placeholder="Enter 10-digit number"
                  maxLength={10}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-500 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                />
              </div>

              {/* Department */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Department Name <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-500 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                >
                  <option value="" className="text-gray-400">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Doctor */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Doctor Name <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  disabled={!selectedDept}
                  value={selectedDoctor}
                  onChange={(e) => setSelectedDoctor(e.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-500 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 disabled:bg-gray-100 disabled:opacity-50 dark:disabled:bg-gray-800"
                >
                  <option value="">
                    {selectedDept ? "Select Doctor" : "Select a department first"}
                  </option>
                  {filteredDoctors.map((doc) => {
                    const name = doc.doctorConsultantName ?? doc.doctor_consultant_name ?? "";
                    return (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-100 pt-5 dark:border-gray-800">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-500 px-6 text-sm font-medium text-white transition hover:bg-brand-600 focus:outline-hidden focus:ring-3 focus:ring-brand-500/25 disabled:bg-gray-400"
              >
                {submitting ? "Checking..." : "Proceed Check-in"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </BlankPage>
  );
}
