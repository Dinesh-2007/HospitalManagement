"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { tableNameFromCardTitle } from "../../../lib/master-form-table";
import { withSalutation } from "../../../lib/salutation";

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
  gender: string;
  department: string;
  specialization: string;
  qualification: string;
  experienceYears: string;
  dateOfBirth: string;
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
    gender: readText(row, ["gender"]),
    department: readText(row, ["clinic", "department", "department_type", "departmentType"]),
    specialization: readText(row, ["specialization"]),
    qualification: readText(row, ["qualification"]),
    experienceYears: readText(row, ["experience_years", "experienceYears"]),
    dateOfBirth: readText(row, ["date_of_birth", "dateOfBirth", "dob"]),
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

  let rawWork = row.workExperiences ?? row.work_experiences;
  if (typeof rawWork === "string" && rawWork.trim()) {
    try { rawWork = JSON.parse(rawWork); } catch { }
  }
  if (Array.isArray(rawWork)) {
    for (const item of rawWork) {
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

  let rawCerts = row.certifications;
  if (typeof rawCerts === "string" && rawCerts.trim()) {
    try { rawCerts = JSON.parse(rawCerts); } catch { }
  }
  if (Array.isArray(rawCerts)) {
    for (const item of rawCerts) {
      if (item && typeof item === "object") {
        certifications.push({
          name: readText(item as MasterRow, ["name", "title", "certificationName", "certification_name"]),
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

function getExperienceYears(doctor: any) {
  // If experience_years has a numeric string/value, return that formatted as years
  const expVal = doctor.experienceYears ?? "";
  if (expVal && !isNaN(Number(expVal)) && Number(expVal) > 0) {
    return `${Number(expVal)} years`;
  }

  // Calculate from registrationDate
  const regDateStr = doctor.registrationDate ?? "";
  if (regDateStr) {
    const regDate = new Date(regDateStr);
    if (!isNaN(regDate.getTime())) {
      const diffMs = Date.now() - regDate.getTime();
      const diffYears = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
      if (diffYears > 0) {
        return `${diffYears} years`;
      }
    }
  }

  // Calculate from work experiences
  let workExps = doctor.workExperiences || [];
  if (typeof workExps === "string") {
    try {
      workExps = JSON.parse(workExps);
    } catch {
      workExps = [];
    }
  }
  if (Array.isArray(workExps) && workExps.length > 0) {
    let totalMs = 0;
    workExps.forEach((exp: any) => {
      const from = new Date(exp.fromDate || exp.from_date || exp.startDate);
      let toStr = exp.toDate || exp.to_date || exp.endDate || "";
      if (!toStr || toStr.toLowerCase() === "present") {
        toStr = new Date().toISOString();
      }
      const to = new Date(toStr);
      if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
        totalMs += (to.getTime() - from.getTime());
      }
    });
    const totalYears = Math.floor(totalMs / (365.25 * 24 * 60 * 60 * 1000));
    if (totalYears > 0) {
      return `${totalYears} years`;
    }
  }

  return "-";
}

export default function BookAppointmentPage() {
  const params = useParams();
  const router = useRouter();
  const hname = params?.Hname as string;
  const [departments, setDepartments] = useState<string[]>([]);
  const [doctorRows, setDoctorRows] = useState<MasterRow[]>([]);
  const [doctorProfilesMap, setDoctorProfilesMap] = useState<Record<string, { profilePhoto?: string; dateOfBirth?: string; experienceYears?: string; specialization?: string; registrationDate?: string; workExperiences?: any[] }>>({});
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
      .map((doctor) => {
        const extra = doctorProfilesMap[doctor.name.toLowerCase()] ?? {};
        return {
          ...doctor,
          profilePhoto: doctor.profilePhoto || extra.profilePhoto || "",
          dateOfBirth: doctor.dateOfBirth || extra.dateOfBirth || "",
          experienceYears: doctor.experienceYears || extra.experienceYears || "",
          specialization: doctor.specialization || extra.specialization || "",
          registrationDate: extra.registrationDate || "",
          workExperiences: extra.workExperiences || [],
        };
      });
  }, [doctorRows, doctorProfilesMap, scheduleRows, selectedDepartment]);

  const [slideIndex, setSlideIndex] = useState(0);
  const isCarouselHovered = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [carouselWidth, setCarouselWidth] = useState(0);

  useEffect(() => {
    setSlideIndex(0);
  }, [doctorOptions]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setCarouselWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setCarouselWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorOptions.length]);

  useEffect(() => {
    if (doctorOptions.length <= 3) return;
    const total = doctorOptions.length;
    const id = setInterval(() => {
      if (!isCarouselHovered.current) {
        setSlideIndex((prev) => {
          // When at last possible 3-group, wrap back to 0
          const maxIndex = total - 3;
          return prev >= maxIndex ? 0 : prev + 1;
        });
      }
    }, 2500);
    return () => clearInterval(id);
  }, [doctorOptions]);

  useEffect(() => {
    let active = true;

    async function loadDoctorProfiles() {
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
            const r = data.row ?? {};
            return [
              name.toLowerCase(),
              {
                profilePhoto: String(r.profile_photo ?? r.profilePhoto ?? ""),
                dateOfBirth: String(r.date_of_birth ?? r.dateOfBirth ?? r.dob ?? ""),
                experienceYears: String(r.experience_years ?? r.experienceYears ?? ""),
                specialization: String(r.specialization ?? ""),
                registrationDate: String(r.registration_date ?? r.registrationDate ?? ""),
                workExperiences: r.work_experiences ?? r.workExperiences ?? [],
              },
            ] as const;
          } catch {
            return [name.toLowerCase(), {}] as const;
          }
        }),
      );

      if (active) {
        setDoctorProfilesMap(Object.fromEntries(entries));
      }
    }

    if (doctorRows.length > 0) {
      void loadDoctorProfiles();
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

  const [activeAppointments, setActiveAppointments] = useState<any[]>([]);
  const [selectedPreviewAppointment, setSelectedPreviewAppointment] = useState<any | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showRescheduleConfirm, setShowRescheduleConfirm] = useState(false);

  async function loadActiveAppointments() {
    if (!hname || !authenticatedPatient) return;
    try {
      const patientId = authenticatedPatient.phone || authenticatedPatient.name;
      const res = await fetch(`/api/${encodeURIComponent(hname)}/appointments?patientId=${encodeURIComponent(patientId)}`, { cache: "no-store" });
      const d = (await res.json().catch(() => ({}))) as { rows?: any[] };
      const rows = d.rows ?? [];
      // Filter for scheduled appointments
      const scheduled = rows.filter((a: any) => a.status === "Scheduled" || !a.status);

      const now = new Date();
      const activeAppts = scheduled.filter((a: any) => {
        if (a.appointment_date && a.appointment_time) {
          const apptDate = new Date(`${a.appointment_date}T${a.appointment_time}`);
          if (!isNaN(apptDate.getTime()) && apptDate < now) {
            return false; // exclude expired
          }
        }
        return true;
      });
      setActiveAppointments(activeAppts);
    } catch (e) {
      console.error("Failed to load active appointments", e);
    }
  }

  useEffect(() => {
    void loadActiveAppointments();
  }, [hname, authenticatedPatient]);

  async function handleCancelAppointment(appt: any) {
    if (!hname || !appt) return;
    setIsProcessingAction(true);
    try {
      const response = await fetch(`/api/${encodeURIComponent(hname)}/appointments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: appt.id,
          patientId: appt.patient_id || authenticatedPatient?.phone || authenticatedPatient?.name,
          department: appt.department,
          doctor: appt.doctor,
          cancelledByRole: "patient",
          cancelledByName: authenticatedPatient?.name || "Patient",
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to cancel appointment.");

      setSelectedPreviewAppointment(null);
      await loadActiveAppointments();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to cancel appointment.");
    } finally {
      setIsProcessingAction(false);
    }
  }

  function handleRescheduleAppointment(appt: any) {
    if (!appt) return;
    setSelectedDepartment(appt.department || "");
    setSelectedDoctor(appt.doctor || "");
    setSelectedPreviewAppointment(null);
    // Scroll to doctor selection / calendar section
    setTimeout(() => {
      document.getElementById("doctor-selection-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
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

          {/* Active Appointments Block */}
          {activeAppointments.length > 0 && (
            <div className="rounded-xl border border-green-300 bg-green-50 p-4 dark:border-green-500/20 dark:bg-green-500/10">
              <div className="flex items-center gap-2 mb-3">
                <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h4 className="text-sm font-bold text-green-800 dark:text-green-300 uppercase tracking-wide">Active Appointments</h4>
              </div>
              <div className="flex flex-wrap gap-3">
                {activeAppointments.map((appt, idx) => (
                  <button
                    key={appt.id || idx}
                    type="button"
                    onClick={() => setSelectedPreviewAppointment(appt)}
                    className={`flex-1 min-w-[280px] text-left rounded-lg p-3 border transition ${appt.isExpired ? "bg-gray-100 border-gray-300 dark:bg-gray-800 dark:border-gray-700" : "bg-green-100 border-green-300 hover:border-green-400 hover:bg-green-200/50 dark:bg-gray-800/40 dark:border-green-900/20"}`}
                  >
                    <div className="font-semibold text-gray-900 dark:text-white text-xs whitespace-nowrap overflow-hidden text-ellipsis">{appt.doctor || "Doctor unavailable"}</div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 flex flex-wrap gap-x-2">
                      <span>{appt.appointment_date || "Date TBA"}</span>
                      <span>{appt.appointment_time || ""}</span>
                      {appt.isExpired && <span className="ml-auto text-red-500 font-semibold uppercase">Expired</span>}
                    </div>
                    {appt.department && (
                      <div className={`text-[10px] font-medium mt-1 ${appt.isExpired ? "text-gray-600 dark:text-gray-400" : "text-green-700 dark:text-green-400"}`}>{appt.department}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-sm text-gray-500">
              Welcome, {withSalutation(authenticatedPatient.name || authenticatedPatient.phone, window.localStorage.getItem("patientGender") ?? "")}
            </div>

            {/* Book Appointment For */}
            <div className="relative inline-block">
              <button
                id="book-for-btn"
                type="button"
                onClick={() => setShowFamilyDropdown(v => !v)}
                className="inline-flex items-center gap-2 rounded-lg border border-brand-500 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-100 transition dark:border-brand-400 dark:bg-brand-500/10 dark:text-brand-400 w-full sm:w-auto"
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
                <div className="absolute right-0 sm:left-0 z-50 mt-2 w-72 rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
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
          </div>

          {!selectedDepartment ? (
            <div id="doctor-selection-section">
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


              {/* Carousel Doctors Section — 3 per view, infinite loop */}
              <div className="mt-10">
                <div className="mb-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Our Specialists</h4>
                </div>
                {doctorOptions.length > 0 ? (
                  <div
                    ref={containerRef}
                    className="relative overflow-hidden rounded-2xl"
                    onMouseEnter={() => { isCarouselHovered.current = true; }}
                    onMouseLeave={() => { isCarouselHovered.current = false; }}
                  >
                    {/* Track: cards are 1/3 of container, gap=16px */}
                    {(() => {
                      const gap = 16;
                      const cardWidth = carouselWidth > 0
                        ? (carouselWidth - gap * 2) / 3
                        : 0;
                      const slideOffset = slideIndex * (cardWidth + gap);
                      return (
                        <div
                          className="flex transition-transform duration-700 ease-in-out"
                          style={{
                            gap: `${gap}px`,
                            transform: `translateX(-${slideOffset}px)`,
                            willChange: "transform",
                          }}
                        >
                          {doctorOptions.map((doctor, index) => (
                            <button
                              key={`${doctor.doctorId}-${index}`}
                              type="button"
                              onClick={() => void openDoctorPopup(doctor)}
                              style={{
                                width: cardWidth > 0 ? `${cardWidth}px` : "calc(33.333% - 11px)",
                                flexShrink: 0,
                              }}
                              className="flex flex-col items-center p-4 rounded-2xl border border-gray-200 bg-white hover:border-brand-300 hover:bg-brand-50 transition shadow-sm hover:shadow-md cursor-pointer animate-in fade-in duration-300"
                            >
                              {/* Profile row centered horizontally */}
                              <div className="flex items-center justify-center gap-4 w-full pb-3 border-b border-gray-100 dark:border-gray-800">
                                {/* Photo */}
                                <div className="h-14 w-14 overflow-hidden rounded-full border-2 border-brand-100 bg-brand-50 shadow-sm shrink-0 flex items-center justify-center">
                                  {doctor.profilePhoto ? (
                                    <Image src={doctor.profilePhoto} alt={doctor.name} width={56} height={56} className="h-full w-full object-cover" unoptimized />
                                  ) : (
                                    <svg className="h-8 w-8 text-brand-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                  )}
                                </div>
                                {/* Name and Department */}
                                <div className="text-left min-w-0">
                                  <span className="text-sm font-semibold text-gray-800 block truncate">{withSalutation(doctor.name, doctor.gender)}</span>
                                  {doctor.department && (
                                    <span className="text-xs text-brand-600 block truncate">{doctor.department}</span>
                                  )}
                                </div>
                              </div>

                              {/* Info fields: Age, Specialization, Experience stacked vertically and centered */}
                              <div className="mt-3 flex flex-col items-center gap-1 text-xs text-gray-500 w-full text-center">
                                <span className="block truncate max-w-full">Age: {calculateAge(doctor.dateOfBirth)}</span>
                                <span className="block truncate max-w-full font-medium text-brand-600 dark:text-brand-400">Specialization: {doctor.specialization || "-"}</span>
                                <span className="block truncate max-w-full">Experience: {getExperienceYears(doctor)}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                    {/* Dot indicators — one dot per group of 3 */}
                    {doctorOptions.length > 3 && (
                      <div className="flex justify-center gap-1.5 mt-4">
                        {Array.from({ length: doctorOptions.length - 2 }).map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setSlideIndex(i)}
                            className={`h-1.5 rounded-full transition-all duration-300 ${i === slideIndex
                                ? "w-5 bg-brand-500"
                                : "w-1.5 bg-gray-300 hover:bg-gray-400"
                              }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 py-4">No doctors available.</div>
                )}
              </div>
            </div>

          ) : (
            <div id="doctor-selection-section" className="mb-6 flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-500/20 dark:bg-brand-500/10">
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
                    <div key={doctor.name} className={`rounded-2xl border transition overflow-hidden ${isActive ? "border-brand-300 bg-brand-50" : "border-gray-200 bg-white"}`}>
                      {/* Profile row */}
                      <div className="flex items-start gap-4 p-5 pb-4">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                          {doctor.profilePhoto ? (
                            <img src={doctor.profilePhoto} alt={doctor.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">No photo</div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          {/* Name */}
                          <p className="text-base font-bold text-gray-900 truncate">{withSalutation(doctor.name, doctor.gender)}</p>
                          {/* Specialization */}
                          {(doctor.specialization || doctor.department) && (
                            <p className="mt-0.5 text-sm text-gray-500 truncate">{doctor.specialization || doctor.department}</p>
                          )}
                          {/* Experience • Qualification */}
                          {(doctor.experienceYears || doctor.qualification) && (
                            <p className="mt-1 text-sm font-semibold text-brand-600">
                              {doctor.experienceYears ? `${doctor.experienceYears} YEARS` : ""}
                              {doctor.experienceYears && doctor.qualification ? <span className="mx-1 text-gray-400">•</span> : null}
                              {doctor.qualification ? doctor.qualification.toUpperCase() : ""}
                            </p>
                          )}
                          {/* Age */}
                          {doctor.dateOfBirth && (
                            <p className="mt-0.5 text-xs text-gray-400">Age {calculateAge(doctor.dateOfBirth)}</p>
                          )}
                          {/* City */}
                          {doctor.clinic && (
                            <p className="mt-0.5 text-xs text-gray-400">{doctor.clinic}</p>
                          )}
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-gray-100" />

                      {/* Action buttons */}
                      <div className="grid grid-cols-2 divide-x divide-gray-100">
                        <button
                          type="button"
                          onClick={() => directBookDoctor(doctor)}
                          className="flex items-center justify-center gap-1.5 py-3 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 transition active:scale-95 rounded-bl-2xl"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          Book Appointment
                        </button>
                        <button
                          type="button"
                          onClick={() => void openDoctorPopup(doctor)}
                          className="flex items-center justify-center gap-1.5 py-3 text-sm font-semibold text-gray-600 bg-white hover:bg-gray-50 transition active:scale-95 rounded-br-2xl"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
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

      {/* Appointment Detail Popup */}
      {selectedPreviewAppointment && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="mt-1 text-xl font-bold text-gray-900 dark:text-white">Appointment Details</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedPreviewAppointment(null);
                  setShowCancelConfirm(false);
                  setShowRescheduleConfirm(false);
                }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/50">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Doctor & Department</p>
                <p className="mt-1 text-base font-semibold text-gray-900 dark:text-white">{selectedPreviewAppointment.doctor}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{selectedPreviewAppointment.department}</p>
              </div>

              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/50">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Schedule</p>
                <div className="mt-1 flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="font-medium">{selectedPreviewAppointment.appointment_date}</span>
                  <span className="mx-1 text-gray-300">|</span>
                  <span className="font-medium">{selectedPreviewAppointment.appointment_time}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4">
                <button
                  type="button"
                  disabled={selectedPreviewAppointment.isExpired}
                  onClick={() => setShowRescheduleConfirm(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Reschedule
                </button>
                <button
                  type="button"
                  disabled={isProcessingAction || selectedPreviewAppointment.isExpired}
                  onClick={() => setShowCancelConfirm(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {isProcessingAction ? "Processing..." : "Cancel"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Confirmation Modal */}
      {showRescheduleConfirm && (
        <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Reschedule Appointment?</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to reschedule? You will be redirected to select a new slot for this doctor.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowRescheduleConfirm(false);
                  handleRescheduleAppointment(selectedPreviewAppointment);
                }}
                className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition"
              >
                Yes, Reschedule
              </button>
              <button
                type="button"
                onClick={() => setShowRescheduleConfirm(false)}
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition dark:border-gray-800 dark:bg-gray-800 dark:text-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mb-4">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Cancel Appointment?</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to cancel this appointment? This action cannot be undone.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={async () => {
                  await handleCancelAppointment(selectedPreviewAppointment);
                  setShowCancelConfirm(false);
                }}
                className="w-full rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-50"
              >
                {isProcessingAction ? "Cancelling..." : "Yes, Cancel"}
              </button>
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={() => setShowCancelConfirm(false)}
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition dark:border-gray-800 dark:bg-gray-800 dark:text-gray-200"
              >
                Keep Appointment
              </button>
            </div>
          </div>
        </div>
      )}

      {isDoctorPopupOpen ? (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900 max-h-[90vh] overflow-y-auto">
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
                      ? withSalutation(`${doctorDetails.firstName} ${doctorDetails.lastName}`.trim(), doctorDetails.gender)
                      : withSalutation(selectedDoctorOption?.name || selectedDoctor, selectedDoctorOption?.gender ?? "")}
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
                      <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                            <thead className="bg-gray-50 text-xs uppercase text-gray-700 dark:bg-gray-800/40 dark:text-gray-300">
                              <tr>
                                <th scope="col" className="px-4 py-3 font-medium">Hospital Name</th>
                                <th scope="col" className="px-4 py-3 font-medium">Designation</th>
                                <th scope="col" className="px-4 py-3 font-medium">Department</th>
                                <th scope="col" className="px-4 py-3 font-medium">Location</th>
                                <th scope="col" className="whitespace-nowrap px-4 py-3 font-medium">From Date</th>
                                <th scope="col" className="whitespace-nowrap px-4 py-3 font-medium">To Date</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                              {doctorDetails.workExperiences.map((experience, index) => (
                                <tr key={`${experience.hospitalName}-${index}`} className="bg-white hover:bg-gray-50 dark:bg-gray-900/50 dark:hover:bg-gray-800/60">
                                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white/90">{experience.hospitalName || "-"}</td>
                                  <td className="px-4 py-3">{experience.designation || "-"}</td>
                                  <td className="px-4 py-3">{experience.department || "-"}</td>
                                  <td className="px-4 py-3">{experience.location || "-"}</td>
                                  <td className="whitespace-nowrap px-4 py-3">{experience.fromDate || "-"}</td>
                                  <td className="whitespace-nowrap px-4 py-3">{experience.toDate || "Present"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-gray-500">No work experience details available.</p>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">Certifications</h4>
                    {doctorDetails?.certifications.length ? (
                      <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                            <thead className="bg-gray-50 text-xs uppercase text-gray-700 dark:bg-gray-800/40 dark:text-gray-300">
                              <tr>
                                <th scope="col" className="px-4 py-3 font-medium">Certification Name</th>
                                <th scope="col" className="px-4 py-3 font-medium">Issuing Organization</th>
                                <th scope="col" className="whitespace-nowrap px-4 py-3 font-medium">Issue Date</th>
                                <th scope="col" className="whitespace-nowrap px-4 py-3 font-medium">Expiry Date</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                              {doctorDetails.certifications.map((certification, index) => (
                                <tr key={`${certification.name}-${index}`} className="bg-white hover:bg-gray-50 dark:bg-gray-900/50 dark:hover:bg-gray-800/60">
                                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white/90">{certification.name || "-"}</td>
                                  <td className="px-4 py-3">{certification.issuingOrganization || "-"}</td>
                                  <td className="whitespace-nowrap px-4 py-3">{certification.issueDate || "-"}</td>
                                  <td className="whitespace-nowrap px-4 py-3">{certification.expiryDate || "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
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
