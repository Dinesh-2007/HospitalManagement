"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { City, Country, State } from "country-state-city";
import { getCurrentUser, getCurrentUserRole } from "../../app/actions/user";
import { logoutAction } from "../../app/actions/auth";
import { changePasswordAction } from "../../app/actions/user-settings";
import { Dropdown } from "../dropdown";
import { DropdownItem } from "../dropdown-item";
import { ChevronDownIcon } from "../icons";
import { Button } from "../ui/button";
import { InputField } from "../ui/input-field";
import { Label } from "../ui/label";
import { PhoneInputField } from "../ui/phone-input";

type EmergencyContact = {
  name: string;
  relationship: string;
  phone: string;
};

type WorkExperience = {
  hospitalName: string;
  designation: string;
  department: string;
  fromDate: string;
  toDate: string;
  location: string;
};

type Document = {
  name: string;
  attachment: string;
  fileName: string;
};

type Certification = {
  name: string;
  issuingOrganization: string;
  issueDate: string;
  expiryDate: string;
};

type ProfileFieldKey =
  | "doctorId"
  | "doctorCode"
  | "firstName"
  | "lastName"
  | "gender"
  | "dateOfBirth"
  | "bloodGroup"
  | "maritalStatus"
  | "nationality"
  | "profilePhoto"
  | "mobileNumber"
  | "alternateMobileNumber"
  | "officialEmail"
  | "personalEmail"
  | "address"
  | "country"
  | "state"
  | "city"
  | "pincode"
  | "registrationNumber"
  | "medicalCouncilName"
  | "registrationDate"
  | "licenseExpiryDate"
  | "mbbsCollegeName"
  | "mbbsUniversity"
  | "mbbsGraduationYear"
  | "higherQualification"
  | "higherQualificationInstitution"
  | "higherQualificationCompletionYear"
  | "specialization"
  | "department"
  | "designation"
  | "licenseNumber"
  | "experienceYears"
  | "employeeType"
  | "shift"
  | "bankName"
  | "accountHolderName"
  | "accountNumber"
  | "ifscCode"
  | "panNumber"
  | "aadhaarNumber";

type ProfileFormState = Record<ProfileFieldKey, string> & {
  emergencyContacts: EmergencyContact[];
  workExperiences: WorkExperience[];
  certifications: Certification[];
  documents: Document[];
};

const INITIAL_PROFILE_FORM: ProfileFormState = {
  doctorId: "",
  doctorCode: "",
  firstName: "",
  lastName: "",
  gender: "",
  dateOfBirth: "",
  bloodGroup: "",
  maritalStatus: "",
  nationality: "",
  profilePhoto: "",
  mobileNumber: "",
  alternateMobileNumber: "",
  officialEmail: "",
  personalEmail: "",
  address: "",
  country: "",
  state: "",
  city: "",
  pincode: "",
  registrationNumber: "",
  medicalCouncilName: "",
  registrationDate: "",
  licenseExpiryDate: "",
  mbbsCollegeName: "",
  mbbsUniversity: "",
  mbbsGraduationYear: "",
  higherQualification: "",
  higherQualificationInstitution: "",
  higherQualificationCompletionYear: "",
  specialization: "",
  department: "",
  designation: "",
  licenseNumber: "",
  experienceYears: "",
  employeeType: "",
  shift: "",
  bankName: "",
  accountHolderName: "",
  accountNumber: "",
  ifscCode: "",
  panNumber: "",
  aadhaarNumber: "",
  emergencyContacts: [
    { name: "", relationship: "", phone: "" },
  ],
  workExperiences: [
    { hospitalName: "", designation: "", department: "", fromDate: "", toDate: "", location: "" },
  ],
  certifications: [
    { name: "", issuingOrganization: "", issueDate: "", expiryDate: "" },
  ],
  documents: [
    { name: "", attachment: "", fileName: "" },
  ],
};

const LOVS = {
  gender: ["Male", "Female", "Other"],
  bloodGroup: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
  maritalStatus: ["Single", "Married", "Divorced", "Widowed"],
  country: ["India", "United States", "United Kingdom", "Other"],
  employeeType: ["Full Time", "Part Time"],
  shift: ["Morning", "Afternoon", "Evening", "Night"],
  higherQualification: ["MD", "MS", "DNB", "DM", "MCh"],
} as const;

const SPECIALIZATION_OPTIONS = [
  "Cardiology",
  "Dermatology",
  "General Medicine",
  "Gynecology",
  "Neurology",
  "Orthopedics",
  "Pediatrics",
  "Psychiatry",
  "Radiology",
];

const DEPARTMENT_OPTIONS = [
  "OPD",
  "IPD",
  "Emergency",
  "ICU",
  "Surgery",
  "Laboratory",
  "Pharmacy",
];

type FieldConfig = {
  key: ProfileFieldKey;
  label: string;
  inputType?: "text" | "date" | "email" | "number" | "file";
  pattern?: string;
  maxLength?: number;
  optionGroup?: keyof typeof LOVS | "specialization" | "department" | "country" | "state" | "city";
  options?: readonly string[];
  fullWidth?: boolean;
};

