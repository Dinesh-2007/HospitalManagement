"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PrescriptionTable } from "./prescription-table";

type QueueTab = "Upcoming" | "Draft" | "Completed";
type DetailTab = "Patient Details" | "Vitals" | "Consultation Form" | "History";
type PatientType = "OP" | "IP";

const DETAIL_TABS: DetailTab[] = ["Patient Details", "Vitals", "Consultation Form", "History"];

type VitalsRow = Record<string, unknown> & {
  vitals_id?: number | null;
  vitals_status?: string | null;
  registration_patient_name?: string | null;
  appointment_patient_name?: string | null;
  patient_name?: string | null;
  appointment_time?: string | null;
};

type ConsultationRow = Record<string, unknown> & {
  id: number;
  status?: string;
  tokenNumber?: string;
  token_number?: string;
  patientDetails?: string;
  patient_details?: string;
  diagnosisName?: string;
  diagnosis_name?: string;
  symptoms?: string;
  remarks?: string;
  followUpDays?: string;
  follow_up_days?: string;
  consultationAmount?: string;
  consultation_amount?: string;
  prescriptionData?: string;
  prescription_data?: string;
  patientType?: string;
  patient_type?: string;
};

type AppointmentHistoryRow = Record<string, unknown> & {
  id?: number;
  appointment_date?: string;
  appointment_time?: string | null;
  appointment_end_time?: string | null;
  doctor?: string | null;
  department?: string | null;
  status?: string | null;
};

function text(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return "";
}

function isVitalsCompleted(row: VitalsRow) {
  return Boolean(row.vitals_id || row.vitals_status);
}

function patientName(row: Record<string, unknown>) {
  return text(row, ["registration_patient_name", "appointment_patient_name", "patient_name", "patient_details", "patientDetails"]);
}

function display(value: string) {
  return value || "-";
}

function formatDisplayDate(value: string) {
  const dateText = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return value;
  const [year, month, day] = dateText.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(year, month - 1, day));
}

function formatDisplayTime(value: string) {
  const [hoursText, minutesText = "00"] = value.split(":");
  const date = new Date();
  date.setHours(Number(hoursText), Number(minutesText), 0, 0);
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(date).replace(/\s/g, "");
}

