"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

export type WardConfig = {
  wardType: string;
  enabled: boolean;
  allocationType?: "rooms" | "beds";
  roomCount: number;
  bedsPerRoom: number;
  roomType: string;
  roomPattern: string;
  bedPattern: string;
  rate: number;
};

export type DeptCustomConfig = {
  wards: Record<string, WardConfig>;
  // Clinics
  hasClinics?: boolean;
  clinicCount?: number;
  hasDoctorRooms?: boolean;
  doctorRoomCount?: number;
  hasNurseStation?: boolean;
  nurseStationCount?: number;
  hasProcedureRoom?: boolean;
  procedureRoomCount?: number;
  hasWaitingArea?: boolean;
  waitingCapacity?: number;
  // Medical Labs
  hasSampleBooth?: boolean;
  sampleBoothCount?: number;
  hasTestingLab?: boolean;
  testingLabCount?: number;
  hasReportCounter?: boolean;
  reportCounterCount?: number;
  hasXray?: boolean;
  xrayCount?: number;
  hasMri?: boolean;
  mriCount?: number;
  hasCtScan?: boolean;
  ctScanCount?: number;
};

export type GeneratedBed = {
  id: string;
  bedNumber: string;
  bedType: string;
  charge: number;
  status: string;
  equipment?: string;
};

export type GeneratedRoom = {
  id: string;
  roomNumber: string;
  roomType: string;
  roomPurpose: string;
  capacity: number;
  rate: number;
  status?: string;
  beds: GeneratedBed[];
};

export type GeneratedWard = {
  id: string;
  wardName: string;
  wardType: string;
  allocationType?: "rooms" | "beds";
  description?: string;
  status: "Enabled" | "Disabled";
  rooms: GeneratedRoom[];
  roomsCountInput?: number;
  bedsPerRoomInput?: number;
  roomTypeInput?: string;
  bedsCountInput?: number;
};

export type GeneratedDept = {
  departmentName: string;
  wards: GeneratedWard[];
};

export type GeneratedFloor = {
  floorId: string;
  floorNumber: number;
  floorName: string;
  departments: GeneratedDept[];
};

