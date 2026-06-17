"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Country, State, City } from "country-state-city";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { BlankPage } from "../../../components/blank-page";

type PatientFormValues = {
  patientId: string;
  patientName: string;
  dob: string;
  gender: string;
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

const EMPTY_VALUES: PatientFormValues = {
  patientId: "",
  patientName: "",
  dob: "",
  gender: "",
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

function toInputDateTime(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toInputDate(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function fromRow(row: Record<string, unknown> | null | undefined): PatientFormValues {
  return {
    patientId: String(row?.patient_id ?? row?.patientId ?? ""),
    patientName: String(row?.patient_name ?? row?.patientName ?? ""),
    dob: toInputDate(row?.dob ?? row?.date_of_birth ?? row?.dateOfBirth),
    gender: String(row?.gender ?? ""),
    address: String(row?.address ?? ""),
    country: String(row?.country ?? ""),
    state: String(row?.state ?? ""),
    city: String(row?.city ?? ""),
    zipCode: String(row?.zip_code ?? row?.zipCode ?? ""),
    email: String(row?.email ?? ""),
    phoneOffice: String(row?.phone_office ?? row?.phoneOffice ?? ""),
    phoneResi: String(row?.phone_resi ?? row?.phoneResi ?? ""),
    mobile: String(row?.mobile ?? ""),
    hnNumber: String(row?.hn_number ?? row?.hnNumber ?? ""),
    numberOfVisits: String(row?.number_of_visits ?? row?.numberOfVisits ?? ""),
    lastVisitDateTime: toInputDateTime(row?.last_visit_date_time ?? row?.lastVisitDateTime),
    lastVisitDoctorName: String(row?.last_visit_doctor_name ?? row?.lastVisitDoctorName ?? ""),
    profession: String(row?.profession ?? ""),
    patientType: String(row?.patient_type ?? row?.patientType ?? ""),
    preferredPaymentType: String(row?.preferred_payment_type ?? row?.preferredPaymentType ?? ""),
    mediclaimPolicyAvailable: String(row?.mediclaim_policy_available ?? row?.mediclaimPolicyAvailable ?? ""),
    policyDetails: String(row?.policy_details ?? row?.policyDetails ?? ""),
    linkedPatientId: String(row?.linked_patient_id ?? row?.linkedPatientId ?? ""),
    relationshipShipLinkedPatient: String(row?.relationship_ship_linked_patient ?? row?.relationshipShipLinkedPatient ?? ""),
    activeFrom: toInputDateTime(row?.active_from ?? row?.activeFrom),
    inactiveFrom: toInputDateTime(row?.inactive_from ?? row?.inactiveFrom),
    inactiveReason: String(row?.inactive_reason ?? row?.inactiveReason ?? ""),
  };
}

export default function PatientRegistrationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const hname = params?.Hname as string;
  const isEditMode = searchParams?.get("mode") === "edit";

  const [patientTypeOptions, setPatientTypeOptions] = useState<string[]>([]);
  const [selectedCountryCode, setSelectedCountryCode] = useState("");
  const [selectedStateCode, setSelectedStateCode] = useState("");
  const [formValues, setFormValues] = useState<PatientFormValues>(EMPTY_VALUES);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPatientTypes() {
      if (!hname) return;
      try {
        const response = await fetch(`/api/${hname}/forms/patient_type`, { method: "GET", cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { rows?: Array<Record<string, unknown>> };
        const types = (data.rows ?? [])
          .map((row) => {
            const typeCode = String(row.type_code ?? row.typeCode ?? "").trim();
            const description = String(row.description ?? "").trim();
            return typeCode ? (description ? `${typeCode} - ${description}` : typeCode) : "";
          })
          .filter(Boolean);
        setPatientTypeOptions(types);
      } catch (loadError) {
        console.error("Failed to fetch patient types", loadError);
      }
    }

    void loadPatientTypes();
  }, [hname]);

  useEffect(() => {
    const countries = Country.getAllCountries();
    if (!formValues.country) return;
    const country = countries.find((item) => item.name === formValues.country);
    setSelectedCountryCode(country?.isoCode ?? "");
  }, [formValues.country]);

  useEffect(() => {
    if (!formValues.country || !formValues.state) return;
    const states = State.getStatesOfCountry(selectedCountryCode);
    const state = states.find((item) => item.name === formValues.state);
    setSelectedStateCode(state?.isoCode ?? "");
  }, [formValues.country, formValues.state, selectedCountryCode]);

  useEffect(() => {
    async function loadCurrentPatient() {
      if (!isEditMode || !hname) {
        setIsLoading(false);
        return;
      }

      try {
        const storedPhone = typeof window === "undefined" ? "" : window.localStorage.getItem("patientPhone") ?? "";
        const storedName = typeof window === "undefined" ? "" : window.localStorage.getItem("patientName") ?? "";
        if (!storedPhone && !storedName) {
          throw new Error("No logged-in patient found.");
        }

        const response = await fetch(`/api/${hname}/patient-auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "signin", phone: storedPhone, name: storedName }),
        });

        const data = (await response.json()) as { row?: Record<string, unknown>; error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load patient profile.");
        }

        setFormValues(fromRow(data.row));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load patient profile.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadCurrentPatient();
  }, [hname, isEditMode]);

  const countries = useMemo(() => Country.getAllCountries(), []);
  const states = useMemo(
    () => (selectedCountryCode ? State.getStatesOfCountry(selectedCountryCode) : []),
    [selectedCountryCode],
  );
  const cities = useMemo(
    () => (selectedCountryCode && selectedStateCode ? City.getCitiesOfState(selectedCountryCode, selectedStateCode) : []),
    [selectedCountryCode, selectedStateCode],
  );

  const updateField = (field: keyof PatientFormValues, value: string) => {
    setFormValues((current) => ({ ...current, [field]: value }));
    setMessage(null);
    setError(null);
  };

  const handleCountryChange = (countryName: string) => {
    const country = countries.find((item) => item.name === countryName);
    setSelectedCountryCode(country?.isoCode ?? "");
    setSelectedStateCode("");
    updateField("country", countryName);
    updateField("state", "");
    updateField("city", "");
  };

  const handleStateChange = (stateName: string) => {
    const state = states.find((item) => item.name === stateName);
    setSelectedStateCode(state?.isoCode ?? "");
    updateField("state", stateName);
    updateField("city", "");
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const patientRegistrationFields = useMemo(
    () => [
      { id: "patientId", label: "Patient ID", type: "display", size: "small", placeholder: "Auto-generated on check-in", hint: "Auto-generated when the patient checks in for the first time." },
      { id: "patientName", label: "Patient Name", type: "text", maxLength: 500, pattern: "[a-zA-Z\\s]*", size: "medium" },
      { id: "dob", label: "Date of Birth", type: "date", size: "small" },
      {
        id: "gender",
        label: "Gender",
        type: "select",
        options: ["Male", "Female", "Others"],
      },
      { id: "address", label: "Address", type: "textarea", size: "medium" },
      {
        id: "country",
        label: "Country",
        type: "select",
        options: countries.map((country) => country.name),
        onChange: handleCountryChange,
      },
      {
        id: "state",
        label: "State",
        type: "select",
        options: states.map((state) => state.name),
        onChange: handleStateChange,
      },
      {
        id: "city",
        label: "City",
        type: "select",
        options: cities.map((city) => city.name),
      },
      { id: "zipCode", label: "ZIP Code", type: "text", maxLength: 6, pattern: "[0-9]{6}", inputMode: "numeric", size: "small" },
      { id: "email", label: "eMail", type: "text", maxLength: 255, size: "medium" },
      { id: "phoneOffice", label: "Phone - Office", type: "text", maxLength: 10, pattern: "[0-9]{10}", inputMode: "tel", size: "small" },
      { id: "phoneResi", label: "Phone - Resi", type: "text", maxLength: 10, pattern: "[0-9]{10}", inputMode: "tel", size: "small" },
      { id: "mobile", label: "Mobile", type: "text", maxLength: 10, pattern: "[0-9]{10}", inputMode: "tel", size: "small" },
      { id: "hnNumber", label: "HN Number", type: "text", maxLength: 50, size: "small" },
      {
        id: "numberOfVisits",
        label: "Number of Visits till now",
        type: "number",
        min: 0,
        size: "small",
      },
      {
        id: "lastVisitDateTime",
        label: "Last Visit Date & Time",
        type: "datetime-local",
      },
      {
        id: "lastVisitDoctorName",
        label: "Last visit doctor name",
        type: "text",
        maxLength: 255,
        size: "medium",
      },
      { id: "profession", label: "Profession", type: "text", maxLength: 255, size: "medium" },
      {
        id: "patientType",
        label: "Patient Type",
        type: "select",
        options: patientTypeOptions,
      },
      {
        id: "preferredPaymentType",
        label: "Preferred Payment Type",
        type: "select",
        options: ["Cash", "Card"],
      },
      {
        id: "mediclaimPolicyAvailable",
        label: "Mediclaim Policy Available",
        type: "select",
        options: ["Yes", "No"],
      },
      {
        id: "policyDetails",
        label: "Policy Details",
        type: "textarea",
        fullWidth: true,
      },
      {
        id: "linkedPatientId",
        label: "Linked Patient Id",
        type: "select",
        options: ["P1001", "P1002", "P1003", "P1004"],
      },
      {
        id: "relationshipShipLinkedPatient",
        label: "Relation Ship - Linked Patient",
        type: "select",
        options: ["Spouse", "Child", "Parent", "Sibling"],
        note: "",
      },
      { id: "activeFrom", label: "Active From", type: "datetime-local" },
      { id: "inactiveFrom", label: "Inactive From", type: "datetime-local" },
      {
        id: "inactiveReason",
        label: "Inactive Reason",
        type: "textarea",
        fullWidth: true,
      },
    ],
    [cities, countries, patientTypeOptions, states],
  );


  async function handleSave() {
    if (!hname) return;
    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/${hname}/patient-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", ...formValues }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to save patient.");
      setMessage("Patient details saved successfully.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save patient.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <BlankPage title="Patient Registration">
      <section className="rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-5">
          <h3 className="text-base font-medium text-gray-800">Patient Registration</h3>
          <p className="mt-1 text-sm text-gray-500">
            {isEditMode ? "Edit your existing profile details." : "Create or update patient details."}
          </p>
        </div>

        <div className="p-4 sm:p-6">
          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="patientId">Patient ID</label>
                <input id="patientId" value={formValues.patientId} onChange={(e) => updateField("patientId", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="patientName">Patient Name</label>
                <input id="patientName" value={formValues.patientName} onChange={(e) => updateField("patientName", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="dob">Date of Birth</label>
                <input id="dob" type="date" value={formValues.dob} onChange={(e) => updateField("dob", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="gender">Gender</label>
                <select id="gender" value={formValues.gender} onChange={(e) => updateField("gender", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs">
                  <option value="">Select Gender</option>
                  {["Male", "Female", "Others"].map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="address">Address</label>
                <textarea id="address" rows={3} value={formValues.address} onChange={(e) => updateField("address", e.target.value)} className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 shadow-theme-xs" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="country">Country</label>
                <select id="country" value={formValues.country} onChange={(e) => handleCountryChange(e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs">
                  <option value="">Select Country</option>
                  {countries.map((country) => <option key={country.isoCode} value={country.name}>{country.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="state">State</label>
                <select id="state" value={formValues.state} onChange={(e) => handleStateChange(e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs">
                  <option value="">Select State</option>
                  {states.map((state) => <option key={state.isoCode} value={state.name}>{state.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="city">City</label>
                <select id="city" value={formValues.city} onChange={(e) => updateField("city", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs">
                  <option value="">Select City</option>
                  {cities.map((city) => <option key={city.name} value={city.name}>{city.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="zipCode">ZIP Code</label>
                <input id="zipCode" value={formValues.zipCode} inputMode="numeric" onChange={(e) => updateField("zipCode", e.target.value.replace(/[^0-9]/g, ""))} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="email">eMail</label>
                <input id="email" type="email" value={formValues.email} onChange={(e) => updateField("email", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="phoneOffice">Phone - Office</label>
                <input id="phoneOffice" value={formValues.phoneOffice} inputMode="numeric" onChange={(e) => updateField("phoneOffice", e.target.value.replace(/[^0-9]/g, ""))} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="phoneResi">Phone - Resi</label>
                <input id="phoneResi" value={formValues.phoneResi} inputMode="numeric" onChange={(e) => updateField("phoneResi", e.target.value.replace(/[^0-9]/g, ""))} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="mobile">Mobile</label>
                <input id="mobile" value={formValues.mobile} inputMode="numeric" onChange={(e) => updateField("mobile", e.target.value.replace(/[^0-9]/g, ""))} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="hnNumber">HN Number</label>
                <input id="hnNumber" value={formValues.hnNumber} onChange={(e) => updateField("hnNumber", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="numberOfVisits">Number of Visits till now</label>
                <input id="numberOfVisits" type="number" min={0} value={formValues.numberOfVisits} onChange={(e) => updateField("numberOfVisits", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="lastVisitDateTime">Last Visit Date & Time</label>
                <input id="lastVisitDateTime" type="datetime-local" value={formValues.lastVisitDateTime} onChange={(e) => updateField("lastVisitDateTime", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="lastVisitDoctorName">Last visit doctor name</label>
                <input id="lastVisitDoctorName" value={formValues.lastVisitDoctorName} onChange={(e) => updateField("lastVisitDoctorName", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="profession">Profession</label>
                <input id="profession" value={formValues.profession} onChange={(e) => updateField("profession", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="patientType">Patient Type</label>
                <select id="patientType" value={formValues.patientType} onChange={(e) => updateField("patientType", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs">
                  <option value="">Select Patient Type</option>
                  {patientTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="preferredPaymentType">Preferred Payment Type</label>
                <select id="preferredPaymentType" value={formValues.preferredPaymentType} onChange={(e) => updateField("preferredPaymentType", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs">
                  <option value="">Select Payment Type</option>
                  {["Cash", "Card"].map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="mediclaimPolicyAvailable">Mediclaim Policy Available</label>
                <select id="mediclaimPolicyAvailable" value={formValues.mediclaimPolicyAvailable} onChange={(e) => updateField("mediclaimPolicyAvailable", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs">
                  <option value="">Select Option</option>
                  {["Yes", "No"].map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="policyDetails">Policy Details</label>
                <textarea id="policyDetails" rows={3} value={formValues.policyDetails} onChange={(e) => updateField("policyDetails", e.target.value)} className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 shadow-theme-xs" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="linkedPatientId">Linked Patient Id</label>
                <select id="linkedPatientId" value={formValues.linkedPatientId} onChange={(e) => updateField("linkedPatientId", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs">
                  <option value="">Select Linked Patient</option>
                  {["P1001", "P1002", "P1003", "P1004"].map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="relationshipShipLinkedPatient">Relation Ship - Linked Patient</label>
                <select id="relationshipShipLinkedPatient" value={formValues.relationshipShipLinkedPatient} onChange={(e) => updateField("relationshipShipLinkedPatient", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs">
                  <option value="">Select Relationship</option>
                  {["Spouse", "Child", "Parent", "Sibling"].map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="activeFrom">Active From</label>
                <input id="activeFrom" type="datetime-local" value={formValues.activeFrom} onChange={(e) => updateField("activeFrom", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="inactiveFrom">Inactive From</label>
                <input id="inactiveFrom" type="datetime-local" value={formValues.inactiveFrom} onChange={(e) => updateField("inactiveFrom", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs" />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="inactiveReason">Inactive Reason</label>
                <textarea id="inactiveReason" rows={3} value={formValues.inactiveReason} onChange={(e) => updateField("inactiveReason", e.target.value)} className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 shadow-theme-xs" />
              </div>
            </div>

            {message ? <p className="text-sm text-green-600">{message}</p> : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <div className="flex flex-col gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() => router.back()}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void handleSave()}
                className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </BlankPage>
  );
}
