"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageLayout } from "../../../../components/page-layout";
import { getCurrentUser } from "../../../../app/actions/user";

type AllocationRow = {
  id: number;
  patient_id: string;
  patient_name: string;
  bed_id: number;
  bed_name: string;
  room_name: string;
  ward_name: string;
  floor_name: string;
  building_name: string;
  allocated_at: string;
  allocated_by_name?: string;
};

type BillingLine = {
  id: number;
  bed_name: string;
  rate_per_day: number;
  start_at: string;
  end_at?: string;
  days_count?: number;
  total_amount?: number;
  status: string;
};

export default function ClinicalDischargePage() {
  const params = useParams();
  const hname = params?.Hname as string;

  const [currentUser, setCurrentUser] = useState<string>("");
  const [admissions, setAdmissions] = useState<AllocationRow[]>([]);
  const [selectedAdmission, setSelectedAdmission] = useState<AllocationRow | null>(null);

  // Billing breakdown for selected patient
  const [billingLines, setBillingLines] = useState<BillingLine[]>([]);
  const [isLoadingBilling, setIsLoadingBilling] = useState(false);

  // Discharge form state
  const [dischargeReason, setDischargeReason] = useState<string>("Normal Discharge");
  const [dischargeNotes, setDischargeNotes] = useState<string>("");
  const [isDischarging, setIsDischarging] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load session user
  useEffect(() => {
    if (!hname) return;
    getCurrentUser(hname).then((user) => {
      if (user) setCurrentUser(user);
    }).catch(() => {});
  }, [hname]);

  const loadAdmissions = useCallback(async () => {
    if (!hname) return;
    try {
      const res = await fetch(`/api/${hname}/infrastructure?action=allocations`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setAdmissions(data.rows ?? []);
      }
    } catch { /* ignore */ }
  }, [hname]);

  useEffect(() => { void loadAdmissions(); }, [loadAdmissions]);

  // Load billing breakdown when an admission is selected
  useEffect(() => {
    if (!hname || !selectedAdmission) { setBillingLines([]); return; }
    setIsLoadingBilling(true);
    fetch(`/api/${hname}/infrastructure?action=billingLines&patientId=${encodeURIComponent(selectedAdmission.patient_id)}`)
      .then((r) => r.json())
      .then((d) => setBillingLines(d.rows ?? []))
      .catch(() => setBillingLines([]))
      .finally(() => setIsLoadingBilling(false));
  }, [hname, selectedAdmission]);

  const handleDischarge = async () => {
    if (!selectedAdmission) return;
    if (!dischargeReason.trim()) {
      setError("Please specify a discharge reason.");
      return;
    }

    setIsDischarging(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/${hname}/infrastructure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "discharge",
          patientId: selectedAdmission.patient_id,
          dischargeReason,
          dischargeNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Discharge failed.");

      setMessage(
        `Patient ${selectedAdmission.patient_name} discharged successfully! Billing Invoice generated: ${data.invoiceNumber} (Total: ₹${data.grandTotal}). Bed moved to Housekeeping Cleaning status.`
      );
      setSelectedAdmission(null);
      void loadAdmissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discharge failed.");
    } finally {
      setIsDischarging(false);
    }
  };

  // Estimate stay duration in days
  const calculateDays = (allocatedAt: string) => {
    const start = new Date(allocatedAt).getTime();
    const now = new Date().getTime();
    const days = Math.max(1, Math.ceil((now - start) / (1000 * 60 * 60 * 24)));
    return days;
  };

  return (
    <PageLayout title="Clinical Discharge & Billing Closure">
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-4">
            <div>
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
                Inpatient Discharge Desk
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Perform clinical discharge, automatically calculate accrued stay billing, and queue the bed for housekeeping sanitization.
              </p>
            </div>
            {currentUser && (
              <span className="text-xs px-3 py-1.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-medium self-start sm:self-auto">
                Discharge Officer: {currentUser}
              </span>
            )}
          </div>
        </div>

        {message && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
            <p className="text-sm font-semibold text-green-800 dark:text-green-300">✅ {message}</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">⚠️ {error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Admitted Patients List */}
          <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
                Currently Admitted Inpatients ({admissions.length})
              </h3>
              <span className="text-xs text-gray-500">Select patient to initiate discharge</span>
            </div>

            <div className="p-4">
              {admissions.length === 0 ? (
                <p className="text-sm text-gray-500 p-4">No admitted patients currently in beds.</p>
              ) : (
                <div className="space-y-2">
                  {admissions.map((adm) => {
                    const isSelected = selectedAdmission?.id === adm.id;
                    const days = calculateDays(adm.allocated_at);

                    return (
                      <button
                        key={adm.id}
                        type="button"
                        onClick={() => setSelectedAdmission(adm)}
                        className={`w-full rounded-xl border p-4 text-left transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                          isSelected
                            ? "border-brand-500 bg-brand-50/70 dark:border-brand-500 dark:bg-brand-500/10 shadow-sm"
                            : "border-gray-200 hover:border-brand-300 dark:border-gray-800 dark:hover:border-gray-700"
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 dark:text-white">{adm.patient_name}</span>
                            <span className="text-xs font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                              {adm.patient_id}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            🛌 Bed: <strong>{adm.bed_name}</strong> ({adm.room_name} / {adm.ward_name} / Floor {adm.floor_name})
                          </p>
                        </div>

                        <div className="text-left sm:text-right shrink-0">
                          <span className="text-xs font-medium text-brand-600 dark:text-brand-400 bg-brand-100/60 dark:bg-brand-900/40 px-2.5 py-1 rounded-full">
                            Length of Stay: ~{days} {days === 1 ? "day" : "days"}
                          </span>
                          <p className="text-xs text-gray-400 mt-1">
                            Admitted: {new Date(adm.allocated_at).toLocaleDateString()}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Discharge Action & Summary Panel */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] space-y-6">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90 border-b border-gray-100 dark:border-gray-800 pb-3">
              Discharge Summary & Authorization
            </h3>

            {!selectedAdmission ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
                👈 Select an admitted patient from the left column to preview billing charges and complete discharge.
              </p>
            ) : (
              <div className="space-y-4">
                {/* Patient Summary Box */}
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
                  <p className="text-xs text-gray-500 font-medium">Selected Patient</p>
                  <h4 className="text-base font-bold text-gray-900 dark:text-white mt-0.5">
                    {selectedAdmission.patient_name}
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-mono">
                    ID: {selectedAdmission.patient_id}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Bed: {selectedAdmission.bed_name} ({selectedAdmission.ward_name})
                  </p>
                </div>

                {/* Accrued Bed Stay Billing Lines */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                    Accrued Bed Charges Ledger
                  </h4>
                  {isLoadingBilling ? (
                    <p className="text-xs text-gray-400">Calculating ledger...</p>
                  ) : billingLines.length === 0 ? (
                    <p className="text-xs text-gray-400">No open billing lines.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {billingLines.map((line) => (
                        <div key={line.id} className="flex items-center justify-between text-xs p-2 rounded bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                          <div>
                            <span className="font-medium text-gray-800 dark:text-gray-200">{line.bed_name}</span>
                            <span className="text-gray-400 ml-1">(@ ₹{line.rate_per_day}/day)</span>
                          </div>
                          <span className={`font-mono font-semibold ${line.status === "Open" ? "text-amber-600" : "text-gray-600"}`}>
                            {line.status === "Open" ? "Active (Accruing)" : `₹${line.total_amount}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Discharge Inputs */}
                <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Discharge Reason *
                    </label>
                    <select
                      value={dischargeReason}
                      onChange={(e) => setDischargeReason(e.target.value)}
                      className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    >
                      <option value="Normal Discharge">Normal Discharge (Recovered)</option>
                      <option value="Transferred to External Hospital">Transferred to External Hospital</option>
                      <option value="Discharge Against Medical Advice (DAMA)">Discharge Against Medical Advice (DAMA)</option>
                      <option value="LAMA (Left Against Medical Advice)">LAMA</option>
                      <option value="Deceased">Deceased</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Clinical Notes / Remarks
                    </label>
                    <textarea
                      rows={2}
                      value={dischargeNotes}
                      onChange={(e) => setDischargeNotes(e.target.value)}
                      placeholder="Optional discharge summary or instructions..."
                      className="w-full rounded-lg border border-gray-300 bg-transparent p-2.5 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDischarge}
                  disabled={isDischarging}
                  className="w-full rounded-lg bg-red-600 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 shadow-sm"
                >
                  {isDischarging ? "Closing Billing & Discharging..." : "Confirm Patient Discharge"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
