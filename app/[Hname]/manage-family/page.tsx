"use client";

import { useEffect, useMemo, useState } from "react";
import { Country, State, City } from "country-state-city";
import { useParams } from "next/navigation";
import { PatientProfileLayout } from "../../../components/patient-profile-layout";
import { PhoneInputField } from "../../../components/ui/phone-input";
import { isValidPhoneNumber } from "libphonenumber-js";

type FamilyFormValues = {
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

const EMPTY_VALUES: FamilyFormValues = {
  patientId: "", patientName: "", dob: "", gender: "", address: "", country: "", state: "", city: "",
  zipCode: "", email: "", phoneOffice: "", phoneResi: "", mobile: "", hnNumber: "", numberOfVisits: "",
  lastVisitDateTime: "", lastVisitDoctorName: "", profession: "", patientType: "", preferredPaymentType: "",
  mediclaimPolicyAvailable: "", policyDetails: "", linkedPatientId: "", relationshipShipLinkedPatient: "",
  activeFrom: "", inactiveFrom: "", inactiveReason: "",
};

function fromRow(row: Record<string, unknown>): FamilyFormValues {
  return {
    patientId: String(row.patient_id ?? ""),
    patientName: String(row.patient_name ?? ""),
    dob: String(row.dob ?? "").slice(0, 10),
    gender: String(row.gender ?? ""),
    address: String(row.address ?? ""),
    country: String(row.country ?? ""),
    state: String(row.state ?? ""),
    city: String(row.city ?? ""),
    zipCode: String(row.zip_code ?? ""),
    email: String(row.email ?? ""),
    phoneOffice: String(row.phone_office ?? ""),
    phoneResi: String(row.phone_resi ?? ""),
    mobile: String(row.mobile ?? ""),
    hnNumber: String(row.hn_number ?? ""),
    numberOfVisits: String(row.number_of_visits ?? ""),
    lastVisitDateTime: String(row.last_visit_date_time ?? "").slice(0, 16),
    lastVisitDoctorName: String(row.last_visit_doctor_name ?? ""),
    profession: String(row.profession ?? ""),
    patientType: String(row.patient_type ?? ""),
    preferredPaymentType: String(row.preferred_payment_type ?? ""),
    mediclaimPolicyAvailable: String(row.mediclaim_policy_available ?? ""),
    policyDetails: String(row.policy_details ?? ""),
    linkedPatientId: String(row.linked_patient_id ?? ""),
    relationshipShipLinkedPatient: String(row.relationship_ship_linked_patient ?? ""),
    activeFrom: String(row.active_from ?? "").slice(0, 16),
    inactiveFrom: String(row.inactive_from ?? "").slice(0, 16),
    inactiveReason: String(row.inactive_reason ?? ""),
  };
}

const RELATIONSHIP_COLORS: Record<string, string> = {
  Spouse: "bg-pink-100 text-pink-700 border-pink-200",
  Child: "bg-blue-100 text-blue-700 border-blue-200",
  Parent: "bg-purple-100 text-purple-700 border-purple-200",
  Sibling: "bg-amber-100 text-amber-700 border-amber-200",
  Other: "bg-gray-100 text-gray-700 border-gray-200",
};

function calculateAge(dob: string) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const diff = Date.now() - birth.getTime();
  const age = new Date(diff).getUTCFullYear() - 1970;
  return isFinite(age) && age >= 0 ? age : null;
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase() ?? "").join("") || "?";
}

const AVATAR_GRADIENTS = [
  "from-pink-400 to-rose-500",
  "from-violet-400 to-purple-500",
  "from-blue-400 to-indigo-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
];

