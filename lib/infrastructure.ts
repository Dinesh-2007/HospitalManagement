/**
 * Shared infrastructure types, field definitions, and status constants
 * for the Hospital Infrastructure & Bed Management system.
 */

/* ─── Status Constants ─── */

export const BUILDING_STATUSES = ["Active", "Inactive", "Under Construction"] as const;
export type BuildingStatus = (typeof BUILDING_STATUSES)[number];

export const BED_STATUSES = [
  "Available",
  "Occupied",
  "Reserved",
  "Cleaning",
  "Maintenance",
  "Blocked",
] as const;
export type BedStatus = (typeof BED_STATUSES)[number];

export const ROOM_STATUSES = [
  "Available",
  "Partially Occupied",
  "Full",
  "Maintenance",
] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const BED_TYPES = [
  "Standard",
  "Semi-Fowler",
  "Fowler",
  "ICU Bed",
  "Pediatric Bed",
  "Bariatric Bed",
  "Motorized",
  "Manual",
  "Air Mattress",
  "Stretcher",
] as const;

/* ─── Table Names ─── */

export const TABLE_NAMES = {
  BUILDING: "building_master",
  FLOOR: "floor_master",
  ROOM_PURPOSE: "room_purpose_master",
  DEPARTMENT: "department_master",
  WARD: "ward_master",
  ROOM: "room_master",
  BED: "bed_master",
  FLOOR_DEPT: "floor_department_assignment",
  WARD_INSTANCE: "ward_instance",
  BED_ALLOCATION: "bed_allocation",
  BED_TRANSFER_HISTORY: "bed_transfer_history",
  BED_STATUS_AUDIT: "bed_status_audit",
} as const;

/* ─── Floor name generation ─── */

export function generateFloorName(index: number): string {
  if (index === 0) return "Ground Floor";
  return `Floor ${index}`;
}

/* ─── Room name generation ─── */

export function generateRoomName(floorNumber: number, roomIndex: number): string {
  const prefix = floorNumber * 100;
  return `Room ${prefix + roomIndex + 1}`;
}

/* ─── Bed name generation ─── */

export function generateBedName(bedIndex: number): string {
  return `Bed ${bedIndex + 1}`;
}

/* ─── Color for room status tiles ─── */

export function roomStatusColor(status: string): string {
  switch (status) {
    case "Available":
      return "#22c55e"; // green
    case "Partially Occupied":
      return "#eab308"; // yellow
    case "Full":
      return "#ef4444"; // red
    case "Maintenance":
      return "#6b7280"; // gray
    default:
      return "#6b7280";
  }
}

/* ─── Color for bed status badges ─── */

export function bedStatusColor(status: string): string {
  switch (status) {
    case "Available":
      return "#22c55e";
    case "Occupied":
      return "#ef4444";
    case "Reserved":
      return "#3b82f6";
    case "Cleaning":
      return "#f59e0b";
    case "Maintenance":
      return "#6b7280";
    case "Blocked":
      return "#1f2937";
    default:
      return "#6b7280";
  }
}

/* ─── Generator config type ─── */

export type InfrastructureGeneratorConfig = {
  buildings: Array<{
    buildingName: string;
    description?: string;
    floorCount: number;
    floorsConfig?: Array<{
      departments: Array<{
        departmentName: string;
        wards: Array<{
          wardType: string;
          roomCount: number;
          bedsPerRoom: number;
          roomType?: string;
          roomPurpose?: string;
          bedType?: string;
          chargePerBed?: number;
          chargePerRoom?: number;
        }>;
      }>;
    }>;
  }>;
};

/* ─── Quick generator config (simplified) ─── */

export type QuickGeneratorConfig = {
  buildingCount: number;
  floorsPerBuilding: number;
  departmentsPerFloor: number;
  wardsPerDepartment: number;
  roomsPerWard: number;
  bedsPerRoom: number;
  selectedDepartments: string[];
  selectedWardTypes: string[];
  roomType?: string;
  roomPurpose?: string;
  bedType?: string;
  chargePerBed?: number;
  chargePerRoom?: number;
};
