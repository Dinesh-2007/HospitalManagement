"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageLayout } from "../../../../components/page-layout";

type HierarchyData = {
  buildings: Array<Record<string, unknown>>;
  floors: Array<Record<string, unknown>>;
  floorDepartments: Array<Record<string, unknown>>;
  wardInstances: Array<Record<string, unknown>>;
  rooms: Array<Record<string, unknown>>;
  beds: Array<Record<string, unknown>>;
};

type GeneratorConfig = {
  buildingCount: number;
  floorsPerBuilding: number;
  departmentsPerFloor: number;
  wardsPerDepartment: number;
  roomsPerWard: number;
  bedsPerRoom: number;
  selectedDepartments: string[];
  selectedWardTypes: string[];
  roomType: string;
  roomPurpose: string;
  bedType: string;
  chargePerBed: number;
  chargePerRoom: number;
};

type GeneratorResult = {
  buildings: number;
  floors: number;
  departments: number;
  wards: number;
  rooms: number;
  beds: number;
};

const DEFAULT_CONFIG: GeneratorConfig = {
  buildingCount: 0,
  floorsPerBuilding: 0,
  departmentsPerFloor: 0,
  wardsPerDepartment: 0,
  roomsPerWard: 0,
  bedsPerRoom: 0,
  selectedDepartments: [],
  selectedWardTypes: [],
  roomType: "",
  roomPurpose: "",
  bedType: "",
  chargePerBed: 0,
  chargePerRoom: 0,
};