export type GeneratedBuilding = {
  buildingId: string;
  buildingName: string;
  buildingCode: string;
  floors: GeneratedFloor[];
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
  const router = useRouter();
  const hname = params?.Hname as string;

  const [activeTab, setActiveTab] = useState<"generator" | "hierarchy">("generator");

  // Step tracking for Wizard (1 to 7)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Buildings State
  const [buildings, setBuildings] = useState<BuildingConfig[]>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("wizard_buildings");
      if (saved !== null) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        } catch { /* ignore */ }
      }
    }
    const ts = Date.now();
    return [
      {
        id: `bld-${ts}`,
        name: "Building A",
        code: "BLD-A",
        description: "",
        floorsCount: 1,
        floors: [
          { id: `fl-0-${ts}`, floorNumber: 0, floorName: "Ground Floor", selectedDeptNames: [], departments: [] },
        ],
      },
    ];
  });
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  const [selectedFloorId, setSelectedFloorId] = useState<string>("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GeneratorResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [hierarchy, setHierarchy] = useState<HierarchyData | null>(null);
  const [isLoadingHierarchy, setIsLoadingHierarchy] = useState(false);

  // Compiled hierarchy state for manual inline editing (Step 5)
  const [generatedBuildings, setGeneratedBuildings] = useState<GeneratedBuilding[]>([]);

  // Inpatient builder current selections
  const [builderBuildingId, setBuilderBuildingId] = useState<string>("");
  const [builderFloorId, setBuilderFloorId] = useState<string>("");
  const [builderDeptName, setBuilderDeptName] = useState<string>("");
  const [builderWardType, setBuilderWardType] = useState<string | null>(null);
  const [builderRoomId, setBuilderRoomId] = useState<string | null>(null);

  // Expandable card tracker: Key = `${buildingId}_${floorId}_${deptName}_${wardType}`
  const [expandedWardCard, setExpandedWardCard] = useState<string | null>(null);

  // Room generator form state
  const [genRoomCount, setGenRoomCount] = useState<number>(5);
  const [genRoomType, setGenRoomType] = useState<string>("");
  const [genRoomPrefix, setGenRoomPrefix] = useState<string>("RM");
  const [genRoomPattern, setGenRoomPattern] = useState<string>("{Prefix}-{FloorNum}{RoomIndex}");
  const [genRoomRate, setGenRoomRate] = useState<number>(1500);
  const [genBedsPerRoom, setGenBedsPerRoom] = useState<number>(2);

  // Bed generator form state
  const [genBedCount, setGenBedCount] = useState<number>(2);
  const [genBedType, setGenBedType] = useState<string>("");
  const [genBedPrefix, setGenBedPrefix] = useState<string>("B");
  const [genBedPattern, setGenBedPattern] = useState<string>("{RoomName}-{Prefix}{BedIndex}");
  const [genBedRate, setGenBedRate] = useState<number>(1500);
  const [genBedEquipment, setGenBedEquipment] = useState<string>("");

  // Sync buildings to sessionStorage & handle focus re-hydration
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("wizard_buildings", JSON.stringify(buildings));
    }
  }, [buildings]);

  useEffect(() => {
    const syncSessionState = () => {
      if (typeof window === "undefined") return;
      const saved = sessionStorage.getItem("wizard_buildings");
      if (saved !== null) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setBuildings(parsed);
          }
        } catch { /* ignore */ }
      }
    };

    window.addEventListener("focus", syncSessionState);
    return () => window.removeEventListener("focus", syncSessionState);
  }, []);

  // Per-department custom parameter overrides: Key = `${buildingId}_${floorId}_${deptName}`
  const [deptCustomConfigs, setDeptCustomConfigs] = useState<Record<string, DeptCustomConfig>>({});

  // Update Modal State (Step 3)
  const [updateModalFloor, setUpdateModalFloor] = useState<{ buildingId: string; floorId: string } | null>(null);
  const [updateModalTab, setUpdateModalTab] = useState<"department" | "clinic" | "medicallab">("department");

  // LOV options
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(true);
  const [wardOptions, setWardOptions] = useState<string[]>([]);
  const [roomTypeOptions, setRoomTypeOptions] = useState<string[]>([]);
  const [roomPurposeOptions, setRoomPurposeOptions] = useState<string[]>([]);
  const [bedTypeOptions, setBedTypeOptions] = useState<string[]>([]);

  // Load LOV options
  useEffect(() => {
    if (!hname) return;

    async function loadDepartments() {
      setIsLoadingDepartments(true);
      try {
        const res = await fetch(`/api/${hname}/forms/department_master`, { cache: "no-store" });
        if (!res.ok) {
          setDepartmentOptions([]);
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
        setDepartmentOptions(fetched);
      } catch {
        setDepartmentOptions([]);
      } finally {
        setIsLoadingDepartments(false);
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
        const finalBedTypes = types.length > 0 ? types : ["Standard Bed", "ICU Bed", "Electric Bed", "Pediatric Bed"];
        setBedTypeOptions(finalBedTypes);
        setGenBedType(finalBedTypes[0]);
      } catch {
        const fallbacks = ["Standard Bed", "ICU Bed", "Electric Bed", "Pediatric Bed"];
        setBedTypeOptions(fallbacks);
        setGenBedType(fallbacks[0]);
      }
    }

    void loadDepartments();
    void loadOptions("ward_master", setWardOptions);
    void loadOptions("room_type_master", (opts) => {
      const finalRoomTypes = opts.length > 0 ? opts : ["General Ward Room", "Private Suite", "Semi-Private Room", "ICU Room"];
      setRoomTypeOptions(finalRoomTypes);
      setGenRoomType(finalRoomTypes[0]);
    });
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
              selectedDeptNames: [],
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
    } finally {
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

    const ts = Date.now();
    const newBld: BuildingConfig = {
      id: `bld-${ts}-${Math.random().toString(36).substring(2, 6)}`,
      name: `Building ${letter}`,
      code: `BLD-${letter}`,
      description: "",
      floorsCount: 1,
      floors: [
        { id: `fl-0-${ts}`, floorNumber: 0, floorName: "Ground Floor", selectedDeptNames: [], departments: [] },
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
    const target = buildings.find((b) => b.id === id);
    const bName = target?.name || "Building";
    const bCode = target?.code || "";
    router.push(
      `/${hname}/bed-management/infrastructure/delete-building?id=${encodeURIComponent(
        id
      )}&name=${encodeURIComponent(bName)}&code=${encodeURIComponent(bCode)}`
    );
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

  const resolveRoomName = (
    pattern: string,
    deptCode: string,
    floorNum: number,
    roomIdx: number,
    wardType: string
  ): string => {
    let name = pattern;
    const roomNum = (floorNum + 1) * 100 + roomIdx;

    let wardCode = wardType.substring(0, 3).toUpperCase();
    if (wardType.toLowerCase().includes("general")) wardCode = "GW";
    else if (wardType.toLowerCase().includes("private")) wardCode = "PV";
    else if (wardType.toLowerCase().includes("semi")) wardCode = "SP";
    else if (wardType.toLowerCase().includes("icu")) wardCode = "ICU";
    else if (wardType.toLowerCase().includes("ccu")) wardCode = "CCU";
    else if (wardType.toLowerCase().includes("nicu")) wardCode = "NICU";
    else if (wardType.toLowerCase().includes("picu")) wardCode = "PICU";

    name = name.replace(/{DeptCode}/g, deptCode);
    name = name.replace(/{FloorNum}/g, String(floorNum));
    name = name.replace(/{RoomNum}/g, String(roomNum));
    name = name.replace(/{RoomIndex}/g, String(roomIdx));
    name = name.replace(/{WardCode}/g, wardCode);
    return name;
  };

  const resolveBedName = (
    pattern: string,
    deptCode: string,
    floorNum: number,
    roomIdx: number,
    roomName: string,
    bedIdx: number
  ): string => {
    let name = pattern;
    const roomNum = (floorNum + 1) * 100 + roomIdx;
    const bedCode = String.fromCharCode(65 + bedIdx - 1);

    name = name.replace(/{DeptCode}/g, deptCode);
    name = name.replace(/{FloorNum}/g, String(floorNum));
    name = name.replace(/{RoomNum}/g, String(roomNum));
    name = name.replace(/{RoomIndex}/g, String(roomIdx));
    name = name.replace(/{RoomName}/g, roomName);
    name = name.replace(/{BedIndex}/g, String(bedIdx));
    name = name.replace(/{BedCode}/g, bedCode);
    return name;
  };

  const syncGeneratedBuildings = useCallback(() => {
    if (buildings.length > 0) {
      const defaultB = buildings[0];
      const defaultFl = defaultB.floors?.[0];
      const defaultDept = defaultFl?.selectedDeptNames?.[0] || "";
      const cleanDept = defaultDept.split("-").pop()?.trim() || defaultDept;

      setBuilderBuildingId((prev) => prev || defaultB.id);
      setBuilderFloorId((prev) => prev || (defaultFl?.id || ""));
      setBuilderDeptName((prev) => prev || cleanDept);
    }

    setGeneratedBuildings((prev) => {
      return buildings.map((b) => {
        const existingB = prev.find((pb) => pb.buildingId === b.id);
        const floors = b.floors.map((fl) => {
          const existingFl = existingB?.floors.find((pfl) => pfl.floorId === fl.id);
          const departments = fl.selectedDeptNames.map((dName) => {
            const cleanName = dName.split("-").pop()?.trim() || dName;
            const existingDept = existingFl?.departments.find((pde) => pde.departmentName === cleanName);

            const defaultWards = wardOptions;

            const wards = defaultWards.map((wType) => {
              const cleanWardType = wType.split("-").pop()?.trim() || wType;
              const existingWard = existingDept?.wards.find((pw) => pw.wardType === cleanWardType);
              if (existingWard) {
                return existingWard;
              }
              const isGeneral = cleanWardType.toLowerCase().includes("general");
              const isPrivate = cleanWardType.toLowerCase().includes("private");
              const isIcu = cleanWardType.toLowerCase().includes("icu") || cleanWardType.toLowerCase().includes("critical") || cleanWardType.toLowerCase().includes("ccu");

              let rCount = 2;
              let bPerRoom = 2;
              let defaultRoomType = roomTypeOptions[0] || "General Ward Room";
              let bCount = 4;

              if (isGeneral) {
                rCount = 4;
                bPerRoom = 4;
                bCount = 16;
                defaultRoomType = roomTypeOptions.find(t => t.toLowerCase().includes("general")) || roomTypeOptions[0] || "General Ward Room";
              } else if (isPrivate) {
                rCount = 2;
                bPerRoom = 1;
                bCount = 2;
                defaultRoomType = roomTypeOptions.find(t => t.toLowerCase().includes("private")) || roomTypeOptions[0] || "Private Suite";
              } else if (isIcu) {
                rCount = 2;
                bPerRoom = 1;
                bCount = 2;
                defaultRoomType = roomTypeOptions.find(t => t.toLowerCase().includes("icu")) || roomTypeOptions[0] || "ICU Room";
              }

              return {
                id: `ward-${b.id}-${fl.id}-${cleanName}-${cleanWardType.replace(/\s+/g, '-')}`,
                wardName: cleanWardType,
                wardType: cleanWardType,
                allocationType: "rooms" as const,
                description: `Inpatient accommodation for ${cleanWardType}`,
                status: "Disabled" as const,
                rooms: [],
                roomsCountInput: rCount,
                bedsPerRoomInput: bPerRoom,
                roomTypeInput: defaultRoomType,
                bedsCountInput: bCount
              };
            });

            return {
              departmentName: cleanName,
              wards
            };
          });

          return {
            floorId: fl.id,
            floorNumber: fl.floorNumber,
            floorName: fl.floorName,
            departments
          };
        });

        return {
          buildingId: b.id,
          buildingName: b.name,
          buildingCode: b.code,
          floors
        };
      });
    });
  }, [buildings, wardOptions, roomTypeOptions]);

  // Synchronize when ward options load
  useEffect(() => {
    if (wardOptions.length > 0) {
      syncGeneratedBuildings();
    }
  }, [wardOptions, syncGeneratedBuildings]);

  const updateWardInputFields = (
    buildingId: string,
    floorId: string,
    deptName: string,
    wardId: string,
    updates: Partial<GeneratedWard>
  ) => {
    setGeneratedBuildings((prev) =>
      prev.map((b) => {
        if (b.buildingId !== buildingId) return b;
        return {
          ...b,
          floors: b.floors.map((f) => {
            if (f.floorId !== floorId) return f;
            return {
              ...f,
              departments: f.departments.map((d) => {
                if (d.departmentName !== deptName) return d;
                return {
                  ...d,
                  wards: d.wards.map((w) => {
                    if (w.id !== wardId) return w;
                    return {
                      ...w,
                      ...updates,
                    };
                  }),
                };
              }),
            };
          }),
        };
      })
    );
  };

  const handleConfigureWard = (
    buildingId: string,
    floorId: string,
    deptName: string,
    ward: GeneratedWard
  ) => {
    const isRooms = (ward.allocationType || "rooms") === "rooms";
    const roomsCount = Number(ward.roomsCountInput ?? 2);
    const bedsPerRoom = Number(ward.bedsPerRoomInput ?? 2);
    const roomType = ward.roomTypeInput || (roomTypeOptions[0] || "General Ward Room");
    const bedsCount = Number(ward.bedsCountInput ?? 4);

    setGeneratedBuildings((prev) =>
      prev.map((b) => {
        if (b.buildingId !== buildingId) return b;
        return {
          ...b,
          floors: b.floors.map((f) => {
            if (f.floorId !== floorId) return f;
            return {
              ...f,
              departments: f.departments.map((d) => {
                if (d.departmentName !== deptName) return d;
                return {
                  ...d,
                  wards: d.wards.map((w) => {
                    if (w.id !== ward.id) return w;

                    const newRooms: GeneratedRoom[] = [];
                    if (isRooms) {
                      for (let r = 1; r <= roomsCount; r++) {
                        const roomName = `RM${r}`;
                        const beds: GeneratedBed[] = [];
                        for (let bd = 1; bd <= bedsPerRoom; bd++) {
                          beds.push({
                            id: `bed-${buildingId}-${floorId}-${deptName}-${w.wardType}-${r}-${bd}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                            bedNumber: `${roomName}-BD${bd}`,
                            bedType: bedTypeOptions[0] || "Standard Bed",
                            charge: 0,
                            status: "Available",
                          });
                        }
                        newRooms.push({
                          id: `rm-${buildingId}-${floorId}-${deptName}-${w.wardType}-${r}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                          roomNumber: roomName,
                          roomType: roomType,
                          roomPurpose: "Patient Room",
                          capacity: bedsPerRoom,
                          rate: 0,
                          status: "Available",
                          beds,
                        });
                      }
                    } else {
                      const virtualRoomName = `${w.wardType} Hall`;
                      const beds: GeneratedBed[] = [];
                      for (let bd = 1; bd <= bedsCount; bd++) {
                        beds.push({
                          id: `bed-${buildingId}-${floorId}-${deptName}-${w.wardType}-${bd}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                          bedNumber: `BD${bd}`,
                          bedType: bedTypeOptions[0] || "Standard Bed",
                          charge: 0,
                          status: "Available",
                        });
                      }
                      newRooms.push({
                        id: `rm-virtual-${buildingId}-${floorId}-${deptName}-${w.wardType.replace(/\s+/g, '-')}`,
                        roomNumber: virtualRoomName,
                        roomType: roomTypeOptions[0] || "Open Ward",
                        roomPurpose: "Patient Hall",
                        capacity: bedsCount,
                        rate: 0,
                        status: "Available",
                        beds,
                      });
                    }

                    return {
                      ...w,
                      rooms: newRooms,
                    };
                  }),
                };
              }),
            };
          }),
        };
      })
    );

    setBuilderWardType(ward.wardType);
    setBuilderRoomId(null);
  };

  const updateWardStatus = (buildingId: string, floorId: string, deptName: string, wardId: string, enabled: boolean) => {
    setGeneratedBuildings((prev) =>
      prev.map((b) => {
        if (b.buildingId !== buildingId) return b;
        return {
          ...b,
          floors: b.floors.map((f) => {
            if (f.floorId !== floorId) return f;
            return {
              ...f,
              departments: f.departments.map((d) => {
                if (d.departmentName !== deptName) return d;
                return {
                  ...d,
                  wards: d.wards.map((w) => {
                    if (w.id !== wardId) return w;
                    return {
                      ...w,
                      status: enabled ? "Enabled" : "Disabled",
                    };
                  }),
                };
              }),
            };
          }),
        };
      })
    );
  };

  const generateRoomsForWard = (
    buildingId: string,
    floorId: string,
    deptName: string,
    wardId: string,
    params: {
      roomCount: number;
      roomType: string;
      roomPrefix: string;
      roomPattern: string;
      rate: number;
      bedsPerRoom: number;
      bedType: string;
      bedPrefix: string;
      bedPattern: string;
    }
  ) => {
    setGeneratedBuildings((prev) =>
      prev.map((b) => {
        if (b.buildingId !== buildingId) return b;
        return {
          ...b,
          floors: b.floors.map((f) => {
            if (f.floorId !== floorId) return f;
            const floorNum = f.floorNumber;
            return {
              ...f,
              departments: f.departments.map((d) => {
                if (d.departmentName !== deptName) return d;
                const deptCode = deptName.substring(0, 3).toUpperCase();

                return {
                  ...d,
                  wards: d.wards.map((w) => {
                    if (w.id !== wardId) return w;

                    const newRooms: GeneratedRoom[] = [];
                    for (let r = 1; r <= params.roomCount; r++) {
                      const rName = resolveRoomName(params.roomPattern || "{Prefix}{FloorNum}{RoomIndex}", deptCode, floorNum, r, w.wardType);
                      const finalRoomName = rName.replace(/{Prefix}/g, params.roomPrefix || "");

                      const beds: GeneratedBed[] = [];
                      for (let bd = 1; bd <= params.bedsPerRoom; bd++) {
                        const bName = resolveBedName(params.bedPattern || "{RoomName}-B{BedIndex}", deptCode, floorNum, r, finalRoomName, bd);
                        const finalBedName = bName.replace(/{Prefix}/g, params.bedPrefix || "");
                        beds.push({
                          id: `bed-${buildingId}-${floorId}-${deptName}-${w.wardType}-${r}-${bd}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                          bedNumber: finalBedName,
                          bedType: params.bedType || (bedTypeOptions.length > 0 ? (bedTypeOptions[0].split("-").pop()?.trim() || bedTypeOptions[0]) : ""),
                          charge: params.rate,
                          status: "Available",
                        });
                      }

                      newRooms.push({
                        id: `rm-${buildingId}-${floorId}-${deptName}-${w.wardType}-${r}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                        roomNumber: finalRoomName,
                        roomType: params.roomType,
                        roomPurpose: "Patient Room",
                        capacity: params.bedsPerRoom,
                        rate: params.rate,
                        status: "Available",
                        beds,
                      });
                    }

                    return {
                      ...w,
                      rooms: [...w.rooms, ...newRooms],
                    };
                  }),
                };
              }),
            };
          }),
        };
      })
    );
  };

  const generateBedsDirectlyForWard = (
    buildingId: string,
    floorId: string,
    deptName: string,
    wardId: string,
    params: {
      bedCount: number;
      bedType: string;
      bedPrefix?: string;
      bedPattern?: string;
      rate: number;
    }
  ) => {
    setGeneratedBuildings((prev) =>
      prev.map((b) => {
        if (b.buildingId !== buildingId) return b;
        return {
          ...b,
          floors: b.floors.map((f) => {
            if (f.floorId !== floorId) return f;
            const floorNum = f.floorNumber;
            return {
              ...f,
              departments: f.departments.map((d) => {
                if (d.departmentName !== deptName) return d;
                const deptCode = deptName.substring(0, 3).toUpperCase();

                return {
                  ...d,
                  wards: d.wards.map((w) => {
                    if (w.id !== wardId) return w;

                    const virtualRoomName = `${w.wardType} Hall`;
                    const beds: GeneratedBed[] = [];
                    for (let bd = 1; bd <= params.bedCount; bd++) {
                      const bName = resolveBedName(
                        params.bedPattern || "{RoomName}-B{BedIndex}",
                        deptCode,
                        floorNum,
                        1,
                        virtualRoomName,
                        bd
                      );
                      const finalBedName = bName.replace(/{Prefix}/g, params.bedPrefix || "");
                      beds.push({
                        id: `bed-${buildingId}-${floorId}-${deptName}-${w.wardType}-${bd}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                        bedNumber: finalBedName,
                        bedType: params.bedType || (bedTypeOptions.length > 0 ? (bedTypeOptions[0].split("-").pop()?.trim() || bedTypeOptions[0]) : ""),
                        charge: params.rate,
                        status: "Available",
                      });
                    }

                    const virtualRoom: GeneratedRoom = {
                      id: `rm-virtual-${buildingId}-${floorId}-${deptName}-${w.wardType.replace(/\s+/g, '-')}`,
                      roomNumber: virtualRoomName,
                      roomType: roomTypeOptions.length > 0 ? (roomTypeOptions[0].split("-").pop()?.trim() || roomTypeOptions[0]) : "Open Ward",
                      roomPurpose: "Patient Hall",
                      capacity: params.bedCount,
                      rate: params.rate,
                      status: "Available",
                      beds,
                    };

                    return {
                      ...w,
                      allocationType: "beds" as const,
                      rooms: [virtualRoom],
                    };
                  }),
                };
              }),
            };
          }),
        };
      })
    );
  };

  const addBedDirectlyToWard = (buildingId: string, floorId: string, deptName: string, wardId: string) => {
    setGeneratedBuildings((prev) =>
      prev.map((b) => {
        if (b.buildingId !== buildingId) return b;
        return {
          ...b,
          floors: b.floors.map((f) => {
            if (f.floorId !== floorId) return f;
            return {
              ...f,
              departments: f.departments.map((d) => {
                if (d.departmentName !== deptName) return d;
                return {
                  ...d,
                  wards: d.wards.map((w) => {
                    if (w.id !== wardId) return w;
                    let virtualRoom = w.rooms[0];
                    if (!virtualRoom) {
                      virtualRoom = {
                        id: `rm-virtual-${buildingId}-${floorId}-${deptName}-${w.wardType.replace(/\s+/g, '-')}`,
                        roomNumber: `${w.wardType} Hall`,
                        roomType: roomTypeOptions[0] || "Open Ward",
                        roomPurpose: "Patient Hall",
                        capacity: 1,
                        rate: 1000,
                        status: "Available",
                        beds: [],
                      };
                    }
                    const bedNum = virtualRoom.beds.length + 1;
                    const newBed: GeneratedBed = {
                      id: `bed-${buildingId}-${floorId}-${deptName}-${wardId}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                      bedNumber: `${w.wardType.substring(0, 3).toUpperCase()}-B${bedNum}`,
                      bedType: bedTypeOptions[0] || "Standard Bed",
                      charge: 1000,
                      status: "Available",
                    };
                    return {
                      ...w,
                      allocationType: "beds" as const,
                      rooms: [{ ...virtualRoom, beds: [...virtualRoom.beds, newBed] }],
                    };
                  }),
                };
              }),
            };
          }),
        };
      })
    );
  };

  const addRoomToWard = (buildingId: string, floorId: string, deptName: string, wardId: string) => {
    setGeneratedBuildings((prev) =>
      prev.map((b) => {
        if (b.buildingId !== buildingId) return b;
        return {
          ...b,
          floors: b.floors.map((f) => {
            if (f.floorId !== floorId) return f;
            return {
              ...f,
              departments: f.departments.map((d) => {
                if (d.departmentName !== deptName) return d;
                return {
                  ...d,
                  wards: d.wards.map((w) => {
                    if (w.id !== wardId) return w;
                    const nextRoomIdx = w.rooms.length + 1;
                    const newRoomNum = `RM-${nextRoomIdx}`;
                    const newRoom: GeneratedRoom = {
                      id: `rm-${buildingId}-${floorId}-${deptName}-${w.wardType}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                      roomNumber: newRoomNum,
                      roomType: roomTypeOptions.length > 0 ? (roomTypeOptions[0].split("-").pop()?.trim() || roomTypeOptions[0]) : "",
                      roomPurpose: "Patient Room",
                      capacity: 1,
                      rate: 1000,
                      status: "Available",
                      beds: [
                        {
                          id: `bed-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                          bedNumber: `${newRoomNum}-A`,
                          bedType: bedTypeOptions.length > 0 ? (bedTypeOptions[0].split("-").pop()?.trim() || bedTypeOptions[0]) : "",
                          charge: 1000,
                          status: "Available",
                        }
                      ]
                    };
                    return { ...w, rooms: [...w.rooms, newRoom] };
                  }),
                };
              }),
            };
          }),
        };
      })
    );
  };

  const updateRoomInWard = (buildingId: string, floorId: string, deptName: string, wardId: string, roomId: string, updates: Partial<GeneratedRoom>) => {
    setGeneratedBuildings((prev) =>
      prev.map((b) => {
        if (b.buildingId !== buildingId) return b;
        return {
          ...b,
          floors: b.floors.map((f) => {
            if (f.floorId !== floorId) return f;
            return {
              ...f,
              departments: f.departments.map((d) => {
                if (d.departmentName !== deptName) return d;
                return {
                  ...d,
                  wards: d.wards.map((w) => {
                    if (w.id !== wardId) return w;
                    return {
                      ...w,
                      rooms: w.rooms.map((r) => {
                        if (r.id !== roomId) return r;
                        return { ...r, ...updates };
                      }),
                    };
                  }),
                };
              }),
            };
          }),
        };
      })
    );
  };

  const deleteRoomFromWard = (buildingId: string, floorId: string, deptName: string, wardId: string, roomId: string) => {
    setGeneratedBuildings((prev) =>
      prev.map((b) => {
        if (b.buildingId !== buildingId) return b;
        return {
          ...b,
          floors: b.floors.map((f) => {
            if (f.floorId !== floorId) return f;
            return {
              ...f,
              departments: f.departments.map((d) => {
                if (d.departmentName !== deptName) return d;
                return {
                  ...d,
                  wards: d.wards.map((w) => {
                    if (w.id !== wardId) return w;
                    return {
                      ...w,
                      rooms: w.rooms.filter((r) => r.id !== roomId),
                    };
                  }),
                };
              }),
            };
          }),
        };
      })
    );
  };

  const duplicateRoomInWard = (buildingId: string, floorId: string, deptName: string, wardId: string, roomId: string) => {
    setGeneratedBuildings((prev) =>
      prev.map((b) => {
        if (b.buildingId !== buildingId) return b;
        return {
          ...b,
          floors: b.floors.map((f) => {
            if (f.floorId !== floorId) return f;
            return {
              ...f,
              departments: f.departments.map((d) => {
                if (d.departmentName !== deptName) return d;
                return {
                  ...d,
                  wards: d.wards.map((w) => {
                    if (w.id !== wardId) return w;
                    const targetRoom = w.rooms.find((r) => r.id === roomId);
                    if (!targetRoom) return w;

                    const newRoomNumber = `${targetRoom.roomNumber}-Copy`;
                    const newRoom: GeneratedRoom = {
                      ...targetRoom,
                      id: `rm-${buildingId}-${floorId}-${deptName}-${w.wardType}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                      roomNumber: newRoomNumber,
                      beds: targetRoom.beds.map((bed, idx) => ({
                        ...bed,
                        id: `bed-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
                        bedNumber: bed.bedNumber.replace(targetRoom.roomNumber, newRoomNumber),
                      })),
                    };

                    const idxOfTarget = w.rooms.findIndex((r) => r.id === roomId);
                    const copyRooms = [...w.rooms];
                    copyRooms.splice(idxOfTarget + 1, 0, newRoom);

                    return {
                      ...w,
                      rooms: copyRooms,
                    };
                  }),
                };
              }),
            };
          }),
        };
      })
    );
  };

  const addBedToRoom = (buildingId: string, floorId: string, deptName: string, wardId: string, roomId: string) => {
    setGeneratedBuildings((prev) =>
      prev.map((b) => {
        if (b.buildingId !== buildingId) return b;
        return {
          ...b,
          floors: b.floors.map((f) => {
            if (f.floorId !== floorId) return f;
            return {
              ...f,
              departments: f.departments.map((d) => {
                if (d.departmentName !== deptName) return d;
                return {
                  ...d,
                  wards: d.wards.map((w) => {
                    if (w.id !== wardId) return w;
                    return {
                      ...w,
                      rooms: w.rooms.map((r) => {
                        if (r.id !== roomId) return r;
                        const nextBedIdx = r.beds.length + 1;
                        const newBed: GeneratedBed = {
                          id: `bed-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                          bedNumber: `${r.roomNumber}-B${nextBedIdx}`,
                          bedType: bedTypeOptions.length > 0 ? (bedTypeOptions[0].split("-").pop()?.trim() || bedTypeOptions[0]) : "",
                          charge: r.rate,
                          status: "Available",
                          equipment: "",
                        };
                        const updatedBeds = [...r.beds, newBed];
                        return {
                          ...r,
                          beds: updatedBeds,
                          capacity: updatedBeds.length,
                        };
                      }),
                    };
                  }),
                };
              }),
            };
          }),
        };
      })
    );
  };

  const updateBedInRoom = (buildingId: string, floorId: string, deptName: string, wardId: string, roomId: string, bedId: string, updates: Partial<GeneratedBed>) => {
    setGeneratedBuildings((prev) =>
      prev.map((b) => {
        if (b.buildingId !== buildingId) return b;
        return {
          ...b,
          floors: b.floors.map((f) => {
            if (f.floorId !== floorId) return f;
            return {
              ...f,
              departments: f.departments.map((d) => {
                if (d.departmentName !== deptName) return d;
                return {
                  ...d,
                  wards: d.wards.map((w) => {
                    if (w.id !== wardId) return w;
                    return {
                      ...w,
                      rooms: w.rooms.map((r) => {
                        if (r.id !== roomId) return r;
                        return {
                          ...r,
                          beds: r.beds.map((bd) => {
                            if (bd.id !== bedId) return bd;
                            return { ...bd, ...updates };
                          }),
                        };
                      }),
                    };
                  }),
                };
              }),
            };
          }),
        };
      })
    );
  };

  const deleteBedFromRoom = (buildingId: string, floorId: string, deptName: string, wardId: string, roomId: string, bedId: string) => {
    setGeneratedBuildings((prev) =>
      prev.map((b) => {
        if (b.buildingId !== buildingId) return b;
        return {
          ...b,
          floors: b.floors.map((f) => {
            if (f.floorId !== floorId) return f;
            return {
              ...f,
              departments: f.departments.map((d) => {
                if (d.departmentName !== deptName) return d;
                return {
                  ...d,
                  wards: d.wards.map((w) => {
                    if (w.id !== wardId) return w;
                    return {
                      ...w,
                      rooms: w.rooms.map((r) => {
                        if (r.id !== roomId) return r;
                        const updatedBeds = r.beds.filter((bd) => bd.id !== bedId);
                        return {
                          ...r,
                          beds: updatedBeds,
                          capacity: updatedBeds.length,
                        };
                      }),
                    };
                  }),
                };
              }),
            };
          }),
        };
      })
    );
  };

  const generateBedsForRoom = (
    buildingId: string,
    floorId: string,
    deptName: string,
    wardId: string,
    roomId: string,
    params: {
      bedCount: number;
      bedType: string;
      bedPrefix: string;
      bedPattern: string;
      charge: number;
      equipment: string;
    }
  ) => {
    setGeneratedBuildings((prev) =>
      prev.map((b) => {
        if (b.buildingId !== buildingId) return b;
        return {
          ...b,
          floors: b.floors.map((f) => {
            if (f.floorId !== floorId) return f;
            const floorNum = f.floorNumber;
            return {
              ...f,
              departments: f.departments.map((d) => {
                if (d.departmentName !== deptName) return d;
                const deptCode = deptName.substring(0, 3).toUpperCase();

                return {
                  ...d,
                  wards: d.wards.map((w) => {
                    if (w.id !== wardId) return w;
                    return {
                      ...w,
                      rooms: w.rooms.map((r) => {
                        if (r.id !== roomId) return r;

                        const newBeds: GeneratedBed[] = [];
                        for (let bd = 1; bd <= params.bedCount; bd++) {
                          const bName = resolveBedName(params.bedPattern || "{RoomName}-B{BedIndex}", deptCode, floorNum, 1, r.roomNumber, bd);
                          const finalBedName = bName.replace(/{Prefix}/g, params.bedPrefix || "");
                          newBeds.push({
                            id: `bed-${Date.now()}-${bd}-${Math.random().toString(36).substring(2, 6)}`,
                            bedNumber: finalBedName,
                            bedType: params.bedType || (bedTypeOptions.length > 0 ? (bedTypeOptions[0].split("-").pop()?.trim() || bedTypeOptions[0]) : ""),
                            charge: params.charge,
                            status: "Available",
                            equipment: params.equipment,
                          });
                        }

                        const updatedBeds = [...r.beds, ...newBeds];
                        return {
                          ...r,
                          beds: updatedBeds,
                          capacity: updatedBeds.length,
                        };
                      }),
                    };
                  }),
                };
              }),
            };
          }),
        };
      })
    );
  };

  const handleNextStep = () => {
    const check = validateStep(currentStep);
    if (!check.valid) {
      setError(check.message || "Please complete the required details before advancing to the next step.");
      return;
    }
    setError(null);

    if (currentStep === 3) {
      syncGeneratedBuildings();
    }

    setCurrentStep((prev) => Math.min(6, prev + 1));
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

    if (targetStep === 4) {
      syncGeneratedBuildings();
    }

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

    const defaultWards: Record<string, WardConfig> = {};
    const deptCode = deptName.includes("-") ? deptName.split("-")[0].trim() : deptName.substring(0, 3).toUpperCase();

    const allWards = wardOptions;
    allWards.forEach((w) => {
      const cleanW = w.split("-").pop()?.trim() || w;
      const isGeneral = cleanW.toLowerCase().includes("general");
      const isPrivate = cleanW.toLowerCase().includes("private");
      const isIcu = cleanW.toLowerCase().includes("icu") || cleanW.toLowerCase().includes("critical") || cleanW.toLowerCase().includes("ccu");

      const enabled = isGeneral || isPrivate || isIcu;
      let roomCount = 1;
      let bedsPerRoom = 1;
      let rate = 1000;

      if (isGeneral) {
        roomCount = 4;
        bedsPerRoom = 4;
        rate = 800;
      } else if (isPrivate) {
        roomCount = 2;
        bedsPerRoom = 1;
        rate = 3000;
      } else if (isIcu) {
        roomCount = 2;
        bedsPerRoom = 1;
        rate = 7000;
      }

      let roomType = "";
      if (roomTypeOptions.length > 0) {
        const found = roomTypeOptions.find(t => {
          const cleanT = t.split("-").pop()?.trim().toLowerCase() || "";
          if (isIcu && (cleanT.includes("icu") || cleanT.includes("critical") || cleanT.includes("intensive"))) return true;
          if (isGeneral && (cleanT.includes("general") || cleanT.includes("ward"))) return true;
          if (isPrivate && (cleanT.includes("private") || cleanT.includes("deluxe") || cleanT.includes("single") || cleanT.includes("suite"))) return true;
          return false;
        });
        if (found) {
          roomType = found.split("-").pop()?.trim() || found;
        } else {
          roomType = roomTypeOptions[0].split("-").pop()?.trim() || roomTypeOptions[0];
        }
      }

      defaultWards[cleanW] = {
        wardType: cleanW,
        enabled,
        allocationType: "rooms",
        roomCount,
        bedsPerRoom,
        roomType: roomType,
        roomPattern: `${deptCode}-F{FloorNum}-R{RoomNum}`,
        bedPattern: `{RoomName}-B{BedCode}`,
        rate,
      };
    });

    const clean = deptName.toLowerCase();
    const hasClinics = clean.includes("opd") || clean.includes("consult") || clean.includes("clinic") || (!clean.includes("lab") && !clean.includes("pharmacy") && !clean.includes("radio") && !clean.includes("imaging"));
    const hasDoctorRooms = hasClinics;
    const hasNurseStation = true;
    const hasProcedureRoom = clean.includes("emergency") || clean.includes("surgery") || clean.includes("cardio") || clean.includes("ot");
    const hasWaitingArea = true;

    const isDiagnostic = clean.includes("radio") || clean.includes("imaging") || clean.includes("lab") || clean.includes("pathology");
    const hasSampleBooth = clean.includes("lab") || clean.includes("pathology");
    const hasTestingLab = isDiagnostic;
    const hasReportCounter = isDiagnostic;
    const hasXray = clean.includes("radio") || clean.includes("imaging") || clean.includes("x-ray") || clean.includes("xray");
    const hasMri = clean.includes("mri") || clean.includes("radio") || clean.includes("imaging");
    const hasCtScan = clean.includes("ct") || clean.includes("scan") || clean.includes("radio") || clean.includes("imaging");

    return {
      wards: defaultWards,
      hasClinics,
      clinicCount: 2,
      hasDoctorRooms,
      doctorRoomCount: 2,
      hasNurseStation,
      nurseStationCount: 1,
      hasProcedureRoom,
      procedureRoomCount: 1,
      hasWaitingArea,
      waitingCapacity: 20,
      hasSampleBooth,
      sampleBoothCount: 2,
      hasTestingLab,
      testingLabCount: 1,
      hasReportCounter,
      reportCounterCount: 1,
      hasXray,
      xrayCount: 1,
      hasMri,
      mriCount: 1,
      hasCtScan,
      ctScanCount: 1,
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

  const updateWardConfig = (buildingId: string, floorId: string, deptName: string, wardType: string, updates: Partial<WardConfig>) => {
    const key = `${buildingId}_${floorId}_${deptName}`;
    const current = getDeptCustomConfig(buildingId, floorId, deptName);
    const ward = current.wards[wardType] || {
      wardType,
      enabled: false,
      allocationType: "rooms",
      roomCount: 1,
      bedsPerRoom: 1,
      roomType: roomTypeOptions.length > 0 ? (roomTypeOptions[0].split("-").pop()?.trim() || roomTypeOptions[0]) : "",
      roomPattern: `{DeptCode}-F{FloorNum}-R{RoomNum}`,
      bedPattern: `{RoomName}-B{BedCode}`,
      rate: 1000,
    };

    const updatedWard = { ...ward, ...updates };

    setDeptCustomConfigs((prev) => ({
      ...prev,
      [key]: {
        ...current,
        wards: {
          ...current.wards,
          [wardType]: updatedWard
        }
      }
    }));

    if (updates.allocationType) {
      setGeneratedBuildings((prev) =>
        prev.map((b) => {
          if (b.buildingId !== buildingId) return b;
          return {
            ...b,
            floors: b.floors.map((f) => {
              if (f.floorId !== floorId) return f;
              return {
                ...f,
                departments: f.departments.map((d) => {
                  if (d.departmentName !== deptName) return d;
                  return {
                    ...d,
                    wards: d.wards.map((w) => {
                      if (w.wardType !== wardType) return w;
                      return {
                        ...w,
                        allocationType: updates.allocationType,
                      };
                    }),
                  };
                }),
              };
            }),
          };
        })
      );
    }
  };

  // Compile final rooms structure for Step 5/6 and API call
  const compileWizardPayload = () => {
    return generatedBuildings.map((b) => ({
      name: b.buildingName,
      code: b.buildingCode,
      description: `Hospital ${b.buildingName}`,
      floorsCount: b.floors.length,
      floors: b.floors.map((f) => ({
        floorNumber: f.floorNumber,
        floorName: f.floorName,
        departments: f.departments.map((d) => {
          const allRooms = d.wards
            .filter((w) => w.status === "Enabled")
            .flatMap((w) =>
              w.rooms.map((r) => ({
                name: r.roomNumber,
                type: r.roomType,
                purpose: r.roomPurpose || "Inpatient Bed",
                capacity: r.capacity || r.beds.length,
                rate: r.rate,
                bedCount: r.beds.length,
                bedType: r.beds[0]?.bedType || (bedTypeOptions.length > 0 ? (bedTypeOptions[0].split("-").pop()?.trim() || bedTypeOptions[0]) : ""),
                wardType: w.wardType,
                beds: r.beds.map((bd) => ({
                  bedNumber: bd.bedNumber,
                  bedType: bd.bedType,
                  charge: bd.charge,
                  description: bd.bedNumber,
                  equipment: bd.equipment || "",
                })),
              }))
            );

          return {
            departmentName: d.departmentName,
            rooms: allRooms,
          };
        }),
      })),
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
    id: "",
    name: "",
    code: "",
    description: "",
    floorsCount: 0,
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
    <PageLayout title="Hospital Infrastructure">
      <div className="space-y-6">
        {/* Top Navigation Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setActiveTab("generator")}
            className={`border-b-2 px-5 py-3 text-sm font-medium transition ${activeTab === "generator"
              ? "border-brand-500 text-brand-600 dark:text-brand-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
              }`}
          >
            Interactive Setup Wizard
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("hierarchy")}
            className={`border-b-2 px-5 py-3 text-sm font-medium transition ${activeTab === "hierarchy"
              ? "border-brand-500 text-brand-600 dark:text-brand-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
              }`}
          >
            Current Hierarchy Tree
          </button>
        </div>

        {activeTab === "generator" && (
          <div className="space-y-6">
            {/* Step Wizard Header */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-800 dark:text-white/90">
                    Hospital Infrastructure Designer
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
                    Step {currentStep} of 6
                  </span>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    disabled={currentStep === 6}
                    className="px-4 py-1.5 rounded-lg bg-brand-500 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-40 transition shadow-xs"
                  >
                    Next Step →
                  </button>
                </div>
              </div>

              {/* Stepper Bar */}
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {[
                  { step: 1, label: "1. Buildings" },
                  { step: 2, label: "2. Floors" },
                  { step: 3, label: "3. Departments" },
                  { step: 4, label: "4. Wards & Beds" },
                  { step: 5, label: "5. Hierarchy Tree" },
                  { step: 6, label: "6. Summary" },
                ].map((s) => (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => handleStepClick(s.step)}
                    className={`rounded-lg py-2 px-2.5 text-xs font-semibold text-center transition ${currentStep === s.step
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
                  <span className="text-amber-500 font-bold">!</span>
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
                    + Add Building
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {buildings.length === 0 && (
                    <div className="col-span-full text-center py-10 text-sm text-gray-400 dark:text-gray-500">
                      No buildings configured. Click <strong>+ Add Building</strong> to get started.
                    </div>
                  )}
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
                      className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${activeBuilding.id === b.id
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
                      className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${activeBuilding.id === b.id
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
                          {fl.floorName} (Floor {fl.floorNumber})
                        </h5>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">
                            {fl.selectedDeptNames.length} Departments Selected
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setUpdateModalFloor({ buildingId: activeBuilding.id, floorId: fl.id });
                              setUpdateModalTab("department");
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-brand-500 text-white text-xs font-semibold hover:bg-brand-600 transition shadow-sm"
                          >
                            Update
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 min-h-[40px] items-center">
                        {fl.selectedDeptNames.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">No departments assigned to this floor. Click "Update" to select departments.</p>
                        ) : (
                          fl.selectedDeptNames.map((dName) => (
                            <span
                              key={dName}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300 dark:border-brand-500 flex items-center gap-1.5"
                            >
                              {dName}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* ====== UPDATE MODAL ====== */}
                {updateModalFloor && (() => {
                  const modalBuilding = buildings.find(b => b.id === updateModalFloor.buildingId);
                  const modalFloor = modalBuilding?.floors.find(f => f.id === updateModalFloor.floorId);
                  if (!modalBuilding || !modalFloor) return null;

                  return (
                    <div
                      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                      onClick={(e) => { if (e.target === e.currentTarget) setUpdateModalFloor(null); }}
                    >
                      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-gray-200 dark:border-gray-700 overflow-hidden">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                          <div>
                            <h3 className="text-base font-bold text-gray-900 dark:text-white">
                              Assign Departments to {modalFloor.floorName}
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {modalFloor.selectedDeptNames.length} department(s) assigned to this floor
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setUpdateModalFloor(null)}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition text-sm font-bold"
                          >
                            ×
                          </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-auto p-6">
                          <div className="space-y-4">
                            <p className="text-xs text-gray-500">
                              Select or unselect departments from the Master list for <strong>{modalFloor.floorName}</strong>:
                            </p>
                            {isLoadingDepartments ? (
                              <p className="text-xs text-gray-400 italic py-4">Loading departments from master...</p>
                            ) : departmentOptions.length === 0 ? (
                              <p className="text-sm text-gray-400 italic text-center py-8">No departments found in Master.</p>
                            ) : (
                              <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider w-16">Select</th>
                                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Department Name</th>
                                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Code</th>
                                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Type</th>
                                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {departmentOptions.map((dept, idx) => {
                                      const isSelected = modalFloor.selectedDeptNames.includes(dept);
                                      const cleanName = dept.split("-").pop()?.trim() || dept;
                                      const codePart = dept.includes("-") ? dept.split("-")[0].trim() : "—";
                                      const clean = dept.toLowerCase();
                                      const deptType =
                                        clean.includes("radio") || clean.includes("imaging") ? "Diagnostic"
                                          : clean.includes("pharmacy") || clean.includes("store") ? "Pharmacy"
                                            : clean.includes("lab") || clean.includes("pathology") ? "Laboratory"
                                              : clean.includes("icu") || clean.includes("critical") ? "Critical Care"
                                                : clean.includes("emergency") ? "Emergency"
                                                  : clean.includes("reception") || clean.includes("registration") ? "Administrative"
                                                    : "Clinical";
                                      return (
                                        <tr key={dept} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition ${isSelected ? 'bg-brand-50/40 dark:bg-brand-900/10' : ''}`}>
                                          <td className="px-4 py-3 text-center">
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={() => toggleDeptForFloor(modalBuilding.id, modalFloor.id, dept)}
                                              className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer"
                                            />
                                          </td>
                                          <td className="px-4 py-3">
                                            <span className="font-semibold text-gray-900 dark:text-white text-sm">{cleanName}</span>
                                          </td>
                                          <td className="px-4 py-3">
                                            <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">{codePart}</span>
                                          </td>
                                          <td className="px-4 py-3">
                                            <span className="text-xs px-2 py-1 rounded-full font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{deptType}</span>
                                          </td>
                                          <td className="px-4 py-3">
                                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
                                              {isSelected ? "Assigned" : "Available"}
                                            </span>
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

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 flex-shrink-0 bg-gray-50 dark:bg-gray-800/50">
                          <button
                            type="button"
                            onClick={() => setUpdateModalFloor(null)}
                            className="px-5 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                          >
                            Close
                          </button>
                          <button
                            type="button"
                            onClick={() => setUpdateModalFloor(null)}
                            className="px-5 py-2 rounded-lg bg-brand-500 text-sm font-semibold text-white hover:bg-brand-600 transition shadow-sm"
                          >
                            Save Changes
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </section>
            )}
            {/* STEP 4: CONFIGURE WARDS & BEDS */}
            {currentStep === 4 && (() => {
              const currentB = generatedBuildings.find((b) => b.buildingId === (builderBuildingId || (buildings[0]?.id || "")));
              const currentFl = currentB?.floors.find((f) => f.floorId === (builderFloorId || (currentB.floors[0]?.floorId || "")));

              const defaultDept = currentFl?.departments[0]?.departmentName || "";
              const activeDeptName = builderDeptName || defaultDept;
              const currentDept = currentFl?.departments.find((d) => d.departmentName === activeDeptName);

              const currentWard = currentDept?.wards.find((w) => w.wardType === builderWardType);
              const currentRoom = currentWard?.rooms.find((r) => r.id === builderRoomId);

              return (
                <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] space-y-6">
                  <div className="border-b border-gray-100 dark:border-gray-800 pb-4">
                    <h4 className="text-base font-bold text-gray-900 dark:text-white">
                      Step 4: Configure Inpatient Wards, Rooms & Beds
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Configure ward types, generate rooms, and customize patient beds inside each room.
                    </p>
                  </div>

                  {/* Context Selection Bar */}
                  <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-150 dark:border-gray-800 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex flex-wrap gap-3 items-center text-xs">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase font-bold text-gray-400">Building</span>
                        <select
                          value={builderBuildingId}
                          onChange={(e) => {
                            const bid = e.target.value;
                            setBuilderBuildingId(bid);
                            const b = generatedBuildings.find(x => x.buildingId === bid);
                            const fid = b?.floors[0]?.floorId || "";
                            setBuilderFloorId(fid);
                            const f = b?.floors.find(x => x.floorId === fid);
                            setBuilderDeptName(f?.departments[0]?.departmentName || "");
                            setBuilderWardType(null);
                            setBuilderRoomId(null);
                          }}
                          className="h-8 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs px-2.5"
                        >
                          {generatedBuildings.map(b => (
                            <option key={b.buildingId} value={b.buildingId}>{b.buildingName}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase font-bold text-gray-400">Floor</span>
                        <select
                          value={builderFloorId}
                          onChange={(e) => {
                            const fid = e.target.value;
                            setBuilderFloorId(fid);
                            const f = currentB?.floors.find(x => x.floorId === fid);
                            setBuilderDeptName(f?.departments[0]?.departmentName || "");
                            setBuilderWardType(null);
                            setBuilderRoomId(null);
                          }}
                          className="h-8 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs px-2.5"
                        >
                          {currentB?.floors.map(f => (
                            <option key={f.floorId} value={f.floorId}>{f.floorName}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase font-bold text-gray-400">Department</span>
                        <select
                          value={activeDeptName}
                          onChange={(e) => {
                            setBuilderDeptName(e.target.value);
                            setBuilderWardType(null);
                            setBuilderRoomId(null);
                          }}
                          className="h-8 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs px-2.5"
                        >
                          {currentFl?.departments.map(d => (
                            <option key={d.departmentName} value={d.departmentName}>{d.departmentName}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1.5 bg-white dark:bg-gray-800/40 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                      <span className="text-brand-500">{currentB?.buildingName || "—"}</span>
                      <span>/</span>
                      <span className="text-brand-500">{currentFl?.floorName || "—"}</span>
                      <span>/</span>
                      <span className="text-brand-500">{activeDeptName || "—"}</span>
                      {builderWardType && (
                        <>
                          <span>/</span>
                          <span className="text-purple-500 font-bold">{builderWardType}</span>
                        </>
                      )}
                      {builderRoomId && currentRoom && (
                        <>
                          <span>/</span>
                          <span className="text-brand-500 font-bold">{currentRoom.roomNumber}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {!builderWardType ? (
                    /* Wards list view */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h5 className="text-sm font-bold text-gray-850 dark:text-white">
                          Inpatient Wards in {activeDeptName}
                        </h5>
                        <span className="text-[11px] text-gray-500 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-full">
                          {currentDept?.wards.filter(w => w.status === "Enabled").length || 0} Enabled
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {currentDept?.wards.map((ward) => {
                          const isEnabled = ward.status === "Enabled";
                          const roomCount = ward.rooms.length;
                          const totalBedsCount = ward.rooms.reduce((acc, r) => acc + r.beds.length, 0);

                          let typeColor = "border-blue-200 dark:border-blue-800 bg-blue-50/10";
                          let labelColor = "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
                          if (ward.wardType.toLowerCase().includes("icu") || ward.wardType.toLowerCase().includes("critical") || ward.wardType.toLowerCase().includes("ccu")) {
                            typeColor = "border-red-200 dark:border-red-800 bg-red-50/10";
                            labelColor = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
                          } else if (ward.wardType.toLowerCase().includes("deluxe") || ward.wardType.toLowerCase().includes("private")) {
                            typeColor = "border-purple-200 dark:border-purple-800 bg-purple-50/10";
                            labelColor = "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
                          }

                          return (
                            <div
                              key={ward.id}
                              className={`rounded-xl border p-5 flex flex-col justify-between transition-all duration-300 ${isEnabled
                                ? `${typeColor} shadow-md dark:shadow-none scale-[1.01]`
                                : "border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/10 opacity-75 hover:opacity-100"
                                }`}
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${labelColor}`}>
                                    {ward.wardType}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => updateWardStatus(currentB!.buildingId, currentFl!.floorId, activeDeptName, ward.id, !isEnabled)}
                                    className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isEnabled ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-700"
                                      }`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isEnabled ? "translate-x-5" : "translate-x-0"
                                        }`}
                                    />
                                  </button>
                                </div>

                                <h6 className="text-sm font-bold text-gray-900 dark:text-white">{ward.wardName}</h6>
                                <p className="text-xs text-gray-500 leading-normal">{ward.description}</p>
                              </div>

                              {isEnabled ? (
                                <div className="pt-4 border-t border-gray-150 dark:border-gray-800 mt-4 space-y-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Structure:</span>
                                    <select
                                      value={ward.allocationType || "rooms"}
                                      onChange={(e) => {
                                        const newType = e.target.value as "rooms" | "beds";
                                        updateWardInputFields(currentB!.buildingId, currentFl!.floorId, activeDeptName, ward.id, { allocationType: newType });
                                      }}
                                      className="h-7 text-[11px] font-medium rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2"
                                    >
                                      <option value="rooms">Room → Beds</option>
                                      <option value="beds">Beds Only</option>
                                    </select>
                                  </div>

                                  {(ward.allocationType || "rooms") === "rooms" ? (
                                    <>
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Room nos.:</span>
                                        <input
                                          type="number"
                                          min={1}
                                          value={ward.roomsCountInput ?? 2}
                                          onChange={(e) => {
                                            updateWardInputFields(currentB!.buildingId, currentFl!.floorId, activeDeptName, ward.id, { roomsCountInput: Math.max(1, Number(e.target.value)) });
                                          }}
                                          className="h-7 w-20 text-[11px] font-medium rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2 text-center"
                                        />
                                      </div>
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Bed nos.:</span>
                                        <input
                                          type="number"
                                          min={1}
                                          value={ward.bedsPerRoomInput ?? 2}
                                          onChange={(e) => {
                                            updateWardInputFields(currentB!.buildingId, currentFl!.floorId, activeDeptName, ward.id, { bedsPerRoomInput: Math.max(1, Number(e.target.value)) });
                                          }}
                                          className="h-7 w-20 text-[11px] font-medium rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2 text-center"
                                        />
                                      </div>
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Room Type:</span>
                                        <select
                                          value={ward.roomTypeInput || (roomTypeOptions[0] || "")}
                                          onChange={(e) => {
                                            updateWardInputFields(currentB!.buildingId, currentFl!.floorId, activeDeptName, ward.id, { roomTypeInput: e.target.value });
                                          }}
                                          className="h-7 w-32 text-[11px] font-medium rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2"
                                        >
                                          {roomTypeOptions.map(t => (
                                            <option key={t} value={t}>{t}</option>
                                          ))}
                                        </select>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Bed nos.:</span>
                                      <input
                                        type="number"
                                        min={1}
                                        value={ward.bedsCountInput ?? 4}
                                        onChange={(e) => {
                                          updateWardInputFields(currentB!.buildingId, currentFl!.floorId, activeDeptName, ward.id, { bedsCountInput: Math.max(1, Number(e.target.value)) });
                                        }}
                                        className="h-7 w-20 text-[11px] font-medium rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2 text-center"
                                      />
                                    </div>
                                  )}

                                  <div className="flex items-center justify-between pt-1">
                                    <div className="text-[11px] text-gray-500">
                                      {ward.allocationType === "beds" ? (
                                        <><strong>{totalBedsCount}</strong> Configured Beds</>
                                      ) : (
                                        <><strong>{roomCount}</strong> Rooms • <strong>{totalBedsCount}</strong> Beds</>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleConfigureWard(currentB!.buildingId, currentFl!.floorId, activeDeptName, ward)}
                                      className="px-3.5 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-sm transition"
                                    >
                                      Configure →
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center py-2 mt-4 text-xs text-gray-400 italic">
                                  Ward is Disabled
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : currentWard?.allocationType === "beds" ? (
                    /* Beds Only (Direct Bed Configuration View) */
                    <div className="space-y-6">
                      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                        <button
                          type="button"
                          onClick={() => setBuilderWardType(null)}
                          className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:underline font-semibold"
                        >
                          ← Back to Wards
                        </button>
                        <h5 className="text-sm font-bold text-gray-900 dark:text-white">
                          Configure Beds for {builderWardType} (Beds Only / Open Hall)
                        </h5>
                      </div>

                      {/* Direct Beds List */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                          <h6 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                            Direct Beds List ({(currentWard?.rooms[0]?.beds || []).length} Beds)
                          </h6>
                          <button
                            type="button"
                            onClick={() => addBedDirectlyToWard(currentB!.buildingId, currentFl!.floorId, activeDeptName, currentWard!.id)}
                            className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline font-bold"
                          >
                            + Add Bed Manually
                          </button>
                        </div>

                        {(currentWard?.rooms[0]?.beds || []).length === 0 ? (
                          <div className="text-center py-12 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                            <p className="text-sm text-gray-500 italic">No beds configured yet in this ward hall.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {currentWard?.rooms[0]?.beds.map((bed) => (
                              <div
                                key={bed.id}
                                className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 p-3.5 space-y-2.5 shadow-sm text-xs"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <input
                                    type="text"
                                    value={bed.bedNumber}
                                    onChange={(e) => updateBedInRoom(currentB!.buildingId, currentFl!.floorId, activeDeptName, currentWard!.id, currentWard!.rooms[0].id, bed.id, { bedNumber: e.target.value })}
                                    className="font-bold border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded px-2 py-1 w-full text-xs"
                                    placeholder="Bed Number"
                                  />
                                  <button
                                    type="button"
                                    title="Delete Bed"
                                    onClick={() => deleteBedFromRoom(currentB!.buildingId, currentFl!.floorId, activeDeptName, currentWard!.id, currentWard!.rooms[0].id, bed.id)}
                                    className="p-1 rounded hover:bg-red-50 text-red-500"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>

                                <div className="text-[11px]">
                                  <label className="block text-[10px] text-gray-400 mb-0.5">Type</label>
                                  <select
                                    value={bed.bedType}
                                    onChange={(e) => updateBedInRoom(currentB!.buildingId, currentFl!.floorId, activeDeptName, currentWard!.id, currentWard!.rooms[0].id, bed.id, { bedType: e.target.value })}
                                    className="w-full border border-gray-250 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded px-2 py-1 text-[11px]"
                                  >
                                    {bedTypeOptions.map(bt => (
                                      <option key={bt} value={bt}>{bt}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : !builderRoomId ? (
                    /* Room configuration list */
                    <div className="space-y-6">
                      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                        <button
                          type="button"
                          onClick={() => setBuilderWardType(null)}
                          className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:underline font-semibold"
                        >
                          ← Back to Wards
                        </button>
                        <h5 className="text-sm font-bold text-gray-900 dark:text-white">
                          Configure Rooms for {builderWardType}
                        </h5>
                      </div>

                      {/* Rooms list */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                          <h6 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                            Rooms List ({currentWard?.rooms.length || 0} Rooms)
                          </h6>
                          <button
                            type="button"
                            onClick={() => addRoomToWard(currentB!.buildingId, currentFl!.floorId, activeDeptName, currentWard!.id)}
                            className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline font-bold"
                          >
                            + Add Room Manually
                          </button>
                        </div>

                        {currentWard?.rooms.length === 0 ? (
                          <div className="text-center py-12 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                            <p className="text-sm text-gray-500 italic">No rooms configured yet.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {currentWard?.rooms.map((room) => (
                              <div
                                key={room.id}
                                className="rounded-xl border border-gray-200 bg-white dark:border-gray-850 p-4 space-y-3.5 shadow-sm text-xs"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={room.roomNumber}
                                      onChange={(e) => updateRoomInWard(currentB!.buildingId, currentFl!.floorId, activeDeptName, currentWard.id, room.id, { roomNumber: e.target.value })}
                                      className="font-bold border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded px-2.5 py-1 w-28 focus:ring-1 focus:ring-brand-500"
                                      placeholder="Room Number"
                                    />
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-950/20 dark:text-brand-300 font-semibold">
                                      {room.beds.length} Beds
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      title="Duplicate Room"
                                      onClick={() => duplicateRoomInWard(currentB!.buildingId, currentFl!.floorId, activeDeptName, currentWard.id, room.id)}
                                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                                      </svg>
                                    </button>
                                    <button
                                      type="button"
                                      title="Delete Room"
                                      onClick={() => deleteRoomFromWard(currentB!.buildingId, currentFl!.floorId, activeDeptName, currentWard.id, room.id)}
                                      className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>

                                <div className="text-[11px]">
                                  <label className="block text-[10px] text-gray-500 mb-0.5">Room Type</label>
                                  <select
                                    value={room.roomType}
                                    onChange={(e) => updateRoomInWard(currentB!.buildingId, currentFl!.floorId, activeDeptName, currentWard.id, room.id, { roomType: e.target.value })}
                                    className="w-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded px-2 py-1"
                                  >
                                    {roomTypeOptions.map(t => (
                                      <option key={t} value={t}>{t}</option>
                                    ))}
                                    {roomTypeOptions.length === 0 && (
                                      <option value="">No Room Types Configured</option>
                                    )}
                                  </select>
                                </div>

                                <div className="pt-2 border-t border-gray-150 dark:border-gray-800 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setBuilderRoomId(room.id);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold transition"
                                  >
                                    Configure Beds ({room.beds.length}) →
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Bed configuration list */
                    <div className="space-y-6">
                      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                        <button
                          type="button"
                          onClick={() => setBuilderRoomId(null)}
                          className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:underline font-semibold"
                        >
                          ← Back to Rooms
                        </button>
                        <h5 className="text-sm font-bold text-gray-900 dark:text-white">
                          Configure Beds for Room {currentRoom?.roomNumber} ({builderWardType})
                        </h5>
                      </div>

                      {/* Beds list */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                          <h6 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                            Beds Grid ({currentRoom?.beds.length || 0} Beds)
                          </h6>
                          <button
                            type="button"
                            onClick={() => addBedToRoom(currentB!.buildingId, currentFl!.floorId, activeDeptName, currentWard!.id, currentRoom!.id)}
                            className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline font-bold"
                          >
                            + Add Bed Manually
                          </button>
                        </div>

                        {currentRoom?.beds.length === 0 ? (
                          <div className="text-center py-12 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                            <p className="text-sm text-gray-500 italic">No beds configured for this room yet.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {currentRoom?.beds.map((bed) => (
                              <div
                                key={bed.id}
                                className="rounded-xl border border-gray-200 bg-gray-50/50 dark:bg-gray-900/30 p-4 space-y-3.5 shadow-sm text-xs relative"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v2M5 7h14m-1.5 14h-11A1.5 1.5 0 015 19.5V7h14v12.5a1.5 1.5 0 01-1.5 1.5z" />
                                    </svg>
                                    <input
                                      type="text"
                                      value={bed.bedNumber}
                                      onChange={(e) => updateBedInRoom(currentB!.buildingId, currentFl!.floorId, activeDeptName, currentWard!.id, currentRoom.id, bed.id, { bedNumber: e.target.value })}
                                      className="font-bold border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded px-2 py-0.5 w-28 focus:ring-1 focus:ring-brand-500"
                                      placeholder="Bed Number"
                                    />
                                  </div>

                                  <button
                                    type="button"
                                    title="Delete Bed"
                                    onClick={() => deleteBedFromRoom(currentB!.buildingId, currentFl!.floorId, activeDeptName, currentWard!.id, currentRoom.id, bed.id)}
                                    className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>

                                <div className="space-y-2">
                                  <div>
                                    <label className="block text-[10px] text-gray-500 mb-0.5">Bed Type</label>
                                    <select
                                      value={bed.bedType}
                                      onChange={(e) => updateBedInRoom(currentB!.buildingId, currentFl!.floorId, activeDeptName, currentWard!.id, currentRoom.id, bed.id, { bedType: e.target.value })}
                                      className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded px-2 py-0.5"
                                    >
                                      {bedTypeOptions.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                      ))}
                                      {bedTypeOptions.length === 0 && (
                                        <option value="">No Bed Types Configured</option>
                                      )}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-[10px] text-gray-500 mb-0.5">Equipment / Assets</label>
                                    <input
                                      type="text"
                                      value={bed.equipment || ""}
                                      onChange={(e) => updateBedInRoom(currentB!.buildingId, currentFl!.floorId, activeDeptName, currentWard!.id, currentRoom.id, bed.id, { equipment: e.target.value })}
                                      className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded px-2 py-0.5"
                                      placeholder="e.g. Ventilator, Syringe Pump"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </section>
              );
            })()}

            {/* STEP 5: HIERARCHY TREE VIEW WITH MANUAL EDITS */}
            {currentStep === 5 && (
              <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] space-y-6">
                <div className="border-b border-gray-100 dark:border-gray-800 pb-3">
                  <h4 className="text-sm font-bold text-gray-800 dark:text-white">
                    Step 5: Dynamic Inpatient Hierarchy Preview
                  </h4>
                  <p className="text-xs text-gray-500">
                    Review a read-only collapsible tree of the generated hospital hierarchy.
                  </p>
                </div>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                  {generatedBuildings.map((b) => (
                    <details key={b.buildingId} className="group border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden" open>
                      <summary className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 px-4 py-3 cursor-pointer select-none font-bold text-gray-900 dark:text-white text-xs hover:bg-gray-100/50">
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-brand-500 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <svg className="w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          Building: {b.buildingName} ({b.buildingCode})
                        </span>
                        <span className="text-[10px] bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300 px-2 py-0.5 rounded font-mono">
                          {b.floors.length} Floors
                        </span>
                      </summary>

                      <div className="p-4 space-y-3 pl-6 border-t border-gray-150 dark:border-gray-800 bg-white dark:bg-transparent">
                        {b.floors.map((fl) => (
                          <details key={fl.floorId} className="group/floor border border-gray-100 dark:border-gray-850 rounded-lg" open>
                            <summary className="flex items-center justify-between px-3 py-2 cursor-pointer select-none font-semibold text-gray-800 dark:text-gray-200 text-xs hover:bg-gray-50/50">
                              <span className="flex items-center gap-2">
                                <svg className="w-3.5 h-3.5 text-gray-500 transition-transform group-open/floor:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                └─ {fl.floorName} (Floor {fl.floorNumber})
                              </span>
                              <span className="text-[10px] bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-500">
                                {fl.departments.length} Depts
                              </span>
                            </summary>

                            <div className="p-3 pl-6 space-y-3 border-t border-gray-100 dark:border-gray-850">
                              {fl.departments.map((dept) => (
                                <details key={dept.departmentName} className="group/dept border border-gray-100/50 dark:border-gray-800/50 rounded" open>
                                  <summary className="flex items-center justify-between px-3 py-1.5 cursor-pointer select-none font-medium text-gray-700 dark:text-gray-300 text-xs hover:bg-gray-50/50">
                                    <span className="flex items-center gap-2">
                                      <svg className="w-3.5 h-3.5 text-gray-400 transition-transform group-open/dept:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                      ├─ Department: {dept.departmentName}
                                    </span>
                                    <span className="text-[10px] bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-300 px-1.5 py-0.5 rounded font-mono">
                                      {dept.wards.filter(w => w.status === "Enabled").length} Wards
                                    </span>
                                  </summary>

                                  <div className="p-2 pl-6 space-y-2 border-t border-gray-100/50 dark:border-gray-850/50 text-xs">
                                    {dept.wards.filter(w => w.status === "Enabled").map((ward) => (
                                      <details key={ward.id} className="group/ward border border-dashed border-gray-200 dark:border-gray-800 rounded">
                                        <summary className="flex items-center justify-between px-2.5 py-1.5 cursor-pointer select-none text-gray-650 dark:text-gray-350 hover:bg-gray-50/50">
                                          <span className="flex items-center gap-1.5">
                                            <svg className="w-3 h-3 text-gray-400 transition-transform group-open/ward:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                            • Ward: {ward.wardType}
                                          </span>
                                          <span className="text-[10px] text-gray-500">
                                            {ward.rooms.length} Rooms
                                          </span>
                                        </summary>

                                        <div className="p-2 pl-4 space-y-2 border-t border-dashed border-gray-200 dark:border-gray-800">
                                          {ward.rooms.map((room) => (
                                            <div key={room.id} className="p-2 bg-gray-50/50 dark:bg-gray-900/20 border border-gray-100 dark:border-gray-800 rounded flex flex-col gap-1 text-[11px]">
                                              <div className="flex justify-between items-center">
                                                <span className="font-bold text-gray-800 dark:text-gray-200">
                                                  Room {room.roomNumber} ({room.roomType})
                                                </span>
                                                <span className="text-gray-500 font-mono">
                                                  ₹{room.rate}/day • {room.beds.length} Beds
                                                </span>
                                              </div>
                                              <div className="pl-3 border-l border-gray-300 dark:border-gray-700 flex flex-wrap gap-2 pt-1">
                                                {room.beds.map((bed) => (
                                                  <div key={bed.id} className="px-2 py-0.5 rounded bg-brand-50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300 border border-brand-100 dark:border-brand-900/30 flex items-center gap-1.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
                                                    <span>Bed {bed.bedNumber} ({bed.bedType})</span>
                                                    {bed.equipment && (
                                                      <span className="text-[9px] text-gray-400 font-medium">({bed.equipment})</span>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          ))}
                                          {ward.rooms.length === 0 && (
                                            <div className="text-[10px] text-gray-400 italic">No rooms configured.</div>
                                          )}
                                        </div>
                                      </details>
                                    ))}
                                    {dept.wards.filter(w => w.status === "Enabled").length === 0 && (
                                      <div className="text-xs text-gray-400 italic">No wards enabled for this department.</div>
                                    )}
                                  </div>
                                </details>
                              ))}
                            </div>
                          </details>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            )}

            {/* STEP 6: SUMMARY AND GENERATION SUBMIT */}
            {currentStep === 6 && (
              <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] space-y-6">
                <div className="border-b border-gray-100 dark:border-gray-800 pb-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-gray-800 dark:text-white">
                      Step 6: Confirm & Generate Infrastructure
                    </h4>
                    <p className="text-xs text-gray-500">
                      Verify the compiled inpatient ward infrastructure counts before committing to the database.
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
                    <div className="text-2xl font-black text-brand-600 dark:text-brand-400">
                      {generatedBuildings.reduce((acc, b) => acc + b.floors.reduce((fAcc, f) => fAcc + f.departments.length, 0), 0)}
                    </div>
                    <div className="text-xs text-gray-500 font-medium mt-0.5">Departments</div>
                  </div>
                  <div className="rounded-xl border p-4 text-center bg-brand-50/50 dark:bg-brand-500/10 border-brand-200 dark:border-brand-800">
                    <div className="text-2xl font-black text-brand-600 dark:text-brand-400">
                      {generatedBuildings.reduce(
                        (acc, b) =>
                          acc +
                          b.floors.reduce(
                            (fAcc, f) =>
                              fAcc +
                              f.departments.reduce(
                                (dAcc, d) =>
                                  dAcc +
                                  d.wards
                                    .filter((w) => w.status === "Enabled")
                                    .reduce((wAcc, w) => wAcc + w.rooms.reduce((rAcc, r) => rAcc + r.beds.length, 0), 0),
                                0
                              ),
                            0
                          ),
                        0
                      )}
                    </div>
                    <div className="text-xs text-gray-500 font-medium mt-0.5">Total Beds</div>
                  </div>
                </div>

                {/* Compiled Tree Review */}
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50 space-y-3">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Final Infrastructure Summary
                  </h5>
                  <div className="space-y-3 text-xs max-h-96 overflow-y-auto">
                    {generatedBuildings.map((b) => (
                      <div key={b.buildingId} className="pl-2 border-l-2 border-brand-500 space-y-2">
                        <div className="font-bold text-gray-900 dark:text-white">
                          Building: {b.buildingName} ({b.buildingCode})
                        </div>
                        {b.floors.map((fl) => (
                          <div key={fl.floorId} className="pl-4 space-y-1">
                            <div className="font-semibold text-gray-800 dark:text-gray-250">
                              └─ {fl.floorName}
                            </div>
                            {fl.departments.map((dept) => (
                              <div key={dept.departmentName} className="pl-6 text-gray-600 dark:text-gray-400">
                                ├─ Dept: {dept.departmentName}
                                <div className="pl-4 space-y-1 text-[11px] font-mono">
                                  {dept.wards
                                    .filter((w) => w.status === "Enabled")
                                    .map((w) => {
                                      const totalBeds = w.rooms.reduce((sum, r) => sum + r.beds.length, 0);
                                      return (
                                        <div key={w.id}>
                                          • Ward: {w.wardType} ({w.rooms.length} Rooms, {totalBeds} Beds)
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                {error && (
                  <p className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-lg border border-red-200 dark:bg-red-950/30 dark:border-red-800">
                    {error}
                  </p>
                )}

                {result && (
                  <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300 space-y-1">
                    <h5 className="font-bold text-sm">Infrastructure Generated Successfully</h5>
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
                    className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50 shadow-sm"
                  >
                    {isGenerating ? "Generating Infrastructure..." : "Confirm & Generate Infrastructure"}
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
                Refresh
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
                      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-brand-600 dark:text-brand-400 uppercase">BLD</span>
                          <span className="font-bold text-gray-900 dark:text-white">{String(b.building_name)}</span>
                          {Boolean(b.code) && <span className="text-xs font-mono text-gray-500">({String(b.code)})</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/${hname}/bed-management/infrastructure/delete-building?id=${encodeURIComponent(
                                String(b.id)
                              )}&name=${encodeURIComponent(String(b.building_name))}&code=${encodeURIComponent(
                                String(b.code || "")
                              )}&isDb=true`
                            )
                          }
                          className="text-xs text-red-600 font-medium hover:underline"
                        >
                          Delete Building
                        </button>
                      </div>

                      <div className="pl-4 space-y-2 border-l-2 border-gray-200 dark:border-gray-700">
                        {bFloors.map((f) => {
                          const fDepts = ((hierarchy.floorDepartments ?? []) as Array<Record<string, unknown>>).filter(
                            (fd) => Number(fd.floor_id) === Number(f.id)
                          );
                          return (
                            <div key={String(f.id)} className="space-y-1">
                              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                {String(f.floor_name)}
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
    </PageLayout >
  );
}
