"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Country, State, City } from "country-state-city";
import { ComponentCard } from "../../../components/component-card";
import { InputField } from "../../../components/ui/input-field";
import { Label } from "../../../components/ui/label";
import { Button } from "../../../components/ui/button";
import { tableNameFromCardTitle } from "../../../lib/master-form-table";

/* ── types ── */
type PatientRow = { id: number; name: string; phone: string; gender: string };

type RegForm = {
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
  patientType: string;
  preferredPaymentType: string;
  mediclaimPolicyAvailable: string;
  policyDetails: string;
};

function emptyReg(mobile = ""): RegForm {
  return {
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
    mobile,
    hnNumber: "",
    profession: "",
    patientType: "",
    preferredPaymentType: "",
    mediclaimPolicyAvailable: "",
    policyDetails: "",
  };
}

/* ── constants ── */
const PATIENT_TABLE = tableNameFromCardTitle("Patient Registration");
const STORAGE_PREFIX = "book-appointment-patient";

function storageKey(hname: string) {
  return `${STORAGE_PREFIX}:${hname}`;
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "").trim();
}

async function fetchPatientRows(hname: string): Promise<PatientRow[]> {
  const res = await fetch(
    `/api/${encodeURIComponent(hname)}/forms/${PATIENT_TABLE}`,
    { method: "GET", cache: "no-store" },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { rows?: Array<Record<string, unknown>> };
  return (data.rows ?? [])
    .map((row) => ({
      id: Number(row.id ?? 0),
      name: String(row.patient_name ?? row.patientName ?? ""),
      phone: String(row.mobile ?? ""),
      gender: String(row.gender ?? ""),
    }))
    .filter((r) => r.id && r.name);
}

/* ══════════════════════════════════════════════════════ */
export default function PatientLoginPage() {
  const router = useRouter();
  const params = useParams();
  const hname = params?.Hname ? decodeURIComponent(params.Hname as string) : null;
  const redirectPath = hname
    ? `/${encodeURIComponent(hname)}/patient-dashboard`
    : "/patient-dashboard";

  /* ── login step state ── */
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [patientRows, setPatientRows] = useState<PatientRow[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ── registration step state ── */
  const [step, setStep] = useState<"login" | "register">("login");
  const [regForm, setRegForm] = useState<RegForm>(emptyReg());
  const [regError, setRegError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  /* ── country / state / city ── */
  const [countries] = useState(() => Country.getAllCountries());
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);

  /* load patient records for phone-check */
  useEffect(() => {
    if (!hname) return;
    setIsLoadingPatients(true);
    fetchPatientRows(hname)
      .then((rows) => setPatientRows(rows))
      .catch(() => setPatientRows([]))
      .finally(() => setIsLoadingPatients(false));
  }, [hname]);

  /* ── step 1: phone + OTP submit ── */
  const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const normalizedPhone = normalizePhone(phone);
      if (!normalizedPhone) {
        setError("Please enter a valid phone number.");
        return;
      }

      const matched = patientRows.find(
        (row) => normalizePhone(row.phone) === normalizedPhone,
      );

      if (matched) {
        /* phone found → log in */
        const payload = { id: matched.id, name: matched.name, phone: matched.phone, gender: matched.gender };
        localStorage.setItem(storageKey(hname ?? ""), JSON.stringify(payload));
        localStorage.setItem("patientName", matched.name);
        localStorage.setItem("patientPhone", matched.phone);
        localStorage.setItem("patientGender", matched.gender);
        router.push(redirectPath);
      } else {
        /* phone NOT found → go to registration step with phone prefilled */
        setRegForm(emptyReg(normalizedPhone));
        setStep("register");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── step 2: register and redirect ── */
  const handleRegisterSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setRegError(null);
    setIsSaving(true);
    try {
      const res = await fetch(`/api/${encodeURIComponent(hname ?? "")}/patient-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "signup",
          phone: regForm.mobile,
          patient: regForm,
        }),
      });
      const data = (await res.json()) as {
        row?: Record<string, unknown>;
        patientId?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Registration failed.");

      const rowId = data.patientId ?? Number(data.row?.id ?? 0);
      const payload = { id: rowId, name: regForm.patientName, phone: regForm.mobile, gender: regForm.gender };
      localStorage.setItem(storageKey(hname ?? ""), JSON.stringify(payload));
      localStorage.setItem("patientName", regForm.patientName);
      localStorage.setItem("patientPhone", regForm.mobile);
      localStorage.setItem("patientGender", regForm.gender);

      router.push(redirectPath);
    } catch (err) {
      setRegError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setIsSaving(false);
    }
  };

  const updateReg = (field: keyof RegForm, value: string) =>
    setRegForm((f) => ({ ...f, [field]: value }));

  const handleCountryChange = (countryName: string) => {
    const found = countries.find((c) => c.name === countryName);
    updateReg("country", countryName);
    updateReg("state", "");
    updateReg("city", "");
    setStates(found ? State.getStatesOfCountry(found.isoCode) : []);
    setCities([]);
  };

  const handleStateChange = (stateName: string) => {
    const foundCountry = countries.find((c) => c.name === regForm.country);
    const foundState = states.find((s) => s.name === stateName);
    updateReg("state", stateName);
    updateReg("city", "");
    setCities(
      foundCountry && foundState
        ? City.getCitiesOfState(foundCountry.isoCode, foundState.isoCode)
        : [],
    );
  };

  /* ══════════════════ RENDER ══════════════════ */

  /* ── Registration form (step 2) ── */
  if (step === "register") {
    return (
      <div className="flex min-h-[80vh] items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <ComponentCard
            title="Complete Registration"
            desc={`Mobile ${regForm.mobile} is not registered. Fill in your details to create an account.`}
          >
            <form onSubmit={(e) => void handleRegisterSubmit(e)} className="space-y-5">
              {regError ? (
                <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
                  {regError}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                <div>
                  <Label htmlFor="reg-name">Patient Name <span className="text-error-500">*</span></Label>
                  <input
                    id="reg-name"
                    value={regForm.patientName}
                    onChange={(e) => updateReg("patientName", e.target.value)}
                    required
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    placeholder="Full name"
                  />
                </div>

                <div>
                  <Label htmlFor="reg-mobile">Mobile</Label>
                  <input
                    id="reg-mobile"
                    value={regForm.mobile}
                    readOnly
                    className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-500 shadow-theme-xs"
                  />
                </div>

                <div>
                  <Label htmlFor="reg-dob">Date of Birth</Label>
                  <input
                    id="reg-dob"
                    type="date"
                    value={regForm.dob}
                    onChange={(e) => updateReg("dob", e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>

                <div>
                  <Label htmlFor="reg-gender">Gender</Label>
                  <select
                    id="reg-gender"
                    value={regForm.gender}
                    onChange={(e) => updateReg("gender", e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  >
                    <option value="">Select Gender</option>
                    {["Male", "Female", "Others"].map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="reg-address">Address</Label>
                  <textarea
                    id="reg-address"
                    rows={2}
                    value={regForm.address}
                    onChange={(e) => updateReg("address", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    placeholder="Full address"
                  />
                </div>

                {/* ── Country / State / City / ZIP ── */}
                <div>
                  <Label htmlFor="reg-country">Country</Label>
                  <select
                    id="reg-country"
                    value={regForm.country}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  >
                    <option value="">Select Country</option>
                    {countries.map((c) => (
                      <option key={c.isoCode} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="reg-state">State</Label>
                  <select
                    id="reg-state"
                    value={regForm.state}
                    onChange={(e) => handleStateChange(e.target.value)}
                    disabled={!regForm.country}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">Select State</option>
                    {states.map((s) => (
                      <option key={s.isoCode} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="reg-city">City</Label>
                  <select
                    id="reg-city"
                    value={regForm.city}
                    onChange={(e) => updateReg("city", e.target.value)}
                    disabled={!regForm.state}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">Select City</option>
                    {cities.map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="reg-zip">ZIP Code</Label>
                  <input
                    id="reg-zip"
                    value={regForm.zipCode}
                    onChange={(e) => updateReg("zipCode", e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    placeholder="ZIP / Postal code"
                  />
                </div>
                {/* ── end Country / State / City / ZIP ── */}

                <div>
                  <Label htmlFor="reg-email">Email</Label>
                  <input
                    id="reg-email"
                    type="email"
                    value={regForm.email}
                    onChange={(e) => updateReg("email", e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <Label htmlFor="reg-profession">Profession</Label>
                  <input
                    id="reg-profession"
                    value={regForm.profession}
                    onChange={(e) => updateReg("profession", e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    placeholder="Occupation"
                  />
                </div>

                <div>
                  <Label htmlFor="reg-phone-office">Phone (Office)</Label>
                  <input
                    id="reg-phone-office"
                    value={regForm.phoneOffice}
                    onChange={(e) => updateReg("phoneOffice", e.target.value.replace(/\D/g, "").slice(0, 10))}
                    inputMode="numeric"
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    placeholder="Office number"
                  />
                </div>

                <div>
                  <Label htmlFor="reg-phone-resi">Phone (Resi)</Label>
                  <input
                    id="reg-phone-resi"
                    value={regForm.phoneResi}
                    onChange={(e) => updateReg("phoneResi", e.target.value.replace(/\D/g, "").slice(0, 10))}
                    inputMode="numeric"
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    placeholder="Residence number"
                  />
                </div>

                <div>
                  <Label htmlFor="reg-hn">HN Number</Label>
                  <input
                    id="reg-hn"
                    value={regForm.hnNumber}
                    onChange={(e) => updateReg("hnNumber", e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    placeholder="HN Number"
                  />
                </div>

              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep("login")}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Back
                </button>
                <Button type="submit" disabled={isSaving} className="flex-1">
                  {isSaving ? "Saving…" : "Register & Continue"}
                </Button>
              </div>
            </form>
          </ComponentCard>
        </div>
      </div>
    );
  }

  /* ── Login form (step 1) ── */
  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="w-full max-w-md">
        <ComponentCard
          title="Patient Login"
          desc="Enter your registered mobile number to sign in."
        >
          <form onSubmit={(e) => void handleLoginSubmit(e)} className="space-y-5">
            {error ? (
              <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
                {error}
              </div>
            ) : null}

            <div>
              <Label htmlFor="phone">Mobile Number</Label>
              <InputField
                id="phone"
                name="phone"
                type="tel"
                placeholder="Enter 10-digit mobile number"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                  setError(null);
                }}
                required
              />
              {isLoadingPatients ? (
                <p className="mt-1 text-xs text-gray-400">Loading patient records…</p>
              ) : null}
            </div>

            <div>
              <Label htmlFor="otp">OTP</Label>
              <InputField
                id="otp"
                name="otp"
                type="text"
                inputMode="numeric"
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
              />
              <p className="mt-1 text-xs text-gray-400">
                Enter any value — OTP verification is not active yet.
              </p>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={isSubmitting || isLoadingPatients}
                className="w-full"
              >
                {isSubmitting ? "Checking…" : "Continue"}
              </Button>
            </div>
          </form>
        </ComponentCard>
      </div>
    </div>
  );
}