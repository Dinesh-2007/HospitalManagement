"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { BlankPage } from "../../../components/blank-page";
import { CalenderIcon } from "../../../components/icons";
import { tableNameFromCardTitle } from "../../../lib/master-form-table";

type MasterRow = Record<string, unknown>;
type PatientAuthState = {
  id?: number;
  name: string;
  phone: string;
};

type PatientSignupState = {
  patientId: string;
  patientName: string;
  address: string;
  country: string;
  state: string;
  city: string;
  zipCode: string;
  email: string;
  phoneOffice: string;
  phoneResi: string;
  mobile: string;
  hnNumber: string;
  numberOfVisits: string;
  lastVisitDateTime: string;
  lastVisitDoctorName: string;
  profession: string;
  patientType: string;
  preferredPaymentType: string;
  mediclaimPolicyAvailable: string;
  policyDetails: string;
  linkedPatientId: string;
  relationshipShipLinkedPatient: string;
  activeFrom: string;
  inactiveFrom: string;
  inactiveReason: string;
};

const DEPARTMENT_TABLE = tableNameFromCardTitle("Department Master");
const DOCTOR_TABLE = tableNameFromCardTitle("Consultant / Doctor Master");
const STORAGE_PREFIX = "book-appointment-patient";

function storageKey(hname: string) {
  return `${STORAGE_PREFIX}:${hname}`;
}

function emptySignupState(): PatientSignupState {
  return {
    patientId: "",
    patientName: "",
    address: "",
    country: "",
    state: "",
    city: "",
    zipCode: "",
    email: "",
    phoneOffice: "",
    phoneResi: "",
    mobile: "",
    hnNumber: "",
    numberOfVisits: "",
    lastVisitDateTime: "",
    lastVisitDoctorName: "",
    profession: "",
    patientType: "",
    preferredPaymentType: "",
    mediclaimPolicyAvailable: "",
    policyDetails: "",
    linkedPatientId: "",
    relationshipShipLinkedPatient: "",
    activeFrom: "",
    inactiveFrom: "",
    inactiveReason: "",
  };
}

function readText(row: MasterRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined) {
      const text = String(value).trim();
      if (text) return text;
    }
  }
  return "";
}

