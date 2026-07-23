"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageLayout } from "../../../../components/page-layout";
import { bedStatusColor } from "../../../../lib/infrastructure";

type Row = Record<string, unknown>;

export default function BedAllocationPage() {
  const params = useParams();
  const hname = params?.Hname as string;

  // Drill-down selections
  const [buildings, setBuildings] = useState<Row[]>([]);
  const [floors, setFloors] = useState<Row[]>([]);
  const [departments, setDepartments] = useState<Row[]>([]);
  const [wards, setWards] = useState<Row[]>([]);
  const [rooms, setRooms] = useState<Row[]>([]);
  const [beds, setBeds] = useState<Row[]>([]);

  const [selectedBuilding, setSelectedBuilding] = useState("");
  const [selectedFloor, setSelectedFloor] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedWard, setSelectedWard] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("");
  const [selectedBed, setSelectedBed] = useState<Row | null>(null);

  // Patient info
  const [patientId, setPatientId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [allocatedByName, setAllocatedByName] = useState("");

  const [isAllocating, setIsAllocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Current allocations
  const [allocations, setAllocations] = useState<Row[]>([]);

  // Load buildings
  useEffect(() => {
    if (!hname) return;
    fetch(`/api/${hname}/forms/building_master`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setBuildings(d.rows ?? []))
      .catch(() => {});
  }, [hname]);

  // Load hierarchy when building selected
  useEffect(() => {
    if (!hname || !selectedBuilding) { setFloors([]); setDepartments([]); setWards([]); setRooms([]); setBeds([]); return; }
    fetch(`/api/${hname}/infrastructure?action=hierarchy&buildingId=${selectedBuilding}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setFloors(data.floors ?? []);
        // Unique departments from floorDepartments
        const deptMap = new Map<string, Row>();
        (data.floorDepartments ?? []).forEach((fd: Row) => {
          const name = String(fd.department_name ?? "");
          if (name && !deptMap.has(name)) deptMap.set(name, fd);
        });
        setDepartments(Array.from(deptMap.values()));
        setWards([]);
        setRooms([]);
        setBeds([]);

        // If we have all data, we can filter downstream
        // Store full data for filtering
        (window as unknown as Record<string, unknown>).__infraData = data;
      })
      .catch(() => {});
  }, [hname, selectedBuilding]);

  // Filter departments by floor
  useEffect(() => {
    const data = (window as unknown as Record<string, unknown>).__infraData as { floorDepartments?: Row[]; wardInstances?: Row[]; rooms?: Row[]; beds?: Row[] } | undefined;
    if (!data) return;

    if (selectedFloor) {
      const filtered = (data.floorDepartments ?? []).filter(
        (fd) => String(fd.floor_id) === selectedFloor
      );
      const deptMap = new Map<string, Row>();
      filtered.forEach((fd) => {
        const name = String(fd.department_name ?? "");
        if (name && !deptMap.has(name)) deptMap.set(name, fd);
      });
      setDepartments(Array.from(deptMap.values()));
    }
    setSelectedDepartment("");
    setSelectedWard("");
    setSelectedRoom("");
    setSelectedBed(null);
    setWards([]);
    setRooms([]);
    setBeds([]);
  }, [selectedFloor]);

  // Filter wards by department
  useEffect(() => {
    const data = (window as unknown as Record<string, unknown>).__infraData as { wardInstances?: Row[]; rooms?: Row[]; beds?: Row[] } | undefined;
    if (!data || !selectedDepartment) { setWards([]); setRooms([]); setBeds([]); return; }

    const filtered = (data.wardInstances ?? []).filter(
      (w) => String(w.department_name) === selectedDepartment &&
             (!selectedFloor || String(w.floor_name) === floors.find((f) => String(f.id) === selectedFloor)?.floor_name)
    );
    const wardMap = new Map<string, Row>();
    filtered.forEach((w) => {
      const type = String(w.ward_type ?? "");
      if (type && !wardMap.has(type)) wardMap.set(type, w);
    });
    setWards(Array.from(wardMap.values()));
    setSelectedWard("");
    setSelectedRoom("");
    setSelectedBed(null);
    setRooms([]);
    setBeds([]);
  }, [selectedDepartment, selectedFloor, floors]);

  // Filter rooms by ward
  useEffect(() => {
    const data = (window as unknown as Record<string, unknown>).__infraData as { rooms?: Row[]; beds?: Row[] } | undefined;
    if (!data || !selectedWard) { setRooms([]); setBeds([]); return; }

    const filtered = (data.rooms ?? []).filter(
      (r) => String(r.ward_name) === selectedWard &&
             String(r.department_name) === selectedDepartment
    );
    setRooms(filtered);
    setSelectedRoom("");
    setSelectedBed(null);
    setBeds([]);
  }, [selectedWard, selectedDepartment]);

  // Filter beds by room
  useEffect(() => {
    const data = (window as unknown as Record<string, unknown>).__infraData as { beds?: Row[] } | undefined;
    if (!data || !selectedRoom) { setBeds([]); return; }

    const filtered = (data.beds ?? []).filter(
      (b) => String(b.room_id) === selectedRoom && String(b.status || "Available") === "Available"
    );
    setBeds(filtered);
    setSelectedBed(null);
  }, [selectedRoom]);

  // Load active allocations
  const loadAllocations = useCallback(async () => {
    if (!hname) return;
    try {
      const res = await fetch(`/api/${hname}/infrastructure?action=allocations`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setAllocations(data.rows ?? []);
      }
    } catch { /* ignore */ }
  }, [hname]);

  useEffect(() => { void loadAllocations(); }, [loadAllocations]);

  const handleAllocate = async () => {
    if (!selectedBed || !patientId || !patientName) {
      setError("Please select a bed and enter patient details.");
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
          patientId,
          patientName,
          allocatedByName: allocatedByName || null,
          allocatedByRole: "Admin",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Allocation failed.");
      setMessage(`Bed allocated successfully to ${patientName} (${patientId}).`);
      setSelectedBed(null);
      setPatientId("");
      setPatientName("");
      void loadAllocations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Allocation failed.");
    } finally {
      setIsAllocating(false);
    }
  };

  return (
    <PageLayout title="Bed Allocation">
      <div className="space-y-6">
        {/* Drill-down selectors */}
        <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800">
            <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
              Allocate Bed
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Drill down through the hierarchy to find and allocate an available bed.
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* Step 1: Location drill-down */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Building</label>
                <select
                  value={selectedBuilding}
                  onChange={(e) => { setSelectedBuilding(e.target.value); setSelectedFloor(""); setSelectedDepartment(""); setSelectedWard(""); setSelectedRoom(""); setSelectedBed(null); }}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                >
                  <option value="">Select Building</option>
                  {buildings.map((b) => (
                    <option key={String(b.id)} value={String(b.id)}>{String(b.building_name || b.code)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Floor</label>
                <select
                  value={selectedFloor}
                  onChange={(e) => setSelectedFloor(e.target.value)}
                  disabled={!selectedBuilding}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 disabled:opacity-50"
                >
                  <option value="">Select Floor</option>
                  {floors.map((f) => (
                    <option key={String(f.id)} value={String(f.id)}>{String(f.floor_name)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Department</label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  disabled={departments.length === 0}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 disabled:opacity-50"
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={String(d.department_name)} value={String(d.department_name)}>
                      {String(d.department_name)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Ward</label>
                <select
                  value={selectedWard}
                  onChange={(e) => setSelectedWard(e.target.value)}
                  disabled={wards.length === 0}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 disabled:opacity-50"
                >
                  <option value="">Select Ward</option>
                  {wards.map((w) => (
                    <option key={String(w.ward_type)} value={String(w.ward_type)}>
                      {String(w.ward_type)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Room</label>
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  disabled={rooms.length === 0}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 disabled:opacity-50"
                >
                  <option value="">Select Room</option>
                  {rooms.map((r) => (
                    <option key={String(r.id)} value={String(r.id)}>
                      {String(r.description || r.code)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Available beds */}
            {beds.length > 0 && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-400">
                  Available Beds ({beds.length})
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {beds.map((bed) => (
                    <button
                      key={String(bed.id)}
                      type="button"
                      onClick={() => setSelectedBed(bed)}
                      className={`rounded-lg border p-3 text-left text-sm transition hover:shadow-md ${
                        selectedBed && Number(selectedBed.id) === Number(bed.id)
                          ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10 dark:border-brand-500"
                          : "border-gray-200 dark:border-gray-700 hover:border-brand-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: bedStatusColor("Available") }}
                        />
                        <span className="font-medium text-gray-800 dark:text-white/90 truncate">
                          {String(bed.description || bed.bed_number || bed.code)}
                        </span>
                      </div>
                      {Boolean(bed.bed_type) && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {String(bed.bed_type)}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedRoom && beds.length === 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                No available beds in this room. All beds are occupied or unavailable.
              </p>
            )}

            {/* Patient info */}
            {selectedBed && (
              <div className="rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-500/5 p-5 space-y-4">
                <h4 className="text-sm font-medium text-gray-800 dark:text-white/90">
                  Allocating: {String(selectedBed.description || selectedBed.bed_number)} in {String(selectedBed.room_name)}
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Patient ID *</label>
                    <input
                      type="text"
                      value={patientId}
                      onChange={(e) => setPatientId(e.target.value)}
                      placeholder="e.g. PID-0001"
                      className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Patient Name *</label>
                    <input
                      type="text"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="Enter patient name"
                      className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Allocated By</label>
                    <input
                      type="text"
                      value={allocatedByName}
                      onChange={(e) => setAllocatedByName(e.target.value)}
                      placeholder="Staff name"
                      className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleAllocate}
                    disabled={isAllocating || !patientId || !patientName}
                    className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 focus:outline-hidden focus:ring-3 focus:ring-brand-500/25 disabled:opacity-50"
                  >
                    {isAllocating ? "Allocating..." : "Allocate Bed"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBed(null)}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {message && (
              <p className="text-sm text-green-600 dark:text-green-400">{message}</p>
            )}
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>
        </section>

        {/* Active allocations */}
        <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800">
            <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
              Active Allocations ({allocations.length})
            </h3>
          </div>
          <div className="p-4 sm:p-6">
            {allocations.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No active bed allocations.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
                  <thead>
                    <tr>
                      {["Patient", "Bed", "Room", "Ward", "Floor", "Building", "Allocated At"].map((col) => (
                        <th key={col} className="px-4 py-3 text-left font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {allocations.map((a, i) => (
                      <tr key={String(a.id ?? i)}>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {String(a.patient_name || "-")}
                          {a.patient_id ? <span className="text-xs text-gray-400 ml-1">({String(a.patient_id)})</span> : null}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{String(a.bed_name || "-")}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{String(a.room_name || "-")}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{String(a.ward_name || "-")}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{String(a.floor_name || "-")}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{String(a.building_name || "-")}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {a.allocated_at ? new Date(String(a.allocated_at)).toLocaleString() : "-"}
                        </td>
                      </tr>
                    ))}
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