export default function DoctorConsultationPage() {
  const params = useParams();
  const hname = params?.Hname as string;

  const [queueTab, setQueueTab] = useState<QueueTab>("Upcoming");
  const [detailTab, setDetailTab] = useState<DetailTab>("Patient Details");
  const [doctorsList, setDoctorsList] = useState<{ name: string }[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);

  const [vitalsRows, setVitalsRows] = useState<VitalsRow[]>([]);
  const [consultationRows, setConsultationRows] = useState<ConsultationRow[]>([]);
  const [selectedPatientRow, setSelectedPatientRow] = useState<VitalsRow | null>(null);
  const [historyRows, setHistoryRows] = useState<AppointmentHistoryRow[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [icdQuery, setIcdQuery] = useState("");
  const [icdResults, setIcdResults] = useState<any[]>([]);
  const [isIcdSearching, setIsIcdSearching] = useState(false);
  const [showIcdDropdown, setShowIcdDropdown] = useState(false);
  const [symptomOptions, setSymptomOptions] = useState<string[]>([]);

  const [editingRecordId, setEditingRecordId] = useState<number | null>(null);
  const [patientType, setPatientType] = useState<PatientType>("OP");
  const [formValues, setFormValues] = useState<Record<string, string>>({
    tokenNumber: "",
    patientDetails: "",
    diagnosisName: "",
    symptoms: "",
    remarks: "",
    instructions: "",
    followUpDays: "",
    consultationAmount: "",
    prescriptionData: "",
    sended: "",
  });

  // Fetch doctors on mount
  useEffect(() => {
    async function fetchDoctors() {
      if (!hname) return;
      try {
        const response = await fetch(`/api/${encodeURIComponent(hname)}/forms/consultant_doctor_master`, { cache: "no-store" });
        const data = await response.json();
        const docs = (data.rows || []).map((r: any) => ({
          name: String(r.doctor_consultant_name || r.doctorConsultantName || r.consultant_doctor_name || r.name || ""),
        })).filter((r: any) => r.name);
        setDoctorsList(docs);
      } catch (err) {
        console.error("Failed to load doctors", err);
      }
    }
    void fetchDoctors();
  }, [hname]);

  // Fetch symptoms on mount
  useEffect(() => {
    async function fetchSymptoms() {
      if (!hname) return;
      try {
        const response = await fetch(`/api/${encodeURIComponent(hname)}/forms/symptoms_master`, { cache: "no-store" });
        const data = await response.json();
        const options = (data.rows || [])
          .map((r: any) => String(r.description || ""))
          .filter(Boolean);
        setSymptomOptions(options);
      } catch (err) {
        console.error("Failed to load symptoms", err);
      }
    }
    void fetchSymptoms();
  }, [hname]);

  const loadData = async () => {
    if (!hname) return;
    setIsLoading(true);
    setErrorMessage("");
    try {
      const todayDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const vUrl = new URL(`/api/${encodeURIComponent(hname)}/vitals`, window.location.origin);
      vUrl.searchParams.set("doctor", selectedDoctor || "all");
      vUrl.searchParams.set("date", todayDate);

      const cUrl = new URL(`/api/${encodeURIComponent(hname)}/forms/doctor_consultation_entry`, window.location.origin);

      const [vRes, cRes] = await Promise.all([
        fetch(vUrl.toString(), { cache: "no-store" }),
        fetch(cUrl.toString(), { cache: "no-store" }),
      ]);

      const vData = await vRes.json();
      const cData = await cRes.json();

      setVitalsRows(vData.rows || []);
      setConsultationRows(cData.rows || []);
    } catch {
      setErrorMessage("Failed to load records.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hname, selectedDoctor]);

  useEffect(() => {
    async function loadHistory() {
      if (!selectedPatientRow) { setHistoryRows([]); return; }
      
      const rawPid = text(selectedPatientRow, ["appointment_patient_id", "registration_id", "registration_patient_id", "patient_id"]);
      const pName = patientName(selectedPatientRow);
      const patientId = rawPid && rawPid.toLowerCase() !== pName.toLowerCase() ? rawPid : "";
      
      if (!patientId) { setHistoryRows([]); return; }
      setIsHistoryLoading(true);
      try {
        const response = await fetch(`/api/${encodeURIComponent(hname)}/appointments?patientId=${encodeURIComponent(patientId)}`, { cache: "no-store" });
        const data = (await response.json()) as { rows?: AppointmentHistoryRow[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Failed to load patient history.");
        setHistoryRows(data.rows ?? []);
      } catch (err) {
        setHistoryRows([]);
        setErrorMessage(err instanceof Error ? err.message : "Failed to load patient history.");
      } finally {
        setIsHistoryLoading(false);
      }
    }
    void loadHistory();
  }, [hname, selectedPatientRow]);

  // Upcoming = only patients who have completed vitals, sorted by time
  const upcomingRows = useMemo(() => {
    return [...vitalsRows]
      .filter(isVitalsCompleted)
      .sort((a, b) => {
        const timeA = text(a, ["appointment_time"]);
        const timeB = text(b, ["appointment_time"]);
        if (!timeA && !timeB) return 0;
        if (!timeA) return 1;
        if (!timeB) return -1;
        return timeA.localeCompare(timeB);
      });
  }, [vitalsRows]);

  const draftRows = useMemo(() => {
    let rows = consultationRows.filter(r => text(r, ["status"]) === "Draft");
    if (selectedDoctor) rows = rows.filter(r => text(r, ["doctor"]) === selectedDoctor);
    return rows;
  }, [consultationRows, selectedDoctor]);

  const completedRows = useMemo(() => {
    let rows = consultationRows.filter(r => text(r, ["status"]) === "Completed");
    if (selectedDoctor) rows = rows.filter(r => text(r, ["doctor"]) === selectedDoctor);
    return rows;
  }, [consultationRows, selectedDoctor]);

  const patientDetailFields = useMemo(() => {
    if (!selectedPatientRow) return [];
    const rawPid = text(selectedPatientRow, ["registration_patient_id", "appointment_patient_id", "patient_id"]);
    const pName = patientName(selectedPatientRow);
    const pid = (rawPid.toLowerCase() === pName.toLowerCase()) ? "" : rawPid;
    return [
      ["Patient ID", pid],
      ["Appointment Number", text(selectedPatientRow, ["appointment_number"]) ? `APT-${String(text(selectedPatientRow, ["appointment_number"])).padStart(4, "0")}` : ""],
      ["Patient Name", pName],
      ["Date of Birth", formatDisplayDate(text(selectedPatientRow, ["registration_dob", "dob"]))],
      ["Age", text(selectedPatientRow, ["registration_age", "age"]) ? `${text(selectedPatientRow, ["registration_age", "age"])} Yrs` : ""],
      ["Gender", text(selectedPatientRow, ["registration_gender", "gender"])],
      ["Contact Number", text(selectedPatientRow, ["registration_mobile", "mobile", "patient_phone"])],
      ["Address", text(selectedPatientRow, ["registration_address", "address"])],
      ["City", text(selectedPatientRow, ["registration_city", "city"])],
      ["State", text(selectedPatientRow, ["registration_state", "state"])],
      ["Country", text(selectedPatientRow, ["registration_country", "country"])],
      ["Zip Code", text(selectedPatientRow, ["registration_zip_code", "zip_code"])],
      ["Email", text(selectedPatientRow, ["registration_email", "email"])],
    ].filter(([, val]) => val !== "");
  }, [selectedPatientRow]);

  const vitalsDetailFields = useMemo(() => {
    if (!selectedPatientRow) return [];
    return [
      ["Vitals Status", text(selectedPatientRow, ["vitals_status"]) || "Active"],
      ["Age", text(selectedPatientRow, ["age"])],
      ["Height (cm)", text(selectedPatientRow, ["height_cm"])],
      ["Weight (kg)", text(selectedPatientRow, ["weight_kg"])],
      ["BMI", text(selectedPatientRow, ["bmi"])],
      ["Temperature", text(selectedPatientRow, ["temperature"])],
      ["Pulse Rate", text(selectedPatientRow, ["pulse_rate"])],
      ["Respiratory Rate", text(selectedPatientRow, ["respiratory_rate"])],
      ["Systolic BP", text(selectedPatientRow, ["systolic_bp"])],
      ["Diastolic BP", text(selectedPatientRow, ["diastolic_bp"])],
      ["SpO2", text(selectedPatientRow, ["spo2"])],
      ["Blood Sugar", text(selectedPatientRow, ["blood_sugar"])],
      ["Remarks", text(selectedPatientRow, ["remarks"])],
    ];
  }, [selectedPatientRow]);

  const previousHistoryRows = useMemo(() => {
    return historyRows
      .sort((a, b) =>
        `${text(b, ["appointment_date"])} ${text(b, ["appointment_time"])}`.localeCompare(
          `${text(a, ["appointment_date"])} ${text(a, ["appointment_time"])}`
        )
      );
  }, [historyRows, selectedPatientRow]);

  const goToNextTab = () => {
    const idx = DETAIL_TABS.indexOf(detailTab);
    if (idx < DETAIL_TABS.length - 1) setDetailTab(DETAIL_TABS[idx + 1]);
  };

  const handleVitalsClick = (row: VitalsRow) => {
    setSelectedPatientRow(row);
    setDetailTab("Patient Details");
    setEditingRecordId(null);
    setPatientType("OP");
    setFormValues({
      tokenNumber: text(row, ["appointment_id"]),
      patientDetails: patientName(row),
      diagnosisName: "",
      symptoms: "",
      remarks: "",
      instructions: "",
      followUpDays: "",
      consultationAmount: "",
      prescriptionData: "",
      sended: "",
    });
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleConsultationClick = (row: ConsultationRow) => {
    const tokenNumber = text(row, ["tokenNumber", "token_number"]);
    const selectedName = text(row, ["patientDetails", "patient_details"]);
    const matchedPatient = vitalsRows.find(vr =>
      (tokenNumber && text(vr, ["appointment_id"]) === tokenNumber) ||
      (selectedName && patientName(vr) === selectedName)
    );
    setPatientType(text(row, ["patientType", "patient_type"]) === "IP" ? "IP" : "OP");
    setSelectedPatientRow(matchedPatient ?? { appointment_id: tokenNumber, appointment_patient_name: selectedName });
    setDetailTab("Consultation Form");
    setEditingRecordId(row.id);
    setFormValues({
      tokenNumber,
      patientDetails: selectedName,
      diagnosisName: text(row, ["diagnosisName", "diagnosis_name"]),
      symptoms: text(row, ["symptoms"]),
      remarks: text(row, ["remarks"]),
      instructions: text(row, ["instructions"]),
      followUpDays: text(row, ["followUpDays", "follow_up_days"]),
      consultationAmount: text(row, ["consultationAmount", "consultation_amount"]),
      prescriptionData: text(row, ["prescriptionData", "prescription_data"]),
      sended: text(row, ["sended"]),
    });
    setErrorMessage("");
    setSuccessMessage("");
  };

  const saveForm = async (status: "Draft" | "Completed", isSended?: boolean) => {
    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const finalSended = isSended ? "Yes" : formValues.sended;
      const payload = {
        id: editingRecordId,
        cardTitle: "Doctor Consultation Entry",
        fields: [
          { id: "status", type: "text" },
          { id: "doctor", type: "text" },
          { id: "tokenNumber", type: "text" },
          { id: "patientDetails", type: "text" },
          { id: "diagnosisName", type: "text" },
          { id: "symptoms", type: "text" },
          { id: "remarks", type: "textarea" },
          { id: "instructions", type: "textarea" },
          { id: "followUpDays", type: "number" },
          { id: "consultationAmount", type: "number" },
          { id: "prescriptionData", type: "textarea" },
          { id: "patientType", type: "text" },
          { id: "sended", type: "text" },
        ],
        values: { ...formValues, status, doctor: selectedDoctor, patientType, sended: finalSended },
      };

      const response = await fetch(`/api/${encodeURIComponent(hname)}/forms/doctor_consultation_entry`, {
        method: editingRecordId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save.");

      setSuccessMessage(`Consultation saved as ${status}.`);
      setFormValues({ tokenNumber: "", patientDetails: "", diagnosisName: "", symptoms: "", remarks: "", followUpDays: "", consultationAmount: "", prescriptionData: "", sended: "" });
      setPatientType("OP");
      setEditingRecordId(null);
      void loadData();
      setQueueTab(status === "Draft" ? "Draft" : "Completed");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendToPharmacy = () => {
    saveForm("Draft", true);
  };

  const updateFormValue = (key: keyof ConsultationRow, value: any) => {
    setFormValues(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    if (!icdQuery || icdQuery.length < 3) {
      setIcdResults([]);
      setShowIcdDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsIcdSearching(true);
      try {
        const queryVal = icdQuery.trim();
        // 1. Standard text search
        const res = await fetch(`/api/icd-proxy/icd/release/11/2024-01/mms/search?q=${encodeURIComponent(queryVal)}`);
        const data = await res.json();
        let entities = data.destinationEntities || [];

        // 2. If text search returned nothing, and the query looks like a code (e.g. "1A02"), try exact code lookup
        if (entities.length === 0 && queryVal.length >= 4 && /^[A-Z0-9.]+$/i.test(queryVal)) {
          const codeRes = await fetch(`/api/icd-proxy/icd/release/11/2024-01/mms/codeinfo/${queryVal.toUpperCase()}`);
          if (codeRes.ok) {
            const codeData = await codeRes.json();
            if (codeData.stemId) {
              const stemPath = codeData.stemId.replace("http://id.who.int", "");
              const entityRes = await fetch(`/api/icd-proxy${stemPath}`);
              if (entityRes.ok) {
                const entityData = await entityRes.json();
                entities = [{
                  id: codeData.stemId,
                  theCode: codeData.code,
                  title: entityData.title?.["@value"] || entityData.title || "Unknown"
                }];
              }
            }
          }
        }

        setIcdResults(entities);
        setShowIcdDropdown(true);
      } catch (err) {
        console.error(err);
      } finally {
        setIsIcdSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [icdQuery]);

  const handleIcdSelect = (entity: any) => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = entity.title;
    const cleanTitle = tempDiv.textContent || tempDiv.innerText || "";

    // Sometimes theCode contains multiple codes joined with / or &. Let's just use it as is.
    const codePart = entity.theCode ? `[${entity.theCode}] ` : "";
    const icdText = `${codePart}${cleanTitle}`.trim();

    setFormValues(prev => ({
      ...prev,
      diagnosisName: prev.diagnosisName ? `${prev.diagnosisName}, ${icdText}` : icdText
    }));
    setIcdQuery("");
    setShowIcdDropdown(false);
  };

  function PatientTypeBadge({ type }: { type: string }) {
    const isOP = type !== "IP";
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isOP ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"}`}>
        {isOP ? "OP" : "IP"}
      </span>
    );
  }

  const isLastTab = detailTab === "Consultation Form";

  return (
    <>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">

        {/* Left Panel */}
        <div className={`col-span-1 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900/50 h-[calc(100vh-8rem)] overflow-hidden transition-all duration-300 ${leftPanelCollapsed ? "lg:col-span-1 p-3" : "lg:col-span-2 xl:col-span-3 p-4"}`}>

          {/* Collapse toggle button */}
          <div className={`flex shrink-0 ${leftPanelCollapsed ? "justify-center" : "justify-end"}`}>
            <button
              type="button"
              title={leftPanelCollapsed ? "Expand panel" : "Collapse panel"}
              onClick={() => setLeftPanelCollapsed(v => !v)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 transition"
            >
              <svg className={`h-4 w-4 transition-transform duration-300 ${leftPanelCollapsed ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>

          {/* Collapsed state: just show tab icons */}
          {leftPanelCollapsed ? (
            <div className="flex flex-col items-center">
            </div>
          ) : (
            <>
              {/* Doctor selector */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Doctor</label>
                <select
                  value={selectedDoctor}
                  onChange={e => setSelectedDoctor(e.target.value)}
                  className="mt-1 block h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:text-white"
                >
                  <option value="">All Doctors</option>
                  {doctorsList.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                </select>
              </div>

              {/* Queue tab switcher */}
              <div className="flex shrink-0 gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
                {(["Upcoming", "Draft", "Completed"] as QueueTab[]).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setQueueTab(tab)}
                    className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${queueTab === tab ? "bg-white text-gray-900 shadow-xs dark:bg-gray-700 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Patient list */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {isLoading ? (
                  <div className="text-center text-sm text-gray-500 p-4">Loading...</div>
                ) : queueTab === "Upcoming" ? (
                  upcomingRows.length === 0 ? (
                    <div className="text-center text-sm text-gray-500 p-4">No patients with completed vitals.</div>
                  ) : (
                    upcomingRows.map((row, i) => (
                      <button
                        key={String(row.vitals_id ?? row.appointment_id ?? i)}
                        type="button"
                        onClick={() => handleVitalsClick(row)}
                        className="w-full text-left flex flex-col gap-1 rounded-xl border border-gray-100 p-3 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50 transition"
                      >
                        <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                          {text(row, ["registration_patient_name", "appointment_patient_name", "patient_name"])}
                        </span>
                        {(() => {
                          const rawPid = text(row, ["registration_patient_id", "appointment_patient_id", "patient_id"]);
                          const name = text(row, ["registration_patient_name", "appointment_patient_name", "patient_name"]);
                          const isValidPid = rawPid && rawPid.toLowerCase() !== name.toLowerCase();
                          return isValidPid ? (
                            <span className="text-xs font-mono text-brand-600 bg-brand-50 rounded px-1.5 py-0.5 self-start">
                              {rawPid}
                            </span>
                          ) : null;
                        })()}
                        <div className="text-xs text-gray-500">{text(row, ["appointment_time"]) || "Walk-in"}</div>
                      </button>
                    ))
                  )
                ) : queueTab === "Draft" ? (
                  draftRows.length === 0 ? (
                    <div className="text-center text-sm text-gray-500 p-4">No drafts.</div>
                  ) : (
                    draftRows.map(row => (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => handleConsultationClick(row)}
                        className="w-full text-left flex flex-col gap-1 rounded-xl border border-gray-100 p-3 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50 transition"
                      >
                        <div className="flex items-center gap-2 justify-between">
                          <span className="text-sm font-semibold text-gray-800 dark:text-white/90 truncate">{text(row, ["patientDetails", "patient_details"]) || "Unknown Patient"}</span>
                          <PatientTypeBadge type={text(row, ["patientType", "patient_type"])} />
                        </div>
                        <div className="text-xs text-gray-500">Token: {text(row, ["tokenNumber", "token_number"]) || "N/A"}</div>
                      </button>
                    ))
                  )
                ) : (
                  completedRows.length === 0 ? (
                    <div className="text-center text-sm text-gray-500 p-4">No completed consultations.</div>
                  ) : (
                    completedRows.map(row => (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => handleConsultationClick(row)}
                        className="w-full text-left flex flex-col gap-1 rounded-xl border border-gray-100 p-3 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50 transition"
                      >
                        <div className="flex items-center gap-2 justify-between">
                          <span className="text-sm font-semibold text-gray-800 dark:text-white/90 truncate">{text(row, ["patientDetails", "patient_details"]) || "Unknown Patient"}</span>
                          <PatientTypeBadge type={text(row, ["patientType", "patient_type"])} />
                        </div>
                        <div className="text-xs text-gray-500">Diagnosis: {text(row, ["diagnosisName", "diagnosis_name"]) || "N/A"}</div>
                      </button>
                    ))
                  )
                )}
              </div>
            </>
          )}
        </div>

        {/* Right Panel */}
        <div className={`col-span-1 flex flex-col h-[calc(100vh-8rem)] rounded-2xl border border-gray-200 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900/50 transition-all duration-300 ${leftPanelCollapsed ? "lg:col-span-11 xl:col-span-11" : "lg:col-span-9 xl:col-span-9"}`}>

          {/* Tab bar with Next button */}
          <div className="border-b border-gray-100 px-6 pt-4 dark:border-gray-800 flex items-center justify-between shrink-0">
            <div className="flex gap-6">
              {DETAIL_TABS.map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDetailTab(tab)}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${detailTab === tab ? "border-brand-500 text-brand-500 dark:border-brand-400 dark:text-brand-400" : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"}`}
                >
                  {tab}
                </button>
              ))}
            </div>
            {!isLastTab && (
              <button
                type="button"
                onClick={goToNextTab}
                className="mb-1 flex items-center gap-1.5 rounded-lg border border-brand-500 px-3 py-1.5 text-xs font-semibold text-brand-500 hover:bg-brand-50 transition dark:hover:bg-brand-900/20"
              >
                Next
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>

          <div className="p-6 flex-1 overflow-y-auto">

            {/* Non-consultation tab content */}
            {detailTab !== "Consultation Form" && (
              <div className="mb-6 rounded-xl border border-gray-100 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-800/20">

                {detailTab === "Patient Details" && (
                  selectedPatientRow ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {patientDetailFields.map(([label, val]) => (
                          <div key={label as string}>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">{label as string}</label>
                            <div className="flex min-h-[2.5rem] w-full items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-200">
                              {display(val as string)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">Please select a patient from the queue to view details.</div>
                  )
                )}

                {detailTab === "Vitals" && (
                  selectedPatientRow ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      {vitalsDetailFields.map(([label, val]) => (
                        <div key={label as string}>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">{label as string}</label>
                          <div className="flex min-h-[2.5rem] w-full items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-200">
                            {display(val as string)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">Please select a patient from the queue to view vitals.</div>
                  )
                )}

                {detailTab === "History" && (
                  selectedPatientRow ? (
                    isHistoryLoading ? (
                      <div className="text-sm text-gray-500">Loading history...</div>
                    ) : previousHistoryRows.length > 0 ? (
                      <div className="space-y-3">
                        {previousHistoryRows.map(row => (
                          <div key={row.id ?? `${text(row, ["appointment_date"])}-${text(row, ["appointment_time"])}-${text(row, ["doctor"])}`} className="flex gap-4 items-center text-sm border border-gray-100 bg-white p-3 rounded-lg shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
                            <div className="font-medium whitespace-nowrap text-gray-900 dark:text-gray-100">
                              {formatDisplayDate(text(row, ["appointment_date"]))} {text(row, ["appointment_time"]) ? formatDisplayTime(text(row, ["appointment_time"])) : ""}
                            </div>
                            <div className="flex-1 text-gray-700 dark:text-gray-300">{text(row, ["doctor"]) || "Unknown Doctor"}</div>
                            <div className="text-gray-500 whitespace-nowrap flex-1">{text(row, ["department"])}</div>
                            <div className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 font-medium dark:bg-gray-800 dark:text-gray-300">{text(row, ["status"]) || "Completed"}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">New patient — no previous visits found in this hospital.</div>
                    )
                  ) : (
                    <div className="text-sm text-gray-500">Please select a patient from the queue to view history.</div>
                  )
                )}
              </div>
            )}

            {/* Consultation Form tab */}
            {detailTab === "Consultation Form" && (
              <form className="flex flex-col gap-6" onSubmit={e => e.preventDefault()}>
                <div className="space-y-4">
                  {successMessage && <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{successMessage}</div>}
                  {errorMessage && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>}

                  {/* Custom native ICD-11 Search Widget */}
                  <div className="relative">
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">ICD-11 Search</label>
                    <input
                      type="text"
                      value={icdQuery}
                      onChange={e => setIcdQuery(e.target.value)}
                      onFocus={() => { if (icdResults.length > 0) setShowIcdDropdown(true); }}
                      onBlur={() => setTimeout(() => setShowIcdDropdown(false), 200)}
                      className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                      placeholder="Type to search ICD-11 diseases/symptoms (select to auto-fill Diagnosis Name)..."
                      autoComplete="off"
                    />
                    {isIcdSearching && (
                      <div className="absolute right-3 top-9 text-xs text-brand-500">Searching...</div>
                    )}
                    {showIcdDropdown && icdResults.length > 0 && (
                      <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                        {icdResults.map((res: any) => (
                          <button
                            key={res.id}
                            type="button"
                            onClick={() => handleIcdSelect(res)}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700 last:border-0"
                          >
                            <span className="font-semibold">{res.theCode ? `[${res.theCode}] ` : ""}</span>
                            <span dangerouslySetInnerHTML={{ __html: res.title }} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Diagnosis Name</label>
                      <input type="text" value={formValues.diagnosisName} onChange={e => updateFormValue("diagnosisName", e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Symptoms</label>
                      <select
                        value={formValues.symptoms}
                        onChange={e => updateFormValue("symptoms", e.target.value)}
                        className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      >
                        <option value="">Select Symptoms</option>
                        {symptomOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Remarks</label>
                      <textarea value={formValues.remarks} onChange={e => updateFormValue("remarks", e.target.value)} rows={3} className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Instructions</label>
                      <textarea value={formValues.instructions} onChange={e => updateFormValue("instructions", e.target.value)} rows={3} className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Follow-up Days</label>
                      <input type="number" min="0" value={formValues.followUpDays} onChange={e => updateFormValue("followUpDays", e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                    </div>
                  </div>
                </div>
                {/* OP / IP Radio */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-400">Patient Category</label>
                  <div className="flex gap-4">
                    {(["OP", "IP"] as PatientType[]).map(type => (
                      <label
                        key={type}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-xl border-2 px-5 py-3 transition-all select-none ${patientType === type
                          ? type === "OP" ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20" : "border-purple-500 bg-purple-50 dark:border-purple-400 dark:bg-purple-900/20"
                          : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900/40 dark:hover:border-gray-600"}`}
                      >
                        <input type="radio" name="patientType" value={type} checked={patientType === type} onChange={() => setPatientType(type)} className="sr-only" />
                        <span className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${patientType === type ? (type === "OP" ? "border-blue-500" : "border-purple-500") : "border-gray-400 dark:border-gray-500"}`}>
                          {patientType === type && <span className={`h-2 w-2 rounded-full ${type === "OP" ? "bg-blue-500" : "bg-purple-500"}`} />}
                        </span>
                        <span className={`text-sm font-semibold ${patientType === type ? (type === "OP" ? "text-blue-700 dark:text-blue-300" : "text-purple-700 dark:text-purple-300") : "text-gray-600 dark:text-gray-400"}`}>
                          {type === "OP" ? "OP — Outpatient" : "IP — Inpatient"}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                {/* Prescription table only in Consultation Form */}
                <div className="space-y-2">
                  <PrescriptionTable
                    value={formValues.prescriptionData}
                    onChange={val => updateFormValue("prescriptionData", val)}
                    isSended={queueTab === "Draft" ? false : (formValues.sended === "Yes" || queueTab === "Completed")}
                    onSendToPharmacy={handleSendToPharmacy}
                    isSubmitting={isSubmitting}
                  />
                </div>

                <div className="flex flex-col gap-3 border-t border-gray-100 pt-5 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setFormValues({ tokenNumber: "", patientDetails: "", diagnosisName: "", symptoms: "", remarks: "", instructions: "", followUpDays: "", consultationAmount: "", prescriptionData: "" });
                      setPatientType("OP");
                      setEditingRecordId(null);
                    }}
                    className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting || !selectedDoctor}
                    onClick={() => saveForm("Draft")}
                    className="rounded-lg border border-brand-500 px-4 py-2.5 text-sm font-medium text-brand-500 hover:bg-brand-50 disabled:opacity-50"
                    title={!selectedDoctor ? "Please select a doctor first" : "Save as draft"}
                  >
                    {isSubmitting ? "Saving..." : "Save as Draft"}
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting || !selectedDoctor}
                    onClick={() => saveForm("Completed")}
                    className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                    title={!selectedDoctor ? "Please select a doctor first" : "Save and mark completed"}
                  >
                    {isSubmitting ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