async function fetchMasterRows(hname: string, tableName: string) {
  const response = await fetch(`/api/${encodeURIComponent(hname)}/forms/${tableName}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Failed to load ${tableName}.`);
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
  };
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
  const [authenticatedPatient, setAuthenticatedPatient] = useState<PatientAuthState | null>(() => {
    if (typeof window === "undefined" || !hname) {
      return null;
    }

    const saved = window.localStorage.getItem(storageKey(hname));

    if (!saved) {
      return null;
    }

    try {
      return JSON.parse(saved) as PatientAuthState;
    } catch {
      window.localStorage.removeItem(storageKey(hname));
      return null;
    }
  });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [authForm, setAuthForm] = useState<PatientAuthState>({ name: "", phone: "" });
  const [signupForm, setSignupForm] = useState<PatientSignupState>(emptySignupState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadOptions() {
      if (!hname || !authenticatedPatient) return;
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const [departmentRows, doctorRows] = await Promise.all([
          fetchMasterRows(hname, DEPARTMENT_TABLE),
          fetchMasterRows(hname, DOCTOR_TABLE),
        ]);
        setDepartments(Array.from(new Set(departmentRows.map(normalizeDepartment).filter(Boolean))).sort((left, right) => left.localeCompare(right)));
        setDoctorRows(doctorRows);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to load appointment options.");
      } finally {
        setIsLoading(false);
      }
    }
    void loadOptions();
  }, [authenticatedPatient, hname]);

  const doctorOptions = useMemo(() => {
    return doctorRows
      .map(normalizeDoctor)
      .filter((doctor) => !selectedDepartment || !doctor.department || doctor.department === selectedDepartment)
      .filter((doctor) => doctor.name);
  }, [doctorRows, selectedDepartment]);

  async function handleSignin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/${encodeURIComponent(hname)}/patient-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "signin", phone: authForm.phone }),
      });
      const data = (await response.json()) as { exists?: boolean; row?: MasterRow; patientId?: number; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Signin failed.");
      if (data.exists) {
        const payload = { id: data.patientId ?? Number(data.row?.id ?? 0), name: authForm.name || String(data.row?.patient_name ?? data.row?.patientName ?? ""), phone: authForm.phone };
        window.localStorage.setItem(storageKey(hname), JSON.stringify(payload));
        setAuthenticatedPatient(payload);
        return;
      }
      setMode("signup");
      setSignupForm((current) => ({ ...current, patientName: authForm.name, mobile: authForm.phone }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Signin failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/${encodeURIComponent(hname)}/patient-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "signup",
          phone: signupForm.mobile,
          patient: signupForm,
        }),
      });
      const data = (await response.json()) as { row?: MasterRow; patientId?: number; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Signup failed.");
      const payload = { id: data.patientId ?? Number(data.row?.id ?? 0), name: signupForm.patientName, phone: signupForm.mobile };
      window.localStorage.setItem(storageKey(hname), JSON.stringify(payload));
      setAuthenticatedPatient(payload);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Signup failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleContinue() {
    if (!selectedDepartment || !selectedDoctor) return;
    const query = new URLSearchParams({
      department: selectedDepartment,
      doctor: selectedDoctor,
      patientId: String(authenticatedPatient?.id ?? ""),
      patientName: authenticatedPatient?.name ?? "",
      patientPhone: authenticatedPatient?.phone ?? "",
    });
    router.push(`/${encodeURIComponent(hname)}/book-appointment/calendar?${query.toString()}`);
  }

  if (!authenticatedPatient) {
    return (
      <BlankPage title="Book Appointment">
        <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">{hname}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Sign in to book an appointment.</p>
          </div>
          <div className="p-6">
            {errorMessage ? <div className="mb-4 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{errorMessage}</div> : null}
            {mode === "signin" ? (
              <form onSubmit={(event) => void handleSignin(event)} className="space-y-4 max-w-xl">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Name</label>
                  <input value={authForm.name} onChange={(event) => setAuthForm((current) => ({ ...current, name: event.target.value }))} className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Phone Number</label>
                  <input value={authForm.phone} onChange={(event) => setAuthForm((current) => ({ ...current, phone: event.target.value }))} className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm" required />
                </div>
                <div className="flex gap-3">
                  <button type="submit" disabled={isSubmitting} className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white">{isSubmitting ? "Checking..." : "Signin"}</button>
                  <button type="button" onClick={() => setMode("signup")} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700">Signup</button>
                </div>
              </form>
            ) : (
              <form onSubmit={(event) => void handleSignup(event)} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {[
                    ["patientId", "Patient ID"],
                    ["patientName", "Patient Name"],
                    ["address", "Address"],
                    ["country", "Country"],
                    ["state", "State"],
                    ["city", "City"],
                    ["zipCode", "ZIP Code"],
                    ["email", "eMail"],
                    ["phoneOffice", "Phone - Office"],
                    ["phoneResi", "Phone - Resi"],
                    ["mobile", "Mobile"],
                    ["hnNumber", "HN Number"],
                    ["numberOfVisits", "Number of Visits till now"],
                    ["lastVisitDateTime", "Last Visit Date & Time"],
                    ["lastVisitDoctorName", "Last visit doctor name"],
                    ["profession", "Profession"],
                    ["patientType", "Patient Type"],
                    ["preferredPaymentType", "Preferred Payment Type"],
                    ["mediclaimPolicyAvailable", "Mediclaim Policy Available"],
                    ["policyDetails", "Policy Details"],
                    ["linkedPatientId", "Linked Patient Id"],
                    ["relationshipShipLinkedPatient", "Relation Ship - Linked Patient"],
                    ["activeFrom", "Active From"],
                    ["inactiveFrom", "Inactive From"],
                    ["inactiveReason", "Inactive Reason"],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
                      <input value={(signupForm as Record<string, string>)[key] ?? ""} onChange={(event) => setSignupForm((current) => ({ ...current, [key]: event.target.value } as PatientSignupState))} className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm" />
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setMode("signin")} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700">Back</button>
                  <button type="submit" disabled={isSubmitting} className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white">{isSubmitting ? "Saving..." : "Submit"}</button>
                </div>
              </form>
            )}
          </div>
        </section>
      </BlankPage>
    );
  }

  return (
    <BlankPage title="Book Appointment">
      <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-800 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-medium text-gray-800 dark:text-white/90">Book Appointment</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Pick a department, then a doctor, then continue to the calendar.</p>
          </div>
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-500 dark:bg-brand-500/[0.12] dark:text-brand-400">
            <CalenderIcon className="h-5 w-5" />
          </span>
        </div>
        <div className="space-y-8 p-4 sm:p-6">
          {errorMessage ? <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{errorMessage}</div> : null}
          <div className="text-sm text-gray-500">Welcome, {authenticatedPatient.name || authenticatedPatient.phone}</div>
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Select Department</h4>
              <span className="text-xs text-gray-500">{isLoading ? "Loading..." : `${departments.length} departments`}</span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {departments.map((department) => {
                const isActive = department === selectedDepartment;
                return (
                  <button key={department} type="button" onClick={() => { setSelectedDepartment(department); setSelectedDoctor(""); }} className={`rounded-2xl border px-5 py-5 text-left transition ${isActive ? "border-brand-300 bg-brand-50" : "border-gray-200 bg-white"}`}>
                    <p className="text-base font-semibold text-gray-800">{department}</p>
                    <p className="mt-2 text-sm text-gray-500">Tap to view doctors in this department</p>
                  </button>
                );
              })}
            </div>
          </div>
          {selectedDepartment ? (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Select Doctor</h4>
                <span className="text-xs text-gray-500">{doctorOptions.length} doctors</span>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {doctorOptions.map((doctor) => {
                  const isActive = doctor.name === selectedDoctor;
                  return (
                    <button key={doctor.name} type="button" onClick={() => setSelectedDoctor(doctor.name)} className={`rounded-2xl border px-5 py-5 text-left transition ${isActive ? "border-brand-300 bg-brand-50" : "border-gray-200 bg-white"}`}>
                      <p className="text-base font-semibold text-gray-800">{doctor.name}</p>
                      <p className="mt-2 text-sm text-gray-500">{doctor.specialization || doctor.department || "Doctor"}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {selectedDoctor ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-lg font-semibold text-gray-800">{selectedDoctor}</h4>
                  <p className="mt-1 text-sm text-gray-500">{selectedDepartment}</p>
                </div>
                <button type="button" onClick={handleContinue} className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white">Choose Doctor</button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </BlankPage>
  );
}
