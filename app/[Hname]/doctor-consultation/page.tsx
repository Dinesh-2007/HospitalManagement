"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { BlankPage } from "../../../components/blank-page";
import { PrescriptionTable } from "./prescription-table";

type TabType = "Vitals" | "Draft" | "Completed";

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
  patientDetails?: string;
  diagnosisName?: string;
  symptoms?: string;
  remarks?: string;
  followUpDays?: string;
  consultationAmount?: string;
  prescriptionData?: string;
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

export default function DoctorConsultationPage() {
  const params = useParams();
  const hname = params?.Hname as string;

  const [activeTab, setActiveTab] = useState<TabType>("Vitals");
  const [doctorsList, setDoctorsList] = useState<{name: string}[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState("");

  const [vitalsRows, setVitalsRows] = useState<VitalsRow[]>([]);
  const [consultationRows, setConsultationRows] = useState<ConsultationRow[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [editingRecordId, setEditingRecordId] = useState<number | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({
    tokenNumber: "",
    patientDetails: "",
    diagnosisName: "",
    symptoms: "",
    remarks: "",
    followUpDays: "",
    consultationAmount: "",
    prescriptionData: "",
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

  // Load Data
  const loadData = async () => {
    if (!hname) return;
    setIsLoading(true);
    setErrorMessage("");
    try {
      // Fetch Vitals (we'll fetch for the selected doctor if set, or all, but the API handles "all" if doctor is "")
      const vUrl = new URL(`/api/${encodeURIComponent(hname)}/vitals`, window.location.origin);
      if (selectedDoctor) {
        vUrl.searchParams.set("doctor", selectedDoctor);
      } else {
        vUrl.searchParams.set("doctor", "all");
      }
      
      const cUrl = new URL(`/api/${encodeURIComponent(hname)}/forms/doctor_consultation`, window.location.origin);

      const [vRes, cRes] = await Promise.all([
        fetch(vUrl.toString(), { cache: "no-store" }),
        fetch(cUrl.toString(), { cache: "no-store" })
      ]);

      const vData = await vRes.json();
      const cData = await cRes.json();

      setVitalsRows(vData.rows || []);
      setConsultationRows(cData.rows || []);
    } catch (err) {
      setErrorMessage("Failed to load records.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hname, selectedDoctor]);

  const displayedVitals = useMemo(() => {
    const sorted = [...vitalsRows].sort((a, b) => {
      // Completed first, then pending
      const aDone = isVitalsCompleted(a) ? 1 : 0;
      const bDone = isVitalsCompleted(b) ? 1 : 0;
      if (aDone !== bDone) {
        return bDone - aDone; // 1 goes first
      }
      // Then by time
      const timeA = text(a, ["appointment_time"]);
      const timeB = text(b, ["appointment_time"]);
      if (!timeA && !timeB) return 0;
      if (!timeA) return 1;
      if (!timeB) return -1;
      return timeA.localeCompare(timeB);
    });
    return sorted;
  }, [vitalsRows]);

  const draftRows = useMemo(() => {
    let rows = consultationRows.filter(r => r.status === "Draft");
    if (selectedDoctor) {
      rows = rows.filter(r => r.doctor === selectedDoctor);
    }
    return rows;
  }, [consultationRows, selectedDoctor]);

  const completedRows = useMemo(() => {
    let rows = consultationRows.filter(r => r.status === "Completed");
    if (selectedDoctor) {
      rows = rows.filter(r => r.doctor === selectedDoctor);
    }
    return rows;
  }, [consultationRows, selectedDoctor]);

  const handleVitalsClick = (row: VitalsRow) => {
    const patientName = text(row, ["registration_patient_name", "appointment_patient_name", "patient_name"]);
    setEditingRecordId(null);
    setFormValues({
      tokenNumber: "",
      patientDetails: patientName,
      diagnosisName: "",
      symptoms: "",
      remarks: "",
      followUpDays: "",
      consultationAmount: "",
      prescriptionData: "",
    });
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleConsultationClick = (row: ConsultationRow) => {
    setEditingRecordId(row.id);
    setFormValues({
      tokenNumber: row.tokenNumber || "",
      patientDetails: row.patientDetails || "",
      diagnosisName: row.diagnosisName || "",
      symptoms: row.symptoms || "",
      remarks: row.remarks || "",
      followUpDays: row.followUpDays || "",
      consultationAmount: row.consultationAmount || "",
      prescriptionData: row.prescriptionData || "",
    });
    setErrorMessage("");
    setSuccessMessage("");
  };

  const saveForm = async (status: "Draft" | "Completed") => {
    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
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
          { id: "followUpDays", type: "number" },
          { id: "consultationAmount", type: "number" },
          { id: "prescriptionData", type: "textarea" }
        ],
        values: {
          ...formValues,
          status,
          doctor: selectedDoctor,
        }
      };

      const response = await fetch(`/api/${encodeURIComponent(hname)}/forms/doctor_consultation`, {
        method: editingRecordId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save.");

      setSuccessMessage(`Consultation saved as ${status}.`);
      setFormValues({
        tokenNumber: "",
        patientDetails: "",
        diagnosisName: "",
        symptoms: "",
        remarks: "",
        followUpDays: "",
        consultationAmount: "",
        prescriptionData: "",
      });
      setEditingRecordId(null);
      void loadData();

      // Switch tab automatically based on save action
      if (status === "Draft") {
        setActiveTab("Draft");
      } else {
        setActiveTab("Completed");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFormValue = (key: string, value: string) => {
    setFormValues(prev => ({ ...prev, [key]: value }));
  };

  return (
    <BlankPage title="Doctor Consultation">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Panel */}
        <div className="col-span-1 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900/50 lg:col-span-3 xl:col-span-3 h-[calc(100vh-8rem)] overflow-hidden">
          
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Doctor</label>
            <select
              value={selectedDoctor}
              onChange={(e) => setSelectedDoctor(e.target.value)}
              className="mt-1 block h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:text-white"
            >
              <option value="">All Doctors</option>
              {doctorsList.map((d) => (
                <option key={d.name} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="flex shrink-0 gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
            {(["Vitals", "Draft", "Completed"] as TabType[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  activeTab === tab
                    ? "bg-white text-gray-900 shadow-xs dark:bg-gray-700 dark:text-white"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {isLoading ? (
              <div className="text-center text-sm text-gray-500 p-4">Loading...</div>
            ) : activeTab === "Vitals" ? (
              displayedVitals.length === 0 ? (
                <div className="text-center text-sm text-gray-500 p-4">No vitals found.</div>
              ) : (
                displayedVitals.map((row, i) => (
                  <button
                    key={String(row.vitals_id || row.appointment_id || i)}
                    type="button"
                    onClick={() => handleVitalsClick(row)}
                    className="w-full text-left flex flex-col gap-1 rounded-xl border border-gray-100 p-3 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50 transition"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                        {text(row, ["registration_patient_name", "appointment_patient_name", "patient_name"])}
                      </span>
                      {isVitalsCompleted(row) ? (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Completed</span>
                      ) : (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Pending</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">{text(row, ["appointment_time"]) || "Walk-in"}</div>
                  </button>
                ))
              )
            ) : activeTab === "Draft" ? (
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
                    <span className="text-sm font-semibold text-gray-800 dark:text-white/90">{row.patientDetails || "Unknown Patient"}</span>
                    <div className="text-xs text-gray-500">Token: {row.tokenNumber || "N/A"}</div>
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
                    <span className="text-sm font-semibold text-gray-800 dark:text-white/90">{row.patientDetails || "Unknown Patient"}</span>
                    <div className="text-xs text-gray-500">Diagnosis: {row.diagnosisName || "N/A"}</div>
                  </button>
                ))
              )
            )}
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="col-span-1 rounded-2xl border border-gray-200 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900/50 lg:col-span-9 xl:col-span-9">
          <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-800">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Consultation Form</h3>
          </div>
          
          <div className="p-6">
            {successMessage && <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{successMessage}</div>}
            {errorMessage && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>}

            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Token Number</label>
                  <input type="text" value={formValues.tokenNumber} onChange={e => updateFormValue("tokenNumber", e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Patient Details</label>
                  <input type="text" value={formValues.patientDetails} onChange={e => updateFormValue("patientDetails", e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Diagnosis Name</label>
                  <input type="text" value={formValues.diagnosisName} onChange={e => updateFormValue("diagnosisName", e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Symptoms</label>
                  <input type="text" value={formValues.symptoms} onChange={e => updateFormValue("symptoms", e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Remarks</label>
                  <textarea value={formValues.remarks} onChange={e => updateFormValue("remarks", e.target.value)} rows={3} className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Follow-up Days</label>
                  <input type="number" min="0" value={formValues.followUpDays} onChange={e => updateFormValue("followUpDays", e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Consultation Amount</label>
                  <input type="number" min="0" value={formValues.consultationAmount} onChange={e => updateFormValue("consultationAmount", e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                </div>
              </div>

              <PrescriptionTable 
                value={formValues.prescriptionData} 
                onChange={(val) => updateFormValue("prescriptionData", val)} 
              />

              <div className="flex flex-col gap-3 border-t border-gray-100 pt-5 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setFormValues({
                      tokenNumber: "", patientDetails: "", diagnosisName: "",
                      symptoms: "", remarks: "", followUpDays: "",
                      consultationAmount: "", prescriptionData: "",
                    });
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

          </div>
        </div>
      </div>
    </BlankPage>
  );
}
