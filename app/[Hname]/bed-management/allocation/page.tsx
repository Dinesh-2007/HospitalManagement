"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageLayout } from "../../../../components/page-layout";
import { bedStatusColor } from "../../../../lib/infrastructure";
import { getCurrentUser } from "../../../../app/actions/user";

type Row = Record<string, unknown>;

type PatientRecord = {
  patient_id: string;
  patient_name: string;
  mobile?: string;
  dob?: string;
};

export default function BedAllocationPage() {
  const params = useParams();
  const hname = params?.Hname as string;

  // Session user
  const [currentUser, setCurrentUser] = useState<string>("");

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

  // Patient lookup state
  const [patientSearchQuery, setPatientSearchQuery] = useState("");
  const [patientSearchResults, setPatientSearchResults] = useState<PatientRecord[]>([]);
  const [isSearchingPatient, setIsSearchingPatient] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);

  const [isAllocating, setIsAllocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Current allocations
  const [allocations, setAllocations] = useState<Row[]>([]);

  // Load session user
  useEffect(() => {
    if (!hname) return;
    getCurrentUser(hname).then((user) => {
      if (user) setCurrentUser(user);
    }).catch(() => {});
  }, [hname]);

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
        const deptMap = new Map<string, Row>();
        (data.floorDepartments ?? []).forEach((fd: Row) => {
          const name = String(fd.department_name ?? "");
          if (name && !deptMap.has(name)) deptMap.set(name, fd);
        });
        setDepartments(Array.from(deptMap.values()));
        setWards([]);
        setRooms([]);
        setBeds([]);
        (window as unknown as Record<string, unknown>).__infraData = data;
      })
      .catch(() => {});
  }, [hname, selectedBuilding]);

  // Filter departments by floor
  useEffect(() => {
    const data = (window as unknown as Record<string, unknown>).__infraData as { floorDepartments?: Row[]; wardInstances?: Row[]; wardMasters?: Row[]; rooms?: Row[]; beds?: Row[] } | undefined;
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

  // Filter wards — combining ward_instance + ward_master (fallback for sites using Masters forms)
  useEffect(() => {
    const data = (window as unknown as Record<string, unknown>).__infraData as { wardInstances?: Row[]; wardMasters?: Row[]; rooms?: Row[]; beds?: Row[] } | undefined;
    if (!data || !selectedDepartment) { setWards([]); setRooms([]); setBeds([]); return; }

    const wardMap = new Map<string, Row>();
    const selFloorName = selectedFloor ? String(floors.find((f) => String(f.id) === selectedFloor)?.floor_name ?? "") : "";

    // 1. Ward instances (created via Infrastructure Builder)
    (data.wardInstances ?? []).forEach((w) => {
      const wDept = String(w.department_name ?? "");
      const wFloor = String(w.floor_name ?? "");
      if (wDept.toLowerCase() === selectedDepartment.toLowerCase() &&
          (!selFloorName || wFloor.toLowerCase() === selFloorName.toLowerCase())) {
        const type = String(w.ward_type ?? "");
        if (type) wardMap.set(type.toLowerCase(), w);
      }
    });

    // 2. Fallback: ward_master (added via Masters form — no building/floor/dept linkage)
    if (wardMap.size === 0) {
      (data.wardMasters ?? []).forEach((w) => {
        const desc = String(w.description ?? w.code ?? "");
        if (desc && !wardMap.has(desc.toLowerCase())) {
          wardMap.set(desc.toLowerCase(), { ward_type: desc, _from_master: true });
        }
      });
    }

    setWards(Array.from(wardMap.values()));
    setSelectedWard("");
    setSelectedRoom("");
    setSelectedBed(null);
    setRooms([]);
    setBeds([]);
  }, [selectedDepartment, selectedFloor, floors]);

  // Derive room list from beds when room_master is empty (beds added via Bed Master form)
  useEffect(() => {
    const data = (window as unknown as Record<string, unknown>).__infraData as { rooms?: Row[]; beds?: Row[] } | undefined;
    if (!data || !selectedWard) { setRooms([]); setBeds([]); return; }

    // First try room_master rows
    const fromRoomMaster = (data.rooms ?? []).filter(
      (r) => String(r.ward_name).toLowerCase() === selectedWard.toLowerCase() &&
             String(r.department_name).toLowerCase() === selectedDepartment.toLowerCase()
    );

    if (fromRoomMaster.length > 0) {
      setRooms(fromRoomMaster);
    } else {
      // Fallback: derive room names from bed_master's room_name field
      const roomNameSet = new Set<string>();
      const syntheticRooms: Row[] = [];
      (data.beds ?? []).forEach((b) => {
        const bWard = String(b.ward_name ?? b.ward ?? "");
        if (bWard.toLowerCase() === selectedWard.toLowerCase()) {
          const rName = String(b.room_name ?? "");
          if (rName && !roomNameSet.has(rName.toLowerCase())) {
            roomNameSet.add(rName.toLowerCase());
            syntheticRooms.push({ id: rName, code: rName, description: rName, _synthetic: true });
          }
        }
      });

      // If no room_name either, create a single virtual room for the ward
      if (syntheticRooms.length === 0) {
        syntheticRooms.push({ id: `__ward__${selectedWard}`, code: selectedWard, description: selectedWard, _synthetic: true });
      }
      setRooms(syntheticRooms);
    }

    setSelectedRoom("");
    setSelectedBed(null);
    setBeds([]);
  }, [selectedWard, selectedDepartment]);

  // Filter beds by room
  useEffect(() => {
    const data = (window as unknown as Record<string, unknown>).__infraData as { rooms?: Row[]; beds?: Row[] } | undefined;
    if (!data || !selectedRoom) { setBeds([]); return; }

    const roomRow = (data.rooms ?? []).find((r) => String(r.id) === selectedRoom);
    const isVirtualWard = selectedRoom.startsWith("__ward__");
    const virtualWardName = isVirtualWard ? selectedRoom.replace("__ward__", "") : "";
    const roomDesc = roomRow ? String(roomRow.description ?? roomRow.code ?? "") : selectedRoom;

    const filtered = (data.beds ?? []).filter((b) => {
      const bWard = String(b.ward_name ?? b.ward ?? "");
      const bRoom = String(b.room_name ?? "");
      const bRoomId = String(b.room_id ?? "");

      if (isVirtualWard) {
        // Match by ward when no room_name was set
        return bWard.toLowerCase() === virtualWardName.toLowerCase() &&
               String(b.status || "Available") === "Available";
      }
      return (
        bRoomId === selectedRoom ||
        bRoom.toLowerCase() === roomDesc.toLowerCase()
      ) && String(b.status || "Available") === "Available";
    });
    setBeds(filtered);
    setSelectedBed(null);
  }, [selectedRoom]);

  // Patient search handler
  useEffect(() => {
    if (!patientSearchQuery.trim() || selectedPatient) {
      setPatientSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setIsSearchingPatient(true);
      fetch(`/api/${hname}/patient-search?q=${encodeURIComponent(patientSearchQuery.trim())}`)
        .then((r) => r.json())
        .then((data) => {
          setPatientSearchResults(data.rows ?? []);
        })
        .catch(() => setPatientSearchResults([]))
        .finally(() => setIsSearchingPatient(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [patientSearchQuery, selectedPatient, hname]);

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
    if (!selectedBed || !selectedPatient) {
      setError("Please select a bed and choose a verified patient from lookup.");
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
      setMessage(`Bed allocated successfully to ${data.patientName || selectedPatient.patient_name} (${selectedPatient.patient_id}).`);
      setSelectedBed(null);
      setSelectedPatient(null);
      setPatientSearchQuery("");
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
              Drill down through the hierarchy to find an available bed and assign a validated patient.
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* Location drill-down */}
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
                          {String(bed.bed_type)} {Boolean(bed.charge) && `• ₹${String(bed.charge)}/day`}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedRoom && beds.length === 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                No available beds in this room. All beds are occupied, reserved, cleaning, or under maintenance.
              </p>
            )}

            {/* Verified Patient Lookup Section */}
            {selectedBed && (
              <div className="rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-500/5 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-brand-100 dark:border-brand-900/50 pb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">
                      Allocating: {String(selectedBed.description || selectedBed.bed_number)} in {String(selectedBed.room_name)}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Rate: ₹{String(selectedBed.charge || selectedBed.rate || 0)}/day • Ward: {String(selectedBed.ward_name)}
                    </p>
                  </div>
                  {currentUser && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 self-start sm:self-auto font-medium">
                      Staff: {currentUser}
                    </span>
                  )}
                </div>

                {/* Patient Lookup Input */}
                {!selectedPatient ? (
                  <div className="relative space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">
                      Search Registered Patient (by PID, Name, or Mobile) *
                    </label>
                    <input
                      type="text"
                      value={patientSearchQuery}
                      onChange={(e) => setPatientSearchQuery(e.target.value)}
                      placeholder="Type Patient ID (e.g. PID-0001), Name, or Mobile number..."
                      className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                    />

                    {isSearchingPatient && (
                      <p className="text-xs text-gray-500">Searching patient database...</p>
                    )}

                    {/* Results Dropdown */}
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
                              <span className="font-semibold text-gray-800 dark:text-white">{p.patient_name}</span>
                              <span className="ml-2 text-xs text-brand-600 dark:text-brand-400 font-mono">({p.patient_id})</span>
                            </div>
                            {p.mobile && <span className="text-xs text-gray-500">📱 {p.mobile}</span>}
                          </button>
                        ))}
                      </div>
                    )}

                    {patientSearchQuery.trim() && !isSearchingPatient && patientSearchResults.length === 0 && (
                      <p className="text-xs text-red-500">
                        No registered patient found matching &quot;{patientSearchQuery}&quot;. Please register the patient in Patient Registration first.
                      </p>
                    )}
                  </div>
                ) : (
                  /* Selected Verified Patient Card */
                  <div className="rounded-lg border border-green-200 bg-green-50/60 p-4 dark:border-green-800 dark:bg-green-950/20 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-md bg-green-100 dark:bg-green-900/60 px-2 py-0.5 text-xs font-semibold text-green-800 dark:text-green-200 font-mono">
                          {selectedPatient.patient_id}
                        </span>
                        <span className="font-bold text-gray-900 dark:text-white">{selectedPatient.patient_name}</span>
                      </div>
                      {selectedPatient.mobile && (
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Phone: {selectedPatient.mobile}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPatient(null)}
                      className="text-xs text-red-600 hover:text-red-800 font-medium underline"
                    >
                      Change Patient
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleAllocate}
                    disabled={isAllocating || !selectedPatient}
                    className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 focus:outline-hidden focus:ring-3 focus:ring-brand-500/25 disabled:opacity-50"
                  >
                    {isAllocating ? "Allocating Bed & Opening Billing Line..." : "Confirm Bed Allocation"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedBed(null); setSelectedPatient(null); }}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

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
                      {["Patient", "Bed", "Room", "Ward", "Floor", "Building", "Allocated By", "Allocated At"].map((col) => (
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
                          <span className="font-semibold">{String(a.patient_name || "-")}</span>
                          {a.patient_id ? <span className="text-xs text-brand-600 dark:text-brand-400 font-mono ml-1.5">({String(a.patient_id)})</span> : null}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{String(a.bed_name || "-")}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{String(a.room_name || "-")}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{String(a.ward_name || "-")}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{String(a.floor_name || "-")}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{String(a.building_name || "-")}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{String(a.allocated_by_name || "-")}</td>
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
