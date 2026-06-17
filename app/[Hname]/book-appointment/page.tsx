"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { tableNameFromCardTitle } from "../../../lib/master-form-table";

type MasterRow = Record<string, unknown>;
type FamilyMember = { id: number; name: string; phone: string; relationship: string };
type PatientAuthState = {
  id?: number;
  name: string;
  phone: string;
};
type ScheduleSummary = {
  doctorName: string;
  daysAvailable: string[];
  availableTimeFrom: string;
  availableTimeTo: string;
  timeSlotMinutes: string;
};
type DoctorOption = {
  doctorId: string;
  doctorCode: string;
  name: string;
  department: string;
  specialization: string;
  qualification: string;
  experienceYears: string;
  profilePhoto: string;
  clinic: string;
  phone: string;
  email: string;
  roomNo: string;
  registrationNumber: string;
};
type WorkExperience = {
  hospitalName: string;
  designation: string;
  department: string;
  fromDate: string;
  toDate: string;
  location: string;
};

type Certification = {
  name: string;
  issuingOrganization: string;
  issueDate: string;
  expiryDate: string;
};

type EducationInfo = {
  mbbsCollegeName: string;
  mbbsUniversity: string;
  mbbsGraduationYear: string;
  higherQualification: string;
  higherQualificationInstitution: string;
  higherQualificationCompletionYear: string;
};

type DoctorProfile = {
  doctorId: string;
  doctorCode: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  bloodGroup: string;
  maritalStatus: string;
  profilePhoto: string;
  mobileNumber: string;
  alternateMobileNumber: string;
  emailId: string;
  emergencyContactNumber: string;
  address: string;
  country: string;
  state: string;
  city: string;
  pincode: string;
  registrationNumber: string;
  specialization: string;
  department: string;
  qualification: string;
  experienceYears: string;
  designation: string;
  licenseNumber: string;
  employeeType: string;
  shift: string;
  education: EducationInfo;
  workExperiences: WorkExperience[];
  certifications: Certification[];
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
const SCHEDULE_TABLE = tableNameFromCardTitle("Consultant / Doctor Schedule");
const PATIENT_TABLE = tableNameFromCardTitle("Patient Registration");
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

function normalizeTextValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        return normalizeTextValue(JSON.parse(trimmed));
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeTextValue(item);
      if (normalized) return normalized;
    }
    return "";
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const priorityKeys = ["url", "src", "photo", "image", "profilePhoto", "path", "publicUrl", "secure_url", "data"];
    for (const key of priorityKeys) {
      if (key in record) {
        const normalized = normalizeTextValue(record[key]);
        if (normalized) return normalized;
      }
    }
    return "";
  }
  return "";
}

function readText(row: MasterRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    const text = normalizeTextValue(value);
    if (text) return text;
  }
  return "";
}

