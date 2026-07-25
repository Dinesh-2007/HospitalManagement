"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageLayout } from "../../../components/page-layout";
import { getCurrentUser } from "../../../app/actions/user";

type TaskRow = {
  id: number;
  bed_id: number;
  bed_name: string;
  room_name: string;
  ward_name: string;
  floor_name: string;
  building_name: string;
  vacated_at: string;
  assigned_to?: string;
  status: "Pending" | "InProgress" | "Complete";
  started_at?: string;
  completed_at?: string;
  completed_by?: string;
  created_by?: string;
};

export default function HousekeepingPage() {
  const params = useParams();
  const hname = params?.Hname as string;

  const [currentUser, setCurrentUser] = useState<string>("");
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterWard, setFilterWard] = useState<string>("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Load session user
  useEffect(() => {
    if (!hname) return;
    getCurrentUser(hname).then((user) => {
      if (user) setCurrentUser(user);
    }).catch(() => {});
  }, [hname]);

  const loadTasks = useCallback(async () => {
    if (!hname) return;
    setIsLoading(true);
    setError(null);
    try {
      let url = `/api/${hname}/infrastructure?action=housekeeping&status=${filterStatus}`;
      if (filterWard) url += `&ward=${encodeURIComponent(filterWard)}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load housekeeping tasks.");
      const data = await res.json();
      setTasks(data.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks.");
    } finally {
      setIsLoading(false);
    }
  }, [hname, filterStatus, filterWard]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const handleClaim = async (taskId: number) => {
    setError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/${hname}/infrastructure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "hkClaim", taskId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to claim task.");
      setActionSuccess(`Task #${taskId} claimed successfully.`);
      void loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim failed.");
    }
  };

  const handleComplete = async (taskId: number, bedName: string) => {
    setError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/${hname}/infrastructure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "hkComplete", taskId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to complete task.");
      setActionSuccess(`Bed "${bedName}" cleaned and returned to Available status.`);
      void loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Completion failed.");
    }
  };

  // Extract unique wards for filter dropdown
  const wardsList = Array.from(new Set(tasks.map((t) => t.ward_name).filter(Boolean)));

  return (
    <PageLayout title="Housekeeping & Bed Sanitation">
      <div className="space-y-6">
        {/* Header & Stats Banner */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
            <div>
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
                Bed Sanitization Queue
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Vacated beds automatically enter the cleaning queue. Marking a task complete makes the bed available for allocation.
              </p>
            </div>
            {currentUser && (
              <span className="text-xs px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-medium self-start sm:self-auto">
                Logged in as: {currentUser}
              </span>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-10 rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                <option value="all">Active Tasks (Pending & In Progress)</option>
                <option value="Pending">Pending Only</option>
                <option value="InProgress">In Progress Only</option>
                <option value="Complete">Completed History</option>
              </select>
            </div>

            {wardsList.length > 0 && (
              <div>
                <select
                  value={filterWard}
                  onChange={(e) => setFilterWard(e.target.value)}
                  className="h-10 rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                >
                  <option value="">All Wards</option>
                  {wardsList.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => void loadTasks()}
              className="h-10 rounded-lg border border-gray-300 px-3 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
            >
              🔄 Refresh Queue
            </button>
          </div>
        </div>

        {actionSuccess && (
          <p className="text-sm font-medium text-green-700 bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800 p-4 rounded-xl">
            ✅ {actionSuccess}
          </p>
        )}

        {error && (
          <p className="text-sm font-medium text-red-700 bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800 p-4 rounded-xl">
            ⚠️ {error}
          </p>
        )}

        {/* Task Cards / Table */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="p-6">
            {isLoading ? (
              <p className="text-sm text-gray-500">Loading housekeeping tasks...</p>
            ) : tasks.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-base font-medium text-gray-700 dark:text-gray-300">No housekeeping tasks found.</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">All vacated beds have been cleaned!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tasks.map((task) => {
                  const isPending = task.status === "Pending";
                  const isInProgress = task.status === "InProgress";
                  const isComplete = task.status === "Complete";

                  return (
                    <div
                      key={task.id}
                      className={`rounded-xl border p-5 space-y-3 transition ${
                        isPending
                          ? "border-amber-200 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/10"
                          : isInProgress
                          ? "border-blue-200 bg-blue-50/40 dark:border-blue-900/50 dark:bg-blue-950/10"
                          : "border-gray-200 bg-gray-50/40 dark:border-gray-800 dark:bg-white/[0.02]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            {task.ward_name} • {task.room_name}
                          </span>
                          <h4 className="text-lg font-bold text-gray-800 dark:text-white mt-0.5">
                            {task.bed_name}
                          </h4>
                        </div>
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            isPending
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300"
                              : isInProgress
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300"
                              : "bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-300"
                          }`}
                        >
                          {task.status}
                        </span>
                      </div>

                      <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                        <p>📍 Location: Floor {task.floor_name}, {task.building_name}</p>
                        <p>🕒 Vacated: {new Date(task.vacated_at).toLocaleString()}</p>
                        {task.assigned_to && <p>👤 Assigned to: <strong className="text-gray-800 dark:text-gray-200">{task.assigned_to}</strong></p>}
                        {task.completed_by && <p>✅ Completed by: {task.completed_by} at {task.completed_at ? new Date(task.completed_at).toLocaleTimeString() : ""}</p>}
                      </div>

                      <div className="pt-2 flex items-center gap-2">
                        {isPending && (
                          <button
                            type="button"
                            onClick={() => handleClaim(task.id)}
                            className="w-full rounded-lg bg-blue-600 py-2 text-xs font-medium text-white hover:bg-blue-700 transition"
                          >
                            Claim Cleaning Task
                          </button>
                        )}
                        {(isPending || isInProgress) && (
                          <button
                            type="button"
                            onClick={() => handleComplete(task.id, task.bed_name)}
                            className="w-full rounded-lg bg-emerald-600 py-2 text-xs font-medium text-white hover:bg-emerald-700 transition"
                          >
                            Mark Cleaning Complete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
