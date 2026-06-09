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

type ProfileFieldKey =
  | "doctorId"
  | "doctorCode"
  | "firstName"
  | "lastName"
  | "gender"
  | "dateOfBirth"
  | "bloodGroup"
  | "maritalStatus"
  | "profilePhoto"
  | "mobileNumber"
  | "alternateMobileNumber"
  | "emailId"
  | "emergencyContactNumber"
  | "address"
  | "country"
  | "state"
  | "city"
  | "pincode"
  | "registrationNumber"
  | "specialization"
  | "department"
  | "qualification"
  | "experienceYears"
  | "designation"
  | "licenseNumber"
  | "employeeType"
  | "shift"
  | "bankName"
  | "accountNumber"
  | "ifscCode"
  | "panNumber"
  | "aadhaarNumber";

type ProfileFormState = Record<ProfileFieldKey, string>;

const INITIAL_PROFILE_FORM: ProfileFormState = {
  doctorId: "",
  doctorCode: "",
  firstName: "",
  lastName: "",
  gender: "",
  dateOfBirth: "",
  bloodGroup: "",
  maritalStatus: "",
  profilePhoto: "",
  mobileNumber: "",
  alternateMobileNumber: "",
  emailId: "",
  emergencyContactNumber: "",
  address: "",
  country: "",
  state: "",
  city: "",
  pincode: "",
  registrationNumber: "",
  specialization: "",
  department: "",
  qualification: "",
  experienceYears: "",
  designation: "",
  licenseNumber: "",
  employeeType: "",
  shift: "",
  bankName: "",
  accountNumber: "",
  ifscCode: "",
  panNumber: "",
  aadhaarNumber: "",
};

