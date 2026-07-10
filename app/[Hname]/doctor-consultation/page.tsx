"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { PrescriptionTable } from "./prescription-table";
import { getCurrentUser, getCurrentUserRole } from "../../actions/user";
import { ConsultationBillingDashboard } from "../../../components/consultation-billing-dashboard";
import { useHospitalTimezone } from "../../../components/context/HospitalTimezoneContext";

function normalizeDoctorProfileRow(row: Record<string, unknown> | null) {
  if (!row) return null;
  return {
    first_name: String(row.first_name || row.firstName || ""),
    last_name: String(row.last_name || row.lastName || ""),
  };
}

async function loadDoctorProfile(hname: string, username: string) {
  const response = await fetch(
    `/api/${encodeURIComponent(hname)}/doctor-profile?username=${encodeURIComponent(username)}`,
    { cache: "no-store" },
  );
  const data = (await response.json().catch(() => ({}))) as {
    row?: Record<string, unknown> | null;
    error?: string;
  };
  if (!response.ok) throw new Error(data.error ?? "Failed to load doctor profile.");
  return normalizeDoctorProfileRow(data.row ?? null);
}

type QueueTab = "Upcoming" | "Draft" | "Completed";
type DetailTab = "Patient Details" | "Vitals" | "Consultation Form" | "Consultation Billing" | "History";
type PatientType = "OP" | "IP";

const DETAIL_TABS: DetailTab[] = ["Patient Details", "Vitals", "Consultation Form", "Consultation Billing", "History"];

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

