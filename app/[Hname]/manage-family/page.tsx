"use client";

import { useEffect, useMemo, useState } from "react";
import { Country, State, City } from "country-state-city";
import { useParams } from "next/navigation";
import { PageLayout } from "../../../components/page-layout";
import { PatientProfileLayout } from "../../../components/patient-profile-layout";
import { PencilIcon, TrashBinIcon } from "../../../components/icons";

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
  const [selectedCountryCode, setSelectedCountryCode] = useState("");
  const [selectedStateCode, setSelectedStateCode] = useState("");
  const [formValues, setFormValues] = useState<FamilyFormValues>(EMPTY_VALUES);

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

  const calculateAge = (dob: string) => {
    if (!dob) return "-";
    const birth = new Date(dob);
    if (Number.isNaN(birth.getTime())) return "-";
    const diff = Date.now() - birth.getTime();
    const age = new Date(diff).getUTCFullYear() - 1970;
    return Number.isFinite(age) && age >= 0 ? String(age) : "-";
  };

  useEffect(() => {
    void loadFamilyMembers();
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
            patientId: formValues.patientId,
            patientName: formValues.patientName,
            dob: formValues.dob,
            gender: formValues.gender,
            address: formValues.address,
            country: formValues.country,
            state: formValues.state,
            city: formValues.city,
            zipCode: formValues.zipCode,
            email: formValues.email,
            phoneOffice: formValues.phoneOffice,
            phoneResi: formValues.phoneResi,
            mobile: formValues.mobile,
            hnNumber: formValues.hnNumber,
            numberOfVisits: formValues.numberOfVisits,
            lastVisitDateTime: formValues.lastVisitDateTime,
            lastVisitDoctorName: formValues.lastVisitDoctorName,
            profession: formValues.profession,
            patientType: formValues.patientType,
            preferredPaymentType: formValues.preferredPaymentType,
            mediclaimPolicyAvailable: formValues.mediclaimPolicyAvailable,
            policyDetails: formValues.policyDetails,
            linkedPatientId: parentPhone || parentName,
            relationshipShipLinkedPatient: formValues.relationshipShipLinkedPatient,
            activeFrom: formValues.activeFrom,
            inactiveFrom: formValues.inactiveFrom,
            inactiveReason: formValues.inactiveReason,
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
      await loadFamilyMembers();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to add family member.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (memberId: number) => {
    if (!hname) return;
    try {
      const response = await fetch(`/api/${encodeURIComponent(hname)}/patient-auth`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: memberId }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to delete family member.");
      setMessage("Family member deleted.");
      await loadFamilyMembers();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete family member.");
    }
  };

  return (
    <PageLayout title="Patient Profile">
      <PatientProfileLayout activeTab="family" hname={hname ?? ""}>
      <section className="min-h-[80vh] rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-5">
          <h3 className="text-base font-medium text-gray-800">Manage Family member</h3>
          <p className="mt-1 text-sm text-gray-500">Family members linked to your profile.</p>
        </div>
        <div className="p-6">
          <div className="mb-6 flex justify-center">
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setFormValues(EMPTY_VALUES);
                setSelectedCountryCode("");
                setSelectedStateCode("");
                setShowForm(true);
              }}
              className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
            >
              Add New Family Member
            </button>
          </div>

          {message ? <p className="mb-4 text-sm text-green-600">{message}</p> : null}
          {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

          {loading ? (
            <p className="text-sm text-gray-500">Loading family members...</p>
          ) : familyMembers.length === 0 ? (
            <p className="text-sm text-gray-500">No family members added yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-gray-500">Name</th>
                    <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-gray-500">Relationship</th>
                    <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-gray-500">Age</th>
                    <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-gray-500">Gender</th>
                    <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {familyMembers.map((member, index) => {
                    const memberId = Number(member.id ?? index);
                    const dob = String(member.dob ?? "");
                    return (
                      <tr key={memberId}>
                        <td className="px-4 py-3 font-medium text-gray-900">{String(member.patient_name ?? "-")}</td>
                        <td className="px-4 py-3 text-gray-700">{String(member.relationship_ship_linked_patient ?? "-")}</td>
                        <td className="px-4 py-3 text-gray-700">{calculateAge(dob)}</td>
                        <td className="px-4 py-3 text-gray-700">{String(member.gender ?? "-")}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(member)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-brand-300 text-brand-600 hover:bg-brand-50"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(memberId)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-300 text-red-600 hover:bg-red-50"
                            >
                              <TrashBinIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {showForm ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4">
          <div className="mx-auto w-full max-w-6xl rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-5">
              <h3 className="text-base font-medium text-gray-800">{editingId ? "Edit Family Member" : "Add New Family Member"}</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Patient ID</label>
                  <input value={formValues.patientId} onChange={(e) => updateField("patientId", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Patient Name</label>
                  <input value={formValues.patientName} onChange={(e) => updateField("patientName", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Date of Birth</label>
                  <input type="date" value={formValues.dob} onChange={(e) => updateField("dob", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Gender</label>
                  <select value={formValues.gender} onChange={(e) => updateField("gender", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm">
                    <option value="">Select Gender</option>
                    {["Male", "Female", "Others"].map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Address</label>
                  <textarea rows={3} value={formValues.address} onChange={(e) => updateField("address", e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Country</label>
                  <select value={formValues.country} onChange={(e) => handleCountryChange(e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm">
                    <option value="">Select Country</option>
                    {countries.map((country) => <option key={country.isoCode} value={country.name}>{country.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">State</label>
                  <select value={formValues.state} onChange={(e) => handleStateChange(e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm">
                    <option value="">Select State</option>
                    {states.map((state) => <option key={state.isoCode} value={state.name}>{state.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">City</label>
                  <select value={formValues.city} onChange={(e) => updateField("city", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm">
                    <option value="">Select City</option>
                    {cities.map((city) => <option key={city.name} value={city.name}>{city.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">ZIP Code</label>
                  <input value={formValues.zipCode} onChange={(e) => updateField("zipCode", e.target.value.replace(/[^0-9]/g, ""))} className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">eMail</label>
                  <input type="email" value={formValues.email} onChange={(e) => updateField("email", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Phone - Office</label>
                  <input value={formValues.phoneOffice} onChange={(e) => updateField("phoneOffice", e.target.value.replace(/[^0-9]/g, ""))} className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Phone - Resi</label>
                  <input value={formValues.phoneResi} onChange={(e) => updateField("phoneResi", e.target.value.replace(/[^0-9]/g, ""))} className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Mobile</label>
                  <input value={formValues.mobile} onChange={(e) => updateField("mobile", e.target.value.replace(/[^0-9]/g, ""))} className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">HN Number</label>
                  <input value={formValues.hnNumber} onChange={(e) => updateField("hnNumber", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Number of Visits till now</label>
                  <input type="number" min={0} value={formValues.numberOfVisits} onChange={(e) => updateField("numberOfVisits", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Last Visit Date & Time</label>
                  <input type="datetime-local" value={formValues.lastVisitDateTime} onChange={(e) => updateField("lastVisitDateTime", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Last visit doctor name</label>
                  <input value={formValues.lastVisitDoctorName} onChange={(e) => updateField("lastVisitDoctorName", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Profession</label>
                  <input value={formValues.profession} onChange={(e) => updateField("profession", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Patient Type</label>
                  <input value={formValues.patientType} onChange={(e) => updateField("patientType", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Preferred Payment Type</label>
                  <input value={formValues.preferredPaymentType} onChange={(e) => updateField("preferredPaymentType", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Mediclaim Policy Available</label>
                  <input value={formValues.mediclaimPolicyAvailable} onChange={(e) => updateField("mediclaimPolicyAvailable", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm" />
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Policy Details</label>
                  <textarea rows={3} value={formValues.policyDetails} onChange={(e) => updateField("policyDetails", e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Linked Patient Id</label>
                  <input value={formValues.linkedPatientId} readOnly className="h-11 w-full rounded-lg border border-gray-300 bg-gray-50 px-4 text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Relationship</label>
                  <select value={formValues.relationshipShipLinkedPatient} onChange={(e) => updateField("relationshipShipLinkedPatient", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm">
                    <option value="">Select Relationship</option>
                    {["Spouse", "Child", "Parent", "Sibling", "Other"].map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Active From</label>
                  <input type="datetime-local" value={formValues.activeFrom} onChange={(e) => updateField("activeFrom", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Inactive From</label>
                  <input type="datetime-local" value={formValues.inactiveFrom} onChange={(e) => updateField("inactiveFrom", e.target.value)} className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm" />
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Inactive Reason</label>
                  <textarea rows={3} value={formValues.inactiveReason} onChange={(e) => updateField("inactiveReason", e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm" />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700"
                >
                  Cancel
                </button>
                <button type="button" onClick={() => void handleSave()} disabled={saving} className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white">
                  {saving ? "Saving..." : editingId ? "Update" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      </PatientProfileLayout>
    </PageLayout>
  );
}
