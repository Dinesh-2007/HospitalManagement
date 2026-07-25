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

// Wizard State Types
export type RoomConfig = {
  id: string;
  name: string;
  type: string;
  purpose: string;
  capacity: number;
  bedCount: number;
  bedType?: string;
  wardType?: string; // If part of an Inpatient Ward
  hasBathroom?: boolean;
  hasVentilator?: boolean;
  hasMonitor?: boolean;
};

export type DepartmentConfig = {
  id: string;
  departmentName: string;
  departmentCode?: string;

  // Step 4 Infrastructure parameters
  hasClinic?: boolean;
  clinicsCount?: number;
  doctorRoomsCount?: number;
  nurseStationsCount?: number;
  procedureRoomsCount?: number;
  hasICU?: boolean;
  icuWardsCount?: number;

  // Department specific rooms
  xrayRoomsCount?: number;
  mriRoomsCount?: number;
  ctScanRoomsCount?: number;
  ultrasoundRoomsCount?: number;

  dispensingCountersCount?: number;
  medicineStoreCount?: number;
  billingCountersCount?: number;

  sampleCollectionCount?: number;
  testingLabsCount?: number;
  reportCounterCount?: number;

  // Inpatient Wards (Step 5)
  wards: Array<{
    id: string;
    wardType: string;
    roomsCount: number;
    bedsPerRoom: number;
    roomType: string;
    hasBathroom?: boolean;
    hasVentilator?: boolean;
    hasMonitor?: boolean;
  }>;

  rooms: RoomConfig[];
};

export type FloorConfig = {
  id: string;
  floorNumber: number;
  floorName: string;
  selectedDeptNames: string[];
  departments: DepartmentConfig[];
};

export type BuildingConfig = {
  id: string;
  name: string;
  code: string;
  description: string;
  floorsCount: number;
  floors: FloorConfig[];
};

export type DeptCustomConfig = {
  // Consultation & Clinics
  hasClinics: boolean;
  clinicCount: number;
  hasDoctorRooms: boolean;
  doctorRoomCount: number;
  hasNurseStation: boolean;
  nurseStationCount: number;
  hasProcedureRoom: boolean;
  procedureRoomCount: number;

  // Diagnostics & Imaging
  hasXray: boolean;
  xrayCount: number;
  hasMri: boolean;
  mriCount: number;
  hasCtScan: boolean;
  ctScanCount: number;
  hasWaitingArea: boolean;
  waitingCapacity: number;

  // Pharmacy
  hasDispensingCounter: boolean;
  dispensingCounterCount: number;
  hasMedicineStore: boolean;
  medicineStoreCount: number;

  // Pathology / Lab
  hasSampleBooth: boolean;
  sampleBoothCount: number;
  hasTestingLab: boolean;
  testingLabCount: number;
  hasReportCounter: boolean;
  reportCounterCount: number;

  // Inpatient Wards & Beds (Step 5)
  hasGeneralWard: boolean;
  generalWardRoomCount: number;
  generalWardBedsPerRoom: number;
  generalWardHasBathroom: boolean;

  hasPrivateWard: boolean;
  privateWardRoomCount: number;
  privateWardBedsPerRoom: number;
  privateWardHasBathroom: boolean;

  hasIcuWard: boolean;
  icuWardRoomCount: number;
  icuWardBedsPerRoom: number;
  icuHasVentilator: boolean;
  icuHasMonitor: boolean;
};

export type GeneratorResult = {
  buildings: number;
  floors: number;
  departments: number;
  wards: number;
  rooms: number;
  beds: number;
};

