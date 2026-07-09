"use client";

import { useEffect, useMemo, useState } from "react";
import { Country, State, City } from "country-state-city";
import { useParams } from "next/navigation";
import { PatientProfileLayout } from "../../../components/patient-profile-layout";

type ProfileFormValues = {
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
  profession: string;
  preferredPaymentType: string;
  mediclaimPolicyAvailable: string;
  policyDetails: string;
  linkedPatientId: string;
  relationshipShipLinkedPatient: string;
  activeFrom: string;
  inactiveFrom: string;
  inactiveReason: string;
};

const EMPTY_VALUES: ProfileFormValues = {
  patientId: "", patientName: "", dob: "", gender: "", address: "", country: "", state: "", city: "",
  zipCode: "", email: "", phoneOffice: "", phoneResi: "", mobile: "", hnNumber: "", profession: "", preferredPaymentType: "",
  mediclaimPolicyAvailable: "", policyDetails: "", linkedPatientId: "", relationshipShipLinkedPatient: "",
  activeFrom: "", inactiveFrom: "", inactiveReason: "",
};

function fromRow(row: Record<string, unknown>): ProfileFormValues {
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
    profession: String(row.profession ?? ""),
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

export default function PatientProfilePage() {
  const params = useParams();
  const hname = params?.Hname ? decodeURIComponent(params.Hname as string) : "";
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patientData, setPatientData] = useState<ProfileFormValues>(EMPTY_VALUES);
  const [originalData, setOriginalData] = useState<ProfileFormValues>(EMPTY_VALUES);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedCountryCode, setSelectedCountryCode] = useState("");
  const [selectedStateCode, setSelectedStateCode] = useState("");

  const countries = useMemo(() => Country.getAllCountries(), []);
  const states = useMemo(
    () => (selectedCountryCode ? State.getStatesOfCountry(selectedCountryCode) : []),
    [selectedCountryCode],
  );
  const cities = useMemo(
    () => (selectedCountryCode && selectedStateCode ? City.getCitiesOfState(selectedCountryCode, selectedStateCode) : []),
    [selectedCountryCode, selectedStateCode],
  );

  useEffect(() => {
    if (!hname) return;
    async function loadProfile() {
      try {
        const phone = window.localStorage.getItem("patientPhone") ?? "";
        const name = window.localStorage.getItem("patientName") ?? "";

        const response = await fetch(`/api/${encodeURIComponent(hname)}/patient-auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "signin", phone, name }),
        });

        const data = await response.json();
        if (data.row) {
          const values = fromRow(data.row);
          setPatientData(values);
          setOriginalData(values);

          // Pre-set location codes if data exists
          const country = countries.find(c => c.name === values.country);
          if (country) {
            setSelectedCountryCode(country.isoCode);
            const stateList = State.getStatesOfCountry(country.isoCode);
            const state = stateList.find(s => s.name === values.state);
            if (state) setSelectedStateCode(state.isoCode);
          }
        }
      } catch (e) {
        setError("Failed to load profile data.");
      } finally {
        setLoading(false);
      }
    }
    void loadProfile();
  }, [hname, countries]);

  const updateField = (field: keyof ProfileFormValues, value: string) => {
    setPatientData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleCountryChange = (name: string) => {
    const country = countries.find(c => c.name === name);
    setSelectedCountryCode(country?.isoCode ?? "");
    setSelectedStateCode("");
    updateField("country", name);
    updateField("state", "");
    updateField("city", "");
  };

  const handleStateChange = (name: string) => {
    const state = states.find(s => s.name === name);
    setSelectedStateCode(state?.isoCode ?? "");
    updateField("state", name);
    updateField("city", "");
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/${encodeURIComponent(hname)}/patient-auth`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: originalData.mobile,
          patient: patientData,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to update profile.");

      const values = fromRow(data.row);
      setPatientData(values);
      setOriginalData(values);
      setIsEditing(false);
      setMessage("Profile updated successfully!");

      // Update local storage if name changed
      if (values.patientName && values.patientName !== window.localStorage.getItem("patientName")) {
        window.localStorage.setItem("patientName", values.patientName);
        window.dispatchEvent(new Event("storage"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  };

  const InfoItem = ({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) => (
    <div className="flex flex-col gap-1 p-4 rounded-2xl bg-gray-50/50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800 transition-all hover:shadow-sm">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
        {icon}
        {label}
      </div>
      <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
        {value || "—"}
      </div>
    </div>
  );

  const SectionHeader = ({ title, icon }: { title: string; icon: React.ReactNode }) => (
    <div className="flex items-center gap-3 mb-4 px-2">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
    </div>
  );

  const inputCls = "h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white";
  const labelCls = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400";

  if (loading) {
    return (
      <PatientProfileLayout activeTab="edit" hname={hname}>
        <div className="flex items-center justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-500" />
        </div>
      </PatientProfileLayout>
    );
  }

  return (
    <PatientProfileLayout activeTab="edit" hname={hname}>
      <div className="mx-auto max-w-5xl">
        {/* Header Section */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 text-2xl font-bold text-white shadow-lg shadow-brand-500/20">
              {patientData.patientName.slice(0, 1).toUpperCase() || "P"}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{patientData.patientName}</h2>
              <p className="text-sm text-gray-500">Member since {new Date(originalData.activeFrom || Date.now()).toLocaleDateString()}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (isEditing) {
                setPatientData(originalData);
                setIsEditing(false);
              } else {
                setIsEditing(true);
              }
              setMessage(null);
              setError(null);
            }}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all active:scale-95 shadow-md ${isEditing
                ? "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                : "bg-brand-500 text-white hover:bg-brand-600 shadow-brand-500/30"
              }`}
          >
            {isEditing ? (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.035H3v-3.572L16.732 3.732z" />
                </svg>
                Edit Profile
              </>
            )}
          </button>
        </div>

        {/* Success/Error Message */}
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

        {isEditing ? (
          /* Edit Mode Form */
          <div className="space-y-10 rounded-3xl border border-gray-200/80 bg-white/50 p-8 backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/50 shadow-xl">
            {/* General Section */}
            <div>
              <SectionHeader title="General Information" icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>} />
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className={labelCls}>Patient Name</label>
                  <input readOnly value={patientData.patientName} className={`${inputCls} bg-gray-50 opacity-70`} />
                </div>
                <div>
                  <label className={labelCls}>Date of Birth</label>
                  <input type="date" value={patientData.dob} onChange={e => updateField("dob", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Gender</label>
                  <select value={patientData.gender} onChange={e => updateField("gender", e.target.value)} className={inputCls}>
                    <option value="">Select Gender</option>
                    {["Male", "Female", "Others"].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Profession</label>
                  <input value={patientData.profession} onChange={e => updateField("profession", e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>

            {/* Contact Section */}
            <div>
              <SectionHeader title="Contact Details" icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>} />
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className={labelCls}>Mobile Number</label>
                  <input readOnly value={patientData.mobile} className={`${inputCls} bg-gray-50 opacity-70`} />
                </div>
                <div>
                  <label className={labelCls}>Email Address</label>
                  <input type="email" value={patientData.email} onChange={e => updateField("email", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Phone (Office)</label>
                  <input type="tel" value={patientData.phoneOffice} onChange={e => updateField("phoneOffice", e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>

            {/* Location Section */}
            <div>
              <SectionHeader title="Location Info" icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                <div className="md:col-span-2 lg:col-span-3">
                  <label className={labelCls}>Full Address</label>
                  <input value={patientData.address} onChange={e => updateField("address", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Country</label>
                  <select value={patientData.country} onChange={e => handleCountryChange(e.target.value)} className={inputCls}>
                    <option value="">Select Country</option>
                    {countries.map(c => <option key={c.isoCode} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>State</label>
                  <select value={patientData.state} onChange={e => handleStateChange(e.target.value)} className={inputCls}>
                    <option value="">Select State</option>
                    {states.map(s => <option key={s.isoCode} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>City</label>
                  <select value={patientData.city} onChange={e => updateField("city", e.target.value)} className={inputCls}>
                    <option value="">Select City</option>
                    {cities.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>ZIP / Postal Code</label>
                  <input value={patientData.zipCode} onChange={e => updateField("zipCode", e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>

            {/* Others Section */}
            <div>
              <SectionHeader title="Other Details" icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className={labelCls}>HN Number</label>
                  <input value={patientData.hnNumber} onChange={e => updateField("hnNumber", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Preferred Payment</label>
                  <select value={patientData.preferredPaymentType} onChange={e => updateField("preferredPaymentType", e.target.value)} className={inputCls}>
                    <option value="">Select</option>
                    {["Cash", "Card"].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Mediclaim Policy</label>
                  <select value={patientData.mediclaimPolicyAvailable} onChange={e => updateField("mediclaimPolicyAvailable", e.target.value)} className={inputCls}>
                    <option value="">Select</option>
                    {["Yes", "No"].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                {patientData.mediclaimPolicyAvailable === "Yes" && (
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className={labelCls}>Policy Details</label>
                    <textarea rows={3} value={patientData.policyDetails} onChange={e => updateField("policyDetails", e.target.value)} className={`${inputCls} h-auto py-3`} />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setPatientData(originalData);
                  setIsEditing(false);
                }}
                className="rounded-xl border border-gray-200 px-8 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 transition dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                Discard Changes
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-brand-500 px-10 py-3 text-sm font-bold text-white shadow-lg shadow-brand-500/25 hover:bg-brand-600 transition disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>
        ) : (
          /* View Mode */
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {/* General Card */}
            <div className="rounded-3xl border border-gray-200/80 bg-white/50 p-6 backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/50 shadow-sm transition-all hover:shadow-md">
              <SectionHeader title="General" icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>} />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <InfoItem label="Name" value={patientData.patientName} />
                <InfoItem label="Birth Date" value={patientData.dob} />
                <InfoItem label="Gender" value={patientData.gender} />
                <InfoItem label="Profession" value={patientData.profession} />
              </div>
            </div>

            {/* Contact Card */}
            <div className="rounded-3xl border border-gray-200/80 bg-white/50 p-6 backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/50 shadow-sm transition-all hover:shadow-md">
              <SectionHeader title="Contact" icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>} />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <InfoItem label="Mobile" value={patientData.mobile} />
                <InfoItem label="Email" value={patientData.email} />
                <InfoItem label="Office" value={patientData.phoneOffice} />
                <InfoItem label="Residence" value={patientData.phoneResi} />
              </div>
            </div>

            {/* Location Card */}
            <div className="rounded-3xl border border-gray-200/80 bg-white/50 p-6 backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/50 shadow-sm transition-all hover:shadow-md md:col-span-2">
              <SectionHeader title="Location" icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2 lg:col-span-2">
                  <InfoItem label="Address" value={patientData.address} />
                </div>
                <InfoItem label="City" value={patientData.city} />
                <InfoItem label="State" value={patientData.state} />
                <InfoItem label="Country" value={patientData.country} />
                <InfoItem label="ZIP Code" value={patientData.zipCode} />
              </div>
            </div>

            {/* Others Card */}
            <div className="rounded-3xl border border-gray-200/80 bg-white/50 p-6 backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/50 shadow-sm transition-all hover:shadow-md md:col-span-2">
              <SectionHeader title="Others" icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <InfoItem label="HN Number" value={patientData.hnNumber} />
                <InfoItem label="Preferred Payment" value={patientData.preferredPaymentType} />
                <InfoItem label="Mediclaim" value={patientData.mediclaimPolicyAvailable} />
                {patientData.mediclaimPolicyAvailable === "Yes" && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <InfoItem label="Policy Details" value={patientData.policyDetails} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PatientProfileLayout>
  );
}
