"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type ConsultationRow = {
  id: number;
  status?: string;
  token_number?: string;
  tokenNumber?: string;
  patient_details?: string;
  patientDetails?: string;
  diagnosis_name?: string;
  diagnosisName?: string;
  doctor?: string;
  patient_type?: string;
  patientType?: string;
  created_at?: string;
  updated_at?: string;
  check_in_time?: string;
};

function getTimingHistory(row: ConsultationRow) {
  const checkIn = row.check_in_time;
  if (!checkIn) return "—";
  
  const start = new Date(checkIn);
  const end = row.status === "Completed" ? new Date(row.updated_at || row.created_at || "") : new Date();
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return "—";
  
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return "—";
  
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  
  const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  
  if (row.status !== "Completed") {
    return `${durationStr} (Elap.)`;
  }
  return durationStr;
}

function text(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const val = row[key];
    if (val !== null && val !== undefined && String(val).trim()) return String(val).trim();
  }
  return "";
}

function formatDate(value: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
}

type StatusFilter = "All" | "Draft" | "Completed";

export default function OutPatientQueuePage() {
  const params = useParams();
  const hname = params?.Hname as string;

  const [rows, setRows] = useState<ConsultationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");

  useEffect(() => {
    async function load() {
      if (!hname) return;
      setIsLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/${encodeURIComponent(hname)}/forms/doctor_consultation_entry`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load.");
        const allRows: ConsultationRow[] = data.rows || [];
        // Filter to OP only (also include records with no patient_type set — treated as OP by default)
        const opRows = allRows.filter(
          (r) => {
            const pt = text(r as Record<string, unknown>, ["patientType", "patient_type"]);
            return pt === "" || pt === "OP";
          }
        );
        setRows(opRows);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load patients.");
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [hname]);

  const filtered = rows.filter((r) => {
    const name = text(r as Record<string, unknown>, ["patientDetails", "patient_details"]).toLowerCase();
    const token = text(r as Record<string, unknown>, ["tokenNumber", "token_number"]).toLowerCase();
    const doctor = text(r as Record<string, unknown>, ["doctor"]).toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase()) || token.includes(search.toLowerCase()) || doctor.includes(search.toLowerCase());
    const status = text(r as Record<string, unknown>, ["status"]);
    const matchStatus = statusFilter === "All" || status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalCount = rows.length;
  const completedCount = rows.filter(r => text(r as Record<string, unknown>, ["status"]) === "Completed").length;
  const draftCount = rows.filter(r => text(r as Record<string, unknown>, ["status"]) === "Draft").length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Outpatient Queue</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Track all outpatient (OP) consultations — in progress and completed.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: "Total Outpatients",
            value: totalCount,
            color: "from-blue-500 to-blue-600",
            icon: (
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2h5M12 12a4 4 0 100-8 4 4 0 000 8z" />
              </svg>
            ),
          },
        ].map((card) => (
          <div key={card.label} className="relative overflow-hidden rounded-2xl bg-white shadow-sm border border-gray-100 dark:border-gray-800 dark:bg-gray-900/50 p-5 flex items-center gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${card.color} shadow-md`}>
              {card.icon}
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900/50">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
          </svg>
          <input
            id="op-search"
            type="text"
            placeholder="Search by patient, token or doctor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900/50">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-sm text-gray-500">
            <svg className="mr-2 h-5 w-5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading patients…
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 text-sm text-red-500">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-sm text-gray-500 gap-2">
            <svg className="h-10 w-10 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>No outpatients found{search ? " matching your search" : ""}.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/60">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">#</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Token</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Patient Name</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Doctor</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Diagnosis</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">OP</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status / Exit</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Timing History</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {filtered.map((row, idx) => {
                  const status = text(row as Record<string, unknown>, ["status"]);
                  const isCompleted = status === "Completed";
                  return (
                    <tr key={row.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="px-5 py-4 text-gray-400 dark:text-gray-500 tabular-nums">{idx + 1}</td>
                      <td className="px-5 py-4 font-mono font-medium text-gray-700 dark:text-gray-300">
                        {text(row as Record<string, unknown>, ["tokenNumber", "token_number"]) || "—"}
                      </td>
                      <td className="px-5 py-4 font-medium text-gray-900 dark:text-white">
                        {text(row as Record<string, unknown>, ["patientDetails", "patient_details"]) || "—"}
                      </td>
                      <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                        {text(row as Record<string, unknown>, ["doctor"]) || "—"}
                      </td>
                      <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                        {text(row as Record<string, unknown>, ["diagnosisName", "diagnosis_name"]) || "—"}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          OP
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Exited Hospital
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                            In Progress
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">
                        {getTimingHistory(row)}
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                        {formatDate(text(row as Record<string, unknown>, ["updated_at"]) || text(row as Record<string, unknown>, ["created_at"]))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