export default function InfrastructurePage() {
  const params = useParams();
  const hname = params?.Hname as string;

  const [activeTab, setActiveTab] = useState<"generator" | "hierarchy">("generator");

  // Step tracking for Wizard (1 to 7)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Buildings State
  const [buildings, setBuildings] = useState<BuildingConfig[]>([
    {
      id: "bld-1",
      name: "Main Tower A",
      code: "BLD-A",
      description: "Main Inpatient & Outpatient Building",
      floorsCount: 4,
      floors: [],
    },
  ]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("bld-1");
  const [selectedFloorId, setSelectedFloorId] = useState<string>("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GeneratorResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [hierarchy, setHierarchy] = useState<HierarchyData | null>(null);
  const [isLoadingHierarchy, setIsLoadingHierarchy] = useState(false);

  // Per-department custom parameter overrides: Key = `${buildingId}_${floorId}_${deptName}`
  const [deptCustomConfigs, setDeptCustomConfigs] = useState<Record<string, DeptCustomConfig>>({});

  // LOV options
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);
  const [wardOptions, setWardOptions] = useState<string[]>([]);
  const [roomTypeOptions, setRoomTypeOptions] = useState<string[]>([]);
  const [roomPurposeOptions, setRoomPurposeOptions] = useState<string[]>([]);
  const [bedTypeOptions, setBedTypeOptions] = useState<string[]>([]);

  // Load LOV options
  useEffect(() => {
    if (!hname) return;

    async function loadDepartments() {
      const defaultDepts = [
        "Emergency & Trauma",
        "Reception & Registration",
        "Outpatient Department (OPD)",
        "General Medicine",
        "Cardiology",
        "Orthopedics",
        "Radiology & Diagnostic Imaging",
        "Pathology & Medical Lab",
        "Pharmacy & Medicine Store",
        "Intensive Care Unit (ICU)",
        "General Surgery",
        "Pediatrics",
        "Obstetrics & Gynecology",
        "Neurology",
      ];
      try {
        const res = await fetch(`/api/${hname}/forms/department_master`, { cache: "no-store" });
        if (!res.ok) {
          setDepartmentOptions(defaultDepts);
          return;
        }
        const data = await res.json();
        const fetched = (data.rows ?? [])
          .map((row: Record<string, unknown>) => {
            const code = String(row.code ?? "").trim();
            const desc = String(row.description ?? row.name ?? row.department_type ?? row.department_name ?? "").trim();
            if (!code && !desc) return "";
            return code && desc ? `${code} - ${desc}` : code || desc;
          })
          .filter(Boolean);

        const combined = Array.from(new Set([...fetched, ...defaultDepts]));
        setDepartmentOptions(combined);
      } catch {
        setDepartmentOptions(defaultDepts);
      }
    }

    async function loadOptions(tableName: string, setter: (opts: string[]) => void) {
      try {
        const res = await fetch(`/api/${hname}/forms/${tableName}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const opts = (data.rows ?? [])
          .map((row: Record<string, unknown>) => {
            const code = String(row.code ?? "").trim();
            const desc = String(row.description ?? row.name ?? "").trim();
            if (!code && !desc) return "";
            return code && desc ? `${code} - ${desc}` : code || desc;
          })
          .filter(Boolean);
        setter(opts);
      } catch { /* ignore */ }
    }

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
      } catch { /* ignore */ }
    }

    void loadDepartments();
    void loadOptions("ward_master", setWardOptions);
    void loadOptions("room_type_master", setRoomTypeOptions);
    void loadOptions("room_purpose_master", setRoomPurposeOptions);
    void loadBedTypes();
  }, [hname]);

  // Synchronize floors array when building floorsCount changes or on initial mount
  useEffect(() => {
    setBuildings((prevBuildings) =>
      prevBuildings.map((b) => {
        const existingFloors = b.floors || [];
        const newFloors: FloorConfig[] = [];
        for (let i = 0; i < b.floorsCount; i++) {
          const defaultName = i === 0 ? "Ground Floor" : `Floor ${i}`;
          const existing = existingFloors.find((f) => f.floorNumber === i);
          if (existing) {
            newFloors.push(existing);
          } else {
            newFloors.push({
              id: `${b.id}-fl-${i}`,
              floorNumber: i,
              floorName: defaultName,
              selectedDeptNames: i === 0 ? ["Emergency", "Reception", "Pharmacy", "Radiology"] : ["Cardiology", "General Medicine"],
              departments: [],
            });
          }
        }
        return { ...b, floors: newFloors };
      })
    );
  }, []);

  // Load hierarchy for Hierarchy Tab
  const loadHierarchy = useCallback(async () => {
    setIsLoadingHierarchy(true);
    try {
      const res = await fetch(`/api/${hname}/infrastructure?action=hierarchy`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load hierarchy");
      const data = await res.json();
      setHierarchy(data);
    } catch (err) {
      console.error(err);
    } fontally: {
      setIsLoadingHierarchy(false);
    }
  }, [hname]);

  useEffect(() => {
    if (activeTab === "hierarchy") void loadHierarchy();
  }, [activeTab, loadHierarchy]);

  // Building Actions
  const handleAddBuilding = () => {
    const existingCodes = new Set(buildings.map((b) => b.code.toUpperCase()));
    const existingNames = new Set(buildings.map((b) => b.name.toUpperCase()));

    let letter = "A";
    for (let i = 0; i < 26; i++) {
      const candidate = String.fromCharCode(65 + i);
      if (!existingCodes.has(`BLD-${candidate}`) && !existingNames.has(`BUILDING ${candidate}`)) {
        letter = candidate;
        break;
      }
    }

    const newBld: BuildingConfig = {
      id: `bld-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: `Building ${letter}`,
      code: `BLD-${letter}`,
      description: `Hospital Block ${letter}`,
      floorsCount: 3,
      floors: [
        { id: `fl-0-${Date.now()}`, floorNumber: 0, floorName: "Ground Floor", selectedDeptNames: ["Emergency", "Reception"], departments: [] },
        { id: `fl-1-${Date.now()}`, floorNumber: 1, floorName: "Floor 1", selectedDeptNames: ["Cardiology"], departments: [] },
        { id: `fl-2-${Date.now()}`, floorNumber: 2, floorName: "Floor 2", selectedDeptNames: ["General Medicine"], departments: [] },
      ],
    };
    setBuildings((prev) => [...prev, newBld]);
    setSelectedBuildingId(newBld.id);
  };

  const handleUpdateBuilding = (id: string, field: keyof BuildingConfig, value: unknown) => {
    setBuildings((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const updated = { ...b, [field]: value };
        if (field === "floorsCount") {
          const count = Number(value) || 1;
          const currentFloors = b.floors || [];
          const updatedFloors: FloorConfig[] = [];
          for (let i = 0; i < count; i++) {
            const defaultName = i === 0 ? "Ground Floor" : `Floor ${i}`;
            const existing = currentFloors.find((f) => f.floorNumber === i);
            if (existing) updatedFloors.push(existing);
            else updatedFloors.push({ id: `${b.id}-fl-${i}`, floorNumber: i, floorName: defaultName, selectedDeptNames: [], departments: [] });
          }
          updated.floors = updatedFloors;
        }
        return updated;
      })
    );
  };

  const handleDeleteBuilding = (id: string) => {
    const remaining = buildings.filter((b) => b.id !== id);
    if (remaining.length === 0) {
      const freshDefault: BuildingConfig = {
        id: `bld-${Date.now()}`,
        name: "Building A",
        code: "BLD-A",
        description: "Main Hospital Building A",
        floorsCount: 3,
        floors: [
          { id: `fl-0-${Date.now()}`, floorNumber: 0, floorName: "Ground Floor", selectedDeptNames: ["Emergency", "Reception"], departments: [] },
          { id: `fl-1-${Date.now()}`, floorNumber: 1, floorName: "Floor 1", selectedDeptNames: ["Cardiology"], departments: [] },
          { id: `fl-2-${Date.now()}`, floorNumber: 2, floorName: "Floor 2", selectedDeptNames: ["General Medicine"], departments: [] },
        ],
      };
      setBuildings([freshDefault]);
      setSelectedBuildingId(freshDefault.id);
    } else {
      setBuildings(remaining);
      if (selectedBuildingId === id) {
        setSelectedBuildingId(remaining[0].id);
      }
    }
  };

  // Step Validation & Progression Rules
  const validateStep = (step: number): { valid: boolean; message?: string } => {
    if (step === 1) {
      if (buildings.length === 0) {
        return { valid: false, message: "Please configure at least 1 building to proceed." };
      }
      for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        if (!b.name.trim()) return { valid: false, message: `Building #${i + 1} requires a valid Building Name.` };
        if (!b.code.trim()) return { valid: false, message: `Building "${b.name}" requires a valid Building Code.` };
        if (!b.floorsCount || b.floorsCount <= 0) return { valid: false, message: `Building "${b.name}" must have at least 1 floor.` };
      }
      return { valid: true };
    }

    if (step === 2) {
      for (const b of buildings) {
        for (const fl of b.floors) {
          if (!fl.floorName.trim()) {
            return { valid: false, message: `Floor #${fl.floorNumber} in ${b.name} requires a valid floor display name.` };
          }
        }
      }
      return { valid: true };
    }

    if (step === 3) {
      for (const b of buildings) {
        for (const fl of b.floors) {
          if (fl.selectedDeptNames.length === 0) {
            return { valid: false, message: `Please assign at least 1 department to ${fl.floorName} in ${b.name}.` };
          }
        }
      }
      return { valid: true };
    }

    return { valid: true };
  };

  const handleNextStep = () => {
    const check = validateStep(currentStep);
    if (!check.valid) {
      setError(check.message || "Please complete the required details before advancing to the next step.");
      return;
    }
    setError(null);
    setCurrentStep((prev) => Math.min(7, prev + 1));
  };

  const handleStepClick = (targetStep: number) => {
    if (targetStep <= currentStep) {
      setError(null);
      setCurrentStep(targetStep);
      return;
    }
    for (let s = 1; s < targetStep; s++) {
      const check = validateStep(s);
      if (!check.valid) {
        setError(`Cannot jump to Step ${targetStep}. ${check.message}`);
        return;
      }
    }
    setError(null);
    setCurrentStep(targetStep);
  };

  // Toggle Department Selection for a Floor
  const toggleDeptForFloor = (buildingId: string, floorId: string, deptName: string) => {
    setBuildings((prev) =>
      prev.map((b) => {
        if (b.id !== buildingId) return b;
        return {
          ...b,
          floors: b.floors.map((f) => {
            if (f.id !== floorId) return f;
            const hasDept = f.selectedDeptNames.includes(deptName);
            const nextDepts = hasDept ? f.selectedDeptNames.filter((d) => d !== deptName) : [...f.selectedDeptNames, deptName];
            return { ...f, selectedDeptNames: nextDepts };
          }),
        };
      })
    );
  };

  // Get or initialize custom parameter configuration for a specific department on a floor
  const getDeptCustomConfig = (buildingId: string, floorId: string, deptName: string): DeptCustomConfig => {
    const key = `${buildingId}_${floorId}_${deptName}`;
    if (deptCustomConfigs[key]) return deptCustomConfigs[key];

    const clean = deptName.split("-").pop()?.trim().toLowerCase() || deptName.toLowerCase();
    const isClinical = clean.includes("cardio") || clean.includes("medicine") || clean.includes("ortho") || clean.includes("general") || clean.includes("opd") || clean.includes("consult") || clean.includes("surg") || clean.includes("pediatr") || clean.includes("neuro");
    const isRadio = clean.includes("radio") || clean.includes("imaging") || clean.includes("xray");
    const isPharma = clean.includes("pharmacy") || clean.includes("store");
    const isLab = clean.includes("lab") || clean.includes("pathology");

    return {
      hasClinics: isClinical || (!isRadio && !isPharma && !isLab),
      clinicCount: 3,
      hasDoctorRooms: isClinical || (!isRadio && !isPharma && !isLab),
      doctorRoomCount: 2,
      hasNurseStation: isClinical,
      nurseStationCount: 1,
      hasProcedureRoom: isClinical,
      procedureRoomCount: 1,

      hasXray: isRadio,
      xrayCount: 1,
      hasMri: isRadio,
      mriCount: 1,
      hasCtScan: isRadio,
      ctScanCount: 1,
      hasWaitingArea: isRadio || isClinical,
      waitingCapacity: 15,

      hasDispensingCounter: isPharma,
      dispensingCounterCount: 2,
      hasMedicineStore: isPharma,
      medicineStoreCount: 1,

      hasSampleBooth: isLab,
      sampleBoothCount: 2,
      hasTestingLab: isLab,
      testingLabCount: 1,
      hasReportCounter: isLab,
      reportCounterCount: 1,

      hasGeneralWard: isClinical,
      generalWardRoomCount: 4,
      generalWardBedsPerRoom: 4,
      generalWardHasBathroom: true,

      hasPrivateWard: isClinical,
      privateWardRoomCount: 2,
      privateWardBedsPerRoom: 1,
      privateWardHasBathroom: true,

      hasIcuWard: clean.includes("icu") || clean.includes("critical") || clean.includes("cardio") || clean.includes("surg"),
      icuWardRoomCount: 1,
      icuWardBedsPerRoom: 1,
      icuHasVentilator: true,
      icuHasMonitor: true,
    };
  };

  const updateDeptCustomConfig = (buildingId: string, floorId: string, deptName: string, updates: Partial<DeptCustomConfig>) => {
    const key = `${buildingId}_${floorId}_${deptName}`;
    const current = getDeptCustomConfig(buildingId, floorId, deptName);
    setDeptCustomConfigs((prev) => ({
      ...prev,
      [key]: { ...current, ...updates },
    }));
  };

  // Compile final rooms structure for Step 6/7 and API call
  const compileWizardPayload = () => {
    return buildings.map((b) => ({
      name: b.name,
      code: b.code,
      description: b.description,
      floorsCount: b.floorsCount,
      floors: b.floors.map((f) => {
        const floorDepts: Array<{ departmentName: string; rooms: RoomConfig[] }> = [];

        f.selectedDeptNames.forEach((dName) => {
          const cleanName = dName.split("-").pop()?.trim() || dName;
          const compiledRooms: RoomConfig[] = [];
          const cfg = getDeptCustomConfig(b.id, f.id, dName);

          // 1. Clinics
          if (cfg.hasClinics) {
            for (let c = 1; c <= (cfg.clinicCount || 1); c++) {
              compiledRooms.push({ id: `rm-cl-${c}`, name: `${cleanName} Consultation Clinic ${c}`, type: "Consultation Room", purpose: "OPD Consultation", capacity: 1, bedCount: 0 });
            }
          }
          // 2. Doctor Rooms
          if (cfg.hasDoctorRooms) {
            for (let d = 1; d <= (cfg.doctorRoomCount || 1); d++) {
              compiledRooms.push({ id: `rm-dr-${d}`, name: `${cleanName} Doctor Room ${d}`, type: "Doctor Room", purpose: "Consultant Office", capacity: 1, bedCount: 0 });
            }
          }
          // 3. Nurse Station
          if (cfg.hasNurseStation) {
            for (let n = 1; n <= (cfg.nurseStationCount || 1); n++) {
              compiledRooms.push({ id: `rm-ns-${n}`, name: `${cleanName} Nurse Station ${n}`, type: "Nurse Station", purpose: "Nursing Care", capacity: 2, bedCount: 0 });
            }
          }
          // 4. Procedure Room
          if (cfg.hasProcedureRoom) {
            for (let p = 1; p <= (cfg.procedureRoomCount || 1); p++) {
              compiledRooms.push({ id: `rm-pr-${p}`, name: `${cleanName} Procedure Room ${p}`, type: "Procedure Room", purpose: "Minor Procedures", capacity: 1, bedCount: 1, bedType: "Procedure Bed" });
            }
          }

          // 5. Diagnostic Rooms
          if (cfg.hasXray) {
            for (let x = 1; x <= (cfg.xrayCount || 1); x++) {
              compiledRooms.push({ id: `rm-xray-${x}`, name: `${cleanName} X-Ray Room ${x}`, type: "Diagnostic Room", purpose: "X-Ray Imaging", capacity: 1, bedCount: 0 });
            }
          }
          if (cfg.hasMri) {
            for (let m = 1; m <= (cfg.mriCount || 1); m++) {
              compiledRooms.push({ id: `rm-mri-${m}`, name: `${cleanName} MRI Suite ${m}`, type: "Diagnostic Room", purpose: "MRI Imaging", capacity: 1, bedCount: 0 });
            }
          }
          if (cfg.hasCtScan) {
            for (let ct = 1; ct <= (cfg.ctScanCount || 1); ct++) {
              compiledRooms.push({ id: `rm-ct-${ct}`, name: `${cleanName} CT Scan Suite ${ct}`, type: "Diagnostic Room", purpose: "CT Scan", capacity: 1, bedCount: 0 });
            }
          }
          if (cfg.hasWaitingArea) {
            compiledRooms.push({ id: `rm-wait-1`, name: `${cleanName} Waiting Lounge`, type: "Waiting Area", purpose: "Patient Reception", capacity: cfg.waitingCapacity || 10, bedCount: 0 });
          }

          // 6. Pharmacy
          if (cfg.hasDispensingCounter) {
            for (let dc = 1; dc <= (cfg.dispensingCounterCount || 1); dc++) {
              compiledRooms.push({ id: `rm-ph-cnt-${dc}`, name: `${cleanName} Dispensing Counter ${dc}`, type: "Service Counter", purpose: "Medicine Dispensing", capacity: 1, bedCount: 0 });
            }
          }
          if (cfg.hasMedicineStore) {
            for (let ms = 1; ms <= (cfg.medicineStoreCount || 1); ms++) {
              compiledRooms.push({ id: `rm-ph-store-${ms}`, name: `${cleanName} Main Storage ${ms}`, type: "Store Room", purpose: "Medicine Storage", capacity: 5, bedCount: 0 });
            }
          }

          // 7. Pathology
          if (cfg.hasSampleBooth) {
            for (let sb = 1; sb <= (cfg.sampleBoothCount || 1); sb++) {
              compiledRooms.push({ id: `rm-lab-sb-${sb}`, name: `${cleanName} Sample Booth ${sb}`, type: "Collection Booth", purpose: "Phlebotomy", capacity: 1, bedCount: 0 });
            }
          }
          if (cfg.hasTestingLab) {
            for (let tl = 1; tl <= (cfg.testingLabCount || 1); tl++) {
              compiledRooms.push({ id: `rm-lab-tl-${tl}`, name: `${cleanName} Testing Lab ${tl}`, type: "Laboratory", purpose: "Specimen Analysis", capacity: 4, bedCount: 0 });
            }
          }
          if (cfg.hasReportCounter) {
            for (let rc = 1; rc <= (cfg.reportCounterCount || 1); rc++) {
              compiledRooms.push({ id: `rm-lab-rc-${rc}`, name: `${cleanName} Report Counter ${rc}`, type: "Service Counter", purpose: "Report Delivery", capacity: 1, bedCount: 0 });
            }
          }

          // 8. General Ward Rooms
          if (cfg.hasGeneralWard) {
            for (let r = 101; r < 101 + (cfg.generalWardRoomCount || 1); r++) {
              compiledRooms.push({
                id: `rm-gw-${r}`,
                name: `General Ward Room ${r}`,
                type: "General Ward",
                purpose: "Inpatient Stay",
                capacity: cfg.generalWardBedsPerRoom || 4,
                bedCount: cfg.generalWardBedsPerRoom || 4,
                bedType: "Standard Bed",
                wardType: "General Ward",
                hasBathroom: cfg.generalWardHasBathroom,
              });
            }
          }

          // 9. Private Ward Rooms
          if (cfg.hasPrivateWard) {
            for (let r = 201; r < 201 + (cfg.privateWardRoomCount || 1); r++) {
              compiledRooms.push({
                id: `rm-pw-${r}`,
                name: `Private Suite ${r}`,
                type: "Private Ward",
                purpose: "Deluxe Inpatient Stay",
                capacity: cfg.privateWardBedsPerRoom || 1,
                bedCount: cfg.privateWardBedsPerRoom || 1,
                bedType: "Deluxe Bed",
                wardType: "Private Ward",
                hasBathroom: cfg.privateWardHasBathroom,
              });
            }
          }

          // 10. ICU Ward Rooms
          if (cfg.hasIcuWard) {
            for (let r = 1; r <= (cfg.icuWardRoomCount || 1); r++) {
              compiledRooms.push({
                id: `rm-icu-${r}`,
                name: `ICU Room ${r}`,
                type: "ICU",
                purpose: "Critical Care",
                capacity: cfg.icuWardBedsPerRoom || 1,
                bedCount: cfg.icuWardBedsPerRoom || 1,
                bedType: "ICU Bed",
                wardType: "ICU Ward",
                hasVentilator: cfg.icuHasVentilator,
                hasMonitor: cfg.icuHasMonitor,
              });
            }
          }

          floorDepts.push({
            departmentName: cleanName,
            rooms: compiledRooms,
          });
        });

        return {
          floorNumber: f.floorNumber,
          floorName: f.floorName,
          departments: floorDepts,
        };
      }),
    }));
  };

  // Submit Generation to Backend
  const handleWizardGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setResult(null);

    const payload = compileWizardPayload();

    try {
      const res = await fetch(`/api/${hname}/infrastructure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "wizardGenerate", buildings: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Infrastructure generation failed.");

      setResult(data.results);
      void loadHierarchy();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Infrastructure generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Selected building object for steps
  const activeBuilding = buildings.find((b) => b.id === selectedBuildingId) || buildings[0] || {
    id: "bld-default",
    name: "Building A",
    code: "BLD-A",
    description: "Main Building",
    floorsCount: 3,
    floors: [],
  };

  // Calculate totals for preview stats
  const totalBuildingsCount = buildings.length;
  const totalFloorsCount = buildings.reduce((acc, b) => acc + b.floorsCount, 0);
  const totalDeptAssignmentsCount = buildings.reduce(
    (acc, b) => acc + b.floors.reduce((fAcc, f) => fAcc + f.selectedDeptNames.length, 0),
    0
  );

  return (
    <PageLayout title="Dynamic Hospital Infrastructure Designer">
      <div className="space-y-6">
        {/* Top Navigation Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setActiveTab("generator")}
            className={`border-b-2 px-5 py-3 text-sm font-medium transition ${
              activeTab === "generator"
                ? "border-brand-500 text-brand-600 dark:text-brand-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            🏗️ Interactive Setup Wizard
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("hierarchy")}
            className={`border-b-2 px-5 py-3 text-sm font-medium transition ${
              activeTab === "hierarchy"
                ? "border-brand-500 text-brand-600 dark:text-brand-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            🏛️ Current Hierarchy Tree
          </button>
        </div>

        {activeTab === "generator" && (
          <div className="space-y-6">
            {/* Step Wizard Header */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-800 dark:text-white/90">
                    Hospital Infrastructure Designer & Allocation Wizard
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Configure buildings, floors, departments, specialized rooms, wards, and beds interactively.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setError(null); setCurrentStep(Math.max(1, currentStep - 1)); }}
                    disabled={currentStep === 1}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 disabled:opacity-40"
                  >
                    ← Previous Step
                  </button>
                  <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                    Step {currentStep} of 7
                  </span>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    disabled={currentStep === 7}
                    className="px-4 py-1.5 rounded-lg bg-brand-500 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-40 transition shadow-xs"
                  >
                    Next Step →
                  </button>
                </div>
              </div>

              {/* Stepper Bar */}
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {[
                  { step: 1, label: "1. Buildings" },
                  { step: 2, label: "2. Floors" },
                  { step: 3, label: "3. Departments" },
                  { step: 4, label: "4. Dept Rooms" },
                  { step: 5, label: "5. Wards" },
                  { step: 6, label: "6. Rooms" },
                  { step: 7, label: "7. Beds & Summary" },
                ].map((s) => (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => handleStepClick(s.step)}
                    className={`rounded-lg py-2 px-2.5 text-xs font-semibold text-center transition ${
                      currentStep === s.step
                        ? "bg-brand-500 text-white shadow-xs"
                        : currentStep > s.step
                        ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                        : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Validation Warning Alert */}
              {error && (
                <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300 text-xs font-medium flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* STEP 1: CREATE BUILDINGS */}
            {currentStep === 1 && (
              <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] space-y-6">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-gray-800 dark:text-white">
                      Step 1: Configure Hospital Buildings
                    </h4>
                    <p className="text-xs text-gray-500">
                      Add and configure each building block of your hospital independently.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddBuilding}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-600 transition"
                  >
                    ➕ Add Building
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {buildings.map((b, idx) => (
                    <div
                      key={b.id}
                      className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider">
                          Building #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteBuilding(b.id)}
                          className="text-xs text-red-600 font-medium hover:underline"
                        >
                          Delete Building
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Building Name</label>
                          <input
                            type="text"
                            value={b.name}
                            onChange={(e) => handleUpdateBuilding(b.id, "name", e.target.value)}
                            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Building Code</label>
                          <input
                            type="text"
                            value={b.code}
                            onChange={(e) => handleUpdateBuilding(b.id, "code", e.target.value)}
                            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                          <input
                            type="text"
                            value={b.description}
                            onChange={(e) => handleUpdateBuilding(b.id, "description", e.target.value)}
                            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Number of Floors</label>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={b.floorsCount}
                            onChange={(e) => handleUpdateBuilding(b.id, "floorsCount", Number(e.target.value))}
                            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* STEP 2: CONFIGURE FLOORS */}
            {currentStep === 2 && (
              <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] space-y-6">
                <div className="border-b border-gray-100 dark:border-gray-800 pb-3">
                  <h4 className="text-sm font-bold text-gray-800 dark:text-white">
                    Step 2: Configure Floors Per Building
                  </h4>
                  <p className="text-xs text-gray-500">
                    Select a building below to customize individual floor names and numbers.
                  </p>
                </div>

                {/* Building Selector */}
                <div className="flex gap-2 border-b border-gray-100 dark:border-gray-800 pb-3 overflow-x-auto">
                  {buildings.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedBuildingId(b.id)}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                        activeBuilding.id === b.id
                          ? "bg-brand-500 text-white"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200"
                      }`}
                    >
                      {b.name} ({b.floorsCount} Floors)
                    </button>
                  ))}
                </div>

                {/* Floors List for Selected Building */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {activeBuilding.floors.map((fl) => (
                    <div
                      key={fl.id}
                      className="rounded-xl border border-gray-200 bg-slate-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                          Floor #{fl.floorNumber}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium">
                          {fl.selectedDeptNames.length} Depts
                        </span>
                      </div>

                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Floor Display Name</label>
                      <input
                        type="text"
                        value={fl.floorName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBuildings((prev) =>
                            prev.map((b) =>
                              b.id === activeBuilding.id
                                ? { ...b, floors: b.floors.map((f) => (f.id === fl.id ? { ...f, floorName: val } : f)) }
                                : b
                            )
                          );
                        }}
                        className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* STEP 3: ASSIGN DEPARTMENTS TO FLOORS */}
            {currentStep === 3 && (
              <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] space-y-6">
                <div className="border-b border-gray-100 dark:border-gray-800 pb-3">
                  <h4 className="text-sm font-bold text-gray-800 dark:text-white">
                    Step 3: Assign Departments to Each Floor
                  </h4>
                  <p className="text-xs text-gray-500">
                    Multi-select departments from Department Master for each floor of {activeBuilding.name}.
                  </p>
                </div>

                <div className="flex gap-2 border-b border-gray-100 dark:border-gray-800 pb-3 overflow-x-auto">
                  {buildings.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedBuildingId(b.id)}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                        activeBuilding.id === b.id
                          ? "bg-brand-500 text-white"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200"
                      }`}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>

                {/* Floors Department Selector Grid */}
                <div className="space-y-6">
                  {activeBuilding.floors.map((fl) => (
                    <div
                      key={fl.id}
                      className="rounded-xl border border-gray-200 p-5 dark:border-gray-800 space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                        <h5 className="text-sm font-bold text-gray-800 dark:text-white">
                          📍 {fl.floorName} (Floor {fl.floorNumber})
                        </h5>
                        <span className="text-xs text-gray-500">
                          {fl.selectedDeptNames.length} Departments Selected
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {(departmentOptions.length > 0
                          ? departmentOptions
                          : ["Emergency", "Reception", "Pharmacy", "Radiology", "Cardiology", "Orthopedics", "General Medicine", "Neurology", "Laboratory", "ICU"]
                        ).map((dept) => {
                          const isSelected = fl.selectedDeptNames.includes(dept);
                          return (
                            <button
                              key={dept}
                              type="button"
                              onClick={() => toggleDeptForFloor(activeBuilding.id, fl.id, dept)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                                isSelected
                                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300 dark:border-brand-500"
                                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                              }`}
                            >
                              {isSelected ? "☑ " : "☐ "} {dept}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* STEP 4: CONFIGURE DEPARTMENT INFRASTRUCTURE & SPECIALIZED ROOMS */}
            {currentStep === 4 && (
              <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] space-y-6">
                <div className="border-b border-gray-100 dark:border-gray-800 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-gray-800 dark:text-white">
                      Step 4: Configure Department Infrastructure & Specialized Rooms
                    </h4>
                    <p className="text-xs text-gray-500">
                      Enable/disable room features and adjust room counts for each assigned department of {activeBuilding.name}.
                    </p>
                  </div>
                </div>

                {/* Building Selector */}
                <div className="flex gap-2 border-b border-gray-100 dark:border-gray-800 pb-3 overflow-x-auto">
                  {buildings.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedBuildingId(b.id)}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                        activeBuilding.id === b.id
                          ? "bg-brand-500 text-white"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200"
                      }`}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>

                {/* Department Room Customization List */}
                <div className="space-y-6">
                  {activeBuilding.floors.map((fl) => (
                    <div key={fl.id} className="space-y-4">
                      <h5 className="text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider">
                        📍 {fl.floorName} (Floor {fl.floorNumber}) — {fl.selectedDeptNames.length} Departments
                      </h5>

                      {fl.selectedDeptNames.length === 0 ? (
                        <p className="text-xs text-gray-500 italic pl-4">No departments assigned to this floor.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {fl.selectedDeptNames.map((dName) => {
                            const cfg = getDeptCustomConfig(activeBuilding.id, fl.id, dName);
                            const cleanName = dName.split("-").pop()?.trim() || dName;

                            return (
                              <div
                                key={dName}
                                className="rounded-xl border border-gray-200 bg-slate-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40 space-y-4"
                              >
                                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                                    🏢 {cleanName}
                                  </span>
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                                    {dName}
                                  </span>
                                </div>

                                {/* Room Parameters */}
                                <div className="space-y-3 text-xs">
                                  {/* Consultation & Doctor Rooms */}
                                  <div className="p-2.5 rounded-lg bg-white border border-gray-200 dark:border-gray-700 dark:bg-gray-900 space-y-2">
                                    <span className="font-bold text-gray-800 dark:text-gray-200 block">🩺 OPD & Consultation</span>
                                    <div className="grid grid-cols-2 gap-2">
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={cfg.hasClinics}
                                          onChange={(e) => updateDeptCustomConfig(activeBuilding.id, fl.id, dName, { hasClinics: e.target.checked })}
                                        />
                                        <span>Consultation Clinics</span>
                                      </label>
                                      {cfg.hasClinics && (
                                        <input
                                          type="number"
                                          min={1}
                                          max={20}
                                          value={cfg.clinicCount}
                                          onChange={(e) => updateDeptCustomConfig(activeBuilding.id, fl.id, dName, { clinicCount: Number(e.target.value) })}
                                          className="h-7 w-20 rounded border border-gray-300 px-2 text-xs dark:bg-gray-800 dark:text-white"
                                        />
                                      )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={cfg.hasDoctorRooms}
                                          onChange={(e) => updateDeptCustomConfig(activeBuilding.id, fl.id, dName, { hasDoctorRooms: e.target.checked })}
                                        />
                                        <span>Doctor Offices</span>
                                      </label>
                                      {cfg.hasDoctorRooms && (
                                        <input
                                          type="number"
                                          min={1}
                                          max={20}
                                          value={cfg.doctorRoomCount}
                                          onChange={(e) => updateDeptCustomConfig(activeBuilding.id, fl.id, dName, { doctorRoomCount: Number(e.target.value) })}
                                          className="h-7 w-20 rounded border border-gray-300 px-2 text-xs dark:bg-gray-800 dark:text-white"
                                        />
                                      )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={cfg.hasNurseStation}
                                          onChange={(e) => updateDeptCustomConfig(activeBuilding.id, fl.id, dName, { hasNurseStation: e.target.checked })}
                                        />
                                        <span>Nurse Stations</span>
                                      </label>
                                      {cfg.hasNurseStation && (
                                        <input
                                          type="number"
                                          min={1}
                                          max={5}
                                          value={cfg.nurseStationCount}
                                          onChange={(e) => updateDeptCustomConfig(activeBuilding.id, fl.id, dName, { nurseStationCount: Number(e.target.value) })}
                                          className="h-7 w-20 rounded border border-gray-300 px-2 text-xs dark:bg-gray-800 dark:text-white"
                                        />
                                      )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={cfg.hasProcedureRoom}
                                          onChange={(e) => updateDeptCustomConfig(activeBuilding.id, fl.id, dName, { hasProcedureRoom: e.target.checked })}
                                        />
                                        <span>Procedure Rooms</span>
                                      </label>
                                      {cfg.hasProcedureRoom && (
                                        <input
                                          type="number"
                                          min={1}
                                          max={10}
                                          value={cfg.procedureRoomCount}
                                          onChange={(e) => updateDeptCustomConfig(activeBuilding.id, fl.id, dName, { procedureRoomCount: Number(e.target.value) })}
                                          className="h-7 w-20 rounded border border-gray-300 px-2 text-xs dark:bg-gray-800 dark:text-white"
                                        />
                                      )}
                                    </div>
                                  </div>

                                  {/* Diagnostics / Pharmacy / Labs */}
                                  <div className="p-2.5 rounded-lg bg-white border border-gray-200 dark:border-gray-700 dark:bg-gray-900 space-y-2">
                                    <span className="font-bold text-gray-800 dark:text-gray-200 block">🩻 Diagnostic & Service Infrastructure</span>
                                    <div className="grid grid-cols-2 gap-2">
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={cfg.hasXray}
                                          onChange={(e) => updateDeptCustomConfig(activeBuilding.id, fl.id, dName, { hasXray: e.target.checked })}
                                        />
                                        <span>X-Ray Suite</span>
                                      </label>
                                      {cfg.hasXray && (
                                        <input
                                          type="number"
                                          min={1}
                                          max={10}
                                          value={cfg.xrayCount}
                                          onChange={(e) => updateDeptCustomConfig(activeBuilding.id, fl.id, dName, { xrayCount: Number(e.target.value) })}
                                          className="h-7 w-20 rounded border border-gray-300 px-2 text-xs dark:bg-gray-800 dark:text-white"
                                        />
                                      )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={cfg.hasMri}
                                          onChange={(e) => updateDeptCustomConfig(activeBuilding.id, fl.id, dName, { hasMri: e.target.checked })}
                                        />
                                        <span>MRI Suite</span>
                                      </label>
                                      {cfg.hasMri && (
                                        <input
                                          type="number"
                                          min={1}
                                          max={5}
                                          value={cfg.mriCount}
                                          onChange={(e) => updateDeptCustomConfig(activeBuilding.id, fl.id, dName, { mriCount: Number(e.target.value) })}
                                          className="h-7 w-20 rounded border border-gray-300 px-2 text-xs dark:bg-gray-800 dark:text-white"
                                        />
                                      )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={cfg.hasCtScan}
                                          onChange={(e) => updateDeptCustomConfig(activeBuilding.id, fl.id, dName, { hasCtScan: e.target.checked })}
                                        />
                                        <span>CT Scan Suite</span>
                                      </label>
                                      {cfg.hasCtScan && (
                                        <input
                                          type="number"
                                          min={1}
                                          max={5}
                                          value={cfg.ctScanCount}
                                          onChange={(e) => updateDeptCustomConfig(activeBuilding.id, fl.id, dName, { ctScanCount: Number(e.target.value) })}
                                          className="h-7 w-20 rounded border border-gray-300 px-2 text-xs dark:bg-gray-800 dark:text-white"
                                        />
                                      )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={cfg.hasDispensingCounter}
                                          onChange={(e) => updateDeptCustomConfig(activeBuilding.id, fl.id, dName, { hasDispensingCounter: e.target.checked })}
                                        />
                                        <span>Dispensing Counter</span>
                                      </label>
                                      {cfg.hasDispensingCounter && (
                                        <input
                                          type="number"
                                          min={1}
                                          max={10}
                                          value={cfg.dispensingCounterCount}
                                          onChange={(e) => updateDeptCustomConfig(activeBuilding.id, fl.id, dName, { dispensingCounterCount: Number(e.target.value) })}
                                          className="h-7 w-20 rounded border border-gray-300 px-2 text-xs dark:bg-gray-800 dark:text-white"
                                        />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* STEP 5: CONFIGURE WARDS & BEDS */}
            {currentStep === 5 && (
              <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] space-y-6">
                <div className="border-b border-gray-100 dark:border-gray-800 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-gray-800 dark:text-white">
                      Step 5: Configure Inpatient Wards & Beds
                    </h4>
                    <p className="text-xs text-gray-500">
                      Configure Ward Types, Room Counts, Beds per Room, and Medical Equipment for each admitting department.
                    </p>
                  </div>
                </div>

                {/* Building Selector */}
                <div className="flex gap-2 border-b border-gray-100 dark:border-gray-800 pb-3 overflow-x-auto">
                  {buildings.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedBuildingId(b.id)}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                        activeBuilding.id === b.id
                          ? "bg-brand-500 text-white"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200"
                      }`}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>

                {/* Ward Configuration Grid */}
                <div className="space-y-6">
                  {activeBuilding.floors.map((fl) => (
                    <div key={fl.id} className="space-y-4">
                      <h5 className="text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider">
                        📍 {fl.floorName} (Floor {fl.floorNumber})
                      </h5>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {fl.selectedDeptNames.map((dName) => {
                          const cfg = getDeptCustomConfig(activeBuilding.id, fl.id, dName);
                          const cleanName = dName.split("-").pop()?.trim() || dName;

                          return (
                            <div
                              key={dName}
                              className="rounded-xl border border-gray-200 bg-slate-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40 space-y-4"
                            >
                              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                                <span className="text-sm font-bold text-gray-900 dark:text-white">
                                  🏥 {cleanName} Wards
                                </span>
                              </div>

                              <div className="space-y-3 text-xs">
                                {/* General Ward */}
                                <div className="p-3 rounded-lg bg-white border border-gray-200 dark:border-gray-700 dark:bg-gray-900 space-y-2">
                                  <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-800 dark:text-gray-200">
                                    <input
                                      type="checkbox"
                                      checked={cfg.hasGeneralWard}
                                      onChange={(e) => updateDeptCustomConfig(activeBuilding.id, fl.id, dName, { hasGeneralWard: e.target.checked })}
                                    />
                                    <span>🏥 General Ward (Multi-Bed Rooms)</span>
                                  </label>

                                  {cfg.hasGeneralWard && (
                                    <div className="pl-5 grid grid-cols-2 gap-2 pt-1">
                                      <div>
                                        <label className="block text-[11px] text-gray-500">Rooms Count</label>
                                        <input
                                          type="number"
                                          min={1}
                                          max={50}
                                          value={cfg.generalWardRoomCount}
                                          onChange={(e) => updateDeptCustomConfig(activeBuilding.id, fl.id, dName, { generalWardRoomCount: Number(e.target.value) })}
                                          className="h-7 w-full rounded border border-gray-300 px-2 text-xs dark:bg-gray-800 dark:text-white"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[11px] text-gray-500">Beds / Room</label>
                                        <input
                                          type="number"
                                          min={1}
                                          max={12}
                                          value={cfg.generalWardBedsPerRoom}
                                          onChange={(e) => updateDeptCustomConfig(activeBuilding.id, fl.id, dName, { generalWardBedsPerRoom: Number(e.target.value) })}
                                          className="h-7 w-full rounded border border-gray-300 px-2 text-xs dark:bg-gray-800 dark:text-white"
                                        />
                                      </div>
                                      <label className="col-span-2 flex items-center gap-1.5 cursor-pointer text-[11px] text-gray-600 dark:text-gray-400 mt-1">
                                        <input
                                          type="checkbox"
                                          checked={cfg.generalWardHasBathroom}
                                          onChange={(e) => updateDeptCustomConfig(activeBuilding.id, fl.id, dName, { generalWardHasBathroom: e.target.checked })}
                                        />
                                        <span>Attached Bathroom</span>
                                      </label>
                                    </div>
                                  )}
                                </div>

                                {/* Private Ward */}
                                <div className="p-3 rounded-lg bg-white border border-gray-200 dark:border-gray-700 dark:bg-gray-900 space-y-2">
                                  <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-800 dark:text-gray-200">
                                    <input
                                      type="checkbox"
                                      checked={cfg.hasPrivateWard}
                                      onChange={(e) => updateDeptCustomConfig(activeBuilding.id, fl.id, dName, { hasPrivateWard: e.target.checked })}
                                    />
                                    <span>🛌 Private / Deluxe Suites</span>
                                  </label>

                                  {cfg.hasPrivateWard && (
                                    <div className="pl-5 grid grid-cols-2 gap-2 pt-1">
                                      <div>
                                        <label className="block text-[11px] text-gray-500">Suite Count</label>
                                        <input
                                          type="number"
                                          min={1}
                                          max={20}
                                          value={cfg.privateWardRoomCount}
                                          onChange={(e) => updateDeptCustomConfig(activeBuilding.id, fl.id, dName, { privateWardRoomCount: Number(e.target.value) })}
                                          className="h-7 w-full rounded border border-gray-300 px-2 text-xs dark:bg-gray-800 dark:text-white"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[11px] text-gray-500">Beds / Suite</label>
                                        <input
                                          type="number"
                                          min={1}
                                          max={2}
                                          value={cfg.privateWardBedsPerRoom}
                                          onChange={(e) => updateDeptCustomConfig(activeBuilding.id, fl.id, dName, { privateWardBedsPerRoom: Number(e.target.value) })}
                                          className="h-7 w-full rounded border border-gray-300 px-2 text-xs dark:bg-gray-800 dark:text-white"
                                        />
                                      </div>
                                      <label className="col-span-2 flex items-center gap-1.5 cursor-pointer text-[11px] text-gray-600 dark:text-gray-400 mt-1">
                                        <input
                                          type="checkbox"
                                          checked={cfg.privateWardHasBathroom}
                                          onChange={(e) => updateDeptCustomConfig(activeBuilding.id, fl.id, dName, { privateWardHasBathroom: e.target.checked })}
                                        />
                                        <span>Private Bathroom</span>
                                      </label>
                                    </div>
                                  )}
                                </div>

                                {/* ICU Ward */}
                                <div className="p-3 rounded-lg bg-red-50/40 border border-red-200 dark:border-red-900/40 dark:bg-red-950/20 space-y-2">
                                  <label className="flex items-center gap-2 cursor-pointer font-bold text-red-900 dark:text-red-300">
                                    <input
                                      type="checkbox"
                                      checked={cfg.hasIcuWard}
                                      onChange={(e) => updateDeptCustomConfig(activeBuilding.id, fl.id, dName, { hasIcuWard: e.target.checked })}
                                    />
                                    <span>🚨 ICU Critical Care Unit</span>
                                  </label>

                                  {cfg.hasIcuWard && (
                                    <div className="pl-5 grid grid-cols-2 gap-2 pt-1">
                                      <div>
                                        <label className="block text-[11px] text-gray-600 dark:text-gray-400">ICU Rooms</label>
                                        <input
                                          type="number"
                                          min={1}
                                          max={10}
                                          value={cfg.icuWardRoomCount}
                                          onChange={(e) => updateDeptCustomConfig(activeBuilding.id, fl.id, dName, { icuWardRoomCount: Number(e.target.value) })}
                                          className="h-7 w-full rounded border border-gray-300 px-2 text-xs dark:bg-gray-800 dark:text-white"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[11px] text-gray-600 dark:text-gray-400">Beds / Room</label>
                                        <input
                                          type="number"
                                          min={1}
                                          max={4}
                                          value={cfg.icuWardBedsPerRoom}
                                          onChange={(e) => updateDeptCustomConfig(activeBuilding.id, fl.id, dName, { icuWardBedsPerRoom: Number(e.target.value) })}
                                          className="h-7 w-full rounded border border-gray-300 px-2 text-xs dark:bg-gray-800 dark:text-white"
                                        />
                                      </div>
                                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-gray-700 dark:text-gray-300 mt-1">
                                        <input
                                          type="checkbox"
                                          checked={cfg.icuHasVentilator}
                                          onChange={(e) => updateDeptCustomConfig(activeBuilding.id, fl.id, dName, { icuHasVentilator: e.target.checked })}
                                        />
                                        <span>Ventilator</span>
                                      </label>
                                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-gray-700 dark:text-gray-300 mt-1">
                                        <input
                                          type="checkbox"
                                          checked={cfg.icuHasMonitor}
                                          onChange={(e) => updateDeptCustomConfig(activeBuilding.id, fl.id, dName, { icuHasMonitor: e.target.checked })}
                                        />
                                        <span>Cardiac Monitor</span>
                                      </label>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* STEP 6 & 7: ROOMS, BEDS & SUMMARY GENERATION */}
            {(currentStep === 6 || currentStep === 7) && (
              <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] space-y-6">
                <div className="border-b border-gray-100 dark:border-gray-800 pb-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-gray-800 dark:text-white">
                      {currentStep === 6 ? "Step 6: Review Configured Rooms" : "Step 7: Final Review & Generate Infrastructure"}
                    </h4>
                    <p className="text-xs text-gray-500">
                      Verify the compiled hierarchy tree before committing to the hospital database.
                    </p>
                  </div>
                </div>

                {/* Summary Stat Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border p-4 text-center bg-brand-50/50 dark:bg-brand-500/10 border-brand-200 dark:border-brand-800">
                    <div className="text-2xl font-black text-brand-600 dark:text-brand-400">{totalBuildingsCount}</div>
                    <div className="text-xs text-gray-500 font-medium mt-0.5">Buildings</div>
                  </div>
                  <div className="rounded-xl border p-4 text-center bg-brand-50/50 dark:bg-brand-500/10 border-brand-200 dark:border-brand-800">
                    <div className="text-2xl font-black text-brand-600 dark:text-brand-400">{totalFloorsCount}</div>
                    <div className="text-xs text-gray-500 font-medium mt-0.5">Total Floors</div>
                  </div>
                  <div className="rounded-xl border p-4 text-center bg-brand-50/50 dark:bg-brand-500/10 border-brand-200 dark:border-brand-800">
                    <div className="text-2xl font-black text-brand-600 dark:text-brand-400">{totalDeptAssignmentsCount}</div>
                    <div className="text-xs text-gray-500 font-medium mt-0.5">Department Assignments</div>
                  </div>
                  <div className="rounded-xl border p-4 text-center bg-brand-50/50 dark:bg-brand-500/10 border-brand-200 dark:border-brand-800">
                    <div className="text-2xl font-black text-brand-600 dark:text-brand-400">~18</div>
                    <div className="text-xs text-gray-500 font-medium mt-0.5">Rooms & Beds</div>
                  </div>
                </div>

                {/* Compiled Tree Preview */}
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50 space-y-3">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Infrastructure Hierarchy Tree Preview
                  </h5>
                  <div className="space-y-3 font-mono text-xs">
                    {buildings.map((b) => (
                      <div key={b.id} className="pl-2 border-l-2 border-brand-500 space-y-1">
                        <div className="font-bold text-gray-900 dark:text-white">
                          🏢 {b.name} ({b.code}) — {b.floorsCount} Floors
                        </div>
                        {b.floors.map((fl) => (
                          <div key={fl.id} className="pl-4 text-gray-700 dark:text-gray-300">
                            └─ 📍 {fl.floorName}: {fl.selectedDeptNames.length > 0 ? fl.selectedDeptNames.join(", ") : "No Depts assigned"}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                {error && (
                  <p className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-lg border border-red-200 dark:bg-red-950/30 dark:border-red-800">
                    ⚠️ {error}
                  </p>
                )}

                {result && (
                  <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300 space-y-1">
                    <h5 className="font-bold text-sm">✅ Infrastructure Generated Successfully!</h5>
                    <p className="text-xs">
                      Created {result.buildings} Buildings, {result.floors} Floors, {result.departments} Department Assignments, {result.wards} Ward Instances, {result.rooms} Rooms, and {result.beds} Beds.
                    </p>
                  </div>
                )}

                {/* Final Submit Button */}
                <div className="flex items-center gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={handleWizardGenerate}
                    disabled={isGenerating}
                    className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
                  >
                    {isGenerating ? "Building Hospital Infrastructure..." : "🚀 Confirm & Generate Hospital Infrastructure"}
                  </button>
                </div>
              </section>
            )}
          </div>
        )}

        {/* HIERARCHY TAB */}
        {activeTab === "hierarchy" && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
                Live Hospital Hierarchy Tree
              </h3>
              <button
                type="button"
                onClick={() => void loadHierarchy()}
                className="text-xs text-brand-600 hover:underline"
              >
                🔄 Refresh Tree
              </button>
            </div>

            {isLoadingHierarchy ? (
              <p className="text-sm text-gray-500">Loading current hospital hierarchy...</p>
            ) : !hierarchy || (hierarchy.buildings ?? []).length === 0 ? (
              <p className="text-sm text-gray-500">
                No hospital infrastructure generated yet. Use the Interactive Setup Wizard to generate your buildings.
              </p>
            ) : (
              <div className="space-y-4">
                {(hierarchy.buildings as Array<Record<string, unknown>>).map((b) => {
                  const bFloors = ((hierarchy.floors ?? []) as Array<Record<string, unknown>>).filter(
                    (f) => Number(f.building_id) === Number(b.id)
                  );
                  return (
                    <div key={String(b.id)} className="rounded-xl border border-gray-200 p-4 space-y-3 dark:border-gray-800">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🏢</span>
                        <span className="font-bold text-gray-900 dark:text-white">{String(b.building_name)}</span>
                        {Boolean(b.code) && <span className="text-xs font-mono text-gray-500">({String(b.code)})</span>}
                      </div>

                      <div className="pl-4 space-y-2 border-l-2 border-gray-200 dark:border-gray-700">
                        {bFloors.map((f) => {
                          const fDepts = ((hierarchy.floorDepartments ?? []) as Array<Record<string, unknown>>).filter(
                            (fd) => Number(fd.floor_id) === Number(f.id)
                          );
                          return (
                            <div key={String(f.id)} className="space-y-1">
                              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                📍 {String(f.floor_name)}
                              </div>
                              <div className="pl-4 text-xs text-gray-600 dark:text-gray-400">
                                Departments: {fDepts.length > 0 ? fDepts.map((d) => String(d.department_name)).join(", ") : "None"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