const LOVS = {
  gender: ["Male", "Female", "Other"],
  bloodGroup: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
  maritalStatus: ["Single", "Married", "Divorced", "Widowed"],
  country: ["India", "United States", "United Kingdom", "Other"],
  employeeType: ["Full Time", "Part Time"],
  shift: ["Morning", "Afternoon", "Evening", "Night"],
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
  { key: "profilePhoto", label: "Profile Photo", inputType: "file" },
  { key: "mobileNumber", label: "Mobile Number", inputType: "text", pattern: "[0-9]*", maxLength: 10 },
  { key: "alternateMobileNumber", label: "Alternate Mobile Number", inputType: "text", pattern: "[0-9]*", maxLength: 10 },
  { key: "emailId", label: "Email ID", inputType: "email", maxLength: 255 },
  { key: "emergencyContactNumber", label: "Emergency Contact Number", inputType: "text", pattern: "[0-9]*", maxLength: 10 },
  { key: "address", label: "Address", inputType: "text", fullWidth: true, maxLength: 255 },
  { key: "country", label: "Country", optionGroup: "country" },
  { key: "state", label: "State", optionGroup: "state" },
  { key: "city", label: "City", optionGroup: "city" },
  { key: "pincode", label: "Pincode", inputType: "text", pattern: "[0-9]*", maxLength: 10 },
  { key: "registrationNumber", label: "Registration Number (Medical Council Number)", inputType: "text", pattern: "[A-Za-z0-9-]*", maxLength: 100 },
  { key: "specialization", label: "Specialization", optionGroup: "specialization" },
  { key: "department", label: "Department", optionGroup: "department" },
  { key: "qualification", label: "Qualification", inputType: "text", maxLength: 150 },
  { key: "experienceYears", label: "Experience (Years)", inputType: "number" },
  { key: "designation", label: "Designation", inputType: "text", maxLength: 100 },
  { key: "licenseNumber", label: "License Number", inputType: "text", pattern: "[A-Za-z0-9-]*", maxLength: 100 },
  { key: "employeeType", label: "Employee Type", optionGroup: "employeeType" },
  { key: "shift", label: "Shift", optionGroup: "shift" },
  { key: "bankName", label: "Bank Name", inputType: "text", maxLength: 150 },
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
          profilePhoto: String(row.profile_photo ?? ""),
          mobileNumber: String(row.mobile_number ?? ""),
          alternateMobileNumber: String(row.alternate_mobile_number ?? ""),
          emailId: String(row.email_id ?? ""),
          emergencyContactNumber: String(row.emergency_contact_number ?? ""),
          address: String(row.address ?? ""),
          country: String(row.country ?? ""),
          state: String(row.state ?? ""),
          city: String(row.city ?? ""),
          pincode: String(row.pincode ?? ""),
          registrationNumber: String(row.registration_number ?? ""),
          specialization: String(row.specialization ?? ""),
          department: String(row.department ?? ""),
          qualification: String(row.qualification ?? ""),
          experienceYears: String(row.experience_years ?? ""),
          designation: String(row.designation ?? ""),
          licenseNumber: String(row.license_number ?? ""),
          employeeType: String(row.employee_type ?? ""),
          shift: String(row.shift ?? ""),
          bankName: String(row.bank_name ?? ""),
          accountNumber: String(row.account_number ?? ""),
          ifscCode: String(row.ifsc_code ?? ""),
          panNumber: String(row.pan_number ?? ""),
          aadhaarNumber: String(row.aadhaar_number ?? ""),
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
      const response = await fetch(`/api/${encodeURIComponent(hname)}/doctor-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profileForm, username: user }),
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
    } else if (key === "mobileNumber" || key === "alternateMobileNumber" || key === "emergencyContactNumber" || key === "pincode" || key === "accountNumber" || key === "aadhaarNumber") {
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
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded bg-white p-6 shadow-xl dark:bg-gray-900">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Doctor Profile</h2>
                <p className="text-sm text-gray-500">Only doctor accounts can access this form.</p>
              </div>
              <Button type="button" variant="outline" onClick={() => setProfileModalOpen(false)}>
                Close
              </Button>
            </div>
            {profileError ? <div className="mb-4 text-sm text-red-500">{profileError}</div> : null}
            {profileMessage ? <div className="mb-4 text-sm text-green-600">{profileMessage}</div> : null}
            <form onSubmit={handleProfileSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-start-2 md:row-start-1 md:row-span-3 md:justify-self-end">
                <div className="flex w-52 flex-col items-stretch gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
                  <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                    {profileForm.profilePhoto ? (
                      <Image src={profileForm.profilePhoto} alt="Profile preview" width={208} height={208} className="h-full w-full object-cover" unoptimized />
                    ) : (
                      <span className="text-xs text-gray-400">Photo</span>
                    )}
                  </div>
                  <label className="cursor-pointer self-center rounded-lg bg-brand-500 px-3 py-2 text-xs font-medium text-white transition hover:bg-brand-600">
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
              {doctorFields
                .filter((field) => field.key !== "profilePhoto")
                .map((field) => (
                  <div key={field.key} className={field.fullWidth ? "md:col-span-2" : undefined}>
                    <Label htmlFor={field.key}>{field.label}</Label>
                    {field.options ? (
                      <select
                        id={field.key}
                        name={field.key}
                        value={profileForm[field.key]}
                        onChange={(event) => updateField(field.key, event.target.value)}
                        className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-hidden focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                      >
                        <option value="">Select</option>
                        {field.options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <InputField
                        id={field.key}
                        name={field.key}
                        type={field.inputType ?? "text"}
                        value={profileForm[field.key]}
                        onChange={(event) => updateField(field.key, event.target.value)}
                        pattern={field.pattern}
                        maxLength={field.maxLength}
                        inputMode={
                          field.key === "mobileNumber" ||
                          field.key === "alternateMobileNumber" ||
                          field.key === "emergencyContactNumber" ||
                          field.key === "pincode" ||
                          field.key === "accountNumber" ||
                          field.key === "aadhaarNumber"
                            ? "tel"
                            : undefined
                        }
                        required={["doctorId", "doctorCode", "firstName", "lastName", "mobileNumber", "emailId", "address"].includes(field.key)}
                      />
                    )}
                  </div>
                ))}
              <div className="md:col-span-2 flex justify-end gap-2 pt-2">
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
