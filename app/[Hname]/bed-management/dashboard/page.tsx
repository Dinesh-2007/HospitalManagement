"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageLayout } from "../../../../components/page-layout";

type StatsData = {
  totalBeds: number;
  occupied: number;
  available: number;
  reserved: number;
  maintenance: number;
  cleaning: number;
  blocked: number;
  occupancyPercent: number;
  departmentWise: Array<Record<string, unknown>>;
  wardWise: Array<Record<string, unknown>>;
};

export default function BedDashboardPage() {
  const params = useParams();
  const hname = params?.Hname as string;
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!hname) return;

    async function loadStats() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/${hname}/infrastructure?action=stats`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch { /* ignore */ }
      finally { setIsLoading(false); }
    }

    void loadStats();
  }, [hname]);

  if (isLoading) {
    return (
      <PageLayout title="Bed Management Dashboard">
        <div className="text-center py-20">
          <p className="text-gray-500 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </PageLayout>
    );
  }

  if (!stats || stats.totalBeds === 0) {
    return (
      <PageLayout title="Bed Management Dashboard">
        <div className="text-center py-20">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-gray-500 dark:text-gray-400">
            No bed data available. Set up infrastructure first.
          </p>
        </div>
      </PageLayout>
    );
  }

  const summaryCards = [
    { label: "Total Beds", value: stats.totalBeds, color: "bg-slate-500", textColor: "text-slate-600 dark:text-slate-400" },
    { label: "Occupied", value: stats.occupied, color: "bg-red-500", textColor: "text-red-600 dark:text-red-400" },
    { label: "Available", value: stats.available, color: "bg-green-500", textColor: "text-green-600 dark:text-green-400" },
    { label: "Reserved", value: stats.reserved, color: "bg-blue-500", textColor: "text-blue-600 dark:text-blue-400" },
    { label: "Maintenance", value: stats.maintenance, color: "bg-gray-500", textColor: "text-gray-600 dark:text-gray-400" },
    { label: "Cleaning", value: stats.cleaning, color: "bg-amber-500", textColor: "text-amber-600 dark:text-amber-400" },
    { label: "Blocked", value: stats.blocked, color: "bg-gray-800", textColor: "text-gray-700 dark:text-gray-500" },
  ];

  return (
    <PageLayout title="Bed Management Dashboard">
      <div className="space-y-6">
        {/* Occupancy rate */}
        <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
              Overall Occupancy
            </h3>
            <div className="text-3xl font-bold text-brand-600 dark:text-brand-400">
              {stats.occupancyPercent}%
            </div>
          </div>
          <div className="h-4 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${stats.occupancyPercent}%`,
                backgroundColor:
                  stats.occupancyPercent >= 90
                    ? "#ef4444"
                    : stats.occupancyPercent >= 70
                      ? "#eab308"
                      : "#22c55e",
              }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {stats.occupied} of {stats.totalBeds} beds occupied
          </p>
        </section>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-4 text-center"
            >
              <div className={`inline-block h-2 w-8 rounded-full mb-2 ${card.color}`} />
              <div className={`text-2xl font-bold ${card.textColor}`}>
                {card.value}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {card.label}
              </div>
            </div>
          ))}
        </div>

        {/* Department-wise */}
        <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800">
            <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
              Department-wise Occupancy
            </h3>
          </div>
          <div className="p-4 sm:p-6">
            {stats.departmentWise.length === 0 ? (
              <p className="text-sm text-gray-500">No department data.</p>
            ) : (
              <div className="space-y-3">
                {stats.departmentWise.map((dept, i) => {
                  const total = Number(dept.total) || 0;
                  const occupied = Number(dept.occupied) || 0;
                  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
                  return (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-40 text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                        {String(dept.department || "Unassigned")}
                      </div>
                      <div className="flex-1">
                        <div className="h-3 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: pct >= 90 ? "#ef4444" : pct >= 70 ? "#eab308" : "#22c55e",
                            }}
                          />
                        </div>
                      </div>
                      <div className="w-24 text-right text-sm text-gray-600 dark:text-gray-400">
                        {occupied}/{total} ({pct}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Ward-wise */}
        <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800">
            <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
              Ward-wise Occupancy
            </h3>
          </div>
          <div className="p-4 sm:p-6">
            {stats.wardWise.length === 0 ? (
              <p className="text-sm text-gray-500">No ward data.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
                  <thead>
                    <tr>
                      {["Ward", "Department", "Total Beds", "Occupied", "Available", "Occupancy"].map((col) => (
                        <th key={col} className="px-4 py-3 text-left font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {stats.wardWise.map((ward, i) => {
                      const total = Number(ward.total) || 0;
                      const occupied = Number(ward.occupied) || 0;
                      const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
                      return (
                        <tr key={i}>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-medium">
                            {String(ward.ward || "Unassigned")}
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                            {String(ward.department || "-")}
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{total}</td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{occupied}</td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{Number(ward.available) || 0}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-16 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: pct >= 90 ? "#ef4444" : pct >= 70 ? "#eab308" : "#22c55e",
                                  }}
                                />
                              </div>
                              <span className="text-xs text-gray-500">{pct}%</span>
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
      </div>
    </PageLayout>
  );
}