const FIELD_CONFIG: FieldConfig[] = [
  { key: "doctorId", label: "Doctor ID", inputType: "text", pattern: "[A-Za-z0-9-]*", maxLength: 50 },
  { key: "doctorCode", label: "Doctor Code", inputType: "text", pattern: "[A-Za-z0-9-]*", maxLength: 50 },
  { key: "firstName", label: "First Name", inputType: "text", pattern: "[A-Za-z ]*", maxLength: 100 },
  { key: "lastName", label: "Last Name", inputType: "text", pattern: "[A-Za-z ]*", maxLength: 100 },
  { key: "gender", label: "Gender", optionGroup: "gender" },
  { key: "dateOfBirth", label: "Date of Birth", inputType: "date" },
  { key: "bloodGroup", label: "Blood Group", optionGroup: "bloodGroup" },
  { key: "maritalStatus", label: "Marital Status", optionGroup: "maritalStatus" },
  { key: "nationality", label: "Nationality", inputType: "text", maxLength: 100 },
  { key: "profilePhoto", label: "Profile Photo", inputType: "file" },
  { key: "mobileNumber", label: "Mobile Number", inputType: "text", pattern: "[0-9]*", maxLength: 10 },
  { key: "alternateMobileNumber", label: "Alternate Mobile Number", inputType: "text", pattern: "[0-9]*", maxLength: 10 },
  { key: "officialEmail", label: "Official Email", inputType: "email", maxLength: 255 },
  { key: "personalEmail", label: "Personal Email", inputType: "email", maxLength: 255 },
  { key: "address", label: "Address", inputType: "text", fullWidth: true, maxLength: 255 },
  { key: "country", label: "Country", optionGroup: "country" },
  { key: "state", label: "State", optionGroup: "state" },
  { key: "city", label: "City", optionGroup: "city" },
  { key: "pincode", label: "Pincode", inputType: "text", pattern: "[0-9]*", maxLength: 10 },
  { key: "registrationNumber", label: "License Number", inputType: "text", pattern: "[A-Za-z0-9-]*", maxLength: 100 },
  { key: "medicalCouncilName", label: "Medical Council Name", inputType: "text", maxLength: 150 },
  { key: "registrationDate", label: "Registration Date", inputType: "date" },
  { key: "licenseExpiryDate", label: "License Expiry Date", inputType: "date" },
  { key: "mbbsCollegeName", label: "MBBS College Name", inputType: "text", maxLength: 150 },
  { key: "mbbsUniversity", label: "MBBS University", inputType: "text", maxLength: 150 },
  { key: "mbbsGraduationYear", label: "MBBS Graduation Year", inputType: "text", maxLength: 10 },
  { key: "higherQualification", label: "Higher Qualification", optionGroup: "higherQualification" },
  { key: "higherQualificationInstitution", label: "Higher Qualification Institution", inputType: "text", maxLength: 150 },
  { key: "higherQualificationCompletionYear", label: "Higher Qualification Completion Year", inputType: "text", maxLength: 10 },
  { key: "specialization", label: "Specialization", optionGroup: "specialization" },
  { key: "department", label: "Department", optionGroup: "department" },
  { key: "designation", label: "Designation", inputType: "text", maxLength: 100 },
  { key: "licenseNumber", label: "License Number", inputType: "text", pattern: "[A-Za-z0-9-]*", maxLength: 100 },
  { key: "employeeType", label: "Employee Type", optionGroup: "employeeType" },
  { key: "shift", label: "Shift", optionGroup: "shift" },
  { key: "bankName", label: "Bank Name", inputType: "text", maxLength: 150 },
  { key: "accountHolderName", label: "Account Holder Name", inputType: "text", maxLength: 150 },
  { key: "accountNumber", label: "Account Number", inputType: "text", pattern: "[0-9]*", maxLength: 20 },
  { key: "ifscCode", label: "IFSC Code", inputType: "text", pattern: "[A-Za-z0-9]*", maxLength: 11 },
  { key: "panNumber", label: "PAN Number", inputType: "text", pattern: "[A-Za-z0-9]*", maxLength: 20 },
  { key: "aadhaarNumber", label: "Aadhaar Number", inputType: "text", pattern: "[0-9]*", maxLength: 12 },
];

function sanitizeDigits(value: string, maxLength?: number) {
  const digits = value.replace(/\D/g, "");
  return typeof maxLength === "number" ? digits.slice(0, maxLength) : digits;
}

function sanitizeAlphaNumeric(value: string, maxLength?: number) {
  const text = value.replace(/[^a-zA-Z0-9-]/g, "");
  return typeof maxLength === "number" ? text.slice(0, maxLength) : text;
}

function sanitizeLetters(value: string, maxLength?: number) {
  const text = value.replace(/[^a-zA-Z\s]/g, "");
  return typeof maxLength === "number" ? text.slice(0, maxLength) : text;
}

