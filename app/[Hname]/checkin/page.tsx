"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Country, State, City } from "country-state-city";
import { CheckCircleIcon } from "../../../components/icons";
import { useHospitalTimezone } from "../../../components/context/HospitalTimezoneContext";
import { PhoneInputField } from "../../../components/ui/phone-input";
import { isValidPhoneNumber } from "libphonenumber-js";

type VitalsRow = Record<string, unknown> & { appointment_end_time?: string | null, appointment_check_in_time?: string | null };

function text(row: VitalsRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return "";
}

function formatDisplayTime(value: string) {
  const [hoursText, minutesText = "00"] = value.split(":");
  const date = new Date();
  date.setHours(Number(hoursText), Number(minutesText), 0, 0);
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(date).replace(/\s/g, "");
}

function formatTimeRange(start: string, end?: string | null) {
  const endText = end ? formatDisplayTime(end) : "";
  return endText ? `${formatDisplayTime(start)} - ${endText}` : formatDisplayTime(start);
}

export default function CheckInPage() {
  const params = useParams();
  const router = useRouter();
  const hname = params?.Hname as string;
  const { todayDate, timezone } = useHospitalTimezone();
  const [date, setDate] = useState(() => todayDate);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [rows, setRows] = useState<VitalsRow[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [doctorsList, setDoctorsList] = useState<{ name: string, department: string, isAvailableToday?: boolean }[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingIn, setCheckingIn] = useState<string | number | null>(null);
  const [checkInResult, setCheckInResult] = useState<{ patientId: string; appointmentNumber: string; queueId: string; patientName: string } | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  // Walk-in modal state variables
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [walkInStep, setWalkInStep] = useState<"phone" | "register" | "consultation">("phone");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [showWalkInOtp, setShowWalkInOtp] = useState(false);
  const [walkInRegForm, setWalkInRegForm] = useState<any>({
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
    profession: "",
    patientType: "Walk in",
  });
  const [walkInDept, setWalkInDept] = useState("");
  const [walkInDoctor, setWalkInDoctor] = useState("");
  const [walkInError, setWalkInError] = useState("");
  const [walkInSubmitting, setWalkInSubmitting] = useState(false);

  // Attendant state for scheduled check-in
  const [attendantCheckInRow, setAttendantCheckInRow] = useState<VitalsRow | null>(null);
  const [hasAttendant, setHasAttendant] = useState<"yes" | "no" | "">("");
  const [attendantName, setAttendantName] = useState("");
  const [attendantPhone, setAttendantPhone] = useState("");
  const [attendantGender, setAttendantGender] = useState("");
  const [attendantRelation, setAttendantRelation] = useState("");

  // Attendant state for walk-in check-in
  const [walkInHasAttendant, setWalkInHasAttendant] = useState<"yes" | "no" | "">("");
  const [walkInAttendantName, setWalkInAttendantName] = useState("");
  const [walkInAttendantPhone, setWalkInAttendantPhone] = useState("");
  const [walkInAttendantGender, setWalkInAttendantGender] = useState("");
  const [walkInAttendantRelation, setWalkInAttendantRelation] = useState("");

  const [countries] = useState(() => Country.getAllCountries());
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);

  const handleWalkInCountryChange = (countryName: string) => {
    const found = countries.find((c) => c.name === countryName);
    setWalkInRegForm((prev: any) => ({ ...prev, country: countryName, state: "", city: "" }));
    setStates(found ? State.getStatesOfCountry(found.isoCode) : []);
    setCities([]);
  };

  const handleWalkInStateChange = (stateName: string) => {
    const foundCountry = countries.find((c) => c.name === walkInRegForm.country);
    const foundState = states.find((s) => s.name === stateName);
    setWalkInRegForm((prev: any) => ({ ...prev, state: stateName, city: "" }));
    setCities(
      foundCountry && foundState
        ? City.getCitiesOfState(foundCountry.isoCode, foundState.isoCode)
        : [],
    );
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWalkInError("");
    if (!isValidPhoneNumber(walkInPhone)) {
      setWalkInError("Please enter a valid mobile number with country code.");
      return;
    }
    setWalkInSubmitting(true);
    try {
      const res = await fetch(`/api/${encodeURIComponent(hname)}/patient-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "signin", phone: walkInPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to check phone number.");

      if (data.exists && data.row) {
        // Patient exists!
        setWalkInRegForm({
          patientName: data.row.patient_name || data.row.patientName || "",
          dob: data.row.dob ? String(data.row.dob).slice(0, 10) : "",
          gender: data.row.gender || "",
          address: data.row.address || "",
          country: data.row.country || "",
          state: data.row.state || "",
          city: data.row.city || "",
          zipCode: data.row.zip_code || data.row.zipCode || "",
          email: data.row.email || "",
          phoneOffice: data.row.phone_office || data.row.phoneOffice || "",
          phoneResi: data.row.phone_resi || data.row.phoneResi || "",
          mobile: data.row.mobile || walkInPhone,
          hnNumber: data.row.hn_number || data.row.hnNumber || "",
          profession: data.row.profession || "",
          patientId: data.row.patient_id || "",
          internalId: data.row.id || "",
        });
        setWalkInStep("consultation");
      } else {
        // Patient does not exist, go to registration step
        setWalkInRegForm({
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
          mobile: walkInPhone,
          hnNumber: "",
          profession: "",
          patientType: "Walk in",
        });
        setWalkInStep("register");
      }
    } catch (err: any) {
      setWalkInError(err.message);
    } finally {
      setWalkInSubmitting(false);
    }
  };

  const handleRegisterNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkInRegForm.patientName) {
      setWalkInError("Patient Name is required.");
      return;
    }
    setWalkInStep("consultation");
  };

  const handleWalkInCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setWalkInError("");
    if (!walkInDept || !walkInDoctor) {
      setWalkInError("Please select both department and doctor.");
      return;
    }
    if (walkInHasAttendant === "yes" && (!walkInAttendantName || !walkInAttendantPhone || !walkInAttendantGender || !walkInAttendantRelation)) {
      setWalkInError("Please fill in all attendant details.");
      return;
    }
    setWalkInSubmitting(true);
    try {
      let patientId = walkInRegForm.patientId;
      let internalId = walkInRegForm.internalId;

      // If we are registering a new patient first (only if they don't exist in DB yet)
      if (walkInStep === "register" || (!patientId && !internalId)) {
        const regRes = await fetch(`/api/${encodeURIComponent(hname)}/patient-auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "signup",
            phone: walkInRegForm.mobile,
            patient: walkInRegForm,
          }),
        });
        const regData = await regRes.json();
        if (!regRes.ok) throw new Error(regData.error ?? "Failed to register patient.");
        patientId = regData.row?.patient_id || regData.patientId;
      }

      // Now perform walk-in check-in
      const checkInRes = await fetch(`/api/${encodeURIComponent(hname)}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: walkInRegForm.patientName,
          patientPhone: walkInRegForm.mobile,
          department: walkInDept,
          doctor: walkInDoctor,
          isWalkIn: true,
          patientId: patientId || internalId,
          appointmentDate: date,
          appointmentTime: new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(new Date()),
          hasAttendant: walkInHasAttendant === "yes",
          attendantName: walkInAttendantName,
          attendantPhone: walkInAttendantPhone,
          attendantGender: walkInAttendantGender,
          attendantRelation: walkInAttendantRelation,
        }),
      });
      const checkInData = await checkInRes.json();
      if (!checkInRes.ok) throw new Error(checkInData.error ?? "Failed to perform check-in.");

      setCheckInResult({
        patientId: checkInData.patientId || patientId,
        appointmentNumber: checkInData.appointmentNumber ?? "",
        queueId: checkInData.queueId ?? "",
        patientName: walkInRegForm.patientName,
      });

      setShowWalkInModal(false);
      // Reset state
      setWalkInPhone("");
      setShowWalkInOtp(false);
      setWalkInDept("");
      setWalkInDoctor("");
      setWalkInStep("phone");
      setWalkInHasAttendant("");
      setWalkInAttendantName("");
      setWalkInAttendantPhone("");
      setWalkInAttendantGender("");
      setWalkInAttendantRelation("");

      await loadPatients();
    } catch (err: any) {
      setWalkInError(err.message);
    } finally {
      setWalkInSubmitting(false);
    }
  };

  const dateLabel = useMemo(() => {
    if (!date) return "Select date";
    const [year, month, day] = date.split("-");
    return `${day}-${month}-${year}`;
  }, [date]);

  const buildVitalsUrl = useCallback((selectedDate: string, selectedDoctorName: string) => {
    const url = new URL(`/api/${encodeURIComponent(hname)}/vitals`, window.location.origin);
    if (selectedDate) url.searchParams.set("date", selectedDate);
    if (selectedDoctorName) url.searchParams.set("doctor", selectedDoctorName);
    return url.toString();
  }, [hname]);

  const loadPatients = useCallback(async () => {
    if (!hname) return;
    setLoading(true);
    try {
      const response = await fetch(buildVitalsUrl(date, "all"), { cache: "no-store" });
      const data = (await response.json()) as { rows?: VitalsRow[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to load patients.");
      setRows(data.rows ?? []);
    } finally {
      setLoading(false);
    }
  }, [buildVitalsUrl, date, hname]);

  useEffect(() => {
    void loadPatients().catch((err) => setError(err instanceof Error ? err.message : "Failed to load patients."));
  }, [loadPatients]);

  useEffect(() => {
    if (!timezone) return;
    const updateTime = () => {
      const timeStr = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      }).format(new Date());
      setCurrentTime(timeStr);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [timezone]);

  useEffect(() => {
    async function loadOptions() {
      if (!hname) return;
      try {
        const [depRes, docRes, schedRes] = await Promise.all([
          fetch(`/api/${encodeURIComponent(hname)}/forms/department_master`, { cache: "no-store" }),
          fetch(`/api/${encodeURIComponent(hname)}/forms/consultant_doctor_master`, { cache: "no-store" }),
          fetch(`/api/${encodeURIComponent(hname)}/forms/consultant_doctor_schedule`, { cache: "no-store" })
        ]);
        const depData = await depRes.json();
        const docData = await docRes.json();
        const schedData = await schedRes.json().catch(() => ({ rows: [] }));

        const deps = (depData.rows || []).map((r: any) => String(r.department_type || r.departmentType || r.department_name || r.name || r.code || "")).filter(Boolean);
        setDepartments(Array.from(new Set(deps)) as string[]);

        const todayStr = todayDate;
        const dayName = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: timezone }).format(new Date());

        const readDays = (value: any) => {
          if (Array.isArray(value)) return value.map(String).filter(Boolean);
          if (typeof value === "string" && value.trim()) {
            try {
              const parsed = JSON.parse(value);
              if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
            } catch {
              return value.replace(/[\[\]"]/g, "").split(",").map((item: string) => item.trim()).filter(Boolean);
            }
          }
          return [];
        };

        const schedules = (schedData.rows || []).map((r: any) => ({
          doctorName: String(r.consultant_doctor_name || r.consultantDoctorName || ""),
          fromDate: String(r.appointment_from_date || r.appointmentFromDate || "").split("T")[0],
          toDate: String(r.appointment_to_date || r.appointmentToDate || "").split("T")[0],
          days: readDays(r.days_available ?? r.daysAvailable)
        }));

        const isDoctorAvailable = (docName: string) => {
          const docSchedules = schedules.filter((s: any) => s.doctorName.trim().toLowerCase() === docName.trim().toLowerCase());
          if (docSchedules.length === 0) return false;

          return docSchedules.some((s: any) => {
            if (s.fromDate && s.fromDate !== "undefined" && todayStr < s.fromDate) return false;
            if (s.toDate && s.toDate !== "undefined" && todayStr > s.toDate) return false;
            if (s.days.length > 0 && !s.days.includes(dayName)) return false;
            return true;
          });
        };

        const docs = (docData.rows || []).map((r: any) => {
          const name = String(r.doctor_consultant_name || r.doctorConsultantName || r.consultant_doctor_name || r.name || "");
          return {
            name,
            department: String(r.clinic || r.department || r.department_type || r.departmentType || ""),
            isAvailableToday: isDoctorAvailable(name)
          };
        }).filter((r: any) => r.name);

        setDoctorsList(docs);
      } catch (err) {
        console.error(err);
      }
    }
    void loadOptions();
  }, [hname]);

  const filteredRows = useMemo(() => {
    // Show all records (both scheduled and walk-in)
    let result = rows;

    if (selectedDepartment) {
      result = result.filter((row) => text(row, ["department"]) === selectedDepartment);
    }
    if (selectedDoctor) {
      result = result.filter((row) => text(row, ["doctor"]) === selectedDoctor);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((row) => {
        const pName = text(row, ["registration_patient_name", "appointment_patient_name", "patient_name"]).toLowerCase();
        const dName = text(row, ["doctor"]).toLowerCase();
        return pName.includes(q) || dName.includes(q);
      });
    }
    result = [...result].sort((a, b) => {
      const aChecked = !!a.appointment_check_in_time;
      const bChecked = !!b.appointment_check_in_time;

      if (aChecked !== bChecked) {
        return aChecked ? 1 : -1;
      }

      const timeA = text(a, ["appointment_time"]);
      const timeB = text(b, ["appointment_time"]);
      if (!timeA && !timeB) return 0;
      if (!timeA) return 1;
      if (!timeB) return -1;
      return timeA.localeCompare(timeB);
    });
    return result;
  }, [rows, searchQuery, selectedDepartment, selectedDoctor]);

  const handleCheckIn = async (row: VitalsRow, attendantDetails?: { hasAttendant: boolean; attendantName: string; attendantPhone: string; attendantGender: string; attendantRelation: string }) => {
    const patientName = text(row, ["registration_patient_name", "appointment_patient_name", "patient_name"]);
    const doctor = text(row, ["doctor"]);
    const department = text(row, ["department"]);
    const patientPhone = text(row, ["patient_phone", "mobile"]);
    const id = row.appointment_id as string | number;

    setCheckingIn(id);
    setError("");
    setCheckInResult(null);

    try {
      const res = await fetch(`/api/${encodeURIComponent(hname)}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName,
          patientPhone,
          department,
          doctor,
          appointmentId: id,
          appointmentDate: text(row, ["appointment_date"]) || date,
          hasAttendant: attendantDetails?.hasAttendant,
          attendantName: attendantDetails?.attendantName,
          attendantPhone: attendantDetails?.attendantPhone,
          attendantGender: attendantDetails?.attendantGender,
          attendantRelation: attendantDetails?.attendantRelation,
        }),
      });

      const data = await res.json() as { error?: string; patientId?: string; appointmentNumber?: string; queueId?: string; patientName?: string };

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to check-in.");
      }

      if (data.patientId) {
        setCheckInResult({
          patientId: data.patientId,
          appointmentNumber: data.appointmentNumber ?? "",
          queueId: data.queueId ?? "",
          patientName: data.patientName ?? patientName,
        });
      }

      setAttendantCheckInRow(null);
      await loadPatients();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setCheckingIn(null);
    }
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-800 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-medium text-gray-800 dark:text-white/90">Check-in Portal</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">View scheduled patients and mark their check-in status.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden flex-col items-end sm:flex bg-gray-50 px-4 py-1.5 rounded-lg border border-gray-200 shadow-theme-xs">
            <span className="text-sm font-semibold text-gray-800">{dateLabel}</span>
            {currentTime && <span className="text-xs text-brand-600 font-bold font-mono tracking-tight">{currentTime}</span>}
          </div>
          <button
            onClick={() => {
              setWalkInError("");
              setWalkInPhone("");
              setShowWalkInOtp(false);
              setWalkInDept("");
              setWalkInDoctor("");
              setWalkInStep("phone");
              setShowWalkInModal(true);
            }}
            className="h-11 rounded-lg bg-brand-500 px-6 text-sm font-medium text-white transition hover:bg-brand-600 focus:outline-hidden focus:ring-3 focus:ring-brand-500/25"
          >
            Add Walk-in
          </button>
        </div>
      </div>
      <div className="p-4 sm:p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Removed Walked-in and Back buttons from here */}
            </div>
            <div className="flex flex-1 items-center gap-3 justify-end">
              <input
                type="text"
                placeholder="Search patient..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 w-full max-w-xs rounded-lg border border-gray-300 px-4 text-sm focus:border-brand-500 focus:ring-brand-500"
              />
              <select
                value={selectedDepartment}
                onChange={(e) => { setSelectedDepartment(e.target.value); setSelectedDoctor(""); }}
                className="h-11 w-full max-w-[200px] rounded-lg border border-gray-300 bg-white px-4 text-sm"
              >
                <option value="">All Departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select
                value={selectedDoctor}
                onChange={(e) => setSelectedDoctor(e.target.value)}
                className="h-11 w-full max-w-[200px] rounded-lg border border-gray-300 bg-white px-4 text-sm"
              >
                <option value="">All Doctors</option>
                {doctorsList
                  .filter(d => !selectedDepartment || d.department === selectedDepartment)
                  .map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
              </select>
            </div>
          </div>

          {error ? <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div> : null}

          {checkInResult ? (
            <div className="flex items-start justify-between gap-4 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
              <div>
                <span className="font-semibold">Check-in successful!</span>
                {" "}{checkInResult.patientName && <span>Patient: <span className="font-medium">{checkInResult.patientName}</span> — </span>}
                Patient ID: <span className="font-mono font-semibold">{checkInResult.patientId}</span>
                {checkInResult.appointmentNumber && <> &nbsp;·&nbsp; Ref. No.: <span className="font-mono font-semibold">{checkInResult.appointmentNumber}</span></>}
                {checkInResult.queueId && <> &nbsp;·&nbsp; Queue ID: <span className="font-mono font-semibold">{checkInResult.queueId}</span></>}
              </div>
              <button type="button" onClick={() => setCheckInResult(null)} className="shrink-0 text-success-600 hover:text-success-800">✕</button>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">Patient</th>
                  <th className="px-4 py-3 text-left">Patient ID</th>
                  <th className="px-4 py-3 text-left">Ref. No.</th>
                  <th className="px-4 py-3 text-left">Queue ID</th>
                  <th className="px-4 py-3 text-left">Doctor</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">Slot</th>
                  <th className="px-4 py-3 text-left">Attendant</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td className="px-4 py-6 text-gray-500 text-center" colSpan={10}>Loading...</td></tr>
                ) : filteredRows.length === 0 ? (
                  <tr><td className="px-4 py-6 text-gray-500 text-center" colSpan={10}>No scheduled patients found.</td></tr>
                ) : filteredRows.map((row) => {
                  const name = text(row, ["registration_patient_name", "appointment_patient_name", "patient_name"]);
                  const isCheckedIn = !!row.appointment_check_in_time;
                  const rowId = row.appointment_id as string | number;
                  const isRowCheckingIn = checkingIn === rowId;
                  const rawPid = text(row, ["registration_patient_id", "appointment_patient_id", "patient_id"]);
                  const displayPatientId = rawPid && isNaN(Number(rawPid)) ? rawPid : "";
                  const pType = text(row, ["patient_type"]) || "scheduled";
                  const apptDate = text(row, ["appointment_date"]);
                  const dateCompact = apptDate ? apptDate.slice(0, 10).replace(/-/g, "") : "";
                  const appointmentIdDisplay = pType === "walk-in"
                    ? (text(row, ["appointment_id_display"]) || (row.appointment_number ? (dateCompact ? `WK-${dateCompact}-${String(row.appointment_number).padStart(4, "0")}` : `WK-${String(row.appointment_number).padStart(4, "0")}`) : "-"))
                    : (text(row, ["appointment_id_display"]) || (row.appointment_number ? (dateCompact ? `APT-${dateCompact}-${String(row.appointment_number).padStart(4, "0")}` : `APT-${String(row.appointment_number).padStart(4, "0")}`) : "-"));
                  const queueIdDisplay = text(row, ["queue_id"]) || "-";
                  const visits = Number(row.number_of_visits || 0);

                  return (
                    <tr key={String(row.appointment_id ?? row.registration_id ?? name)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800">{name}</span>
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${visits > 1 ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                            {visits > 1 ? "Old" : "New"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {displayPatientId
                          ? <span className="font-mono text-xs text-brand-700 bg-brand-50 rounded px-2 py-0.5">{displayPatientId}</span>
                          : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-gray-600">{appointmentIdDisplay}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-indigo-600">{queueIdDisplay}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-medium">{text(row, ["doctor"])}</td>
                      <td className="px-4 py-3 text-gray-600 capitalize">
                        {text(row, ["patient_type"]) || "scheduled"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{text(row, ["appointment_date"])}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {text(row, ["appointment_time"])
                          ? formatTimeRange(text(row, ["appointment_time"]), text(row, ["appointment_end_time"]) || null)
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{text(row, ["time_slot_minutes"]) ? `${text(row, ["time_slot_minutes"])} min` : "-"}</td>
                      <td className="px-4 py-3 text-gray-600 font-medium">{isCheckedIn ? (row.has_attendant ? "Yes" : "No") : "-"}</td>
                      <td className="px-4 py-3">
                        {isCheckedIn ? (
                          getStageBadge(
                            row.appointment_status === "Scheduled" || row.appointment_status === "Rescheduled"
                              ? "Checked In"
                              : String(row.appointment_status || "Checked In")
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setAttendantCheckInRow(row);
                              setHasAttendant("");
                              setAttendantName("");
                              setAttendantPhone("");
                              setAttendantGender("");
                              setAttendantRelation("");
                            }}
                            disabled={isRowCheckingIn}
                            className="rounded-full border border-brand-300 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100 transition disabled:opacity-50"
                          >
                            {isRowCheckingIn ? "Checking..." : "Check-in"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* Attendant Check-in Modal */}
      {attendantCheckInRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">Attendant Information</h3>
            <div className="mb-4 text-sm text-gray-600">
              Is an attendant accompanying the patient?
              <div className="flex items-center gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="hasAttendant" value="yes" checked={hasAttendant === "yes"} onChange={(e) => setHasAttendant(e.target.value as any)} className="text-brand-600 focus:ring-brand-500 h-4 w-4" /> Yes
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="hasAttendant" value="no" checked={hasAttendant === "no"} onChange={(e) => setHasAttendant(e.target.value as any)} className="text-brand-600 focus:ring-brand-500 h-4 w-4" /> No
                </label>
              </div>
            </div>

            {hasAttendant === "yes" && (
              <div className="space-y-4 mb-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Attendant Name <span className="text-red-500">*</span></label>
                  <input type="text" value={attendantName} onChange={(e) => setAttendantName(e.target.value)} required className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Phone Number <span className="text-red-500">*</span></label>
                  <PhoneInputField value={attendantPhone} onChange={setAttendantPhone} required />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Gender <span className="text-red-500">*</span></label>
                  <select value={attendantGender} onChange={(e) => setAttendantGender(e.target.value)} required className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm">
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Relation <span className="text-red-500">*</span></label>
                  <input type="text" value={attendantRelation} onChange={(e) => setAttendantRelation(e.target.value)} required className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm" />
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-4 border-t border-gray-100 dark:border-gray-800">
              <button type="button" onClick={() => setAttendantCheckInRow(null)} className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (hasAttendant === "") {
                    setError("Please select whether there is an attendant.");
                    return;
                  }
                  if (hasAttendant === "yes" && (!attendantName || !attendantPhone || !attendantGender || !attendantRelation)) {
                    setError("Please fill in all attendant details.");
                    return;
                  }
                  handleCheckIn(attendantCheckInRow, {
                    hasAttendant: hasAttendant === "yes",
                    attendantName,
                    attendantPhone,
                    attendantGender,
                    attendantRelation
                  });
                }}
                disabled={hasAttendant === "" || checkingIn === attendantCheckInRow.appointment_id}
                className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition disabled:opacity-50"
              >
                {checkingIn === attendantCheckInRow.appointment_id ? "Checking..." : "Complete Check-in"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Walk-in Modal */}
      {showWalkInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
            <div className="mb-6 flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Add Walk-in Check-in</h3>
                <p className="text-xs text-gray-500">
                  {walkInStep === "phone" && "Step 1: Check patient existence by mobile number"}
                  {walkInStep === "register" && "Step 2: Register new patient details"}
                  {walkInStep === "consultation" && "Step 3: Select department and doctor to check-in"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowWalkInModal(false);
                  setWalkInStep("phone");
                  setWalkInPhone("");
                  setWalkInError("");
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {walkInError ? (
              <div className="mb-4 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
                {walkInError}
              </div>
            ) : null}

            {/* Step 1: Phone number lookup */}
            {walkInStep === "phone" && (
              <form onSubmit={handlePhoneSubmit} className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Mobile Number</label>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <PhoneInputField
                          value={walkInPhone}
                          onChange={(val) => {
                            setWalkInPhone(val);
                            setShowWalkInOtp(false);
                          }}
                          required
                          placeholder="Enter mobile number"
                        />
                      </div>
                      {isValidPhoneNumber(walkInPhone) && !showWalkInOtp && (
                        <button
                          type="button"
                          onClick={() => setShowWalkInOtp(true)}
                          className="h-11 rounded-lg border border-brand-300 bg-brand-50 px-4 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition whitespace-nowrap"
                        >
                          Send OTP
                        </button>
                      )}
                    </div>
                  </div>
                  {showWalkInOtp && (
                    <div className="animate-fadeIn">
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Enter OTP</label>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="Enter 6-digit OTP code"
                        className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm focus:border-brand-500 focus:ring-brand-500 bg-brand-50/10 placeholder-brand-300 font-mono tracking-widest"
                      />
                      <p className="mt-1 text-xs text-brand-500">OTP sent successfully! (Placeholder)</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 pt-4 justify-end border-t border-gray-100 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => setShowWalkInModal(false)}
                    className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={walkInSubmitting}
                    className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition disabled:opacity-50"
                  >
                    {walkInSubmitting ? "Checking..." : "Continue"}
                  </button>
                </div>
              </form>
            )}

            {/* Step 2: Register Patient */}
            {walkInStep === "register" && (
              <form onSubmit={handleRegisterNext} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-h-[50vh] overflow-y-auto pr-1">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Patient Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={walkInRegForm.patientName}
                      onChange={(e) => setWalkInRegForm((prev: any) => ({ ...prev, patientName: e.target.value }))}
                      placeholder="Full name"
                      className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Mobile</label>
                    <input
                      type="text"
                      readOnly
                      value={walkInRegForm.mobile}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 text-sm text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Date of Birth</label>
                    <input
                      type="date"
                      value={walkInRegForm.dob}
                      onChange={(e) => setWalkInRegForm((prev: any) => ({ ...prev, dob: e.target.value }))}
                      className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Gender</label>
                    <select
                      value={walkInRegForm.gender}
                      onChange={(e) => setWalkInRegForm((prev: any) => ({ ...prev, gender: e.target.value }))}
                      className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm"
                    >
                      <option value="">Select Gender</option>
                      {["Male", "Female", "Other"].map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Address</label>
                    <textarea
                      value={walkInRegForm.address}
                      onChange={(e) => setWalkInRegForm((prev: any) => ({ ...prev, address: e.target.value }))}
                      rows={2}
                      placeholder="Full address"
                      className="w-full rounded-lg border border-gray-300 p-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Country</label>
                    <select
                      value={walkInRegForm.country}
                      onChange={(e) => handleWalkInCountryChange(e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm"
                    >
                      <option value="">Select Country</option>
                      {countries.map((c) => (
                        <option key={c.isoCode} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">State</label>
                    <select
                      disabled={!walkInRegForm.country}
                      value={walkInRegForm.state}
                      onChange={(e) => handleWalkInStateChange(e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      <option value="">Select State</option>
                      {states.map((s) => (
                        <option key={s.isoCode} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">City</label>
                    <select
                      disabled={!walkInRegForm.state}
                      value={walkInRegForm.city}
                      onChange={(e) => setWalkInRegForm((prev: any) => ({ ...prev, city: e.target.value }))}
                      className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      <option value="">Select City</option>
                      {cities.map((c) => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">ZIP Code</label>
                    <input
                      type="text"
                      value={walkInRegForm.zipCode}
                      onChange={(e) => setWalkInRegForm((prev: any) => ({ ...prev, zipCode: e.target.value }))}
                      placeholder="ZIP / Postal code"
                      className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                    <input
                      type="email"
                      value={walkInRegForm.email}
                      onChange={(e) => setWalkInRegForm((prev: any) => ({ ...prev, email: e.target.value }))}
                      placeholder="email@example.com"
                      className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Profession</label>
                    <input
                      type="text"
                      value={walkInRegForm.profession}
                      onChange={(e) => setWalkInRegForm((prev: any) => ({ ...prev, profession: e.target.value }))}
                      placeholder="Occupation"
                      className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Phone (Office)</label>
                    <PhoneInputField
                      value={walkInRegForm.phoneOffice}
                      onChange={(val) => setWalkInRegForm((prev: any) => ({ ...prev, phoneOffice: val }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Phone (Resi)</label>
                    <PhoneInputField
                      value={walkInRegForm.phoneResi}
                      onChange={(val) => setWalkInRegForm((prev: any) => ({ ...prev, phoneResi: val }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">HN Number</label>
                    <input
                      type="text"
                      value={walkInRegForm.hnNumber}
                      onChange={(e) => setWalkInRegForm((prev: any) => ({ ...prev, hnNumber: e.target.value }))}
                      placeholder="HN Number"
                      className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-4 justify-end border-t border-gray-100 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => setWalkInStep("phone")}
                    className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition"
                  >
                    Continue
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: Consultation Check-in Details */}
            {walkInStep === "consultation" && (
              <form onSubmit={handleWalkInCheckIn} className="space-y-4">
                <div className="space-y-4">
                  <div className="p-3 bg-brand-50/50 rounded-lg text-xs space-y-1 text-gray-600">
                    <div>Patient Name: <span className="font-semibold text-gray-800">{walkInRegForm.patientName}</span></div>
                    <div>Mobile: <span className="font-mono font-semibold text-gray-800">{walkInRegForm.mobile}</span></div>
                    {walkInRegForm.patientId && <div>Patient ID: <span className="font-mono font-semibold text-gray-800">{walkInRegForm.patientId}</span></div>}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Department <span className="text-red-500">*</span></label>
                    <select
                      required
                      value={walkInDept}
                      onChange={(e) => { setWalkInDept(e.target.value); setWalkInDoctor(""); }}
                      className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm"
                    >
                      <option value="">Select Department</option>
                      {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Select Doctor <span className="text-red-500">*</span></label>
                    {walkInDept ? (
                      <div className="overflow-x-auto rounded-xl border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left">Doctor Name</th>
                              <th className="px-4 py-3 text-center">Total Appointments</th>
                              <th className="px-4 py-3 text-center">Checked-in</th>
                              <th className="px-4 py-3 text-center">Walked-out</th>
                              <th className="px-4 py-3 text-center">Remaining</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {doctorsList
                              .filter(d => d.department === walkInDept && d.isAvailableToday)
                              .map(d => {
                                const docRows = rows.filter(r => text(r, ["doctor"]) === d.name);
                                const totalAppts = docRows.length;
                                const checkedIn = docRows.filter(r => !!r.appointment_check_in_time).length;
                                const walkedOut = docRows.filter(r => {
                                  const status = text(r, ["appointment_status", "status", "vitals_status"]).toLowerCase();
                                  return status === "walked out" || status === "walkedout" || status === "completed";
                                }).length;
                                const remaining = checkedIn - walkedOut;

                                return (
                                  <tr
                                    key={d.name}
                                    onClick={() => setWalkInDoctor(d.name)}
                                    className={`cursor-pointer hover:bg-brand-50 transition ${walkInDoctor === d.name ? 'bg-brand-50 border-l-2 border-l-brand-500' : ''}`}
                                  >
                                    <td className="px-4 py-3 font-medium text-gray-800">
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="radio"
                                          name="walkInDoctor"
                                          checked={walkInDoctor === d.name}
                                          onChange={() => setWalkInDoctor(d.name)}
                                          className="h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300"
                                        />
                                        {d.name}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-center text-gray-600">{totalAppts}</td>
                                    <td className="px-4 py-3 text-center text-gray-600">{checkedIn}</td>
                                    <td className="px-4 py-3 text-center text-gray-600">{walkedOut}</td>
                                    <td className="px-4 py-3 text-center text-gray-600 font-semibold">{remaining}</td>
                                  </tr>
                                );
                              })}
                            {doctorsList.filter(d => d.department === walkInDept && d.isAvailableToday).length === 0 && (
                              <tr>
                                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">No doctors available for this department today.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 py-2 border border-dashed border-gray-200 rounded-lg text-center bg-gray-50">
                        Please select a department first to view available doctors.
                      </div>
                    )}
                  </div>
                  <div className="pt-4 border-t border-gray-100">
                    <h4 className="text-sm font-semibold text-gray-800 mb-3">Attendant Information</h4>
                    <div className="mb-4 text-sm text-gray-600">
                      Is an attendant accompanying the patient?
                      <div className="flex items-center gap-4 mt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="walkInHasAttendant" value="yes" checked={walkInHasAttendant === "yes"} onChange={(e) => setWalkInHasAttendant(e.target.value as any)} className="text-brand-600 focus:ring-brand-500 h-4 w-4" /> Yes
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="walkInHasAttendant" value="no" checked={walkInHasAttendant === "no"} onChange={(e) => setWalkInHasAttendant(e.target.value as any)} className="text-brand-600 focus:ring-brand-500 h-4 w-4" /> No
                        </label>
                      </div>
                    </div>
                    {walkInHasAttendant === "yes" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700">Attendant Name <span className="text-red-500">*</span></label>
                          <input type="text" value={walkInAttendantName} onChange={(e) => setWalkInAttendantName(e.target.value)} required className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm" />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700">Phone Number <span className="text-red-500">*</span></label>
                          <PhoneInputField value={walkInAttendantPhone} onChange={setWalkInAttendantPhone} required />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700">Gender <span className="text-red-500">*</span></label>
                          <select value={walkInAttendantGender} onChange={(e) => setWalkInAttendantGender(e.target.value)} required className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm">
                            <option value="">Select</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700">Relation <span className="text-red-500">*</span></label>
                          <input type="text" value={walkInAttendantRelation} onChange={(e) => setWalkInAttendantRelation(e.target.value)} required className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-3 pt-4 justify-end border-t border-gray-100 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => {
                      if (walkInRegForm.patientId) {
                        // Came from existing patient lookup
                        setWalkInStep("phone");
                      } else {
                        // Came from signup registration
                        setWalkInStep("register");
                      }
                    }}
                    className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={walkInSubmitting}
                    className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition disabled:opacity-50"
                  >
                    {walkInSubmitting ? "Saving..." : "Check-in"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function getStageBadge(status: string) {
  switch (status) {
    case "Checked In":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          Checked In
        </span>
      );
    case "Vitals":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          Vitals
        </span>
      );
    case "Conslt":
    case "Completed":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-4 py-1.5 text-sm font-medium text-purple-700 dark:bg-purple-900/20 dark:text-purple-300">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
          Conslt
        </span>
      );
    case "Lab":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-50 px-4 py-1.5 text-sm font-medium text-pink-700 dark:bg-pink-900/20 dark:text-pink-300">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          Lab
        </span>
      );
    case "Pharmacy":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
          </svg>
          Pharmacy
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-4 py-1.5 text-sm font-medium text-success-700 dark:bg-success-900/20 dark:text-success-300">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          {status}
        </span>
      );
  }
}

