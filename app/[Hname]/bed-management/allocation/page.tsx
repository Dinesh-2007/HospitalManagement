"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PageLayout } from "../../../../components/page-layout";
import { bedStatusColor } from "../../../../lib/infrastructure";
import { getCurrentUser } from "../../../../app/actions/user";

/* ─── Types ─── */

type Row = Record<string, unknown>;
type StepId = "block" | "floor" | "department" | "ward" | "beds";

type PatientRecord = {
  patient_id: string;
  patient_name: string;
  mobile?: string;
  dob?: string;
};

type HierarchyData = {
  buildings: Row[];
  floors: Row[];
  floorDepartments: Row[];
  wardInstances: Row[];
  wardMasters: Row[];
  rooms: Row[];
  beds: Row[];
};

/* ─── Pure helper functions (module-level, no closures) ─── */

function floorsOf(h: HierarchyData, building: Row): Row[] {
  return (h.floors ?? []).filter(
    (f) => String(f.building_id) === String(building.id)
  );
}

function deptsOf(h: HierarchyData, floor: Row | null, building: Row): Row[] {
  const fds = (h.floorDepartments ?? []).filter((fd) =>
    floor
      ? String(fd.floor_id) === String(floor.id)
      : String(fd.building_id) === String(building.id)
  );
  const map = new Map<string, Row>();
  fds.forEach((fd) => {
    const name = String(fd.department_name ?? "");
    if (name && !map.has(name.toLowerCase())) map.set(name.toLowerCase(), fd);
  });
  return Array.from(map.values());
}

function wardsOf(
  h: HierarchyData,
  dept: string,
  floor: Row | null,
  building: Row
): Row[] {
  const floorName = floor ? String(floor.floor_name ?? "") : "";
  const bldName = String(building.building_name ?? "");
  const wardMap = new Map<string, Row>();

  (h.wardInstances ?? []).forEach((w) => {
    const wDept = String(w.department_name ?? "");
    const wFloor = String(w.floor_name ?? "");
    const wBld = String(w.building_name ?? "");
    if (
      wDept.toLowerCase() === dept.toLowerCase() &&
      (!floorName || wFloor.toLowerCase() === floorName.toLowerCase()) &&
      wBld.toLowerCase() === bldName.toLowerCase()
    ) {
      const type = String(w.ward_type ?? "");
      if (type && !wardMap.has(type.toLowerCase()))
        wardMap.set(type.toLowerCase(), w);
    }
  });

  // Fallback to ward_master if no instances found
  if (wardMap.size === 0) {
    (h.wardMasters ?? []).forEach((w) => {
      const desc = String(w.description ?? w.code ?? "");
      if (desc && !wardMap.has(desc.toLowerCase()))
        wardMap.set(desc.toLowerCase(), { ward_type: desc, _from_master: true });
    });
  }

  return Array.from(wardMap.values());
}

function bedsOfWard(
  h: HierarchyData,
  ward: string,
  dept: string,
  building: Row,
  floor: Row | null
): Row[] {
  const bN = String(building.building_name ?? "").toLowerCase();
  const fN = floor ? String(floor.floor_name ?? "").toLowerCase() : "";
  return (h.beds ?? []).filter((b) => {
    const bW = String(b.ward_name ?? b.ward ?? "").toLowerCase();
    const bD = String(b.department_name ?? "").toLowerCase();
    const bB = String(b.building_name ?? "").toLowerCase();
    const bF = String(b.floor_name ?? "").toLowerCase();
    return (
      bW === ward.toLowerCase() &&
      bD === dept.toLowerCase() &&
      bB === bN &&
      (!fN || bF === fN)
    );
  });
}

function bedsOfBuilding(h: HierarchyData, building: Row): Row[] {
  const name = String(building.building_name ?? "").toLowerCase();
  return (h.beds ?? []).filter(
    (b) => String(b.building_name ?? "").toLowerCase() === name
  );
}

function bedsOfFloor(h: HierarchyData, floor: Row, building: Row): Row[] {
  const bN = String(building.building_name ?? "").toLowerCase();
  const fN = String(floor.floor_name ?? "").toLowerCase();
  return (h.beds ?? []).filter(
    (b) =>
      String(b.building_name ?? "").toLowerCase() === bN &&
      String(b.floor_name ?? "").toLowerCase() === fN
  );
}