function MultiSelectDropdown({
  options,
  value,
  onChange,
  placeholder = "Select..."
}: {
  options: string[],
  value: string,
  onChange: (val: string) => void,
  placeholder?: string
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  let selected: string[] = [];
  try {
    if (value) {
      if (value.startsWith("[") && value.endsWith("]")) {
        selected = JSON.parse(value);
      } else {
        selected = [value];
      }
    } else {
      selected = [];
    }
  } catch {
    selected = [];
  }
  if (!Array.isArray(selected)) selected = [];

  const toggle = (opt: string) => {
    let newSelected: string[];
    if (selected.includes(opt)) {
      newSelected = selected.filter(o => o !== opt);
    } else {
      newSelected = [...selected, opt];
    }
    onChange(JSON.stringify(newSelected));
  };

  const removeSelected = (e: React.MouseEvent, opt: string) => {
    e.stopPropagation();
    onChange(JSON.stringify(selected.filter(o => o !== opt)));
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="min-h-10 w-full cursor-pointer rounded-lg border border-gray-300 bg-transparent px-3 py-1.5 text-sm focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 flex flex-wrap items-center gap-1.5 justify-between"
      >
        <div className="flex flex-wrap gap-1.5 items-center flex-1">
          {selected.length === 0 ? (
            <span className="text-gray-400 dark:text-gray-500">{placeholder}</span>
          ) : (
            selected.map(opt => (
              <span
                key={opt}
                className="inline-flex items-center gap-1 rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
              >
                {opt}
                <button
                  type="button"
                  onClick={(e) => removeSelected(e, opt)}
                  className="hover:text-brand-950 dark:hover:text-brand-100 font-bold"
                >
                  &times;
                </button>
              </span>
            ))
          )}
        </div>
        <div className="flex items-center gap-2 pl-2 text-gray-400 shrink-0">
          <svg className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800 animate-in fade-in slide-in-from-top-1 duration-150">
          {options.length > 5 && (
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="mb-2 h-8 w-full rounded border border-gray-200 px-2 text-xs focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              onClick={e => e.stopPropagation()}
            />
          )}
          <div className="space-y-1">
            {filteredOptions.length === 0 ? (
              <div className="p-2 text-xs text-gray-500 dark:text-gray-400">No options found.</div>
            ) : (
              filteredOptions.map(opt => {
                const isChecked = selected.includes(opt);
                return (
                  <div
                    key={opt}
                    onClick={() => toggle(opt)}
                    className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-pointer transition select-none hover:bg-gray-50 dark:hover:bg-gray-700/50 ${isChecked ? "bg-brand-50/50 dark:bg-brand-950/20" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => { }}
                      className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:checked:bg-brand-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300">{opt}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface ScreeningImagingRow {
  name: string;
  notes: string;
  fileName?: string;
  fileData?: string;
}

function ScreeningImagingTable({
  value,
  onChange
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  let rows: ScreeningImagingRow[] = [];
  try {
    const parsed = value ? JSON.parse(value) : [];
    if (Array.isArray(parsed)) {
      rows = parsed.map((item: any): ScreeningImagingRow | null => {
        if (typeof item === "string") {
          return { name: item, notes: "", fileName: "", fileData: "" };
        } else if (item && typeof item === "object") {
          return {
            name: String(item.name || item.type || ""),
            notes: String(item.notes || ""),
            fileName: item.fileName ? String(item.fileName) : "",
            fileData: item.fileData ? String(item.fileData) : ""
          };
        }
        return null;
      }).filter((item): item is ScreeningImagingRow => item !== null);
    }
  } catch {
    rows = [];
  }

  const handleAddRow = () => {
    const newRows = [...rows, { name: "ECG", notes: "", fileName: "", fileData: "" }];
    onChange(JSON.stringify(newRows));
  };

  const handleRemoveRow = (index: number) => {
    const newRows = rows.filter((_, idx) => idx !== index);
    onChange(JSON.stringify(newRows));
  };

  const handleUpdateRow = (index: number, field: keyof ScreeningImagingRow, val: string) => {
    const newRows = rows.map((row, idx) => {
      if (idx === index) {
        return { ...row, [field]: val };
      }
      return row;
    });
    onChange(JSON.stringify(newRows));
  };

  const handleFileUpload = (index: number, file: File | null) => {
    if (!file) {
      handleUpdateRow(index, "fileName", "");
      handleUpdateRow(index, "fileData", "");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const newRows = rows.map((row, idx) => {
        if (idx === index) {
          return { ...row, fileName: file.name, fileData: result };
        }
        return row;
      });
      onChange(JSON.stringify(newRows));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFile = (index: number) => {
    const newRows = rows.map((row, idx) => {
      if (idx === index) {
        return { ...row, fileName: "", fileData: "" };
      }
      return row;
    });
    onChange(JSON.stringify(newRows));
  };

  return (
    <div className="space-y-4 mt-2">
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 w-16">#</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 w-52">Document Type</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Findings / Details</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 w-72">Document Attachment</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300 w-24">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-transparent">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  No screening or imaging documents added yet. Click "+ Add Document Row" to begin.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={index} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30">
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      <select
                        value={["ECG", "X-Ray", "Screening Echo"].includes(row.name) ? row.name : "Others"}
                        onChange={e => {
                          const val = e.target.value;
                          handleUpdateRow(index, "name", val === "Others" ? "" : val);
                        }}
                        className="h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-xs focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      >
                        <option value="ECG">ECG</option>
                        <option value="X-Ray">X-Ray</option>
                        <option value="Screening Echo">Screening Echo</option>
                        <option value="Others">Others</option>
                      </select>
                      {!["ECG", "X-Ray", "Screening Echo"].includes(row.name) && (
                        <input
                          type="text"
                          value={row.name}
                          onChange={e => handleUpdateRow(index, "name", e.target.value)}
                          placeholder="Specify document name..."
                          className="h-8 w-full rounded-md border border-gray-300 px-2.5 text-xs focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <textarea
                      value={row.notes}
                      onChange={e => handleUpdateRow(index, "notes", e.target.value)}
                      placeholder="Enter findings, observations, or details..."
                      rows={2}
                      className="w-full rounded-lg border border-gray-300 p-2.5 text-xs focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    />
                  </td>
                  <td className="px-4 py-3">
                    {row.fileName ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-600 dark:text-gray-400 font-medium truncate max-w-[200px]" title={row.fileName}>
                          📎 {row.fileName}
                        </span>
                        <div className="flex gap-2">
                          <a
                            href={row.fileData}
                            download={row.fileName}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                          >
                            Download/View
                          </a>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(index)}
                            className="text-[11px] font-semibold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Remove File
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex h-9 w-full cursor-pointer items-center justify-center rounded-lg border border-dashed border-gray-300 px-3 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800/50">
                        <svg className="mr-1.5 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Upload Document
                        <input
                          type="file"
                          className="sr-only"
                          onChange={e => handleFileUpload(index, e.target.files?.[0] ?? null)}
                        />
                      </label>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(index)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:text-gray-500 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition"
                      title="Remove Row"
                    >
                      <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={handleAddRow}
        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50/50 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50 dark:border-brand-900/40 dark:bg-brand-950/20 dark:text-brand-300 dark:hover:bg-brand-950/40 transition"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Document Row
      </button>
    </div>
  );
}

function DoctorTreatmentNoteGroup({
  doctors,
  value,
  onChange
}: {
  doctors: string[],
  value: string,
  onChange: (val: string) => void
}) {
  let selected: { doctor: string, note: string }[] = [];
  try {
    const parsed = value ? JSON.parse(value) : [];
    if (Array.isArray(parsed)) {
      selected = parsed.map((item: any) => {
        if (typeof item === "string") {
          return { doctor: item, note: "" };
        } else if (item && typeof item === "object" && item.doctor) {
          return { doctor: item.doctor, note: item.note || "" };
        }
        return null;
      }).filter((item): item is { doctor: string, note: string } => item !== null);
    }
  } catch {
    selected = [];
  }

  const selectedDoctorNames = selected.map(s => s.doctor);

  const handleDropdownChange = (newNamesJson: string) => {
    const newNames: string[] = JSON.parse(newNamesJson);
    const updated = newNames.map(name => {
      const existing = selected.find(s => s.doctor === name);
      return existing ? existing : { doctor: name, note: "" };
    });
    onChange(JSON.stringify(updated));
  };

  const updateDoctorNote = (doctor: string, note: string) => {
    const updated = selected.map(s => {
      if (s.doctor === doctor) {
        return { ...s, note };
      }
      return s;
    });
    onChange(JSON.stringify(updated));
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Choose Multiple Doctors</label>
        <MultiSelectDropdown
          options={doctors}
          value={JSON.stringify(selectedDoctorNames)}
          onChange={handleDropdownChange}
          placeholder="Select Doctors..."
        />
      </div>

      {selected.length > 0 && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Doctor Treatment Notes</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selected.map(item => (
              <div key={item.doctor} className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/30 flex flex-col gap-2">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{item.doctor}</span>
                <textarea
                  value={item.note}
                  onChange={e => updateDoctorNote(item.doctor, e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-xs focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  placeholder={`Write treatment instructions/note by ${item.doctor}...`}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const DEFAULT_FORM_VALUES = {
  tokenNumber: "",
  patientDetails: "",
  allergies: "No",
  allergiesDetail: "[]",
  presentIllness: "",
  patientPastHistory: "",
  provisionalDiagnosis: "",
  symptoms: "[]",
  diagnosisName: "",
  labInvestigations: "",
  screeningImaging: "[]",
  treatment: "",
  treatmentDoctors: "[]",
  remarks: "",
  instructions: "",
  followUpDays: "",
  patientOutcome: "",
  patientOutcomeNotes: "",
  disposition: "",
  referralDetails: "",
  referralDateTime: "",
  dutyDoctorName: "",
  medicalOfficer: "",
  attenderSignature: "",
  recordsHandledOverBy: "",
  consultationAmount: "",
  prescriptionData: "",
  prescriptionNotes: "",
  sended: "",
};

export default function DoctorConsultationPage() {
  const params = useParams();
  const hname = params?.Hname as string;

  // Hospital-timezone-aware "today" — fixes UTC vs local date mismatch
  const { todayDate: todayDateFromCtx } = useHospitalTimezone();
  // Use a ref so loadData (which is called in a useEffect) always reads the latest value
  const todayDateRef = useRef(todayDateFromCtx);
  useEffect(() => { todayDateRef.current = todayDateFromCtx; }, [todayDateFromCtx]);

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
  const [allergyOptions, setAllergyOptions] = useState<string[]>([]);

  const [editingRecordId, setEditingRecordId] = useState<number | null>(null);
  const [patientType, setPatientType] = useState<PatientType>("OP");
  const [formValues, setFormValues] = useState<Record<string, string>>(DEFAULT_FORM_VALUES);

  const handleSignatureUpload = (file: File | null) => {
    if (!file) {
      updateFormValue("attenderSignature", "");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      updateFormValue("attenderSignature", result);
    };
    reader.readAsDataURL(file);
  };

  // Fetch doctors and auto-select on mount
  useEffect(() => {
    async function initPage() {
      if (!hname) return;
      try {
        const [user, role] = await Promise.all([getCurrentUser(hname), getCurrentUserRole(hname)]);

        const response = await fetch(`/api/${encodeURIComponent(hname)}/forms/consultant_doctor_master`, { cache: "no-store" });
        const data = await response.json();
        const docs = (data.rows || []).map((r: any) => ({
          name: String(r.doctor_consultant_name || r.doctorConsultantName || r.consultant_doctor_name || r.name || ""),
        })).filter((r: any) => r.name);
        setDoctorsList(docs);

        if (role && role.toLowerCase() !== "admin" && user) {
          const profile = await loadDoctorProfile(hname, user);
          if (profile) {
            const fullName = `${profile.first_name} ${profile.last_name}`.trim();
            const matchedDoc = docs.find((d: any) => {
              const dName = d.name.toLowerCase();
              return dName === fullName.toLowerCase() || dName.includes(fullName.toLowerCase()) || fullName.toLowerCase().includes(dName);
            });
            if (matchedDoc) {
              setSelectedDoctor(matchedDoc.name);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load initial page data", err);
      }
    }
    void initPage();
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

  // Fetch allergies on mount
  useEffect(() => {
    async function fetchAllergies() {
      if (!hname) return;
      try {
        const response = await fetch(`/api/${encodeURIComponent(hname)}/forms/allergy_master`, { cache: "no-store" });
        const data = await response.json();
        const options = (data.rows || [])
          .map((r: any) => String(r.description || ""))
          .filter(Boolean);
        setAllergyOptions(options);
      } catch (err) {
        console.error("Failed to load allergies", err);
      }
    }
    void fetchAllergies();
  }, [hname]);

  const loadData = async () => {
    if (!hname) return;
    setIsLoading(true);
    setErrorMessage("");
    try {
      const todayDate = todayDateRef.current; // timezone-aware YYYY-MM-DD
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
      .filter((row) => isVitalsCompleted(row) && text(row, ["appointment_status"]) !== "Completed")
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
      ["Appointment Number", (() => {
        const num = text(selectedPatientRow, ["appointment_number"]);
        if (!num) return "";
        const pType = text(selectedPatientRow, ["patient_type"]) || (selectedPatientRow?.appointment_id ? "Appointment" : "Walk in");
        const isWalkInPatient = String(pType).toLowerCase() === "walk-in" || String(pType).toLowerCase() === "walk in";
        const apptDate = text(selectedPatientRow, ["appointment_date"]) || todayDateRef.current;
        const dateCompact = apptDate ? apptDate.slice(0, 10).replace(/-/g, "") : "";
        return isWalkInPatient
          ? (dateCompact ? `WK-${dateCompact}-${String(num).padStart(4, "0")}` : `WK-${String(num).padStart(4, "0")}`)
          : (dateCompact ? `APT-${dateCompact}-${String(num).padStart(4, "0")}` : `APT-${String(num).padStart(4, "0")}`);
      })()],
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
      ["Temperature (F/C)", text(selectedPatientRow, ["temperature"])],
      ["Pulse Rate (beats/min)", text(selectedPatientRow, ["pulse_rate"])],
      ["Respiratory Rate (breaths/min)", text(selectedPatientRow, ["respiratory_rate"])],
      ["Systolic BP", text(selectedPatientRow, ["systolic_bp"])],
      ["Diastolic BP", text(selectedPatientRow, ["diastolic_bp"])],
      ["SpO2 (%)", text(selectedPatientRow, ["spo2"])],
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
    setFormValues({ ...DEFAULT_FORM_VALUES, tokenNumber: text(row, ["appointment_id"]), patientDetails: patientName(row) });
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
      ...DEFAULT_FORM_VALUES,
      tokenNumber,
      patientDetails: selectedName,
      allergies: text(row, ["allergies"]) || "No",
      allergiesDetail: text(row, ["allergiesDetail", "allergies_detail"]) || "[]",
      presentIllness: text(row, ["presentIllness", "present_illness"]),
      patientPastHistory: text(row, ["patientPastHistory", "patient_past_history"]),
      provisionalDiagnosis: text(row, ["provisionalDiagnosis", "provisional_diagnosis"]),
      symptoms: text(row, ["symptoms"]) || "[]",
      diagnosisName: text(row, ["diagnosisName", "diagnosis_name"]),
      labInvestigations: text(row, ["labInvestigations", "lab_investigations"]),
      screeningImaging: text(row, ["screeningImaging", "screening_imaging"]) || "[]",
      treatment: text(row, ["treatment"]) || "",
      treatmentDoctors: text(row, ["treatmentDoctors", "treatment_notes", "treatment_doctors"]) || "[]",
      remarks: text(row, ["remarks"]),
      instructions: text(row, ["instructions"]),
      followUpDays: text(row, ["followUpDays", "follow_up_days"]),
      patientOutcome: text(row, ["patientOutcome", "patient_outcome"]),
      patientOutcomeNotes: text(row, ["patientOutcomeNotes", "patient_outcome_notes"]) || "",
      disposition: text(row, ["disposition"]),
      referralDetails: text(row, ["referralDetails", "referral_details"]) || "",
      referralDateTime: text(row, ["referralDateTime", "referral_date_time"]) || "",
      dutyDoctorName: text(row, ["dutyDoctorName", "duty_doctor_name"]) || "",
      medicalOfficer: text(row, ["medicalOfficer", "medical_officer"]) || "",
      attenderSignature: text(row, ["attenderSignature", "attender_signature"]) || "",
      recordsHandledOverBy: text(row, ["recordsHandledOverBy", "records_handed_over_by"]) || "",
      consultationAmount: text(row, ["consultationAmount", "consultation_amount"]),
      prescriptionData: text(row, ["prescriptionData", "prescription_data"]),
      prescriptionNotes: text(row, ["prescriptionNotes", "prescription_notes"]) || "",
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
      const finalSended = (isSended || status === "Completed") ? "Yes" : formValues.sended;
      const payload = {
        id: editingRecordId,
        cardTitle: "Doctor Consultation Entry",
        fields: Object.keys(DEFAULT_FORM_VALUES).filter(k => !["tokenNumber", "patientDetails", "sended"].includes(k)).map(k => ({ id: k, type: "text" })).concat([
          { id: "status", type: "text" },
          { id: "doctor", type: "text" },
          { id: "tokenNumber", type: "text" },
          { id: "patientDetails", type: "text" },
          { id: "patientType", type: "text" },
          { id: "sended", type: "text" },
        ]),
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
      setFormValues({ ...DEFAULT_FORM_VALUES });
      setPatientType("OP");
      setEditingRecordId(null);
      void loadData();

      // If completing, also mark appointment as completed
      if (status === "Completed" && formValues.tokenNumber) {
        try {
          await fetch(`/api/${encodeURIComponent(hname)}/appointments`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: formValues.tokenNumber,
              status: "Conslt",
            }),
          });
        } catch (e) {
          console.error("Failed to mark appointment as completed:", e);
        }
      }

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
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${detailTab === tab ? "border-brand-500 text-brand-500 dark:border-brand-400 dark:text-brand-400" : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"}`}
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

                {detailTab === "Consultation Billing" && (
                  <div className="-mx-4 -mt-4">
                    <ConsultationBillingDashboard />
                  </div>
                )}
              </div>
            )}

            {/* Consultation Form tab */}
            {detailTab === "Consultation Form" && (
              <form className="flex flex-col gap-8" onSubmit={e => e.preventDefault()}>
                {successMessage && <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{successMessage}</div>}
                {errorMessage && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>}

                {/* Section 1: Clinical Assessment */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
                  <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-gray-100 border-b border-gray-100 pb-3 dark:border-gray-800">
                    1. Clinical Assessment
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Allergies</label>
                      <div className="flex gap-4">
                        {(["Yes", "No"]).map(opt => (
                          <label key={opt} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="allergies"
                              value={opt}
                              checked={formValues.allergies === opt}
                              onChange={() => updateFormValue("allergies", opt)}
                              className="h-4 w-4 text-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    {formValues.allergies === "Yes" && (
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Specify Allergies</label>
                        <MultiSelectDropdown
                          options={allergyOptions}
                          value={formValues.allergiesDetail}
                          onChange={val => updateFormValue("allergiesDetail", val)}
                          placeholder="Select Allergy..."
                        />
                      </div>
                    )}
                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Present Illness</label>
                      <textarea value={formValues.presentIllness} onChange={e => updateFormValue("presentIllness", e.target.value)} rows={3} className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Patient Past History</label>
                      <textarea value={formValues.patientPastHistory} onChange={e => updateFormValue("patientPastHistory", e.target.value)} rows={3} className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" placeholder="Enter patient past history..." />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Provisional Diagnosis</label>
                      <textarea value={formValues.provisionalDiagnosis} onChange={e => updateFormValue("provisionalDiagnosis", e.target.value)} rows={3} className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" placeholder="Enter provisional diagnosis..." />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Symptoms</label>
                      <MultiSelectDropdown
                        options={symptomOptions}
                        value={formValues.symptoms}
                        onChange={val => updateFormValue("symptoms", val)}
                        placeholder="Select Symptoms..."
                      />
                    </div>
                    <div className="relative">
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">ICD-11 Search</label>
                      <input
                        type="text"
                        value={icdQuery}
                        onChange={e => setIcdQuery(e.target.value)}
                        onFocus={() => { if (icdResults.length > 0) setShowIcdDropdown(true); }}
                        onBlur={() => setTimeout(() => setShowIcdDropdown(false), 200)}
                        className="h-10 w-full rounded-lg border border-gray-300 px-3 pr-10 text-sm dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                        placeholder="Type to search ICD-11..."
                        autoComplete="off"
                      />
                      <svg className="absolute right-3 top-9 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
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
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Diagnosis Name</label>
                      <input type="text" value={formValues.diagnosisName} onChange={e => updateFormValue("diagnosisName", e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                    </div>
                  </div>
                </div>

                {/* Section 2: Investigations */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
                  <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-gray-100 border-b border-gray-100 pb-3 dark:border-gray-800">
                    2. Investigations
                  </h3>
                  <div className="space-y-6">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Lab Investigations</label>
                      <textarea value={formValues.labInvestigations} onChange={e => updateFormValue("labInvestigations", e.target.value)} rows={3} className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" placeholder="Enter lab tests..." />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Screening & Imaging</label>
                      <ScreeningImagingTable
                        value={formValues.screeningImaging}
                        onChange={val => updateFormValue("screeningImaging", val)}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Treatment */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
                  <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-gray-100 border-b border-gray-100 pb-3 dark:border-gray-800">
                    3. Treatment
                  </h3>
                  <div className="space-y-6">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">General Treatment Note</label>
                      <textarea
                        value={formValues.treatment}
                        onChange={e => updateFormValue("treatment", e.target.value)}
                        rows={4}
                        className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        placeholder="Enter general treatment instructions..."
                      />
                    </div>
                    <div>
                      <DoctorTreatmentNoteGroup
                        doctors={doctorsList.map(d => d.name)}
                        value={formValues.treatmentDoctors}
                        onChange={val => updateFormValue("treatmentDoctors", val)}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 4: Prescription */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
                  <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-gray-100 border-b border-gray-100 pb-3 dark:border-gray-800 flex items-center justify-between">
                    4. Prescription
                  </h3>
                  <div className="space-y-2">
                    <PrescriptionTable
                      value={formValues.prescriptionData}
                      onChange={val => updateFormValue("prescriptionData", val)}
                      isSended={queueTab === "Draft" ? false : (formValues.sended === "Yes" || queueTab === "Completed")}
                      onSendToPharmacy={handleSendToPharmacy}
                      isSubmitting={isSubmitting}
                    />
                    <div className="mt-4">
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Prescription Notes / Instructions</label>
                      <textarea
                        value={formValues.prescriptionNotes}
                        onChange={e => updateFormValue("prescriptionNotes", e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        placeholder="Enter additional prescription details or special instructions..."
                      />
                    </div>
                  </div>
                </div>

                {/* Section 5: Advice */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
                  <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-gray-100 border-b border-gray-100 pb-3 dark:border-gray-800">
                    5. Advice
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Remarks</label>
                      <textarea value={formValues.remarks} onChange={e => updateFormValue("remarks", e.target.value)} rows={2} className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Instructions</label>
                      <textarea value={formValues.instructions} onChange={e => updateFormValue("instructions", e.target.value)} rows={2} className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Follow-up Days</label>
                      <input type="number" min="0" value={formValues.followUpDays} onChange={e => updateFormValue("followUpDays", e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-400">Patient Category</label>
                      <div className="flex gap-4">
                        {(["OP", "IP"] as PatientType[]).map(type => (
                          <label
                            key={type}
                            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 transition-all select-none ${patientType === type
                              ? type === "OP" ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20" : "border-purple-500 bg-purple-50 dark:border-purple-400 dark:bg-purple-900/20"
                              : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900/40 dark:hover:border-gray-600"}`}
                          >
                            <input type="radio" name="patientType" value={type} checked={patientType === type} onChange={() => setPatientType(type)} className="sr-only" />
                            <span className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${patientType === type ? (type === "OP" ? "border-blue-500" : "border-purple-500") : "border-gray-400 dark:border-gray-500"}`}>
                              {patientType === type && <span className={`h-2 w-2 rounded-full ${type === "OP" ? "bg-blue-500" : "bg-purple-500"}`} />}
                            </span>
                            <span className={`text-sm font-medium ${patientType === type ? (type === "OP" ? "text-blue-700 dark:text-blue-300" : "text-purple-700 dark:text-purple-300") : "text-gray-600 dark:text-gray-400"}`}>
                              {type === "OP" ? "OP — Outpatient" : "IP — Inpatient"}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Patient Outcome</label>
                      <select value={formValues.patientOutcome} onChange={e => updateFormValue("patientOutcome", e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
                        <option value="">Select Outcome</option>
                        <option value="Improved">Improved</option>
                        <option value="Unchanged">Unchanged</option>
                        <option value="Worsened">Worsened</option>
                        <option value="Died">Died</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Patient Outcome Notes</label>
                      <textarea value={formValues.patientOutcomeNotes} onChange={e => updateFormValue("patientOutcomeNotes", e.target.value)} rows={2} className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" placeholder="Enter patient outcome notes..." />
                    </div>
                  </div>
                </div>

                {/* Section 6: Disposition */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
                  <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-gray-100 border-b border-gray-100 pb-3 dark:border-gray-800">
                    6. Disposition
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Disposition</label>
                      <select value={formValues.disposition} onChange={e => updateFormValue("disposition", e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
                        <option value="">Select Disposition</option>
                        <option value="Admission">Admission</option>
                        <option value="Discharge">Discharge</option>
                        <option value="LAMA">LAMA</option>
                        <option value="Transferred / Refer to other hospital">Transferred / Refer to other hospital</option>
                      </select>
                    </div>

                    {formValues.disposition === "Transferred / Refer to other hospital" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100 dark:border-gray-800">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Referral / Transfer Details</label>
                          <textarea
                            value={formValues.referralDetails}
                            onChange={e => updateFormValue("referralDetails", e.target.value)}
                            rows={3}
                            className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                            placeholder="Enter hospital name, reason for transfer, or notes..."
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Transfer Date & Time</label>
                          <input
                            type="datetime-local"
                            value={formValues.referralDateTime}
                            onChange={e => updateFormValue("referralDateTime", e.target.value)}
                            className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                          />
                        </div>
                      </div>
                    )}

                  </div>
                </div>

                {/* Section 7: Others */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
                  <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-gray-100 border-b border-gray-100 pb-3 dark:border-gray-800">
                    7. Others
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Duty Doctor Name (View Only)</label>
                      <input
                        type="text"
                        value={selectedDoctor || formValues.dutyDoctorName || ""}
                        readOnly
                        disabled
                        className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-500 cursor-not-allowed dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Medical Officer</label>
                      <select
                        value={formValues.medicalOfficer}
                        onChange={e => updateFormValue("medicalOfficer", e.target.value)}
                        className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      >
                        <option value="">Select Medical Officer</option>
                        {doctorsList.map(doc => (
                          <option key={doc.name} value={doc.name}>{doc.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Attender Signature</label>
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <label className="flex h-10 flex-1 cursor-pointer items-center justify-between rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-600 transition hover:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90">
                            <span className="truncate text-xs">
                              {formValues.attenderSignature ? "Signature Uploaded" : "Upload Signature Image..."}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={e => handleSignatureUpload(e.target.files?.[0] ?? null)}
                            />
                          </label>
                          {formValues.attenderSignature && (
                            <button
                              type="button"
                              onClick={() => updateFormValue("attenderSignature", "")}
                              className="text-xs font-semibold text-red-500 hover:text-red-700"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        {formValues.attenderSignature && (
                          <div className="relative mt-1 h-20 w-40 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-950 flex items-center justify-center">
                            <img
                              src={formValues.attenderSignature}
                              alt="Attender Signature Preview"
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Records Handed Over By</label>
                      <select
                        value={formValues.recordsHandledOverBy}
                        onChange={e => updateFormValue("recordsHandledOverBy", e.target.value)}
                        className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      >
                        <option value="">Select Doctor</option>
                        {doctorsList.map(doc => (
                          <option key={doc.name} value={doc.name}>{doc.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setFormValues({ ...DEFAULT_FORM_VALUES });
                      setPatientType("OP");
                      setEditingRecordId(null);
                    }}
                    className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting || !selectedDoctor}
                    onClick={() => saveForm("Draft")}
                    className="rounded-lg border border-brand-500 px-5 py-2.5 text-sm font-medium text-brand-500 hover:bg-brand-50 disabled:opacity-50 transition shadow-sm dark:hover:bg-brand-900/20"
                    title={!selectedDoctor ? "Please select a doctor first" : "Save as draft"}
                  >
                    {isSubmitting ? "Saving..." : "Save as Draft"}
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting || !selectedDoctor}
                    onClick={() => saveForm("Completed")}
                    className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 transition shadow-sm"
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