function normalizePhone(value: unknown) {
  return normalizeTextValue(value).replace(/\D/g, "").trim();
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

function normalizeDoctor(row: MasterRow): DoctorOption {
  const name = readText(row, ["doctor_consultant_name", "doctorConsultantName", "consultant_doctor_name", "name"]);
  return {
    doctorId: readText(row, ["doctor_id", "doctorId"]),
    doctorCode: readText(row, ["doctor_code", "doctorCode", "code"]),
    name,
    department: readText(row, ["clinic", "department", "department_type", "departmentType"]),
    specialization: readText(row, ["specialization"]),
    qualification: readText(row, ["qualification"]),
    experienceYears: readText(row, ["experience_years", "experienceYears"]),
    profilePhoto: readText(row, ["profile_photo", "profilePhoto", "doctor_image", "photo"]),
    clinic: readText(row, ["clinic"]),
    phone: readText(row, ["mobile", "phoneOffice", "phoneResi"]),
    email: readText(row, ["email"]),
    roomNo: readText(row, ["roomNo"]),
    registrationNumber: readText(row, ["registrationNumber"]),
  };
}

function readDays(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return value.replace(/[\[\]\"]/g, "").split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function normalizeSchedule(row: MasterRow): ScheduleSummary {
  return {
    doctorName: readText(row, ["consultant_doctor_name", "consultantDoctorName"]),
    daysAvailable: readDays(row.days_available ?? row.daysAvailable),
    availableTimeFrom: readText(row, ["available_time_from", "availableTimeFrom"]),
    availableTimeTo: readText(row, ["available_time_to", "availableTimeTo"]),
    timeSlotMinutes: readText(row, ["time_slot_minutes", "timeSlotMinutes"]),
  };
}

function normalizeDoctorProfile(row: MasterRow | null): DoctorProfile | null {
  if (!row) return null;

  const education: EducationInfo = {
    mbbsCollegeName: readText(row, ["mbbs_college_name", "mbbsCollegeName", "education.mbbsCollegeName"]),
    mbbsUniversity: readText(row, ["mbbs_university", "mbbsUniversity", "education.mbbsUniversity"]),
    mbbsGraduationYear: readText(row, ["mbbs_graduation_year", "mbbsGraduationYear", "education.mbbsGraduationYear"]),
    higherQualification: readText(row, ["higher_qualification", "higherQualification", "education.higherQualification"]),
    higherQualificationInstitution: readText(row, ["higher_qualification_institution", "higherQualificationInstitution", "education.higherQualificationInstitution"]),
    higherQualificationCompletionYear: readText(row, ["higher_qualification_completion_year", "higherQualificationCompletionYear", "education.higherQualificationCompletionYear"]),
  };

  const workExperiences: WorkExperience[] = [];
  const certifications: Certification[] = [];

  if (Array.isArray(row.workExperiences)) {
    for (const item of row.workExperiences) {
      if (item && typeof item === "object") {
        workExperiences.push({
          hospitalName: readText(item as MasterRow, ["hospitalName", "hospital_name", "institution"]),
          designation: readText(item as MasterRow, ["designation", "role"]),
          department: readText(item as MasterRow, ["department", "unit"]),
          fromDate: readText(item as MasterRow, ["fromDate", "from_date", "startDate"]),
          toDate: readText(item as MasterRow, ["toDate", "to_date", "endDate"]),
          location: readText(item as MasterRow, ["location", "city"]),
        });
      }
    }
  }

  if (Array.isArray(row.certifications)) {
    for (const item of row.certifications) {
      if (item && typeof item === "object") {
        certifications.push({
          name: readText(item as MasterRow, ["name", "title"]),
          issuingOrganization: readText(item as MasterRow, ["issuingOrganization", "issuing_organization", "issuer"]),
          issueDate: readText(item as MasterRow, ["issueDate", "issue_date", "issuedOn"]),
          expiryDate: readText(item as MasterRow, ["expiryDate", "expiry_date", "expiresOn"]),
        });
      }
    }
  }

  return {
    doctorId: readText(row, ["doctor_id", "doctorId"]),
    doctorCode: readText(row, ["doctor_code", "doctorCode"]),
    firstName: readText(row, ["first_name", "firstName"]),
    lastName: readText(row, ["last_name", "lastName"]),
    gender: readText(row, ["gender"]),
    dateOfBirth: readText(row, ["date_of_birth", "dateOfBirth", "dob"]),
    bloodGroup: readText(row, ["blood_group", "bloodGroup"]),
    maritalStatus: readText(row, ["marital_status", "maritalStatus"]),
    profilePhoto: readText(row, ["profile_photo", "profilePhoto"]),
    mobileNumber: readText(row, ["mobile_number", "mobileNumber"]),
    alternateMobileNumber: readText(row, ["alternate_mobile_number", "alternateMobileNumber"]),
    emailId: readText(row, ["email_id", "emailId"]),
    emergencyContactNumber: readText(row, ["emergency_contact_number", "emergencyContactNumber"]),
    address: readText(row, ["address"]),
    country: readText(row, ["country"]),
    state: readText(row, ["state"]),
    city: readText(row, ["city"]),
    pincode: readText(row, ["pincode"]),
    registrationNumber: readText(row, ["registration_number", "registrationNumber"]),
    specialization: readText(row, ["specialization"]),
    department: readText(row, ["department"]),
    qualification: readText(row, ["qualification"]),
    experienceYears: readText(row, ["experience_years", "experienceYears"]),
    designation: readText(row, ["designation"]),
    licenseNumber: readText(row, ["license_number", "licenseNumber"]),
    employeeType: readText(row, ["employee_type", "employeeType"]),
    shift: readText(row, ["shift"]),
    education,
    workExperiences,
    certifications,
  };
}

function calculateAge(dateOfBirth: string) {
  if (!dateOfBirth) return "-";
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return "-";
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return `${age} yrs`;
}

export default function BookAppointmentPage() {
  const params = useParams();
  const router = useRouter();
  const hname = params?.Hname as string;
  const [departments, setDepartments] = useState<string[]>([]);
  const [doctorRows, setDoctorRows] = useState<MasterRow[]>([]);
  const [doctorPhotos, setDoctorPhotos] = useState<Record<string, string>>({});
  const [patientRows, setPatientRows] = useState<MasterRow[]>([]);
  const [scheduleRows, setScheduleRows] = useState<ScheduleSummary[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedDoctorOption, setSelectedDoctorOption] = useState<DoctorOption | null>(null);
  const [doctorDetails, setDoctorDetails] = useState<DoctorProfile | null>(null);
  const [isDoctorPopupOpen, setIsDoctorPopupOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [authenticatedPatient, setAuthenticatedPatient] = useState<PatientAuthState | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (!hname) return;
    const saved = window.localStorage.getItem(storageKey(hname));
    if (saved) {
      try {
        setAuthenticatedPatient(JSON.parse(saved) as PatientAuthState);
      } catch {
        window.localStorage.removeItem(storageKey(hname));
      }
    }
    setIsHydrated(true);
  }, [hname]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBookConfirmation, setShowBookConfirmation] = useState(false);
  const [showFamilyDropdown, setShowFamilyDropdown] = useState(false);
  const [bookingFor, setBookingFor] = useState<FamilyMember | null>(null);

  useEffect(() => {
    async function loadPatients() {
      if (!hname) return;
      try {
        const rows = await fetchMasterRows(hname, PATIENT_TABLE);
        setPatientRows(rows);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to load patient records.");
      }
    }
    void loadPatients();
  }, [hname]);

  useEffect(() => {
    async function loadOptions() {
      if (!hname || !authenticatedPatient) return;
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const [departmentRows, doctorRows, scheduleRows] = await Promise.all([
          fetchMasterRows(hname, DEPARTMENT_TABLE),
          fetchMasterRows(hname, DOCTOR_TABLE),
          fetchMasterRows(hname, SCHEDULE_TABLE),
        ]);
        setDepartments(Array.from(new Set(departmentRows.map(normalizeDepartment).filter(Boolean))).sort((left, right) => left.localeCompare(right)));
        setDoctorRows(doctorRows);
        setScheduleRows(scheduleRows.map(normalizeSchedule).filter((row) => row.doctorName));
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to load appointment options.");
      } finally {
        setIsLoading(false);
      }
    }
    void loadOptions();
  }, [authenticatedPatient, hname]);

  const doctorOptions = useMemo(() => {
    const scheduledDoctors = new Set(
      scheduleRows.map((row) => row.doctorName.trim().toLowerCase()),
    );

    return doctorRows
      .map(normalizeDoctor)
      .filter((doctor) => !selectedDepartment || !doctor.department || doctor.department === selectedDepartment)
      .filter((doctor) => scheduledDoctors.has(doctor.name.trim().toLowerCase()))
      .filter((doctor) => doctor.name)
      .map((doctor) => ({
        ...doctor,
        profilePhoto: doctor.profilePhoto || doctorPhotos[doctor.name.toLowerCase()] || "",
      }));
  }, [doctorRows, doctorPhotos, scheduleRows, selectedDepartment]);

  useEffect(() => {
    let active = true;

    async function loadDoctorPhotos() {
      const names = Array.from(
        new Set(
          doctorRows
            .map(normalizeDoctor)
            .map((doctor) => doctor.name)
            .filter(Boolean),
        ),
      );

      const entries = await Promise.all(
        names.map(async (name) => {
          try {
            const params = new URLSearchParams();
            params.set("doctorName", name);
            const response = await fetch(
              `/api/${encodeURIComponent(hname)}/doctor-profile?${params.toString()}`,
              { cache: "no-store" },
            );
            const data = (await response.json().catch(() => ({}))) as { row?: Record<string, unknown> | null };
            return [name.toLowerCase(), String(data.row?.profile_photo ?? data.row?.profilePhoto ?? "")] as const;
          } catch {
            return [name.toLowerCase(), ""] as const;
          }
        }),
      );

      if (active) {
        setDoctorPhotos(Object.fromEntries(entries));
      }
    }

    if (doctorRows.length > 0) {
      void loadDoctorPhotos();
    }

    return () => {
      active = false;
    };
  }, [doctorRows, hname]);

  const patientOptions = useMemo(() => {
    return patientRows
      .map((row) => ({
        id: Number(row.id ?? 0),
        name: readText(row, ["patient_name", "patientName"]),
        phone: readText(row, ["mobile"]),
      }))
      .filter((row) => row.id && row.name)
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [patientRows]);

  const familyMembers = useMemo<FamilyMember[]>(() => {
    if (!authenticatedPatient) return [];

    // Get all possible identifiers for the authenticated user
    const myId = String(authenticatedPatient.id);
    const myPhone = authenticatedPatient.phone ? authenticatedPatient.phone.replace(/\D/g, "") : "";
    const myName = authenticatedPatient.name.trim().toLowerCase();

    // Also include global patientPhone / patientName from localStorage (used by manage-family page)
    const globalPhone = typeof window !== "undefined" ? (window.localStorage.getItem("patientPhone") || "").replace(/\D/g, "") : "";
    const globalName = typeof window !== "undefined" ? (window.localStorage.getItem("patientName") || "").trim().toLowerCase() : "";

    return patientRows
      .filter(row => {
        const linked = readText(row, ["linked_patient_id", "linkedPatientId"]);
        if (!linked) return false;

        const linkedLower = linked.toLowerCase();

        if (myPhone && linked === myPhone) return true;
        if (myName && linkedLower === myName) return true;
        if (myId && linked === myId) return true;

        if (globalPhone && linked === globalPhone) return true;
        if (globalName && linkedLower === globalName) return true;

        return false;
      })
      .map(row => ({
        id: Number(row.id ?? 0),
        name: readText(row, ["patient_name", "patientName"]),
        phone: readText(row, ["mobile"]),
        relationship: readText(row, ["relationship_ship_linked_patient", "relationshipShipLinkedPatient", "relationship"]),
      }))
      .filter(m => m.name);
  }, [patientRows, authenticatedPatient]);

  const selectedDoctorSchedule = useMemo(() => {
    return scheduleRows.filter(
      (row) => row.doctorName.trim().toLowerCase() === selectedDoctor.trim().toLowerCase(),
    );
  }, [scheduleRows, selectedDoctor]);

  async function openDoctorPopup(doctor: DoctorOption) {
    setSelectedDoctor(doctor.name);
    setSelectedDoctorOption(doctor);
    setIsDoctorPopupOpen(true);
    setErrorMessage(null);
    try {
      const query = new URLSearchParams();
      if (doctor.doctorId) query.set("doctorId", doctor.doctorId);
      if (doctor.doctorCode) query.set("doctorCode", doctor.doctorCode);
      if (doctor.name) query.set("doctorName", doctor.name);
      const response = await fetch(
        `/api/${encodeURIComponent(hname)}/doctor-profile?${query.toString()}`,
        { cache: "no-store" },
      );
      const data = (await response.json().catch(() => ({}))) as { row?: MasterRow | null; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to load doctor profile.");
      const normalizedDetails = normalizeDoctorProfile(data.row ?? null);
      setDoctorDetails(
        normalizedDetails
          ? {
            ...normalizedDetails,
            profilePhoto: normalizedDetails.profilePhoto || doctor.profilePhoto,
          }
          : null,
      );
    } catch (error) {
      setDoctorDetails(null);
      setErrorMessage(error instanceof Error ? error.message : "Failed to load doctor profile.");
    }
  }

  function directBookDoctor(doctor: DoctorOption) {
    const department = selectedDepartment || doctor.department || "";
    const doctorName = doctor.name;
    const forPatient = bookingFor ?? authenticatedPatient;
    const query = new URLSearchParams({
      department,
      doctor: doctorName,
      patientId: String(forPatient?.id ?? ""),
      patientName: forPatient?.name ?? "",
      patientPhone: forPatient?.phone ?? "",
    });
    router.push(`/${encodeURIComponent(hname)}/book-appointment/calendar?${query.toString()}`);
  }

  function handleContinue() {
    setShowBookConfirmation(true);
  }

  function executeBooking() {
    setShowBookConfirmation(false);
    if (!selectedDepartment || !selectedDoctor) return;
    const forPatient = bookingFor ?? authenticatedPatient;
    const query = new URLSearchParams({
      department: selectedDepartment,
      doctor: selectedDoctor,
      patientId: String(forPatient?.id ?? ""),
      patientName: forPatient?.name ?? "",
      patientPhone: forPatient?.phone ?? "",
    });
    router.push(`/${encodeURIComponent(hname)}/book-appointment/calendar?${query.toString()}`);
  }

  if (!isHydrated) return null;

  if (!authenticatedPatient) {
    return (
      <div>
        <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">{hname}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Please log in to book an appointment.</p>
          </div>
          <div className="p-6">
            <a
              href={`/${encodeURIComponent(hname)}/patient-login`}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition"
            >
              Go to Patient Login
            </a>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div>
      <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">

        <div className="space-y-8 p-4 sm:p-6">
          {errorMessage ? <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{errorMessage}</div> : null}

          {/* Book Appointment For */}
          <div className="relative inline-block">
            <button
              id="book-for-btn"
              type="button"
              onClick={() => setShowFamilyDropdown(v => !v)}
              className="inline-flex items-center gap-2 rounded-lg border border-brand-500 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-100 transition dark:border-brand-400 dark:bg-brand-500/10 dark:text-brand-400"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m4-4a4 4 0 100-8 4 4 0 000 8zm6 0a3 3 0 100-6 3 3 0 000 6z" />
              </svg>
              Book Appointment For
              {bookingFor ? <span className="ml-1 font-semibold text-brand-700 dark:text-brand-300">{bookingFor.name}</span> : <span className="ml-1 text-gray-500">Myself</span>}
              <svg className={`h-3.5 w-3.5 transition-transform ${showFamilyDropdown ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showFamilyDropdown && (
              <div className="absolute left-0 z-50 mt-2 w-72 rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
                {/* Myself option */}
                <button
                  type="button"
                  onClick={() => { setBookingFor(null); setShowFamilyDropdown(false); }}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-gray-50 dark:hover:bg-gray-800 ${bookingFor === null ? "bg-brand-50 text-brand-600 font-semibold dark:bg-brand-500/10 dark:text-brand-400" : "text-gray-700 dark:text-gray-200"
                    }`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-500/20">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </span>
                  <div>
                    <div className="font-medium">{authenticatedPatient.name || authenticatedPatient.phone}</div>
                    <div className="text-xs text-gray-400">Myself</div>
                  </div>
                </button>

                {familyMembers.length > 0 && (
                  <div className="border-t border-gray-100 dark:border-gray-800">
                    {familyMembers.map(member => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => { setBookingFor(member); setShowFamilyDropdown(false); }}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-gray-50 dark:hover:bg-gray-800 ${bookingFor?.id === member.id ? "bg-brand-50 text-brand-600 font-semibold dark:bg-brand-500/10 dark:text-brand-400" : "text-gray-700 dark:text-gray-200"
                          }`}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </span>
                        <div>
                          <div className="font-medium">{member.name}</div>
                          {member.relationship && <div className="text-xs text-gray-400">{member.relationship}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {familyMembers.length === 0 && (
                  <div className="px-4 py-3 text-xs text-gray-400">No linked family members found.</div>
                )}
              </div>
            )}
          </div>

          <div className="text-sm text-gray-500">Welcome, {authenticatedPatient.name || authenticatedPatient.phone}</div>
          {!selectedDepartment ? (
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
          ) : (
            <div className="mb-6 flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-500/20 dark:bg-brand-500/10">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Department</span>
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                <span className="text-base font-bold text-brand-700 dark:text-brand-300">{selectedDepartment}</span>
              </div>
              <button type="button" onClick={() => { setSelectedDepartment(""); setSelectedDoctor(""); }} className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm border border-gray-200 hover:bg-gray-50 transition dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back
              </button>
            </div>
          )}
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
                    <div key={doctor.name} className={`rounded-2xl border p-5 transition ${isActive ? "border-brand-300 bg-brand-50" : "border-gray-200 bg-white"}`}>
                      <div className="flex items-start gap-4">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-gray-50">
                          {doctor.profilePhoto ? (
                            <img src={doctor.profilePhoto} alt={doctor.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">No photo</div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-gray-800 truncate">{doctor.name}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            {doctor.specialization ? (
                              <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-600">{doctor.specialization}</span>
                            ) : null}
                            {doctor.experienceYears ? (
                              <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">{doctor.experienceYears} yrs</span>
                            ) : null}
                          </div>
                          {doctor.qualification ? (
                            <p className="mt-2 text-sm text-gray-500 truncate">{doctor.qualification}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => directBookDoctor(doctor)}
                          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white"
                        >
                          Book Appointment
                        </button>
                        <button
                          type="button"
                          onClick={() => void openDoctorPopup(doctor)}
                          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
                        >
                          More Details
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </section>
      {isDoctorPopupOpen ? (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-4 shadow-xl dark:bg-gray-900 max-h-[80vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setIsDoctorPopupOpen(false)}
              className="absolute right-4 top-4 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
            >
              Close
            </button>
            <div className="grid gap-6 md:grid-cols-[140px_minmax(0,1fr)]">
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-200 p-3 dark:border-gray-800">
                <div className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800">
                  {doctorDetails?.profilePhoto || selectedDoctorOption?.profilePhoto ? (
                    <img
                      src={doctorDetails?.profilePhoto || selectedDoctorOption?.profilePhoto || ""}
                      alt={selectedDoctor}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="text-sm text-gray-400">No photo</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleContinue}
                  className="mt-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white"
                >
                  Book Appointment
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="text-2xl font-semibold text-gray-800 dark:text-white/90">
                    {doctorDetails?.firstName || doctorDetails?.lastName
                      ? `${doctorDetails.firstName} ${doctorDetails.lastName}`.trim()
                      : selectedDoctorOption?.name || selectedDoctor}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {doctorDetails?.designation || doctorDetails?.qualification || doctorDetails?.specialization || "Doctor"}
                  </p>
                  {selectedDoctorSchedule.length > 0 ? (
                    <div className="mt-3 rounded-2xl border border-brand-200 bg-brand-50/80 px-4 py-3 text-sm font-medium text-brand-700 shadow-sm dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
                      {selectedDoctorSchedule.map((schedule, index) => (
                        <p key={`${schedule.doctorName}-${index}`} className="leading-6">
                          <span className="font-semibold">
                            {schedule.daysAvailable.join(", ") || "All Days"}
                          </span>
                          <span className="mx-2 inline-block h-1.5 w-1.5 rounded-full bg-brand-400 align-middle" />
                          <span>{schedule.availableTimeFrom} - {schedule.availableTimeTo}</span>
                          <span className="mx-2 inline-block h-1.5 w-1.5 rounded-full bg-brand-400 align-middle" />
                          <span>{schedule.timeSlotMinutes || "10"} min</span>
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["Doctor ID", doctorDetails?.doctorId],
                    ["Name", doctorDetails ? `${doctorDetails.firstName} ${doctorDetails.lastName}`.trim() : ""],
                    ["Gender", doctorDetails?.gender],
                    ["Age", doctorDetails ? calculateAge(doctorDetails.dateOfBirth) : "-"],
                    ["Phone", doctorDetails?.mobileNumber],
                    ["Email", doctorDetails?.emailId],
                    ["Qualification", doctorDetails?.qualification],
                    ["Experience", doctorDetails?.experienceYears ? `${doctorDetails.experienceYears} years` : "-"],
                    ["Specialization", doctorDetails?.specialization],
                    ["Department", doctorDetails?.department],
                    ["Employee Type", doctorDetails?.employeeType],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/40">
                      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
                      <div className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">{value || "-"}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/40">
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">Education Details</h4>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {[
                      ["MBBS College", doctorDetails?.education.mbbsCollegeName],
                      ["MBBS University", doctorDetails?.education.mbbsUniversity],
                      ["MBBS Year", doctorDetails?.education.mbbsGraduationYear],
                      ["Higher Qualification", doctorDetails?.education.higherQualification],
                      ["Qualification Institution", doctorDetails?.education.higherQualificationInstitution],
                      ["Completion Year", doctorDetails?.education.higherQualificationCompletionYear],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900/50">
                        <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
                        <div className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">{value || "-"}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">Work Experience</h4>
                    {doctorDetails?.workExperiences.length ? (
                      <div className="mt-3 space-y-3">
                        {doctorDetails.workExperiences.map((experience, index) => (
                          <div key={`${experience.hospitalName}-${index}`} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/50">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white/90">{experience.designation || "-"}</p>
                            <p className="mt-1 text-sm text-gray-500">{experience.hospitalName || "-"} • {experience.location || "-"}</p>
                            <p className="mt-2 text-sm text-gray-500">{experience.department || "-"}</p>
                            <p className="mt-1 text-sm text-gray-500">{experience.fromDate || "-"} — {experience.toDate || "Present"}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-gray-500">No work experience details available.</p>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">Certifications</h4>
                    {doctorDetails?.certifications.length ? (
                      <div className="mt-3 space-y-3">
                        {doctorDetails.certifications.map((certification, index) => (
                          <div key={`${certification.name}-${index}`} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/50">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white/90">{certification.name || "-"}</p>
                            <p className="mt-1 text-sm text-gray-500">{certification.issuingOrganization || "-"}</p>
                            <p className="mt-1 text-sm text-gray-500">Issued: {certification.issueDate || "-"}</p>
                            <p className="mt-1 text-sm text-gray-500">Expires: {certification.expiryDate || "-"}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-gray-500">No certifications available.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {showBookConfirmation ? (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Confirmation</h2>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">ARE YOU CONFIRM TO BOOK</p>
            <div className="mt-5 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowBookConfirmation(false)}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700"
              >
                No
              </button>
              <button
                type="button"
                onClick={executeBooking}
                className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