function bedsOfDept(
  h: HierarchyData,
  dept: string,
  building: Row,
  floor: Row | null
): Row[] {
  const bN = String(building.building_name ?? "").toLowerCase();
  const fN = floor ? String(floor.floor_name ?? "").toLowerCase() : "";
  return (h.beds ?? []).filter((b) => {
    const bD = String(b.department_name ?? "").toLowerCase();
    const bB = String(b.building_name ?? "").toLowerCase();
    const bF = String(b.floor_name ?? "").toLowerCase();
    return bD === dept.toLowerCase() && bB === bN && (!fN || bF === fN);
  });
}

function stats(beds: Row[]) {
  let available = 0,
    occupied = 0;
  beds.forEach((b) => {
    const s = String(b.status || "Available");
    if (s === "Available") available++;
    else if (s === "Occupied") occupied++;
  });
  return { total: beds.length, available, occupied };
}

/* ─── CSS keyframes ─── */

const ANIM_CSS = `
@keyframes bedStepIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
.bed-step-in{animation:bedStepIn .32s ease-out both}
@keyframes bedCardPop{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
.bed-card-pop{animation:bedCardPop .25s ease-out both}
`;

/* ═══════════════════════════════════════════════════════════
   Bed Allocation Page – Step-by-step hospital structure
   ═══════════════════════════════════════════════════════════ */