export function HeaderUserDropdown() {
  const params = useParams();
  const hname = params?.Hname ? decodeURIComponent(params.Hname as string) : "HSMS";
  const [user, setUser] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [isChangePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileForm, setProfileForm] = useState<ProfileFormState>(INITIAL_PROFILE_FORM);
  const isDoctor = role?.toLowerCase() === "doctor";

  useEffect(() => {
    if (hname !== "HSMS") {
      getCurrentUser(hname).then(setUser).catch(console.error);
      getCurrentUserRole(hname).then(setRole).catch(console.error);
    }
  }, [hname]);

  useEffect(() => {
    async function loadDoctorProfile() {
      if (!isDoctor || !user || !isProfileModalOpen) {
        return;
      }

      try {
        const response = await fetch(
          `/api/${encodeURIComponent(hname)}/doctor-profile?username=${encodeURIComponent(user)}`,
          { cache: "no-store" },
        );
        const data = (await response.json().catch(() => ({}))) as { row?: Record<string, unknown> | null; error?: string };

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load profile");
        }

        const row = data.row ?? null;
        if (!row) {
          setProfileForm(INITIAL_PROFILE_FORM);
          return;
        }

        setProfileForm({
          doctorId: String(row.doctor_id ?? ""),
          doctorCode: String(row.doctor_code ?? ""),
          firstName: String(row.first_name ?? ""),
          lastName: String(row.last_name ?? ""),
          gender: String(row.gender ?? ""),
          dateOfBirth: row.date_of_birth ? String(row.date_of_birth).slice(0, 10) : "",
          bloodGroup: String(row.blood_group ?? ""),
          maritalStatus: String(row.marital_status ?? ""),
          nationality: String(row.nationality ?? ""),
          profilePhoto: String(row.profile_photo ?? ""),
          mobileNumber: String(row.mobile_number ?? ""),
          alternateMobileNumber: String(row.alternate_mobile_number ?? ""),
          officialEmail: String(row.email_id ?? ""),
          personalEmail: String(row.personal_email ?? ""),
          address: String(row.address ?? ""),
          country: String(row.country ?? ""),
          state: String(row.state ?? ""),
          city: String(row.city ?? ""),
          pincode: String(row.pincode ?? ""),
          registrationNumber: String(row.registration_number ?? ""),
          medicalCouncilName: String(row.medical_council_name ?? ""),
          registrationDate: row.registration_date ? String(row.registration_date).slice(0, 10) : "",
          licenseExpiryDate: row.license_expiry_date ? String(row.license_expiry_date).slice(0, 10) : "",
          mbbsCollegeName: String(row.mbbs_college_name ?? ""),
          mbbsUniversity: String(row.mbbs_university ?? ""),
          mbbsGraduationYear: String(row.mbbs_graduation_year ?? ""),
          higherQualification: String(row.higher_qualification ?? ""),
          higherQualificationInstitution: String(row.higher_qualification_institution ?? ""),
          higherQualificationCompletionYear: String(row.higher_qualification_completion_year ?? ""),
          specialization: String(row.specialization ?? ""),
          department: String(row.department ?? ""),
          designation: String(row.designation ?? ""),
          licenseNumber: String(row.license_number ?? ""),
          experienceYears: String(row.experience_years ?? ""),
          employeeType: String(row.employee_type ?? ""),
          shift: String(row.shift ?? ""),
          bankName: String(row.bank_name ?? ""),
          accountHolderName: String(row.account_holder_name ?? ""),
          accountNumber: String(row.account_number ?? ""),
          ifscCode: String(row.ifsc_code ?? ""),
          panNumber: String(row.pan_number ?? ""),
          aadhaarNumber: String(row.aadhaar_number ?? ""),
          documents: Array.isArray(row.documents)
            ? (row.documents as unknown as Document[])
            : row.documents
              ? JSON.parse(String(row.documents))
              : [{ name: "", attachment: "", fileName: "" }],
          emergencyContacts: Array.isArray(row.emergency_contacts)
            ? (row.emergency_contacts as unknown as EmergencyContact[])
            : row.emergency_contacts
              ? JSON.parse(String(row.emergency_contacts))
              : [{ name: "", relationship: "", phone: "" }],
          workExperiences: Array.isArray(row.work_experiences)
            ? (row.work_experiences as unknown as WorkExperience[])
            : row.work_experiences
              ? JSON.parse(String(row.work_experiences))
              : [{ hospitalName: "", designation: "", department: "", fromDate: "", toDate: "", location: "" }],
          certifications: Array.isArray(row.certifications)
            ? (row.certifications as unknown as Certification[])
            : row.certifications
              ? JSON.parse(String(row.certifications))
              : [{ name: "", issuingOrganization: "", issueDate: "", expiryDate: "" }],
        });
      } catch (error) {
        setProfileError(error instanceof Error ? error.message : "Failed to load profile");
      }
    }

    void loadDoctorProfile();
  }, [hname, isDoctor, isProfileModalOpen, user]);

  const doctorFields = useMemo(
    () =>
      FIELD_CONFIG.map((field) => {
        if (field.optionGroup === "gender") {
          return { ...field, options: LOVS.gender };
        }
        if (field.optionGroup === "bloodGroup") {
          return { ...field, options: LOVS.bloodGroup };
        }
        if (field.optionGroup === "maritalStatus") {
          return { ...field, options: LOVS.maritalStatus };
        }
        if (field.optionGroup === "country") {
          return { ...field, options: Country.getAllCountries().map((item) => item.name) };
        }
        if (field.optionGroup === "state") {
          return {
            ...field,
            options: profileForm.country
              ? State.getStatesOfCountry(
                  Country.getAllCountries().find((item) => item.name === profileForm.country)?.isoCode ?? "",
                ).map((item) => item.name)
              : [],
          };
        }
        if (field.optionGroup === "city") {
          const selectedCountry = Country.getAllCountries().find((item) => item.name === profileForm.country);
          const selectedState = State.getStatesOfCountry(selectedCountry?.isoCode ?? "").find(
            (item) => item.name === profileForm.state,
          );
          return {
            ...field,
            options:
              selectedCountry && selectedState
                ? City.getCitiesOfState(selectedCountry.isoCode, selectedState.isoCode).map((item) => item.name)
                : [],
          };
        }
        if (field.optionGroup === "employeeType") {
          return { ...field, options: LOVS.employeeType };
        }
        if (field.optionGroup === "shift") {
          return { ...field, options: LOVS.shift };
        }
        if (field.optionGroup === "higherQualification") {
          return { ...field, options: LOVS.higherQualification };
        }
        if (field.optionGroup === "specialization") {
          return { ...field, options: SPECIALIZATION_OPTIONS };
        }
        if (field.optionGroup === "department") {
          return { ...field, options: DEPARTMENT_OPTIONS };
        }
        return field;
      }),
    [profileForm.country, profileForm.state],
  );

  if (!user) return null;

  async function handleLogout() {
    await logoutAction(hname);
    window.location.href = `/${encodeURIComponent(hname)}`;
  }

  async function handleChangePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setChangePasswordError("");
    const formData = new FormData(e.currentTarget);
    try {
      await changePasswordAction(hname, formData);
      setChangePasswordModalOpen(false);
      alert("Password changed successfully!");
    } catch (error) {
      setChangePasswordError(error instanceof Error ? error.message : "Failed to change password");
    }
  }

  async function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isDoctor) return;

    setProfileError("");
    setProfileMessage("");

    try {
      const payload = {
        ...profileForm,
        emailId: profileForm.officialEmail,
        username: user,
        emergencyContacts: JSON.stringify(profileForm.emergencyContacts),
        workExperiences: JSON.stringify(profileForm.workExperiences),
        certifications: JSON.stringify(profileForm.certifications),
        documents: JSON.stringify(profileForm.documents),
      };

      const response = await fetch(`/api/${encodeURIComponent(hname)}/doctor-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to save profile");
      setProfileMessage("Profile saved successfully.");
      setProfileModalOpen(false);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Failed to save profile");
    }
  }

  function updateField(key: ProfileFieldKey, value: string) {
    const config = FIELD_CONFIG.find((field) => field.key === key);
    if (!config) return;

    let nextValue = value;
    if (config.inputType === "number") {
      nextValue = sanitizeDigits(value, config.maxLength);
    } else if (key === "profilePhoto") {
      nextValue = value.slice(0, 255);
    } else if (key === "pincode" || key === "accountNumber" || key === "aadhaarNumber") {
      nextValue = sanitizeDigits(value, config.maxLength);
    } else if (key === "ifscCode" || key === "panNumber" || key === "doctorId" || key === "doctorCode" || key === "registrationNumber" || key === "licenseNumber") {
      nextValue = sanitizeAlphaNumeric(value.toUpperCase(), config.maxLength);
    } else if (key === "firstName" || key === "lastName" || key === "state" || key === "city") {
      nextValue = sanitizeLetters(value, config.maxLength);
    } else if (typeof config.maxLength === "number") {
      nextValue = value.slice(0, config.maxLength);
    }

    setProfileForm((current) => ({ ...current, [key]: nextValue }));
  }

  function handleProfilePhotoUpload(file: File | null) {
    if (!file) {
      setProfileForm((current) => ({ ...current, profilePhoto: "" }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setProfileForm((current) => ({ ...current, profilePhoto: result }));
    };
    reader.readAsDataURL(file);
  }

  function handleDocumentUpload(index: number, file: File | null) {
    if (!file) {
      setProfileForm((current) => {
        const documents = current.documents.map((doc, idx) =>
          idx === index ? { ...doc, attachment: "", fileName: "" } : doc,
        );
        return { ...current, documents };
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const attachment = typeof reader.result === "string" ? reader.result : "";
      setProfileForm((current) => {
        const documents = current.documents.map((doc, idx) =>
          idx === index ? { ...doc, attachment, fileName: file.name } : doc,
        );
        return { ...current, documents };
      });
    };
    reader.readAsDataURL(file);
  }

  function updateDocumentName(index: number, value: string) {
    setProfileForm((current) => {
      const documents = current.documents.map((doc, idx) =>
        idx === index ? { ...doc, name: value } : doc,
      );
      return { ...current, documents };
    });
  }

  function updateEmergencyContact(index: number, key: keyof EmergencyContact, value: string) {
    setProfileForm((current) => {
      const contacts = current.emergencyContacts.map((item, idx) =>
        idx === index ? { ...item, [key]: value } : item,
      );
      return { ...current, emergencyContacts: contacts };
    });
  }

  function addEmergencyContact() {
    setProfileForm((current) => ({
      ...current,
      emergencyContacts: [...current.emergencyContacts, { name: "", relationship: "", phone: "" }],
    }));
  }

  function removeEmergencyContact(index: number) {
    setProfileForm((current) => ({
      ...current,
      emergencyContacts: current.emergencyContacts.filter((_, idx) => idx !== index),
    }));
  }

  function updateWorkExperience(index: number, key: keyof WorkExperience, value: string) {
    setProfileForm((current) => {
      const experiences = current.workExperiences.map((item, idx) =>
        idx === index ? { ...item, [key]: value } : item,
      );
      return { ...current, workExperiences: experiences };
    });
  }

  function addWorkExperience() {
    setProfileForm((current) => ({
      ...current,
      workExperiences: [...current.workExperiences, { hospitalName: "", designation: "", department: "", fromDate: "", toDate: "", location: "" }],
    }));
  }

  function removeWorkExperience(index: number) {
    setProfileForm((current) => ({
      ...current,
      workExperiences: current.workExperiences.filter((_, idx) => idx !== index),
    }));
  }

  function updateCertification(index: number, key: keyof Certification, value: string) {
    setProfileForm((current) => {
      const certifications = current.certifications.map((item, idx) =>
        idx === index ? { ...item, [key]: value } : item,
      );
      return { ...current, certifications };
    });
  }

  function addCertification() {
    setProfileForm((current) => ({
      ...current,
      certifications: [...current.certifications, { name: "", issuingOrganization: "", issueDate: "", expiryDate: "" }],
    }));
  }

  function removeCertification(index: number) {
    setProfileForm((current) => ({
      ...current,
      certifications: current.certifications.filter((_, idx) => idx !== index),
    }));
  }

  function calculateTotalExperience() {
    const years = profileForm.workExperiences.reduce((sum, experience) => {
      const from = experience.fromDate ? new Date(experience.fromDate) : null;
      const to = experience.toDate ? new Date(experience.toDate) : new Date();
      if (!from || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return sum;
      return sum + Math.max(0, (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24 * 365));
    }, 0);
    return `${Math.floor(years)} year${Math.floor(years) === 1 ? "" : "s"}`;
  }

  const totalExperience = calculateTotalExperience();

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setDropdownOpen((current) => !current)}
          className="dropdown-toggle flex cursor-pointer items-center gap-3"
        >
          <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-100 font-bold text-gray-600 dark:border-gray-800 dark:bg-gray-800">
            {user.substring(0, 2).toUpperCase()}
          </div>
          <div className="hidden sm:flex sm:items-center sm:gap-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{user}</span>
            <ChevronDownIcon className="h-4 w-4 text-gray-400" />
          </div>
        </button>

        <Dropdown
          isOpen={isDropdownOpen}
          onClose={() => setDropdownOpen(false)}
          className="absolute right-0 top-full z-50 mt-2 w-48 rounded border border-gray-200 bg-white shadow-lg"
        >
          {isDoctor ? <DropdownItem onClick={() => setProfileModalOpen(true)}>Profile</DropdownItem> : null}
          <DropdownItem onClick={() => setChangePasswordModalOpen(true)}>Change Password</DropdownItem>
          <DropdownItem onClick={handleLogout} className="text-red-600">
            Logout
          </DropdownItem>
        </Dropdown>
      </div>

      {isChangePasswordModalOpen ? (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded bg-white p-6 shadow-xl dark:bg-gray-900">
            <h2 className="mb-4 text-xl font-semibold">Change Password</h2>
            {changePasswordError ? <div className="mb-4 text-sm text-red-500">{changePasswordError}</div> : null}
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <Label htmlFor="oldPassword">Old Password</Label>
                <InputField id="oldPassword" name="oldPassword" type="password" required />
              </div>
              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <InputField id="newPassword" name="newPassword" type="password" required />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setChangePasswordModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Change Password</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isProfileModalOpen && isDoctor ? (
        <div className="fixed inset-0 z-[999999] flex items-start justify-center bg-black/50 p-0">
          <div className="h-screen w-full max-w-none overflow-auto bg-white p-6 dark:bg-gray-900">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Doctor Profile</h2>
                <p className="text-sm text-gray-500">Only doctor accounts can access this form.</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setProfileModalOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
            {profileError ? <div className="mb-4 text-sm text-red-500">{profileError}</div> : null}
            {profileMessage ? <div className="mb-4 text-sm text-green-600">{profileMessage}</div> : null}
            <form onSubmit={handleProfileSubmit} className="mx-auto w-full max-w-[1200px] space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                <div className="md:col-span-3 space-y-4">
                  <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Basic Information</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {[
                        ["doctorId", "Doctor ID"],
                        ["doctorCode", "Doctor Code"],
                        ["firstName", "First Name"],
                        ["lastName", "Last Name"],
                      ].map(([key, label]) => (
                        <div key={key}>
                          <Label htmlFor={key}>{label}</Label>
                          <InputField
                            id={key}
                            name={key}
                            type="text"
                            value={profileForm[key as ProfileFieldKey]}
                            onChange={(event) => updateField(key as ProfileFieldKey, event.target.value)}
                            maxLength={100}
                          />
                        </div>
                      ))}
                      <div>
                        <Label htmlFor="gender">Gender</Label>
                        <select
                          id="gender"
                          name="gender"
                          value={profileForm.gender}
                          onChange={(event) => updateField("gender", event.target.value)}
                          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-hidden focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                        >
                          <option value="">Select</option>
                          {LOVS.gender.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="dateOfBirth">Date of Birth</Label>
                        <InputField id="dateOfBirth" name="dateOfBirth" type="date" value={profileForm.dateOfBirth} onChange={(event) => updateField("dateOfBirth", event.target.value)} />
                      </div>
                      <div>
                        <Label htmlFor="bloodGroup">Blood Group</Label>
                        <select
                          id="bloodGroup"
                          name="bloodGroup"
                          value={profileForm.bloodGroup}
                          onChange={(event) => updateField("bloodGroup", event.target.value)}
                          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-hidden focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                        >
                          <option value="">Select</option>
                          {LOVS.bloodGroup.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="maritalStatus">Marital Status</Label>
                        <select
                          id="maritalStatus"
                          name="maritalStatus"
                          value={profileForm.maritalStatus}
                          onChange={(event) => updateField("maritalStatus", event.target.value)}
                          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-hidden focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                        >
                          <option value="">Select</option>
                          {LOVS.maritalStatus.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="nationality">Nationality</Label>
                        <InputField id="nationality" name="nationality" type="text" value={profileForm.nationality} onChange={(event) => updateField("nationality", event.target.value)} maxLength={100} />
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Medical Registration</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {[
                        ["registrationNumber", "Registration Number"],
                        ["licenseNumber", "License Number"],
                        ["medicalCouncilName", "Medical Council Name"],
                        ["registrationDate", "Registration Date"],
                        ["licenseExpiryDate", "License Expiry Date"],
                      ].map(([key, label]) => (
                        <div key={key}>
                          <Label htmlFor={key}>{label}</Label>
                          <InputField
                            id={key}
                            name={key}
                            type={key === "registrationDate" || key === "licenseExpiryDate" ? "date" : "text"}
                            value={profileForm[key as ProfileFieldKey]}
                            onChange={(event) => updateField(key as ProfileFieldKey, event.target.value)}
                            maxLength={key === "registrationNumber" || key === "licenseNumber" ? 100 : 150}
                          />
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Educational Details</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {[
                        ["mbbsCollegeName", "MBBS College Name"],
                        ["mbbsUniversity", "MBBS University"],
                        ["mbbsGraduationYear", "MBBS Graduation Year"],
                        ["higherQualificationInstitution", "Higher Qualification Institution"],
                        ["higherQualificationCompletionYear", "Completion Year"],
                      ].map(([key, label]) => (
                        <div key={key}>
                          <Label htmlFor={key}>{label}</Label>
                          <InputField
                            id={key}
                            name={key}
                            type={key === "mbbsGraduationYear" || key === "higherQualificationCompletionYear" ? "text" : "text"}
                            value={profileForm[key as ProfileFieldKey]}
                            onChange={(event) => updateField(key as ProfileFieldKey, event.target.value)}
                            maxLength={150}
                          />
                        </div>
                      ))}
                      <div>
                        <Label htmlFor="higherQualification">Higher Qualification</Label>
                        <select
                          id="higherQualification"
                          name="higherQualification"
                          value={profileForm.higherQualification}
                          onChange={(event) => updateField("higherQualification", event.target.value)}
                          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-hidden focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                        >
                          <option value="">Select</option>
                          {LOVS.higherQualification.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Contact Information</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {[
                        ["mobileNumber", "Mobile Number"],
                        ["alternateMobileNumber", "Alternate Mobile Number"],
                        ["officialEmail", "Official Email"],
                        ["personalEmail", "Personal Email"],
                      ].map(([key, label]) => (
                        <div key={key}>
                          <Label htmlFor={key}>{label}</Label>
                          {key.includes("Mobile") ? (
                            <PhoneInputField
                              id={key}
                              value={profileForm[key as ProfileFieldKey]}
                              onChange={(val) => updateField(key as ProfileFieldKey, val)}
                            />
                          ) : (
                            <InputField
                              id={key}
                              name={key}
                              type={key.includes("Email") ? "email" : "text"}
                              value={profileForm[key as ProfileFieldKey]}
                              onChange={(event) => updateField(key as ProfileFieldKey, event.target.value)}
                              maxLength={key.includes("Email") ? 255 : 10}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Emergency Contacts</h3>
                      <Button type="button" variant="outline" onClick={addEmergencyContact}>
                        Add Contact
                      </Button>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
                      <div className="grid grid-cols-3 gap-0 border-b border-gray-200 bg-gray-100 px-3 py-2 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:border-gray-800">
                        <span>Name</span>
                        <span>Relationship</span>
                        <span>Phone</span>
                      </div>
                      {profileForm.emergencyContacts.map((contact, index) => (
                        <div key={index} className="grid grid-cols-3 gap-0 border-b border-gray-200 px-3 py-3 dark:border-gray-800">
                          <div>
                            <InputField
                              id={`emergency-name-${index}`}
                              name={`emergency-name-${index}`}
                              type="text"
                              value={contact.name}
                              onChange={(event) => updateEmergencyContact(index, "name", event.target.value)}
                              placeholder="Name"
                            />
                          </div>
                          <div>
                            <InputField
                              id={`emergency-relationship-${index}`}
                              name={`emergency-relationship-${index}`}
                              type="text"
                              value={contact.relationship}
                              onChange={(event) => updateEmergencyContact(index, "relationship", event.target.value)}
                              placeholder="Relationship"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <PhoneInputField
                                id={`emergency-phone-${index}`}
                                value={contact.phone}
                                onChange={(val) => updateEmergencyContact(index, "phone", val)}
                                placeholder="Phone"
                              />
                            </div>
                            {profileForm.emergencyContacts.length > 1 ? (
                              <button type="button" className="text-sm text-red-600" onClick={() => removeEmergencyContact(index)}>
                                Remove
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Address Information</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <Label htmlFor="address">Address</Label>
                        <InputField id="address" name="address" type="text" value={profileForm.address} onChange={(event) => updateField("address", event.target.value)} maxLength={255} />
                      </div>
                      {[
                        ["city", "City"],
                        ["state", "State"],
                        ["country", "Country"],
                        ["pincode", "Pincode"],
                      ].map(([key, label]) => (
                        <div key={key}>
                          <Label htmlFor={key}>{label}</Label>
                          <InputField
                            id={key}
                            name={key}
                            type={key === "pincode" ? "text" : "text"}
                            value={profileForm[key as ProfileFieldKey]}
                            onChange={(event) => updateField(key as ProfileFieldKey, event.target.value)}
                            maxLength={key === "pincode" ? 10 : 100}
                          />
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Work Experience</h3>
                        <p className="text-xs text-gray-500">Total experience: {totalExperience}</p>
                      </div>
                      <Button type="button" variant="outline" onClick={addWorkExperience}>
                        Add Row
                      </Button>
                    </div>
                    <div className="space-y-4">
                      {profileForm.workExperiences.map((experience, index) => (
                        <div key={index} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            {[
                              ["hospitalName", "Hospital Name"],
                              ["designation", "Designation"],
                              ["department", "Department"],
                            ].map(([key, label]) => (
                              <div key={key}>
                                <Label htmlFor={`${key}-${index}`}>{label}</Label>
                                <InputField
                                  id={`${key}-${index}`}
                                  name={`${key}-${index}`}
                                  type="text"
                                  value={experience[key as keyof WorkExperience]}
                                  onChange={(event) => updateWorkExperience(index, key as keyof WorkExperience, event.target.value)}
                                />
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mt-4">
                            {[
                              ["fromDate", "From Date"],
                              ["toDate", "To Date"],
                              ["location", "Location"],
                            ].map(([key, label]) => (
                              <div key={key}>
                                <Label htmlFor={`${key}-${index}`}>{label}</Label>
                                <InputField
                                  id={`${key}-${index}`}
                                  name={`${key}-${index}`}
                                  type={key === "location" ? "text" : "date"}
                                  value={experience[key as keyof WorkExperience]}
                                  onChange={(event) => updateWorkExperience(index, key as keyof WorkExperience, event.target.value)}
                                />
                              </div>
                            ))}
                          </div>
                          {profileForm.workExperiences.length > 1 ? (
                            <div className="mt-3 text-right">
                              <button type="button" className="text-sm text-red-600" onClick={() => removeWorkExperience(index)}>
                                Remove row
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Certifications</h3>
                      <Button type="button" variant="outline" onClick={addCertification}>
                        Add Row
                      </Button>
                    </div>
                    <div className="space-y-4">
                      {profileForm.certifications.map((certification, index) => (
                        <div key={index} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                              <Label htmlFor={`cert-name-${index}`}>Certification Name</Label>
                              <InputField
                                id={`cert-name-${index}`}
                                name={`cert-name-${index}`}
                                type="text"
                                value={certification.name}
                                onChange={(event) => updateCertification(index, "name", event.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor={`cert-org-${index}`}>Issuing Organization</Label>
                              <InputField
                                id={`cert-org-${index}`}
                                name={`cert-org-${index}`}
                                type="text"
                                value={certification.issuingOrganization}
                                onChange={(event) => updateCertification(index, "issuingOrganization", event.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor={`cert-issue-${index}`}>Issue Date</Label>
                              <InputField
                                id={`cert-issue-${index}`}
                                name={`cert-issue-${index}`}
                                type="date"
                                value={certification.issueDate}
                                onChange={(event) => updateCertification(index, "issueDate", event.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor={`cert-expiry-${index}`}>Expiry Date</Label>
                              <InputField
                                id={`cert-expiry-${index}`}
                                name={`cert-expiry-${index}`}
                                type="date"
                                value={certification.expiryDate}
                                onChange={(event) => updateCertification(index, "expiryDate", event.target.value)}
                              />
                            </div>
                          </div>
                          {profileForm.certifications.length > 1 ? (
                            <div className="mt-3 text-right">
                              <button type="button" className="text-sm text-red-600" onClick={() => removeCertification(index)}>
                                Remove row
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Bank Details</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {[
                        ["bankName", "Bank Name"],
                        ["accountHolderName", "Account Holder Name"],
                        ["accountNumber", "Account Number"],
                        ["ifscCode", "IFSC Code"],
                        ["panNumber", "PAN Number"],
                        ["aadhaarNumber", "Aadhaar Number"],
                      ].map(([key, label]) => (
                        <div key={key}>
                          <Label htmlFor={key}>{label}</Label>
                          <InputField
                            id={key}
                            name={key}
                            type={key === "accountNumber" || key === "aadhaarNumber" ? "text" : "text"}
                            value={profileForm[key as ProfileFieldKey]}
                            onChange={(event) => updateField(key as ProfileFieldKey, event.target.value)}
                            maxLength={key === "accountNumber" ? 20 : key === "ifscCode" || key === "panNumber" ? 11 : 150}
                          />
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Documents</h3>
                      <Button type="button" variant="outline" onClick={() => setProfileForm((current) => ({
                        ...current,
                        documents: [...current.documents, { name: "", attachment: "", fileName: "" }],
                      }))}>
                        Add Document
                      </Button>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
                      <div className="grid grid-cols-12 gap-0 border-b border-gray-200 bg-gray-100 px-3 py-2 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:border-gray-800">
                        <span className="col-span-4">Document Name</span>
                        <span className="col-span-5">Attachment</span>
                        <span className="col-span-3 text-right">Actions</span>
                      </div>
                      {profileForm.documents.map((document, index) => (
                        <div key={index} className="grid grid-cols-12 gap-3 border-b border-gray-200 px-3 py-3 dark:border-gray-800">
                          <div className="col-span-4">
                            <InputField
                              id={`document-name-${index}`}
                              name={`document-name-${index}`}
                              type="text"
                              value={document.name}
                              onChange={(event) => updateDocumentName(index, event.target.value)}
                              placeholder="Document name"
                            />
                          </div>
                          <div className="col-span-5">
                            <div className="flex items-center gap-3">
                              <label className="flex h-11 flex-1 items-center rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-600 transition hover:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90">
                                <span className="truncate">{document.fileName || "Upload file..."}</span>
                                <input
                                  type="file"
                                  accept="application/pdf,image/*"
                                  className="hidden"
                                  onChange={(event) => handleDocumentUpload(index, event.target.files?.[0] ?? null)}
                                />
                              </label>
                            </div>
                          </div>
                          <div className="col-span-3 flex items-center justify-end">
                            {profileForm.documents.length > 1 ? (
                              <button
                                type="button"
                                className="text-sm text-red-600"
                                onClick={() => setProfileForm((current) => ({
                                  ...current,
                                  documents: current.documents.filter((_, idx) => idx !== index),
                                }))}
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
                <div className="md:col-span-1 flex items-start">
                  <div className="sticky top-0 flex w-full flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-950">
                      {profileForm.profilePhoto ? (
                        <Image src={profileForm.profilePhoto} alt="Profile preview" width={96} height={96} className="h-full w-full object-cover" unoptimized />
                      ) : (
                        <span className="text-xs text-gray-400">Photo</span>
                      )}
                    </div>
                    <label className="cursor-pointer rounded-lg bg-brand-500 px-3 py-2 text-xs font-medium text-white transition hover:bg-brand-600">
                      Upload Photo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => handleProfilePhotoUpload(event.target.files?.[0] ?? null)}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setProfileModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
