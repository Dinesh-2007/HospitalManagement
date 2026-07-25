"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageLayout } from "../../../../components/page-layout";
import { getCurrentUser } from "../../../../app/actions/user";

type Row = Record<string, unknown>;

type PatientRecord = {
  patient_id: string;
  patient_name: string;
  mobile?: string;
};

type ReservationRow = {
  id: number;
  bed_id: number;
  patient_id: string;
  patient_name: string;
  bed_desc?: string;
  bed_name?: string;
  room_name?: string;
  ward_name?: string;
  floor_name?: string;
  building_name?: string;
  charge?: number;
  allocated_at: string;
  allocated_by_name?: string;
};

export default function BedReservationsPage() {
  const params = useParams();
  const hname = params?.Hname as string;

  const [currentUser, setCurrentUser] = useState<string>("");
  const [reservations, setReservations] = useState<ReservationRow[]>([]);

  // Selection state for creating reservation
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

  // Patient lookup
  const [patientSearchQuery, setPatientSearchQuery] = useState("");
  const [patientSearchResults, setPatientSearchResults] = useState<PatientRecord[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [reservedFrom, setReservedFrom] = useState<string>(new Date().toISOString().slice(0, 16));

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  // Load reservations
  const loadReservations = useCallback(async () => {
    if (!hname) return;
    try {
      const res = await fetch(`/api/${hname}/infrastructure?action=reservations`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setReservations(data.rows ?? []);
      }
    } catch { /* ignore */ }
  }, [hname]);

  useEffect(() => { void loadReservations(); }, [loadReservations]);

  // Patient search handler
  useEffect(() => {
    if (!patientSearchQuery.trim() || selectedPatient) {
      setPatientSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/${hname}/patient-search?q=${encodeURIComponent(patientSearchQuery.trim())}`)
        .then((r) => r.json())
        .then((data) => setPatientSearchResults(data.rows ?? []))
        .catch(() => setPatientSearchResults([]));
    }, 300);

    return () => clearTimeout(timer);
  }, [patientSearchQuery, selectedPatient, hname]);

  // Hierarchy drill down
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
        (window as unknown as Record<string, unknown>).__infraDataRes = data;
      })
      .catch(() => {});
  }, [hname, selectedBuilding]);

  useEffect(() => {
    const data = (window as unknown as Record<string, unknown>).__infraDataRes as { wardInstances?: Row[]; rooms?: Row[]; beds?: Row[] } | undefined;
    if (!data || !selectedDepartment) { setWards([]); setRooms([]); setBeds([]); return; }

    const filtered = (data.wardInstances ?? []).filter(
      (w) => String(w.department_name) === selectedDepartment
    );
    const wardMap = new Map<string, Row>();
    filtered.forEach((w) => {
      const type = String(w.ward_type ?? "");
      if (type && !wardMap.has(type)) wardMap.set(type, w);
    });
    setWards(Array.from(wardMap.values()));
  }, [selectedDepartment]);

  useEffect(() => {
    const data = (window as unknown as Record<string, unknown>).__infraDataRes as { rooms?: Row[]; beds?: Row[] } | undefined;
    if (!data || !selectedWard) { setRooms([]); setBeds([]); return; }

    const filtered = (data.rooms ?? []).filter(
      (r) => String(r.ward_name) === selectedWard
    );
    setRooms(filtered);
  }, [selectedWard]);

  useEffect(() => {
    const data = (window as unknown as Record<string, unknown>).__infraDataRes as { beds?: Row[] } | undefined;
    if (!data || !selectedRoom) { setBeds([]); return; }

    const filtered = (data.beds ?? []).filter(
      (b) => String(b.room_id) === selectedRoom && String(b.status || "Available") === "Available"
    );
    setBeds(filtered);
  }, [selectedRoom]);

  const handleCreateReservation = async () => {
    if (!selectedBed || !selectedPatient) {
      setError("Please select an available bed and a verified patient.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/${hname}/infrastructure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reserve",
          bedId: Number(selectedBed.id),
          patientId: selectedPatient.patient_id,
          patientName: selectedPatient.patient_name,
          reservedFrom,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reservation failed.");

      setMessage(`Bed successfully reserved for ${selectedPatient.patient_name} (${selectedPatient.patient_id}).`);
      setSelectedBed(null);
      setSelectedPatient(null);
      setPatientSearchQuery("");
      void loadReservations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reservation failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConvert = async (resItem: ReservationRow) => {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/${hname}/infrastructure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "convertReservation",
          bedId: resItem.bed_id,
          patientId: resItem.patient_id,
          patientName: resItem.patient_name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Conversion failed.");

      setMessage(`Reservation converted to Active Admission for ${resItem.patient_name}. Bed is now Occupied and daily billing has started.`);
      void loadReservations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed.");
    }
  };

  const handleRelease = async (resItem: ReservationRow) => {
    if (!confirm(`Are you sure you want to release the reservation for ${resItem.patient_name}?`)) return;
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/${hname}/infrastructure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "releaseReservation",
          bedId: resItem.bed_id,
          patientId: resItem.patient_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Release failed.");

      setMessage(`Reservation released. Bed is now Available.`);
      void loadReservations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Release failed.");
    }
  };

  return (
    <PageLayout title="Bed Reservations & Advance Booking">
      <div className="space-y-6">
        {/* Create Reservation Section */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-4">
            <div>
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
                Create Advance Bed Reservation
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Block an available bed for planned admissions or surgical procedures.
              </p>
            </div>
            {currentUser && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-medium self-start sm:self-auto">
                Staff: {currentUser}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-1">Building</label>
              <select
                value={selectedBuilding}
                onChange={(e) => setSelectedBuilding(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 text-gray-800 dark:text-white"
              >
                <option value="">Select Building</option>
                {buildings.map((b) => <option key={String(b.id)} value={String(b.id)}>{String(b.building_name)}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-1">Department</label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                disabled={departments.length === 0}
                className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 text-gray-800 dark:text-white disabled:opacity-50"
              >
                <option value="">Select Dept</option>
                {departments.map((d) => <option key={String(d.department_name)} value={String(d.department_name)}>{String(d.department_name)}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-1">Ward</label>
              <select
                value={selectedWard}
                onChange={(e) => setSelectedWard(e.target.value)}
                disabled={wards.length === 0}
                className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 text-gray-800 dark:text-white disabled:opacity-50"
              >
                <option value="">Select Ward</option>
                {wards.map((w) => <option key={String(w.ward_type)} value={String(w.ward_type)}>{String(w.ward_type)}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-1">Room</label>
              <select
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                disabled={rooms.length === 0}
                className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 text-gray-800 dark:text-white disabled:opacity-50"
              >
                <option value="">Select Room</option>
                {rooms.map((r) => <option key={String(r.id)} value={String(r.id)}>{String(r.description || r.code)}</option>)}
              </select>
            </div>
          </div>

          {/* Beds list */}
          {beds.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-2">
                Available Beds ({beds.length})
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {beds.map((bed) => (
                  <button
                    key={String(bed.id)}
                    type="button"
                    onClick={() => setSelectedBed(bed)}
                    className={`p-3 rounded-lg border text-left text-sm transition ${
                      selectedBed?.id === bed.id
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                        : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
                    }`}
                  >
                    <div className="font-semibold text-gray-800 dark:text-white">{String(bed.description || bed.bed_number)}</div>
                    <div className="text-xs text-gray-500">₹{String(bed.charge || 0)}/day</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Form */}
          {selectedBed && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-950/20 space-y-4">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-white">
                Reserving Bed: {String(selectedBed.description || selectedBed.bed_number)} ({String(selectedBed.ward_name)})
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Search Registered Patient *
                  </label>
                  {!selectedPatient ? (
                    <div className="relative">
                      <input
                        type="text"
                        value={patientSearchQuery}
                        onChange={(e) => setPatientSearchQuery(e.target.value)}
                        placeholder="Search PID, Name or Phone..."
                        className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      />
                      {patientSearchResults.length > 0 && (
                        <div className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                          {patientSearchResults.map((p) => (
                            <button
                              key={p.patient_id}
                              type="button"
                              onClick={() => { setSelectedPatient(p); setPatientSearchQuery(""); setPatientSearchResults([]); }}
                              className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-blue-50 dark:hover:bg-blue-900/30 flex justify-between"
                            >
                              <span className="font-semibold">{p.patient_name}</span>
                              <span className="font-mono text-blue-600">({p.patient_id})</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-lg border border-green-300 bg-green-50 p-2.5 dark:border-green-800 dark:bg-green-950/30">
                      <span className="text-xs font-bold text-gray-800 dark:text-white">
                        {selectedPatient.patient_name} <span className="font-mono text-green-700">({selectedPatient.patient_id})</span>
                      </span>
                      <button type="button" onClick={() => setSelectedPatient(null)} className="text-xs text-red-600 underline">Change</button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Expected Arrival Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={reservedFrom}
                    onChange={(e) => setReservedFrom(e.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCreateReservation}
                  disabled={isSubmitting || !selectedPatient}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Creating Reservation..." : "Confirm Reservation"}
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedBed(null); setSelectedPatient(null); }}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {message && <p className="text-sm text-green-700 bg-green-50 p-3 rounded-lg border border-green-200">✅ {message}</p>}
          {error && <p className="text-sm text-red-700 bg-red-50 p-3 rounded-lg border border-red-200">⚠️ {error}</p>}
        </section>

        {/* Active Reservations List */}
        <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-800">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
              Active Bed Reservations ({reservations.length})
            </h3>
          </div>
          <div className="p-6">
            {reservations.length === 0 ? (
              <p className="text-sm text-gray-500">No active bed reservations.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reservations.map((r) => (
                  <div key={r.id} className="rounded-xl border border-blue-200 bg-blue-50/30 dark:border-blue-900/40 dark:bg-blue-950/10 p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded">
                          RESERVED
                        </span>
                        <h4 className="text-base font-bold text-gray-800 dark:text-white mt-1">
                          {r.patient_name}
                        </h4>
                        <p className="text-xs font-mono text-gray-500">{r.patient_id}</p>
                      </div>
                    </div>

                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <p>🛌 Bed: <strong>{r.bed_desc || r.bed_name}</strong> ({r.room_name} / {r.ward_name})</p>
                      <p>🕒 Arrival: {new Date(r.allocated_at).toLocaleString()}</p>
                      <p>👤 Reserved by: {r.allocated_by_name || "System"}</p>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-blue-100 dark:border-blue-900/30">
                      <button
                        type="button"
                        onClick={() => handleConvert(r)}
                        className="w-full rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Check-in & Admit Patient
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRelease(r)}
                        className="w-full rounded-lg border border-red-300 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        Cancel Reservation
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