export default function BedAllocationPage() {
  const params = useParams();
  const hname = params?.Hname as string;

  /* ── State ── */
  const [currentUser, setCurrentUser] = useState("");
  const [hierarchy, setHierarchy] = useState<HierarchyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [currentStep, setCurrentStep] = useState<StepId>("block");
  const [selectedBuilding, setSelectedBuilding] = useState<Row | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<Row | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedWard, setSelectedWard] = useState("");
  const [selectedBed, setSelectedBed] = useState<Row | null>(null);

  const [patientSearchQuery, setPatientSearchQuery] = useState("");
  const [patientSearchResults, setPatientSearchResults] = useState<
    PatientRecord[]
  >([]);
  const [isSearchingPatient, setIsSearchingPatient] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(
    null
  );

  const [isAllocating, setIsAllocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* ── Load session user ── */
  useEffect(() => {
    if (!hname) return;
    getCurrentUser(hname)
      .then((u) => {
        if (u) setCurrentUser(u);
      })
      .catch(() => {});
  }, [hname]);

  /* ── Load ALL hierarchy data & run initial auto-skip cascade ── */
  useEffect(() => {
    if (!hname) return;
    setIsLoading(true);
    fetch(`/api/${hname}/infrastructure?action=hierarchy`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data: HierarchyData) => {
        setHierarchy(data);
        const blds = data.buildings ?? [];

        // No buildings or multiple → show block selection
        if (blds.length === 0 || blds.length >= 2) {
          setCurrentStep("block");
          return;
        }

        // Single building → auto-skip & cascade
        const b = blds[0];
        setSelectedBuilding(b);

        const fls = floorsOf(data, b);
        if (fls.length >= 2) {
          setCurrentStep("floor");
          return;
        }
        const f = fls[0] ?? null;
        setSelectedFloor(f);

        const ds = deptsOf(data, f, b);
        if (ds.length >= 2) {
          setCurrentStep("department");
          return;
        }
        const d = ds.length === 1 ? String(ds[0].department_name) : "";
        setSelectedDepartment(d);
        if (!d) {
          setCurrentStep("beds");
          return;
        }

        const ws = wardsOf(data, d, f, b);
        if (ws.length >= 2) {
          setCurrentStep("ward");
          return;
        }
        setSelectedWard(ws.length === 1 ? String(ws[0].ward_type) : "");
        setCurrentStep("beds");
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [hname]);

  /* ─────────────────────────────────────────────
     Selection handlers with auto-skip cascade
     ───────────────────────────────────────────── */

  function handleSelectBuilding(b: Row) {
    if (!hierarchy) return;
    setSelectedBuilding(b);
    setSelectedFloor(null);
    setSelectedDepartment("");
    setSelectedWard("");
    setSelectedBed(null);
    setSelectedPatient(null);
    setMessage(null);
    setError(null);

    const fls = floorsOf(hierarchy, b);
    if (fls.length >= 2) {
      setCurrentStep("floor");
      return;
    }
    const f = fls[0] ?? null;
    setSelectedFloor(f);

    const ds = deptsOf(hierarchy, f, b);
    if (ds.length >= 2) {
      setCurrentStep("department");
      return;
    }
    const d = ds.length === 1 ? String(ds[0].department_name) : "";
    setSelectedDepartment(d);
    if (!d) {
      setCurrentStep("beds");
      return;
    }

    const ws = wardsOf(hierarchy, d, f, b);
    if (ws.length >= 2) {
      setCurrentStep("ward");
      return;
    }
    setSelectedWard(ws.length === 1 ? String(ws[0].ward_type) : "");
    setCurrentStep("beds");
  }

  function handleSelectFloor(f: Row) {
    if (!hierarchy || !selectedBuilding) return;
    setSelectedFloor(f);
    setSelectedDepartment("");
    setSelectedWard("");
    setSelectedBed(null);
    setSelectedPatient(null);
    setMessage(null);
    setError(null);

    const ds = deptsOf(hierarchy, f, selectedBuilding);
    if (ds.length >= 2) {
      setCurrentStep("department");
      return;
    }
    const d = ds.length === 1 ? String(ds[0].department_name) : "";
    setSelectedDepartment(d);
    if (!d) {
      setCurrentStep("beds");
      return;
    }

    const ws = wardsOf(hierarchy, d, f, selectedBuilding);
    if (ws.length >= 2) {
      setCurrentStep("ward");
      return;
    }
    setSelectedWard(ws.length === 1 ? String(ws[0].ward_type) : "");
    setCurrentStep("beds");
  }

  function handleSelectDepartment(dept: string) {
    if (!hierarchy || !selectedBuilding) return;
    setSelectedDepartment(dept);
    setSelectedWard("");
    setSelectedBed(null);
    setSelectedPatient(null);
    setMessage(null);
    setError(null);

    const ws = wardsOf(hierarchy, dept, selectedFloor, selectedBuilding);
    if (ws.length >= 2) {
      setCurrentStep("ward");
      return;
    }
    setSelectedWard(ws.length === 1 ? String(ws[0].ward_type) : "");
    setCurrentStep("beds");
  }

  function handleSelectWard(w: string) {
    setSelectedWard(w);
    setSelectedBed(null);
    setSelectedPatient(null);
    setMessage(null);
    setError(null);
    setCurrentStep("beds");
  }

  function handleSelectBed(bed: Row) {
    if (String(bed.status || "Available") !== "Available") return;
    setSelectedBed(bed);
    setMessage(null);
    setError(null);
  }

  /* ── Breadcrumb back-navigation ── */

  function handleBreadcrumbClick(step: StepId) {
    setSelectedBed(null);
    setSelectedPatient(null);
    setPatientSearchQuery("");
    setMessage(null);
    setError(null);
    switch (step) {
      case "block":
        setSelectedBuilding(null);
        setSelectedFloor(null);
        setSelectedDepartment("");
        setSelectedWard("");
        break;
      case "floor":
        setSelectedFloor(null);
        setSelectedDepartment("");
        setSelectedWard("");
        break;
      case "department":
        setSelectedDepartment("");
        setSelectedWard("");
        break;
      case "ward":
        setSelectedWard("");
        break;
    }
    setCurrentStep(step);
  }

  function handleGoBack() {
    for (let i = breadcrumbs.length - 1; i >= 0; i--) {
      if (breadcrumbs[i].clickable) {
        handleBreadcrumbClick(breadcrumbs[i].step);
        return;
      }
    }
  }

  /* ─────────────────────────
     Derived / computed data
     ───────────────────────── */

  const buildings = useMemo(
    () => hierarchy?.buildings ?? [],
    [hierarchy]
  );

  const currentFloors = useMemo(() => {
    if (!hierarchy || !selectedBuilding) return [];
    return floorsOf(hierarchy, selectedBuilding);
  }, [hierarchy, selectedBuilding]);

  const currentDepts = useMemo(() => {
    if (!hierarchy || !selectedBuilding) return [];
    return deptsOf(hierarchy, selectedFloor, selectedBuilding);
  }, [hierarchy, selectedFloor, selectedBuilding]);

  const currentWards = useMemo(() => {
    if (!hierarchy || !selectedBuilding || !selectedDepartment) return [];
    return wardsOf(
      hierarchy,
      selectedDepartment,
      selectedFloor,
      selectedBuilding
    );
  }, [hierarchy, selectedDepartment, selectedFloor, selectedBuilding]);

  const currentBeds = useMemo(() => {
    if (!hierarchy || !selectedBuilding || !selectedWard) return [];
    return bedsOfWard(
      hierarchy,
      selectedWard,
      selectedDepartment,
      selectedBuilding,
      selectedFloor
    );
  }, [hierarchy, selectedWard, selectedDepartment, selectedBuilding, selectedFloor]);

  const bedsByRoom = useMemo(() => {
    const groups = new Map<string, Row[]>();
    currentBeds.forEach((bed) => {
      const room = String(bed.room_name || "General");
      if (!groups.has(room)) groups.set(room, []);
      groups.get(room)!.push(bed);
    });
    return groups;
  }, [currentBeds]);

  /* ── Breadcrumb items ── */
  const breadcrumbs = useMemo(() => {
    if (!hierarchy) return [];
    const items: { step: StepId; label: string; clickable: boolean }[] = [];
    if (selectedBuilding) {
      items.push({
        step: "block",
        label: String(selectedBuilding.building_name || "Building"),
        clickable: hierarchy.buildings.length >= 2,
      });
      if (selectedFloor) {
        items.push({
          step: "floor",
          label: String(selectedFloor.floor_name || "Floor"),
          clickable: floorsOf(hierarchy, selectedBuilding).length >= 2,
        });
      }
      if (selectedDepartment) {
        items.push({
          step: "department",
          label: selectedDepartment,
          clickable:
            deptsOf(hierarchy, selectedFloor, selectedBuilding).length >= 2,
        });
      }
      if (selectedWard && selectedDepartment) {
        items.push({
          step: "ward",
          label: selectedWard,
          clickable:
            wardsOf(
              hierarchy,
              selectedDepartment,
              selectedFloor,
              selectedBuilding
            ).length >= 2,
        });
      }
    }
    return items;
  }, [
    hierarchy,
    selectedBuilding,
    selectedFloor,
    selectedDepartment,
    selectedWard,
  ]);

  const canGoBack = breadcrumbs.some((bc) => bc.clickable);

  /* ── Patient search ── */
  useEffect(() => {
    if (!patientSearchQuery.trim() || selectedPatient) {
      setPatientSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setIsSearchingPatient(true);
      fetch(
        `/api/${hname}/patient-search?q=${encodeURIComponent(
          patientSearchQuery.trim()
        )}`
      )
        .then((r) => r.json())
        .then((d) => setPatientSearchResults(d.rows ?? []))
        .catch(() => setPatientSearchResults([]))
        .finally(() => setIsSearchingPatient(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [patientSearchQuery, selectedPatient, hname]);

  /* ── Allocate bed ── */
  async function handleAllocate() {
    if (!selectedBed || !selectedPatient) {
      setError("Please select a bed and choose a verified patient.");
      return;
    }
    setIsAllocating(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/${hname}/infrastructure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "allocate",
          bedId: Number(selectedBed.id),
          patientId: selectedPatient.patient_id,
          patientName: selectedPatient.patient_name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Allocation failed.");
      setMessage(
        `Bed allocated to ${
          data.patientName || selectedPatient.patient_name
        } (${selectedPatient.patient_id}).`
      );
      // Refresh hierarchy to reflect updated bed statuses
      fetch(`/api/${hname}/infrastructure?action=hierarchy`, {
        cache: "no-store",
      })
        .then((r) => r.json())
        .then((d) => setHierarchy(d))
        .catch(() => {});
      setSelectedBed(null);
      setSelectedPatient(null);
      setPatientSearchQuery("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Allocation failed.");
    } finally {
      setIsAllocating(false);
    }
  }

  /* ═══════════════════
     RENDER
     ═══════════════════ */

  const STEPS_ARR: StepId[] = ["block", "floor", "department", "ward", "beds"];
  const STEP_LABEL: Record<StepId, string> = {
    block: "Building",
    floor: "Floor",
    department: "Dept",
    ward: "Ward",
    beds: "Beds",
  };

  return (
    <PageLayout title="Bed Allocation">
      {/* Inject CSS keyframes */}
      <style dangerouslySetInnerHTML={{ __html: ANIM_CSS }} />

      <div className="space-y-5">
        {/* ────────────────────────────────────────
            Breadcrumb + Step Indicator
           ──────────────────────────────────────── */}
        <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] px-5 py-4">
          {/* Breadcrumb row */}
          <div className="flex items-center gap-2 text-sm flex-wrap">
            {/* Back button */}
            {currentStep !== "block" && canGoBack && (
              <button
                type="button"
                onClick={handleGoBack}
                className="mr-1 flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition"
                title="Go back"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            )}

            <span className="font-medium text-gray-700 dark:text-gray-300">
              🏥 Bed Allocation
            </span>

            {breadcrumbs.map((bc) => (
              <span key={bc.step} className="flex items-center gap-1.5">
                <svg
                  className="h-3.5 w-3.5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                {bc.clickable ? (
                  <button
                    type="button"
                    onClick={() => handleBreadcrumbClick(bc.step)}
                    className="font-medium text-brand-600 dark:text-brand-400 hover:underline transition"
                  >
                    {bc.label}
                  </button>
                ) : (
                  <span className="font-medium text-gray-500 dark:text-gray-400">
                    {bc.label}
                  </span>
                )}
              </span>
            ))}
          </div>

          {/* Step indicator dots */}
          <div className="mt-3 flex items-center gap-1">
            {STEPS_ARR.map((step, idx) => {
              const isActive = step === currentStep;
              const isPassed =
                STEPS_ARR.indexOf(step) < STEPS_ARR.indexOf(currentStep);
              return (
                <div key={step} className="flex items-center gap-1">
                  {idx > 0 && (
                    <div
                      className={`h-0.5 w-5 sm:w-8 rounded transition-colors ${
                        isPassed
                          ? "bg-brand-500"
                          : "bg-gray-200 dark:bg-gray-700"
                      }`}
                    />
                  )}
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                      isActive
                        ? "bg-brand-500 text-white scale-110 shadow-md shadow-brand-500/25"
                        : isPassed
                        ? "bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300"
                        : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
                    }`}
                    title={STEP_LABEL[step]}
                  >
                    {idx + 1}
                  </div>
                </div>
              );
            })}
            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
              {currentStep === "block"
                ? "Select Building"
                : currentStep === "floor"
                ? "Select Floor"
                : currentStep === "department"
                ? "Select Department"
                : currentStep === "ward"
                ? "Select Ward"
                : "Select Bed"}
            </span>
          </div>
        </section>

        {/* ────────────────────────────────────────
            Loading Spinner
           ──────────────────────────────────────── */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600 dark:border-gray-700 dark:border-t-brand-400" />
          </div>
        )}

        {/* ────────────────────────────────────────
            Step Content
           ──────────────────────────────────────── */}
        {!isLoading && (
          <div key={currentStep} className="bed-step-in">
            {/* ═══ BLOCK (Building) Selection ═══ */}
            {currentStep === "block" && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-1">
                  Select Building
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                  Choose a building block to view available beds
                </p>

                {buildings.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-16 text-center">
                    <div className="text-4xl mb-3">🏗️</div>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">
                      No buildings configured
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                      Set up your hospital infrastructure in Bed Management →
                      Infrastructure Setup
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {buildings.map((b, i) => {
                      const s = stats(
                        hierarchy ? bedsOfBuilding(hierarchy, b) : []
                      );
                      return (
                        <button
                          key={String(b.id)}
                          type="button"
                          onClick={() => handleSelectBuilding(b)}
                          className="bed-card-pop group relative aspect-square flex flex-col items-center justify-center rounded-2xl border-2 border-gray-200 bg-gradient-to-br from-white to-gray-50 p-4 transition-all hover:border-brand-400 hover:shadow-xl hover:shadow-brand-500/10 hover:-translate-y-1 active:scale-95 dark:border-gray-700 dark:from-gray-900 dark:to-gray-800 dark:hover:border-brand-500"
                          style={{ animationDelay: `${i * 60}ms` }}
                        >
                          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-brand-50 text-2xl group-hover:bg-brand-100 transition dark:bg-brand-950/50 dark:group-hover:bg-brand-900/40">
                            🏥
                          </div>
                          <span className="font-semibold text-gray-800 dark:text-white/90 text-sm text-center">
                            {String(b.building_name || b.code)}
                          </span>
                          <div className="mt-2 flex items-center gap-1.5 text-xs">
                            <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                              {s.available}
                            </span>
                            <span className="text-gray-300 dark:text-gray-600">
                              /
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">
                              {s.total} beds
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ═══ FLOOR Selection ═══ */}
            {currentStep === "floor" && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-1">
                  Select Floor
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                  Choose a floor in{" "}
                  {String(selectedBuilding?.building_name || "the building")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {currentFloors.map((f, i) => {
                    const s = stats(
                      hierarchy && selectedBuilding
                        ? bedsOfFloor(hierarchy, f, selectedBuilding)
                        : []
                    );
                    return (
                      <button
                        key={String(f.id)}
                        type="button"
                        onClick={() => handleSelectFloor(f)}
                        className="bed-card-pop group flex items-center gap-4 rounded-xl border-2 border-gray-200 bg-white p-5 transition-all hover:border-brand-400 hover:shadow-lg hover:shadow-brand-500/10 active:scale-[0.98] dark:border-gray-700 dark:bg-gray-900 dark:hover:border-brand-500"
                        style={{ animationDelay: `${i * 60}ms` }}
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-xl group-hover:bg-blue-100 transition dark:bg-blue-950/40 dark:group-hover:bg-blue-900/40">
                          🏢
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <span className="font-semibold text-gray-800 dark:text-white/90 block truncate">
                            {String(f.floor_name)}
                          </span>
                          <div className="mt-1 flex items-center gap-2 text-xs">
                            <span className="text-green-600 dark:text-green-400 inline-flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                              {s.available} available
                            </span>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-500 dark:text-gray-400">
                              {s.total} total
                            </span>
                          </div>
                        </div>
                        <svg
                          className="h-5 w-5 text-gray-300 group-hover:text-brand-500 transition shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ═══ DEPARTMENT Selection ═══ */}
            {currentStep === "department" && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-1">
                  Select Department
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                  Choose a department
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {currentDepts.map((d, i) => {
                    const dn = String(d.department_name);
                    const s = stats(
                      hierarchy && selectedBuilding
                        ? bedsOfDept(
                            hierarchy,
                            dn,
                            selectedBuilding,
                            selectedFloor
                          )
                        : []
                    );
                    return (
                      <button
                        key={dn}
                        type="button"
                        onClick={() => handleSelectDepartment(dn)}
                        className="bed-card-pop group flex flex-col items-center gap-3 rounded-xl border-2 border-gray-200 bg-white p-5 transition-all hover:border-brand-400 hover:shadow-lg hover:shadow-brand-500/10 active:scale-95 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-brand-500"
                        style={{ animationDelay: `${i * 60}ms` }}
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-50 text-xl group-hover:bg-purple-100 transition dark:bg-purple-950/40 dark:group-hover:bg-purple-900/40">
                          🏛️
                        </div>
                        <span className="font-semibold text-gray-800 dark:text-white/90 text-sm text-center">
                          {dn}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-green-600 dark:text-green-400 inline-flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                            {s.available}
                          </span>
                          <span className="text-gray-300 dark:text-gray-600">
                            /
                          </span>
                          <span className="text-gray-500 dark:text-gray-400">
                            {s.total}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ═══ WARD Selection ═══ */}
            {currentStep === "ward" && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-1">
                  Select Ward
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                  Choose a ward in {selectedDepartment}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {currentWards.map((w, i) => {
                    const wt = String(w.ward_type ?? "");
                    const s = stats(
                      hierarchy && selectedBuilding
                        ? bedsOfWard(
                            hierarchy,
                            wt,
                            selectedDepartment,
                            selectedBuilding,
                            selectedFloor
                          )
                        : []
                    );
                    const pct =
                      s.total > 0
                        ? Math.round((s.available / s.total) * 100)
                        : 0;
                    return (
                      <button
                        key={wt}
                        type="button"
                        onClick={() => handleSelectWard(wt)}
                        className="bed-card-pop group flex flex-col gap-3 rounded-xl border-2 border-gray-200 bg-white p-5 transition-all hover:border-brand-400 hover:shadow-lg hover:shadow-brand-500/10 active:scale-95 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-brand-500"
                        style={{ animationDelay: `${i * 60}ms` }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-lg group-hover:bg-amber-100 transition dark:bg-amber-950/40 dark:group-hover:bg-amber-900/40">
                            🛏️
                          </div>
                          <span className="font-semibold text-gray-800 dark:text-white/90 text-sm text-left">
                            {wt}
                          </span>
                        </div>
                        {/* Occupancy progress bar */}
                        <div className="w-full">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-green-600 dark:text-green-400">
                              {s.available} free
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">
                              {s.total} total
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-500 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ═══ BEDS Grid ═══ */}
            {currentStep === "beds" && (
              <div>
                <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                      {selectedWard || "Beds"}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {stats(currentBeds).available} available out of{" "}
                      {currentBeds.length} beds
                    </p>
                  </div>
                  {/* Legend */}
                  <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-3 w-3 rounded"
                        style={{ backgroundColor: "#22c55e" }}
                      />
                      Available
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-3 w-3 rounded"
                        style={{ backgroundColor: "#ef4444" }}
                      />
                      Occupied
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-3 w-3 rounded"
                        style={{ backgroundColor: "#3b82f6" }}
                      />
                      Reserved
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-3 w-3 rounded"
                        style={{ backgroundColor: "#6b7280" }}
                      />
                      Other
                    </span>
                  </div>
                </div>

                {currentBeds.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-12 text-center">
                    <div className="text-4xl mb-3">🛏️</div>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">
                      No beds found
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                      No beds are configured for this selection
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Array.from(bedsByRoom.entries()).map(
                      ([roomName, roomBeds]) => (
                        <div key={roomName}>
                          {/* Room header (only when multiple rooms) */}
                          {bedsByRoom.size > 1 && (
                            <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3 flex items-center gap-2">
                              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                              {roomName}
                              <span className="text-xs font-normal text-gray-400 ml-1">
                                ({stats(roomBeds).available}/{roomBeds.length}{" "}
                                available)
                              </span>
                            </h4>
                          )}

                          {/* Bed tiles */}
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                            {roomBeds.map((bed, i) => {
                              const st = String(bed.status || "Available");
                              const isAvail = st === "Available";
                              const isSel =
                                selectedBed &&
                                Number(selectedBed.id) === Number(bed.id);
                              return (
                                <button
                                  key={String(bed.id)}
                                  type="button"
                                  disabled={!isAvail}
                                  onClick={() => handleSelectBed(bed)}
                                  className={`bed-card-pop relative flex flex-col items-center justify-center rounded-xl border-2 p-3 min-h-[76px] transition-all ${
                                    isSel
                                      ? "border-brand-500 bg-brand-50 dark:bg-brand-950/30 ring-2 ring-brand-500/30 scale-105 shadow-lg"
                                      : isAvail
                                      ? "border-green-200 bg-green-50/50 hover:border-green-400 hover:shadow-md hover:-translate-y-0.5 cursor-pointer dark:border-green-900 dark:bg-green-950/20 dark:hover:border-green-500"
                                      : "border-gray-200 bg-gray-50/50 cursor-not-allowed opacity-70 dark:border-gray-700 dark:bg-gray-900/50"
                                  }`}
                                  style={{ animationDelay: `${i * 25}ms` }}
                                  title={
                                    isAvail
                                      ? `${String(
                                          bed.description ||
                                            bed.bed_number ||
                                            bed.code
                                        )} – Click to select`
                                      : `${String(
                                          bed.description ||
                                            bed.bed_number ||
                                            bed.code
                                        )} – ${st}${
                                          bed.patient_name
                                            ? ` (${String(bed.patient_name)})`
                                            : ""
                                        }`
                                  }
                                >
                                  <span
                                    className="h-3 w-3 rounded-full mb-1"
                                    style={{
                                      backgroundColor: bedStatusColor(st),
                                    }}
                                  />
                                  <span
                                    className={`text-xs font-semibold truncate max-w-full ${
                                      isAvail
                                        ? "text-gray-800 dark:text-white/90"
                                        : "text-gray-400 dark:text-gray-500"
                                    }`}
                                  >
                                    {String(
                                      bed.description ||
                                        bed.bed_number ||
                                        bed.code
                                    )}
                                  </span>
                                  {bed.bed_type && (
                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-full">
                                      {String(bed.bed_type)}
                                    </span>
                                  )}
                                  {!isAvail && bed.patient_name && (
                                    <span className="text-[10px] text-red-500 dark:text-red-400 truncate max-w-full mt-0.5">
                                      {String(bed.patient_name)}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ────────────────────────────────────────
            Patient Assignment Panel
           ──────────────────────────────────────── */}
        {selectedBed && (
          <section className="bed-step-in rounded-2xl border border-brand-200 dark:border-brand-800 bg-gradient-to-br from-brand-50/50 to-white dark:from-brand-950/20 dark:to-gray-900/80 p-6 space-y-4 shadow-lg shadow-brand-500/5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-brand-100 dark:border-brand-900/50 pb-4">
              <div>
                <h4 className="text-base font-semibold text-gray-800 dark:text-white/90 flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                  Allocating: {String(selectedBed.description || selectedBed.bed_number)}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {selectedBed.room_name
                    ? `Room: ${String(selectedBed.room_name)} • `
                    : ""}
                  Ward: {String(selectedBed.ward_name)} • Rate: ₹
                  {String(selectedBed.charge || selectedBed.rate || 0)}/day
                </p>
              </div>
              {currentUser && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 self-start sm:self-auto font-medium">
                  Staff: {currentUser}
                </span>
              )}
            </div>

            {/* Patient Lookup */}
            {!selectedPatient ? (
              <div className="relative space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">
                  Search Registered Patient (by PID, Name, or Mobile) *
                </label>
                <input
                  type="text"
                  value={patientSearchQuery}
                  onChange={(e) => setPatientSearchQuery(e.target.value)}
                  placeholder="Type Patient ID (e.g. PID-0001), Name, or Mobile..."
                  className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                />

                {isSearchingPatient && (
                  <p className="text-xs text-gray-500">
                    Searching patient database...
                  </p>
                )}

                {patientSearchResults.length > 0 && (
                  <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                    {patientSearchResults.map((p) => (
                      <button
                        key={p.patient_id}
                        type="button"
                        onClick={() => {
                          setSelectedPatient(p);
                          setPatientSearchQuery("");
                          setPatientSearchResults([]);
                        }}
                        className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-brand-50 dark:hover:bg-brand-500/10 transition flex items-center justify-between"
                      >
                        <div>
                          <span className="font-semibold text-gray-800 dark:text-white">
                            {p.patient_name}
                          </span>
                          <span className="ml-2 text-xs text-brand-600 dark:text-brand-400 font-mono">
                            ({p.patient_id})
                          </span>
                        </div>
                        {p.mobile && (
                          <span className="text-xs text-gray-500">
                            📱 {p.mobile}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {patientSearchQuery.trim() &&
                  !isSearchingPatient &&
                  patientSearchResults.length === 0 && (
                    <p className="text-xs text-red-500">
                      No registered patient found matching &quot;
                      {patientSearchQuery}&quot;. Please register the patient
                      first.
                    </p>
                  )}
              </div>
            ) : (
              /* Selected Patient Card */
              <div className="rounded-lg border border-green-200 bg-green-50/60 p-4 dark:border-green-800 dark:bg-green-950/20 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-md bg-green-100 dark:bg-green-900/60 px-2 py-0.5 text-xs font-semibold text-green-800 dark:text-green-200 font-mono">
                      {selectedPatient.patient_id}
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {selectedPatient.patient_name}
                    </span>
                  </div>
                  {selectedPatient.mobile && (
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                      Phone: {selectedPatient.mobile}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPatient(null)}
                  className="text-xs text-red-600 hover:text-red-800 font-medium underline"
                >
                  Change
                </button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleAllocate}
                disabled={isAllocating || !selectedPatient}
                className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 focus:outline-hidden focus:ring-3 focus:ring-brand-500/25 disabled:opacity-50"
              >
                {isAllocating
                  ? "Allocating Bed..."
                  : "Confirm Bed Allocation"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedBed(null);
                  setSelectedPatient(null);
                  setPatientSearchQuery("");
                }}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </section>
        )}

        {/* ── Success / Error Messages ── */}
        {message && (
          <p className="text-sm font-medium text-green-600 dark:text-green-400 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
            ✅ {message}
          </p>
        )}
        {error && (
          <p className="text-sm font-medium text-red-600 dark:text-red-400 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            ⚠️ {error}
          </p>
        )}
      </div>
    </PageLayout>
  );
}
