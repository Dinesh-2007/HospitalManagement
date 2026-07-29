"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageLayout } from "../../../../components/page-layout";
import { bedStatusColor } from "../../../../lib/infrastructure";

type Room = Record<string, unknown>;
type Bed = Record<string, unknown>;
type Building = Record<string, unknown>;
type Floor = Record<string, unknown>;

export default function FloorPlanPage() {
  const params = useParams();
  const hname = params?.Hname as string;

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState("");
  const [selectedFloor, setSelectedFloor] = useState("");
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load buildings on mount
  useEffect(() => {
    if (!hname) return;
    async function load() {
      try {
        const res = await fetch(`/api/${hname}/forms/building_master`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setBuildings(data.rows ?? []);
      } catch { /* ignore */ }
    }
    void load();
  }, [hname]);

  // Load floors when building changes
  useEffect(() => {
    if (!hname || !selectedBuilding) { setFloors([]); return; }
    async function load() {
      try {
        const res = await fetch(
          `/api/${hname}/infrastructure?action=hierarchy&buildingId=${selectedBuilding}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = await res.json();
        setFloors(data.floors ?? []);
      } catch { /* ignore */ }
    }
    void load();
  }, [hname, selectedBuilding]);

  // Load rooms & beds when floor changes
  const loadFloorData = useCallback(async () => {
    if (!hname || !selectedBuilding || !selectedFloor) {
      setRooms([]);
      setBeds([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/${hname}/infrastructure?action=hierarchy&buildingId=${selectedBuilding}&floorId=${selectedFloor}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = await res.json();
      const fetchedRooms: Room[] = data.rooms ?? [];
      const fetchedBeds: Bed[] = data.beds ?? [];
      const fetchedWardMasters: Room[] = data.wardMasters ?? [];

      // If room_master is empty, synthesize rooms from ward_master entries
      // so wards show up as "rooms" in the floor plan grid
      if (fetchedRooms.length === 0 && fetchedWardMasters.length > 0) {
        const syntheticRooms: Room[] = fetchedWardMasters.map((w) => ({
          id: `__ward__${String(w.description ?? w.code ?? w.id)}`,
          code: String(w.code ?? ""),
          description: String(w.description ?? w.code ?? ""),
          ward_name: String(w.description ?? w.code ?? ""),
          _synthetic: true,
        }));
        setRooms(syntheticRooms);
      } else {
        setRooms(fetchedRooms);
      }
      setBeds(fetchedBeds);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, [hname, selectedBuilding, selectedFloor]);

  useEffect(() => { void loadFloorData(); }, [loadFloorData]);

  // Compute room status color from its beds
  function getRoomColor(room: Room): string {
    const isWardRoom = String(room.id).startsWith("__ward__");
    const wardName = isWardRoom ? String(room.description ?? "") : "";
    const roomDesc = String(room.description ?? room.code ?? "");
    const roomBedList = beds.filter((b) =>
      isWardRoom
        ? String(b.ward_name ?? b.ward ?? "").toLowerCase() === wardName.toLowerCase()
        : (Number(b.room_id) === Number(room.id) ||
           (roomDesc && String(b.room_name).toLowerCase() === roomDesc.toLowerCase()))
    );
    if (roomBedList.length === 0) return "#6b7280"; // gray - no beds
    const total = roomBedList.length;
    const occupied = roomBedList.filter((b) => b.status === "Occupied").length;
    const maintenance = roomBedList.filter(
      (b) => b.status === "Maintenance" || b.status === "Blocked"
    ).length;

    if (maintenance === total) return "#1f2937"; // dark gray / black
    if (occupied === 0) return "#22c55e"; // green
    if (occupied >= total) return "#ef4444"; // red
    return "#eab308"; // yellow
  }

  function getRoomStatusLabel(room: Room): string {
    const isWardRoom = String(room.id).startsWith("__ward__");
    const wardName = isWardRoom ? String(room.description ?? "") : "";
    const roomDesc = String(room.description ?? room.code ?? "");
    const roomBedList = beds.filter((b) =>
      isWardRoom
        ? String(b.ward_name ?? b.ward ?? "").toLowerCase() === wardName.toLowerCase()
        : (Number(b.room_id) === Number(room.id) ||
           (roomDesc && String(b.room_name).toLowerCase() === roomDesc.toLowerCase()))
    );
    if (roomBedList.length === 0) return "No beds";
    const occupied = roomBedList.filter((b) => b.status === "Occupied").length;
    return `${occupied}/${roomBedList.length} occupied`;
  }

  const roomBeds = selectedRoom
    ? (() => {
        const isWardRoom = String(selectedRoom.id).startsWith("__ward__");
        const wardName = isWardRoom ? String(selectedRoom.description ?? "") : "";
        const roomDesc = String(selectedRoom.description ?? selectedRoom.code ?? "");
        return beds.filter((b) =>
          isWardRoom
            ? String(b.ward_name ?? b.ward ?? "").toLowerCase() === wardName.toLowerCase()
            : (Number(b.room_id) === Number(selectedRoom.id) ||
               (roomDesc && String(b.room_name).toLowerCase() === roomDesc.toLowerCase()))
        );
      })()
    : [];

  return (
    <PageLayout title="Floor Plan View">
      <div className="space-y-6">
        {/* Building & Floor selectors */}
        <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800">
            <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
              Floor Plan
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Select a building and floor to view the room layout with real-time occupancy.
            </p>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-2xl">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                  Building
                </label>
                <select
                  value={selectedBuilding}
                  onChange={(e) => { setSelectedBuilding(e.target.value); setSelectedFloor(""); setSelectedRoom(null); }}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                >
                  <option value="">Select Building</option>
                  {buildings.map((b) => (
                    <option key={String(b.id)} value={String(b.id)}>
                      {String(b.building_name || b.code)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                  Floor
                </label>
                <select
                  value={selectedFloor}
                  onChange={(e) => { setSelectedFloor(e.target.value); setSelectedRoom(null); }}
                  disabled={!selectedBuilding}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 disabled:opacity-50"
                >
                  <option value="">Select Floor</option>
                  {floors.map((f) => (
                    <option key={String(f.id)} value={String(f.id)}>
                      {String(f.floor_name)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Room grid */}
        {selectedFloor && (
          <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h3 className="text-sm font-medium text-gray-800 dark:text-white/90">
                  Rooms ({rooms.length})
                </h3>
                <div className="flex items-center gap-3 text-xs">
                  {[
                    { color: "#22c55e", label: "Available" },
                    { color: "#eab308", label: "Partial" },
                    { color: "#ef4444", label: "Full" },
                    { color: "#3b82f6", label: "Reserved" },
                    { color: "#f97316", label: "Cleaning" },
                    { color: "#1f2937", label: "Maintenance" },
                  ].map((legend) => (
                    <span key={legend.label} className="flex items-center gap-1">
                      <span
                        className="inline-block h-3 w-3 rounded"
                        style={{ backgroundColor: legend.color }}
                      />
                      {legend.label}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void loadFloorData()}
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
              >
                Refresh
              </button>
            </div>

            <div className="p-6">
              {isLoading ? (
                <p className="text-sm text-gray-500">Loading floor plan...</p>
              ) : rooms.length === 0 ? (
                <p className="text-sm text-gray-500">No rooms on this floor.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {rooms.map((room) => {
                    const color = getRoomColor(room);
                    const isSelected = selectedRoom && Number(selectedRoom.id) === Number(room.id);
                    return (
                      <button
                        key={String(room.id)}
                        type="button"
                        onClick={() => setSelectedRoom(isSelected ? null : room)}
                        className={`relative rounded-xl p-4 text-white text-center transition-all hover:scale-105 hover:shadow-lg cursor-pointer ${
                          isSelected ? "ring-2 ring-offset-2 ring-brand-500" : ""
                        }`}
                        style={{ backgroundColor: color }}
                      >
                        <div className="font-semibold text-sm truncate">
                          {String(room.description || room.code)}
                        </div>
                        <div className="text-xs mt-1 opacity-90">
                          {getRoomStatusLabel(room)}
                        </div>
                        {Boolean(room.ward_name) && (
                          <div className="text-[10px] mt-0.5 opacity-75 truncate">
                            {String(room.ward_name)}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Room detail panel */}
        {selectedRoom && (
          <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
                  {String(selectedRoom.description || selectedRoom.code)} — Beds
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {String(selectedRoom.department_name || "")} • {String(selectedRoom.ward_name || "")}
                  {selectedRoom.room_type ? ` • ${String(selectedRoom.room_type)}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRoom(null)}
                className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              {roomBeds.length === 0 ? (
                <p className="text-sm text-gray-500">No beds in this room.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {roomBeds.map((bed) => {
                    const statusColor = bedStatusColor(String(bed.status || "Available"));
                    return (
                      <div
                        key={String(bed.id)}
                        className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-start gap-3"
                      >
                        <div
                          className="mt-0.5 h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: statusColor }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm text-gray-800 dark:text-white/90">
                            {String(bed.description || bed.bed_number || bed.code)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Status: <span className="font-medium">{String(bed.status || "Available")}</span>
                          </div>
                          {Boolean(bed.bed_type) && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Type: {String(bed.bed_type)}
                            </div>
                          )}
                          {Boolean(bed.charge) && Number(bed.charge) > 0 && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Charge: ₹{Number(bed.charge).toLocaleString()}
                            </div>
                          )}
                          {Boolean(bed.patient_name) && (
                            <div className="mt-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                              🧑‍⚕️ {String(bed.patient_name)}
                              {bed.patient_id ? ` (${String(bed.patient_id)})` : ""}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </PageLayout>
  );
}
