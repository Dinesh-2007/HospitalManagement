"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Country, State, City } from "country-state-city";
import { ComponentCard } from "../../../components/component-card";
import { InputField } from "../../../components/ui/input-field";
import { Label } from "../../../components/ui/label";
import { Button } from "../../../components/ui/button";
import { PhoneInputField } from "../../../components/ui/phone-input";
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
  return value.trim();
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
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showOtpField, setShowOtpField] = useState(false);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);

  const [showNotRegisteredPopup, setShowNotRegisteredPopup] = useState(false);
  const [notRegisteredPhone, setNotRegisteredPhone] = useState<string>("");

  /* ── registration step state ── */
  const [step, setStep] = useState<"login" | "register">("login");
  const [regForm, setRegForm] = useState<RegForm>(emptyReg());
  const [regError, setRegError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  /* ── country / state / city ── */
  const [countries] = useState(() => Country.getAllCountries());
  const [states, setStates] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);

  /* ── login/signup intent ── */
  const [otpIntent, setOtpIntent] = useState<"signin" | "signup">("signin");
  const [pendingPatient, setPendingPatient] = useState<PatientRow | null>(null);

  /* ── step 1: Send OTP button ── */
  const handleSendOtp = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    setOtpMessage(null);

    try {
      const normalizedPhone = normalizePhone(phone);
      if (!normalizedPhone) {
        setError("Please enter a valid phone number.");
        return;
      }
      if (!hname) {
        setError("Tenant is missing.");
        return;
      }

      const res = await fetch(`/api/${encodeURIComponent(hname)}/patient-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "signin",
          phone: normalizedPhone,
        }),
      });

      const data = (await res.json()) as {
        exists?: boolean;
        row?: Record<string, unknown> | null;
        patientId?: number | null;
        error?: string;
      };

      if (!res.ok) {
        setNotRegisteredPhone(normalizedPhone);
        setShowNotRegisteredPopup(true);
        return;
      }

      if (data.exists) {
        const row = data.row ?? null;
        const patient: PatientRow = {
          id: Number(row?.id ?? data.patientId ?? 0),
          name: String(row?.patient_name ?? row?.patientName ?? ""),
          phone: String(row?.mobile ?? row?.phone ?? normalizedPhone),
          gender: String(row?.gender ?? ""),
        };
        setPendingPatient(patient);
        setOtpIntent("signin");
        setShowOtpField(true);
        setOtpMessage("OTP sent successfully");
      } else {
        setNotRegisteredPhone(normalizedPhone);
        setShowNotRegisteredPopup(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePopupSignup = () => {
    const normalizedPhone = normalizePhone(phone);
    setShowNotRegisteredPopup(false);
    setNotRegisteredPhone("");

    setOtpIntent("signup");
    setPendingPatient(null);

    // Keep step as "login", but show OTP field
    setStep("login");
    setOtp("");
    setShowOtpField(true);
    setOtpMessage("OTP sent successfully");
  };

  const handlePopupChangeNumber = () => {
    setShowNotRegisteredPopup(false);
    setNotRegisteredPhone("");
    setPhone(""); // Clear phone as well
    setOtp("");
    setShowOtpField(false);
    setOtpMessage(null);
    setOtpIntent("signin");
    setPendingPatient(null);
    setError(null);
    setStep("login");
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
    setStates(found ? (State.getStatesOfCountry(found.isoCode).map((s: any) => String(s.name)) as string[]) : []);
    setCities([]);
  };

  const handleStateChange = (stateName: string) => {
    updateReg("state", stateName);
    updateReg("city", "");
    const foundCountry = countries.find((c) => c.name === regForm.country);
    // Since we only store state names (string[]), derive cities with a lookup
    const statesForCountry = foundCountry ? State.getStatesOfCountry(foundCountry.isoCode) : [];
    const foundState = statesForCountry.find((s: any) => s.name === stateName);
    setCities(
      foundCountry && foundState
        ? (City.getCitiesOfState(foundCountry.isoCode, foundState.isoCode).map((c: any) => String(c.name)) as string[])
        : [],
    );
  };

  /* ══════════════════ RENDER ══════════════════ */

  /* ── Registration step (step 2) ── */
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
                  <Label htmlFor="reg-name">
                    Patient Name <span className="text-error-500">*</span>
                  </Label>
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
                  <div className="pointer-events-none opacity-70">
                    <PhoneInputField
                      value={regForm.mobile}
                      onChange={() => {}}
                    />
                  </div>
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
                      <option key={g} value={g}>
                        {g}
                      </option>
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
                      <option key={c.isoCode} value={c.name}>
                        {c.name}
                      </option>
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
                      <option key={s} value={s}>
                        {s}
                      </option>
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
                      <option key={c} value={c}>
                        {c}
                      </option>
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
                  <PhoneInputField
                    value={regForm.phoneOffice}
                    onChange={(val) => updateReg("phoneOffice", val)}
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" disabled={isSaving} className="w-full">
                  {isSaving ? "Creating Account..." : "Create Account & Login"}
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
          desc="Enter your mobile number. OTP will appear only if number is registered."
        >
          <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
            {error ? (
              <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
                {error}
              </div>
            ) : null}

            <div>
              <Label htmlFor="phone">Mobile Number</Label>
              <div className={showOtpField ? "pointer-events-none opacity-70" : ""}>
                <PhoneInputField
                  value={phone}
                  onChange={(val) => {
                    if (showOtpField) return;
                    setPhone(val);
                    setError(null);
                  }}
                />
              </div>
            </div>

            {/* OTP is hidden on initial screen */}
            {showOtpField ? (
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
                />
                {otpMessage ? (
                  <p className="mt-2 text-sm text-brand-700 font-medium">{otpMessage}</p>
                ) : null}
              </div>
            ) : null}

            <div className="pt-2">
              {showOtpField ? (
                <Button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    if (otpIntent === "signin") {
                      if (!pendingPatient) return;
                      const payload = {
                        id: pendingPatient.id,
                        name: pendingPatient.name,
                        phone: pendingPatient.phone,
                        gender: pendingPatient.gender,
                      };
                      localStorage.setItem(storageKey(hname ?? ""), JSON.stringify(payload));
                      localStorage.setItem("patientName", pendingPatient.name);
                      localStorage.setItem("patientPhone", pendingPatient.phone);
                      localStorage.setItem("patientGender", pendingPatient.gender);
                      router.push(redirectPath);
                    } else {
                      // signup: transition to registration form
                      setRegForm(emptyReg(normalizePhone(phone)));
                      setStep("register");
                    }
                  }}
                  className="w-full"
                >
                  Continue
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={isSubmitting}
                  onClick={(e) => void handleSendOtp(e)}
                  className="w-full"
                >
                  {isSubmitting ? "Checking…" : "Send OTP"}
                </Button>
              )}
            </div>
          </form>

          {/* Popup: not registered */}
          {showNotRegisteredPopup ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-md rounded-xl bg-white shadow-lg border border-gray-200 p-5">
                <div className="text-sm text-gray-700">
                  The number <span className="font-semibold">{notRegisteredPhone}</span> is not yet
                  registered would you like to signup?
                </div>
                <div className="mt-4 flex gap-3">
                  <Button type="button" onClick={handlePopupSignup} className="flex-1">
                    Signup
                  </Button>
                  <Button type="button" onClick={handlePopupChangeNumber} className="flex-1">
                    Change number
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </ComponentCard>
      </div>
    </div>
  );
}