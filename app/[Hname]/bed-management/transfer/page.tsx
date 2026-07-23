"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageLayout } from "../../../../components/page-layout";
import { bedStatusColor } from "../../../../lib/infrastructure";

type Row = Record<string, unknown>;

export default function BedTransferPage() {
  const params = useParams();
  const hname = params?.Hname as string;

  // Current allocations (occupied beds)
  const [allocations, setAllocations] = useState<Row[]>([]);
  const [selectedAllocation, setSelectedAllocation] = useState<Row | null>(null);

  // New bed selection (drill-down)
  const [buildings, setBuildings] = useState<Row[]>([]);
  const [floors, setFloors] = useState<Row[]>([]);
  const [rooms, setRooms] = useState<Row[]>([]);
  const [availableBeds, setAvailableBeds] = useState<Row[]>([]);

  const [selectedBuilding, setSelectedBuilding] = useState("");
  const [selectedFloor, setSelectedFloor] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("");
  const [selectedNewBed, setSelectedNewBed] = useState<Row | null>(null);

  const [transferReason, setTransferReason] = useState("");
  const [transferredByName, setTransferredByName] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Transfer history
  const [history, setHistory] = useState<Row[]>([]);

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

  const loadHistory = useCallback(async () => {
    if (!hname) return;
    try {
      const res = await fetch(`/api/${hname}/infrastructure?action=transfers`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.rows ?? []);
      }
    } catch { /* ignore */ }
  }, [hname]);

  useEffect(() => { void loadAllocations(); void loadHistory(); }, [loadAllocations, loadHistory]);

  // Load buildings
  useEffect(() => {
    if (!hname) return;
    fetch(`/api/${hname}/forms/building_master`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setBuildings(d.rows ?? []))
      .catch(() => {});
  }, [hname]);

  // Load hierarchy for new bed selection
  useEffect(() => {
    if (!hname || !selectedBuilding) { setFloors([]); setRooms([]); setAvailableBeds([]); return; }
    fetch(`/api/${hname}/infrastructure?action=hierarchy&buildingId=${selectedBuilding}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setFloors(data.floors ?? []);
        (window as unknown as Record<string, unknown>).__transferData = data;
      })
      .catch(() => {});
  }, [hname, selectedBuilding]);

  useEffect(() => {
    const data = (window as unknown as Record<string, unknown>).__transferData as { rooms?: Row[]; beds?: Row[] } | undefined;
    if (!data || !selectedFloor) { setRooms([]); setAvailableBeds([]); return; }
    const floorName = floors.find((f) => String(f.id) === selectedFloor)?.floor_name;
    const filtered = (data.rooms ?? []).filter((r) => String(r.floor_name) === String(floorName));
    setRooms(filtered);
    setSelectedRoom("");
    setSelectedNewBed(null);
    setAvailableBeds([]);
  }, [selectedFloor, floors]);

  useEffect(() => {
    const data = (window as unknown as Record<string, unknown>).__transferData as { beds?: Row[] } | undefined;
    if (!data || !selectedRoom) { setAvailableBeds([]); return; }
    const filtered = (data.beds ?? []).filter(
      (b) => String(b.room_id) === selectedRoom && String(b.status || "Available") === "Available"
    );
    setAvailableBeds(filtered);
    setSelectedNewBed(null);
  }, [selectedRoom]);

  const handleTransfer = async () => {
    if (!selectedAllocation || !selectedNewBed) {
      setError("Please select both a patient and a new bed.");
      return;
    }

    setIsTransferring(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/${hname}/infrastructure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transfer",
          patientId: selectedAllocation.patient_id,
          patientName: selectedAllocation.patient_name,
          oldBedId: Number(selectedAllocation.bed_id),
          newBedId: Number(selectedNewBed.id),
          transferredByName: transferredByName || null,
          transferredByRole: "Admin",
          reason: transferReason || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transfer failed.");
      setMessage(`Patient ${String(selectedAllocation.patient_name)} successfully transferred.`);
      setSelectedAllocation(null);
      setSelectedNewBed(null);
      setTransferReason("");
      void loadAllocations();
      void loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed.");
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <PageLayout title="Bed Transfer">
      <div className="space-y-6">
        {/* Step 1: Select patient */}
        <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800">
            <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
              Step 1: Select Patient to Transfer
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Choose a currently admitted patient from the active allocations.
            </p>
          </div>
          <div className="p-4 sm:p-6">
            {allocations.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No active bed allocations to transfer.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {allocations.map((a) => {
                  const isSelected = selectedAllocation && String(selectedAllocation.id) === String(a.id);
                  return (
                    <button
                      key={String(a.id)}
                      type="button"
                      onClick={() => setSelectedAllocation(isSelected ? null : a)}
                      className={`rounded-xl border p-4 text-left transition hover:shadow-md ${
                        isSelected
                          ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10 dark:border-brand-500"
                          : "border-gray-200 dark:border-gray-700 hover:border-brand-300"
                      }`}
                    >
                      <div className="font-medium text-sm text-gray-800 dark:text-white/90">
                        {String(a.patient_name || "-")}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        ID: {String(a.patient_id || "-")}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Bed: {String(a.bed_name || "-")} • Room: {String(a.room_name || "-")}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {String(a.ward_name || "-")} • {String(a.floor_name || "-")} • {String(a.building_name || "-")}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Step 2: Select new bed */}
        {selectedAllocation && (
          <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800">
              <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
                Step 2: Select New Bed for {String(selectedAllocation.patient_name)}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Building</label>
                  <select
                    value={selectedBuilding}
                    onChange={(e) => { setSelectedBuilding(e.target.value); setSelectedFloor(""); setSelectedRoom(""); setSelectedNewBed(null); }}
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
                    onChange={(e) => { setSelectedFloor(e.target.value); setSelectedRoom(""); setSelectedNewBed(null); }}
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
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Room</label>
                  <select
                    value={selectedRoom}
                    onChange={(e) => { setSelectedRoom(e.target.value); setSelectedNewBed(null); }}
                    disabled={rooms.length === 0}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 disabled:opacity-50"
                  >
                    <option value="">Select Room</option>
                    {rooms.map((r) => (
                      <option key={String(r.id)} value={String(r.id)}>{String(r.description || r.code)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {availableBeds.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {availableBeds.map((bed) => (
                    <button
                      key={String(bed.id)}
                      type="button"
                      onClick={() => setSelectedNewBed(bed)}
                      className={`rounded-lg border p-3 text-left text-sm transition ${
                        selectedNewBed && Number(selectedNewBed.id) === Number(bed.id)
                          ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                          : "border-gray-200 dark:border-gray-700 hover:border-brand-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: bedStatusColor("Available") }} />
                        <span className="font-medium text-gray-800 dark:text-white/90 truncate">
                          {String(bed.description || bed.bed_number || bed.code)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedNewBed && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Transfer Reason</label>
                      <textarea
                        value={transferReason}
                        onChange={(e) => setTransferReason(e.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Transferred By</label>
                      <input
                        type="text"
                        value={transferredByName}
                        onChange={(e) => setTransferredByName(e.target.value)}
                        placeholder="Staff name"
                        className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleTransfer}
                    disabled={isTransferring}
                    className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 focus:outline-hidden focus:ring-3 focus:ring-brand-500/25 disabled:opacity-50"
                  >
                    {isTransferring ? "Transferring..." : "Confirm Transfer"}
                  </button>
                </div>
              )}
            </div>

            {message && <p className="px-6 pb-4 text-sm text-green-600 dark:text-green-400">{message}</p>}
            {error && <p className="px-6 pb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
          </section>
        )}

        {/* Transfer History */}
        <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800">
            <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
              Transfer History ({history.length})
            </h3>
          </div>
          <div className="p-4 sm:p-6">
            {history.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No transfer history.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
                  <thead>
                    <tr>
                      {["Patient", "From", "To", "Transferred By", "Reason", "Date"].map((col) => (
                        <th key={col} className="px-4 py-3 text-left font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {history.map((h, i) => (
                      <tr key={String(h.id ?? i)}>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {String(h.patient_name || "-")}
                          <span className="text-xs text-gray-400 ml-1">({String(h.patient_id || "")})</span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {String(h.old_bed_name || "-")} / {String(h.old_room_name || "-")}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {String(h.new_bed_name || "-")} / {String(h.new_room_name || "-")}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{String(h.transferred_by_name || "-")}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{String(h.reason || "-")}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {h.transferred_at ? new Date(String(h.transferred_at)).toLocaleString() : "-"}
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