export default function InfrastructurePage() {
  const params = useParams();
  const hname = params?.Hname as string;

  const [activeTab, setActiveTab] = useState<"generator" | "hierarchy">("generator");
  const [config, setConfig] = useState<GeneratorConfig>(DEFAULT_CONFIG);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GeneratorResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hierarchy, setHierarchy] = useState<HierarchyData | null>(null);
  const [isLoadingHierarchy, setIsLoadingHierarchy] = useState(false);

  // LOV options
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);
  const [wardOptions, setWardOptions] = useState<string[]>([]);
  const [roomTypeOptions, setRoomTypeOptions] = useState<string[]>([]);
  const [roomPurposeOptions, setRoomPurposeOptions] = useState<string[]>([]);
  const [bedTypeOptions, setBedTypeOptions] = useState<string[]>([]);

  // Load LOV options
  useEffect(() => {
    if (!hname) return;

    async function loadOptions(tableName: string, setter: (opts: string[]) => void) {
      try {
        const res = await fetch(`/api/${hname}/forms/${tableName}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const opts = (data.rows ?? [])
          .map((row: Record<string, unknown>) => {
            const code = String(row.code ?? "").trim();
            const desc = String(row.description ?? row.department_type ?? "").trim();
            if (!code) return "";
            return desc ? `${code} - ${desc}` : code;
          })
          .filter(Boolean);
        setter(opts);
      } catch {
        /* ignore */
      }
    }

    // Fetch distinct bed types from bed_master
    async function loadBedTypes() {
      try {
        const res = await fetch(`/api/${hname}/forms/bed_master`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const seen = new Set<string>();
        const types: string[] = [];
        for (const row of (data.rows ?? []) as Record<string, unknown>[]) {
          const bt = String(row.bed_type ?? "").trim();
          if (bt && !seen.has(bt)) {
            seen.add(bt);
            types.push(bt);
          }
        }
        setBedTypeOptions(types);
      } catch {
        /* ignore */
      }
    }

    void loadOptions("department_master", setDepartmentOptions);
    void loadOptions("ward_master", setWardOptions);
    void loadOptions("room_type_master", setRoomTypeOptions);
    void loadOptions("room_purpose_master", setRoomPurposeOptions);
    void loadBedTypes();
  }, [hname]);

  // Load hierarchy
  const loadHierarchy = useCallback(async () => {
    setIsLoadingHierarchy(true);
    try {
      const res = await fetch(`/api/${hname}/infrastructure?action=hierarchy`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setHierarchy(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingHierarchy(false);
    }
  }, [hname]);

  useEffect(() => {
    if (activeTab === "hierarchy") void loadHierarchy();
  }, [activeTab, loadHierarchy]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/${hname}/infrastructure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", config }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed.");
      setResult(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const updateConfig = (field: keyof GeneratorConfig, value: unknown) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const toggleArrayItem = (field: "selectedDepartments" | "selectedWardTypes", value: string) => {
    setConfig((prev) => {
      const arr = prev[field];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  };

  return (
    <PageLayout title="Infrastructure Setup">
      <div className="space-y-6">
        {/* Tab switcher */}
        <div className="flex items-center gap-2 rounded-2xl bg-slate-200/70 dark:bg-gray-800 p-1.5 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("generator")}
            className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === "generator"
                ? "border border-slate-200 bg-white dark:bg-gray-700 dark:border-gray-600 text-slate-900 dark:text-white/90 shadow-[0_1px_2px_rgba(15,23,42,0.08)]"
                : "border border-transparent bg-transparent text-slate-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700"
            }`}
          >
            Quick Setup
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("hierarchy")}
            className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === "hierarchy"
                ? "border border-slate-200 bg-white dark:bg-gray-700 dark:border-gray-600 text-slate-900 dark:text-white/90 shadow-[0_1px_2px_rgba(15,23,42,0.08)]"
                : "border border-transparent bg-transparent text-slate-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700"
            }`}
          >
            Current Hierarchy
          </button>
        </div>

        {/* Generator Tab */}
        {activeTab === "generator" && (
          <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800">
              <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
                Infrastructure Generator
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Quickly generate the entire hospital infrastructure hierarchy. Enter counts
                and the system will auto-create buildings, floors, departments, wards, rooms,
                and beds.
              </p>
            </div>

            <div className="p-6 space-y-8">
              {/* Counts */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { label: "Buildings", key: "buildingCount" as const, min: 0, max: 10 },
                  { label: "Floors per Building", key: "floorsPerBuilding" as const, min: 0, max: 20 },
                  { label: "Departments per Floor", key: "departmentsPerFloor" as const, min: 0, max: 10 },
                  { label: "Wards per Department", key: "wardsPerDepartment" as const, min: 0, max: 10 },
                  { label: "Rooms per Ward", key: "roomsPerWard" as const, min: 0, max: 50 },
                  { label: "Beds per Room", key: "bedsPerRoom" as const, min: 0, max: 10 },
                ].map((item) => (
                  <div key={item.key}>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                      {item.label}
                    </label>
                    <input
                      type="number"
                      min={item.min}
                      max={item.max}
                      value={config[item.key] as number}
                      onChange={(e) => updateConfig(item.key, Math.max(0, Number(e.target.value) || 0))}
                      className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                    />
                  </div>
                ))}
              </div>

              {/* Department selection */}
              {departmentOptions.length > 0 && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-400">
                    Select Departments (leave empty for auto-named)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {departmentOptions.map((dept) => (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => toggleArrayItem("selectedDepartments", dept)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition ${
                          config.selectedDepartments.includes(dept)
                            ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:border-brand-500 dark:text-brand-300"
                            : "border-gray-300 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 hover:border-brand-300"
                        }`}
                      >
                        {dept}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Ward type selection */}
              {wardOptions.length > 0 && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-400">
                    Select Ward Types (leave empty for auto-named)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {wardOptions.map((ward) => (
                      <button
                        key={ward}
                        type="button"
                        onClick={() => toggleArrayItem("selectedWardTypes", ward)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition ${
                          config.selectedWardTypes.includes(ward)
                            ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:border-brand-500 dark:text-brand-300"
                            : "border-gray-300 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 hover:border-brand-300"
                        }`}
                      >
                        {ward}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Optional config */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                    Room Type
                  </label>
                  <select
                    value={config.roomType}
                    onChange={(e) => updateConfig("roomType", e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  >
                    <option value="">Select Room Type</option>
                    {roomTypeOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                    Room Purpose
                  </label>
                  <select
                    value={config.roomPurpose}
                    onChange={(e) => updateConfig("roomPurpose", e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  >
                    <option value="">Select Room Purpose</option>
                    {roomPurposeOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                    {roomPurposeOptions.length === 0 && (
                      <option disabled value="">No room purposes in master — add via Room Purpose</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                    Bed Type
                  </label>
                  <select
                    value={config.bedType}
                    onChange={(e) => updateConfig("bedType", e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  >
                    <option value="">Select Bed Type</option>
                    {bedTypeOptions.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                    {bedTypeOptions.length === 0 && (
                      <option disabled value="">No bed types in master — add via Bed Master</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                    Charge per Bed
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={config.chargePerBed}
                    onChange={(e) => updateConfig("chargePerBed", Number(e.target.value) || 0)}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                    Charge per Room
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={config.chargePerRoom}
                    onChange={(e) => updateConfig("chargePerRoom", Number(e.target.value) || 0)}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="rounded-xl bg-slate-50 dark:bg-gray-800/50 p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Generation Preview
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { label: "Buildings", value: config.buildingCount },
                    { label: "Floors", value: config.buildingCount * config.floorsPerBuilding },
                    { label: "Dept Assignments", value: config.buildingCount * config.floorsPerBuilding * config.departmentsPerFloor },
                    { label: "Ward Instances", value: config.buildingCount * config.floorsPerBuilding * config.departmentsPerFloor * config.wardsPerDepartment },
                    { label: "Rooms", value: config.buildingCount * config.floorsPerBuilding * config.departmentsPerFloor * config.wardsPerDepartment * config.roomsPerWard },
                    { label: "Beds", value: config.buildingCount * config.floorsPerBuilding * config.departmentsPerFloor * config.wardsPerDepartment * config.roomsPerWard * config.bedsPerRoom },
                  ].map((item) => (
                    <div key={item.label} className="text-center">
                      <div className="text-2xl font-bold text-brand-600 dark:text-brand-400">
                        {item.value.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 border-t border-gray-100 dark:border-gray-800 pt-5">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating || config.buildingCount === 0}
                  className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 focus:outline-hidden focus:ring-3 focus:ring-brand-500/25 disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Generating...
                    </>
                  ) : (
                    "Generate Infrastructure"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setConfig(DEFAULT_CONFIG); setResult(null); setError(null); }}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                >
                  Reset
                </button>
              </div>

              {/* Result */}
              {result && (
                <div className="rounded-xl border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20 p-4">
                  <h4 className="text-sm font-semibold text-green-800 dark:text-green-300 mb-2">
                    ✓ Infrastructure Generated Successfully
                  </h4>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
                    {Object.entries(result).map(([key, value]) => (
                      <div key={key}>
                        <div className="text-lg font-bold text-green-700 dark:text-green-400">{value}</div>
                        <div className="text-xs text-green-600 dark:text-green-500 capitalize">{key}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-4">
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Hierarchy Tab */}
        {activeTab === "hierarchy" && (
          <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5 dark:border-gray-800">
              <div>
                <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
                  Current Infrastructure Hierarchy
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Overview of all buildings, floors, departments, wards, rooms, and beds.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadHierarchy()}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
              >
                Refresh
              </button>
            </div>

            <div className="p-6">
              {isLoadingHierarchy ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading hierarchy...</p>
              ) : !hierarchy || hierarchy.buildings.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">🏗️</div>
                  <p className="text-gray-500 dark:text-gray-400">
                    No infrastructure configured yet. Use the Quick Setup tab to generate.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                      { label: "Buildings", value: hierarchy.buildings.length, emoji: "🏢" },
                      { label: "Floors", value: hierarchy.floors.length, emoji: "🏗️" },
                      { label: "Dept Assignments", value: hierarchy.floorDepartments.length, emoji: "🏥" },
                      { label: "Ward Instances", value: hierarchy.wardInstances.length, emoji: "🛏️" },
                      { label: "Rooms", value: hierarchy.rooms.length, emoji: "🚪" },
                      { label: "Beds", value: hierarchy.beds.length, emoji: "🛌" },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-4 text-center"
                      >
                        <div className="text-xl mb-1">{item.emoji}</div>
                        <div className="text-xl font-bold text-gray-800 dark:text-white/90">
                          {item.value}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{item.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Building tree */}
                  <div className="space-y-3">
                    {hierarchy.buildings.map((building) => {
                      const buildingFloors = hierarchy.floors.filter(
                        (f: Record<string, unknown>) => Number(f.building_id) === Number(building.id)
                      );
                      return (
                        <details
                          key={String(building.id)}
                          className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                        >
                          <summary className="cursor-pointer bg-slate-50 dark:bg-gray-800 px-4 py-3 text-sm font-medium text-gray-800 dark:text-white/90 hover:bg-slate-100 dark:hover:bg-gray-700">
                            🏢 {String(building.building_name || building.code)} — {buildingFloors.length} floor(s)
                          </summary>
                          <div className="px-4 py-3 space-y-2">
                            {buildingFloors.length === 0 ? (
                              <p className="text-xs text-gray-400">No floors configured</p>
                            ) : (
                              buildingFloors.map((floor) => {
                                const floorDepts = hierarchy.floorDepartments.filter(
                                  (fd: Record<string, unknown>) => Number(fd.floor_id) === Number(floor.id)
                                );
                                return (
                                  <details
                                    key={String(floor.id)}
                                    className="ml-4 rounded-lg border border-gray-100 dark:border-gray-700"
                                  >
                                    <summary className="cursor-pointer px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                                      🏗️ {String(floor.floor_name)} — {floorDepts.length} dept(s)
                                    </summary>
                                    <div className="px-3 py-2 space-y-1">
                                      {floorDepts.map((fd) => {
                                        const wards = hierarchy.wardInstances.filter(
                                          (w: Record<string, unknown>) => Number(w.floor_dept_assignment_id) === Number(fd.id)
                                        );
                                        return (
                                          <div key={String(fd.id)} className="ml-4 text-xs text-gray-600 dark:text-gray-400">
                                            🏥 {String(fd.department_name)} — {wards.length} ward(s)
                                            {wards.map((w) => {
                                              const wRooms = hierarchy.rooms.filter(
                                                (r: Record<string, unknown>) =>
                                                  Number(r.ward_instance_id) === Number(w.id)
                                              );
                                              return (
                                                <div key={String(w.id)} className="ml-4">
                                                  🛏️ {String(w.ward_type)} — {wRooms.length} room(s)
                                                </div>
                                              );
                                            })}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </details>
                                );
                              })
                            )}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </PageLayout>
  );
}