export default function HospitalManageFamilyPage() {
  const params = useParams();
  const hname = params?.Hname ? decodeURIComponent(params.Hname as string) : null;
  const [showForm, setShowForm] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedCountryCode, setSelectedCountryCode] = useState("");
  const [selectedStateCode, setSelectedStateCode] = useState("");
  const [formValues, setFormValues] = useState<FamilyFormValues>(EMPTY_VALUES);
  const [showOtp, setShowOtp] = useState(false);
  const [relationshipOptions, setRelationshipOptions] = useState<string[]>([]);

  const countries = useMemo(() => Country.getAllCountries(), []);
  const states = useMemo(
    () => (selectedCountryCode ? State.getStatesOfCountry(selectedCountryCode) : []),
    [selectedCountryCode],
  );
  const cities = useMemo(
    () => (selectedCountryCode && selectedStateCode ? City.getCitiesOfState(selectedCountryCode, selectedStateCode) : []),
    [selectedCountryCode, selectedStateCode],
  );

  const loadFamilyMembers = async () => {
    if (!hname) return;
    try {
      const parentPhone = typeof window === "undefined" ? "" : window.localStorage.getItem("patientPhone") ?? "";
      const parentName = typeof window === "undefined" ? "" : window.localStorage.getItem("patientName") ?? "";
      const response = await fetch(
        `/api/${encodeURIComponent(hname)}/patient-auth?parentPhone=${encodeURIComponent(parentPhone)}&parentName=${encodeURIComponent(parentName)}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as { rows?: Record<string, unknown>[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to load family members.");
      setFamilyMembers((data.rows ?? []).filter((row) => String(row.patient_name ?? "").trim() !== ""));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load family members.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadFamilyMembers(); }, [hname]);

  useEffect(() => {
    async function loadRelationships() {
      if (!hname) return;
      try {
        const res = await fetch(`/api/${encodeURIComponent(hname)}/forms/relationship`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { rows?: Array<Record<string, unknown>> };
        const opts = (data.rows ?? [])
          .map((r) => String(r.name ?? r.relationship_name ?? "").trim())
          .filter(Boolean);
        if (opts.length > 0) setRelationshipOptions(opts);
      } catch {
        // silently ignore; fallback options are shown
      }
    }
    void loadRelationships();
  }, [hname]);

  const updateField = (field: keyof FamilyFormValues, value: string) => {
    setFormValues((current) => ({ ...current, [field]: value }));
    setError(null);
    setMessage(null);
  };

  const openEdit = (member: Record<string, unknown>) => {
    setEditingId(Number(member.id));
    setFormValues(fromRow(member));
    setSelectedCountryCode("");
    setSelectedStateCode("");
    setShowOtp(false);
    setShowForm(true);
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

  const handleSave = async () => {
    if (!hname) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    if (!isValidPhoneNumber(formValues.mobile)) {
      setError("Please enter a valid mobile number with country code.");
      setSaving(false);
      return;
    }
    try {
      const parentPhone = typeof window === "undefined" ? "" : window.localStorage.getItem("patientPhone") ?? "";
      const parentName = typeof window === "undefined" ? "" : window.localStorage.getItem("patientName") ?? "";
      const response = await fetch(`/api/${encodeURIComponent(hname)}/patient-auth`, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId ?? undefined,
          action: editingId ? undefined : "signup",
          phone: formValues.mobile,
          patient: {
            ...formValues,
            linkedPatientId: parentPhone || parentName,
          },
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to add family member.");
      setMessage(editingId ? "Family member updated." : "Family member added.");
      setShowForm(false);
      setFormValues(EMPTY_VALUES);
      setSelectedCountryCode("");
      setSelectedStateCode("");
      setEditingId(null);
      setShowOtp(false);
      await loadFamilyMembers();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to add family member.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (memberId: number) => {
    if (!hname) return;
    setDeletingId(memberId);
    try {
      const response = await fetch(`/api/${encodeURIComponent(hname)}/patient-auth`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: memberId }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to delete family member.");
      setMessage("Family member removed.");
      await loadFamilyMembers();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete family member.");
    } finally {
      setDeletingId(null);
    }
  };

  const inputCls = "h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white";
  const labelCls = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400";
  const selectCls = inputCls;
  const textareaCls = "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white";

  return (
    <PatientProfileLayout activeTab="family" hname={hname ?? ""}>
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Family</h2>
            <p className="mt-1 text-sm text-gray-500">Family members linked to your profile</p>
          </div>
          <button
            type="button"
            onClick={() => { setEditingId(null); setFormValues(EMPTY_VALUES); setSelectedCountryCode(""); setSelectedStateCode(""); setShowOtp(false); setShowForm(true); }}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-500/30 hover:bg-brand-600 transition-all active:scale-95"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Family Member
          </button>
        </div>

        {/* Status messages */}
        {message && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {message}
          </div>
        )}
        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-500" />
          </div>
        ) : familyMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-300 bg-white/60 py-24 text-center dark:border-gray-700 dark:bg-gray-900/30">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800 mb-4">
              <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">No family members yet</h3>
            <p className="mt-2 max-w-xs text-sm text-gray-400">Add your family members to book appointments for them easily.</p>
            <button
              type="button"
              onClick={() => { setEditingId(null); setFormValues(EMPTY_VALUES); setShowOtp(false); setShowForm(true); }}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add First Member
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {familyMembers.map((member, index) => {
              const memberId = Number(member.id ?? index);
              const name = String(member.patient_name ?? "Unknown");
              const relationship = String(member.relationship_ship_linked_patient ?? "");
              const dob = String(member.dob ?? "");
              const gender = String(member.gender ?? "");
              const age = calculateAge(dob);
              const initials = getInitials(name);
              const gradient = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
              const relColor = RELATIONSHIP_COLORS[relationship] ?? "bg-gray-100 text-gray-700 border-gray-200";
              const isDeleting = deletingId === memberId;

              return (
                <div
                  key={memberId}
                  className="group relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm transition-all hover:shadow-lg hover:-translate-y-1 dark:border-gray-800 dark:bg-gray-900"
                >
                  {/* Card gradient header */}
                  <div className={`h-20 bg-gradient-to-br ${gradient} relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(255,255,255,0.2),transparent_70%)]" />
                  </div>

                  {/* Avatar (overlapping) */}
                  <div className="absolute left-5 top-10">
                    <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-xl font-bold text-white shadow-md ring-4 ring-white dark:ring-gray-900`}>
                      {initials}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="absolute right-4 top-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => openEdit(member)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-gray-600 shadow hover:bg-white hover:text-brand-600 transition"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.035H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(memberId)}
                      disabled={isDeleting}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-gray-600 shadow hover:bg-white hover:text-rose-600 transition disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-rose-200 border-t-rose-500" />
                      ) : (
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Card body */}
                  <div className="px-5 pb-5 pt-12">
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">{name}</h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {relationship && (
                          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${relColor}`}>
                            {relationship}
                          </span>
                        )}
                        {gender && (
                          <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                            {gender}
                          </span>
                        )}
                        {age !== null && (
                          <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                            {age} yrs
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Mobile */}
                    {String(member.mobile ?? "") && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                        <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {String(member.mobile)}
                      </div>
                    )}

                    {/* Edit/Delete row (always visible on mobile) */}
                    <div className="mt-4 flex gap-2 sm:hidden">
                      <button type="button" onClick={() => openEdit(member)} className="flex-1 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition">
                        Edit
                      </button>
                      <button type="button" onClick={() => void handleDelete(memberId)} disabled={isDeleting} className="flex-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition disabled:opacity-50">
                        {isDeleting ? "Removing…" : "Remove"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4 pt-8">
          <div className="relative mx-auto w-full max-w-4xl rounded-3xl bg-white shadow-2xl dark:bg-gray-900 overflow-hidden">
            {/* Modal Header */}
            <div className="relative overflow-hidden px-8 py-6 bg-gradient-to-br from-brand-500 to-indigo-600">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.15),transparent_70%)]" />
              <div className="relative flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">{editingId ? "Edit Family Member" : "Add New Family Member"}</h3>
                  <p className="mt-0.5 text-sm text-brand-100/80">Fill in the details below</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); setShowOtp(false); }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-white hover:bg-white/30 transition"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Form Body */}
            <div className="p-8 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {[
                  { key: "patientName", label: "Patient Name", type: "text" },
                  { key: "dob", label: "Date of Birth", type: "date" },
                ].map(({ key, label, type }) => (
                  <div key={key}>
                    <label className={labelCls}>{label}</label>
                    <input
                      type={type}
                      value={formValues[key as keyof FamilyFormValues]}
                      onChange={(e) => updateField(key as keyof FamilyFormValues, e.target.value)}
                      className={inputCls}
                    />
                  </div>
                ))}

                {/* Mobile and OTP field */}
                <div>
                  <label className={labelCls}>Mobile</label>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <PhoneInputField
                        value={formValues.mobile}
                        onChange={(val) => {
                          updateField("mobile", val);
                          setShowOtp(false);
                        }}
                      />
                    </div>
                    {isValidPhoneNumber(formValues.mobile) && !showOtp && (
                      <button
                        type="button"
                        onClick={() => setShowOtp(true)}
                        className="h-11 rounded-xl border border-brand-300 bg-brand-50 px-4 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition whitespace-nowrap"
                      >
                        Send OTP
                      </button>
                    )}
                  </div>
                </div>

                {showOtp && (
                  <div className="animate-fadeIn">
                    <label className={labelCls}>Enter OTP</label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="Enter 6-digit OTP code"
                      className="h-11 w-full rounded-xl border border-brand-200 bg-white px-4 text-sm text-gray-900 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white bg-brand-50/10 placeholder-brand-300 font-mono tracking-widest"
                    />
                  </div>
                )}

                {[
                  { key: "email", label: "Email", type: "email" },
                  { key: "hnNumber", label: "HN Number", type: "text" },
                  { key: "profession", label: "Profession", type: "text" },
                  { key: "phoneOffice", label: "Phone - Office", type: "tel" },
                  { key: "phoneResi", label: "Phone - Resi", type: "tel" },
                ].map(({ key, label, type }) => (
                  <div key={key}>
                    <label className={labelCls}>{label}</label>
                    {type === "tel" ? (
                      <PhoneInputField
                        value={formValues[key as keyof FamilyFormValues]}
                        onChange={(val) => updateField(key as keyof FamilyFormValues, val)}
                      />
                    ) : (
                      <input
                        type={type}
                        value={formValues[key as keyof FamilyFormValues]}
                        onChange={(e) => updateField(key as keyof FamilyFormValues, e.target.value)}
                        className={inputCls}
                      />
                    )}
                  </div>
                ))}

                {/* Gender */}
                <div>
                  <label className={labelCls}>Gender</label>
                  <select value={formValues.gender} onChange={(e) => updateField("gender", e.target.value)} className={selectCls}>
                    <option value="">Select Gender</option>
                    {["Male", "Female", "Others"].map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                {/* Relationship */}
                <div>
                  <label className={labelCls}>Relationship</label>
                  <select value={formValues.relationshipShipLinkedPatient} onChange={(e) => updateField("relationshipShipLinkedPatient", e.target.value)} className={selectCls}>
                    <option value="">Select Relationship</option>
                    {(relationshipOptions.length > 0
                      ? relationshipOptions
                      : ["Spouse", "Child", "Parent", "Sibling", "Other"]
                    ).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                {/* Country */}
                <div>
                  <label className={labelCls}>Country</label>
                  <select value={formValues.country} onChange={(e) => handleCountryChange(e.target.value)} className={selectCls}>
                    <option value="">Select Country</option>
                    {countries.map((c) => <option key={c.isoCode} value={c.name}>{c.name}</option>)}
                  </select>
                </div>

                {/* State */}
                <div>
                  <label className={labelCls}>State</label>
                  <select value={formValues.state} onChange={(e) => handleStateChange(e.target.value)} className={selectCls}>
                    <option value="">Select State</option>
                    {states.map((s) => <option key={s.isoCode} value={s.name}>{s.name}</option>)}
                  </select>
                </div>

                {/* City */}
                <div>
                  <label className={labelCls}>City</label>
                  <select value={formValues.city} onChange={(e) => updateField("city", e.target.value)} className={selectCls}>
                    <option value="">Select City</option>
                    {cities.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>

                {/* ZIP */}
                <div>
                  <label className={labelCls}>ZIP Code</label>
                  <input value={formValues.zipCode} onChange={(e) => updateField("zipCode", e.target.value.replace(/[^0-9]/g, ""))} className={inputCls} />
                </div>

                {/* Address full width */}
                <div className="md:col-span-2 lg:col-span-3">
                  <label className={labelCls}>Address</label>
                  <textarea rows={2} value={formValues.address} onChange={(e) => updateField("address", e.target.value)} className={textareaCls} />
                </div>

                {/* Payment & insurance row */}
                <div>
                  <label className={labelCls}>Preferred Payment</label>
                  <select value={formValues.preferredPaymentType} onChange={(e) => updateField("preferredPaymentType", e.target.value)} className={selectCls}>
                    <option value="">Select</option>
                    {["Cash", "Card"].map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Mediclaim Policy</label>
                  <select value={formValues.mediclaimPolicyAvailable} onChange={(e) => updateField("mediclaimPolicyAvailable", e.target.value)} className={selectCls}>
                    <option value="">Select</option>
                    {["Yes", "No"].map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                {formValues.mediclaimPolicyAvailable === "Yes" && (
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className={labelCls}>Policy Details</label>
                    <textarea rows={2} value={formValues.policyDetails} onChange={(e) => updateField("policyDetails", e.target.value)} className={textareaCls} />
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>
              )}

              {/* Actions */}
              <div className="mt-8 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); setShowOtp(false); }}
                  className="rounded-xl border border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-brand-600 transition disabled:opacity-60"
                >
                  {saving ? "Saving…" : editingId ? "Update Member" : "Add Member"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PatientProfileLayout>
  );
}
