"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageLayout } from "../../../../components/page-layout";

type Row = Record<string, unknown>;

const REPORT_TYPES = [
  { key: "bed-occupancy", label: "Bed Occupancy" },
  { key: "ward-occupancy", label: "Ward Occupancy" },
  { key: "floor-occupancy", label: "Floor Occupancy" },
  { key: "building-occupancy", label: "Building Occupancy" },
  { key: "admission", label: "Admission Report" },
  { key: "transfer", label: "Transfer Report" },
  { key: "bed-utilization", label: "Bed Utilization" },
] as const;

type ReportType = (typeof REPORT_TYPES)[number]["key"];

const REPORT_COLUMNS: Record<ReportType, { key: string; label: string }[]> = {
  "bed-occupancy": [
    { key: "code", label: "Code" },
    { key: "bed_name", label: "Bed" },
    { key: "bed_type", label: "Type" },
    { key: "status", label: "Status" },
    { key: "ward_name", label: "Ward" },
    { key: "room_name", label: "Room" },
    { key: "floor_name", label: "Floor" },
    { key: "building_name", label: "Building" },
    { key: "department_name", label: "Department" },
    { key: "patient_name", label: "Patient" },
    { key: "patient_id", label: "Patient ID" },
  ],
  "ward-occupancy": [
    { key: "ward", label: "Ward" },
    { key: "department", label: "Department" },
    { key: "total_beds", label: "Total Beds" },
    { key: "occupied", label: "Occupied" },
    { key: "available", label: "Available" },
  ],
  "floor-occupancy": [
    { key: "floor", label: "Floor" },
    { key: "building", label: "Building" },
    { key: "total_beds", label: "Total Beds" },
    { key: "occupied", label: "Occupied" },
    { key: "available", label: "Available" },
  ],
  "building-occupancy": [
    { key: "building", label: "Building" },
    { key: "total_beds", label: "Total Beds" },
    { key: "occupied", label: "Occupied" },
    { key: "available", label: "Available" },
  ],
  admission: [
    { key: "patient_name", label: "Patient" },
    { key: "patient_id", label: "Patient ID" },
    { key: "bed_name", label: "Bed" },
    { key: "room_name", label: "Room" },
    { key: "ward_name", label: "Ward" },
    { key: "floor_name", label: "Floor" },
    { key: "building_name", label: "Building" },
    { key: "allocated_by_name", label: "Allocated By" },
    { key: "allocated_at", label: "Allocated At" },
    { key: "status", label: "Status" },
  ],
  transfer: [
    { key: "patient_name", label: "Patient" },
    { key: "patient_id", label: "Patient ID" },
    { key: "old_bed_name", label: "From Bed" },
    { key: "old_room_name", label: "From Room" },
    { key: "new_bed_name", label: "To Bed" },
    { key: "new_room_name", label: "To Room" },
    { key: "transferred_by_name", label: "Transferred By" },
    { key: "reason", label: "Reason" },
    { key: "transferred_at", label: "Date" },
  ],
  "bed-utilization": [
    { key: "code", label: "Code" },
    { key: "bed_name", label: "Bed" },
    { key: "bed_type", label: "Type" },
    { key: "status", label: "Status" },
    { key: "charge", label: "Charge" },
    { key: "ward_name", label: "Ward" },
    { key: "room_name", label: "Room" },
    { key: "floor_name", label: "Floor" },
    { key: "building_name", label: "Building" },
    { key: "department_name", label: "Department" },
  ],
};

const PAGE_SIZE = 20;

export default function ReportsPage() {
  const params = useParams();
  const hname = params?.Hname as string;

  const [activeReport, setActiveReport] = useState<ReportType>("bed-occupancy");
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const loadReport = useCallback(async () => {
    if (!hname) return;
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/${hname}/infrastructure?action=reports&reportType=${activeReport}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        setRows(data.rows ?? []);
      }
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, [hname, activeReport]);

  useEffect(() => {
    setCurrentPage(1);
    setSearchQuery("");
    void loadReport();
  }, [loadReport]);

  const columns = REPORT_COLUMNS[activeReport];

  // Filter rows
  const filteredRows = searchQuery
    ? rows.filter((row) =>
        columns.some((col) =>
          String(row[col.key] ?? "")
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
        )
      )
    : rows;

  // Pagination
  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const pagedRows = filteredRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  function formatCellValue(value: unknown, key: string): string {
    if (value === null || value === undefined || value === "") return "-";
    if (key.endsWith("_at") || key === "transferred_at" || key === "allocated_at") {
      try {
        return new Date(String(value)).toLocaleString();
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  return (
    <PageLayout title="Bed Management Reports">
      <div className="space-y-6">
        {/* Report type tabs */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-200/70 dark:bg-gray-800 p-1.5">
          {REPORT_TYPES.map((report) => (
            <button
              key={report.key}
              type="button"
              onClick={() => setActiveReport(report.key)}
              className={`shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition ${
                activeReport === report.key
                  ? "border border-slate-200 bg-white dark:bg-gray-700 dark:border-gray-600 text-slate-900 dark:text-white/90 shadow-[0_1px_2px_rgba(15,23,42,0.08)]"
                  : "border border-transparent bg-transparent text-slate-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700"
              }`}
            >
              {report.label}
            </button>
          ))}
        </div>

        {/* Report content */}
        <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col gap-3 border-b border-gray-100 px-6 py-5 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
                {REPORT_TYPES.find((r) => r.key === activeReport)?.label} Report
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {filteredRows.length} record(s)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Search..."
                className="h-9 w-48 rounded-lg border border-gray-300 bg-transparent px-3 py-1.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
              <button
                type="button"
                onClick={() => void loadReport()}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {isLoading ? (
              <p className="text-sm text-gray-500">Loading report...</p>
            ) : pagedRows.length === 0 ? (
              <p className="text-sm text-gray-500">No data for this report.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          #
                        </th>
                        {columns.map((col) => (
                          <th
                            key={col.key}
                            className="px-4 py-3 text-left font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {pagedRows.map((row, rowIndex) => (
                        <tr key={String(row.id ?? rowIndex)}>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                            {(currentPage - 1) * PAGE_SIZE + rowIndex + 1}
                          </td>
                          {columns.map((col) => (
                            <td
                              key={col.key}
                              className="px-4 py-3 text-gray-700 dark:text-gray-300"
                            >
                              {col.key === "status" ? (
                                <span
                                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                                  style={{
                                    backgroundColor:
                                      String(row[col.key]) === "Occupied" ? "#fef2f2" :
                                      String(row[col.key]) === "Available" ? "#f0fdf4" :
                                      String(row[col.key]) === "Reserved" ? "#eff6ff" :
                                      "#f9fafb",
                                    color:
                                      String(row[col.key]) === "Occupied" ? "#dc2626" :
                                      String(row[col.key]) === "Available" ? "#16a34a" :
                                      String(row[col.key]) === "Reserved" ? "#2563eb" :
                                      "#6b7280",
                                  }}
                                >
                                  {formatCellValue(row[col.key], col.key)}
                                </span>
                              ) : (
                                formatCellValue(row[col.key], col.key)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800 mt-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Page {currentPage} of {totalPages}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
