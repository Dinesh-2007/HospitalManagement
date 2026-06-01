"use client";

import React, { useMemo, useState } from "react";
import { BlankPage } from "../../../components/blank-page";

type MedicineRow = {
  id: number;
  medicineName: string;
  quantity: string;
};

const paymentStatusOptions = ["Pending", "Partially Paid", "Paid", "Cancelled"];

export default function PharmacyDispensingPage() {
  const [patientName, setPatientName] = useState("");
  const [prescribedQty, setPrescribedQty] = useState("0");
  const [receivedQty, setReceivedQty] = useState("0");
  const [billingAmount, setBillingAmount] = useState("");
  const [paymentStatus, setPaymentStatus] = useState(paymentStatusOptions[0]);
  const [medicineRows, setMedicineRows] = useState<MedicineRow[]>([
    { id: 1, medicineName: "", quantity: "0" },
  ]);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const calculatedQty = useMemo(() => {
    return medicineRows.reduce((total, row) => {
      const quantityValue = Number(row.quantity);
      return total + (Number.isFinite(quantityValue) ? quantityValue : 0);
    }, 0);
  }, [medicineRows]);

  const updateMedicineRow = (rowId: number, field: keyof Omit<MedicineRow, "id">, value: string) => {
    setMedicineRows((currentRows) =>
      currentRows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
    );
  };

  const addMedicineRow = () => {
    setMedicineRows((currentRows) => [
      ...currentRows,
      { id: Date.now(), medicineName: "", quantity: "0" },
    ]);
  };

  const removeMedicineRow = (rowId: number) => {
    setMedicineRows((currentRows) =>
      currentRows.length > 1 ? currentRows.filter((row) => row.id !== rowId) : currentRows,
    );
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitMessage("Dispensing form prepared successfully.");
  };

  return (
    <BlankPage title="Pharmacy - Pharmacy Dispensing">
      <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-slate-200 px-6 py-5 dark:border-gray-800">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white/90">Pharmacy Dispensing</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
              Capture prescription details, quantities, and billing status.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8 px-6 py-6">
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">Patient Name</label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={patientName}
                    readOnly
                    placeholder="Auto Fill"
                    className="h-11 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 shadow-theme-xs focus:border-brand-300 focus:outline-hidden dark:border-gray-700 dark:bg-gray-950 dark:text-white/90"
                  />
                  <button
                    type="button"
                    onClick={() => setPatientName("Auto Filled Patient")}
                    className="shrink-0 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    Auto Fill
                  </button>
                </div>
              </div>

              <div className="xl:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">Calculated Qty</label>
                <input
                  type="text"
                  value={calculatedQty}
                  readOnly
                  className="h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 shadow-theme-xs focus:border-brand-300 focus:outline-hidden dark:border-gray-700 dark:bg-gray-950 dark:text-white/90"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">Prescribed Qty</label>
                <input
                  type="number"
                  min="0"
                  value={prescribedQty}
                  onChange={(event) => setPrescribedQty(event.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-transparent px-4 py-2.5 text-sm text-slate-700 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">Received Qty</label>
                <input
                  type="number"
                  min="0"
                  value={receivedQty}
                  onChange={(event) => setReceivedQty(event.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-transparent px-4 py-2.5 text-sm text-slate-700 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">Billing Amount</label>
                <div className="flex items-center rounded-lg border border-slate-300 bg-transparent shadow-theme-xs focus-within:border-brand-300 focus-within:ring-3 focus-within:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900">
                  <span className="px-4 text-sm text-slate-500 dark:text-gray-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={billingAmount}
                    onChange={(event) => setBillingAmount(event.target.value)}
                    className="h-11 w-full rounded-r-lg border-0 bg-transparent px-0 py-2.5 text-sm text-slate-700 focus:outline-hidden dark:text-white/90"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">Payment Status</label>
                <select
                  value={paymentStatus}
                  onChange={(event) => setPaymentStatus(event.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-transparent px-4 py-2.5 text-sm text-slate-700 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                >
                  {paymentStatusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-gray-800 dark:bg-gray-950/40">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white/90">Medicine List</h3>
                  <p className="text-sm text-slate-500 dark:text-gray-400">Add the dispensed medicines and their quantities.</p>
                </div>
                <button
                  type="button"
                  onClick={addMedicineRow}
                  className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 focus:outline-hidden focus:ring-3 focus:ring-brand-500/25"
                >
                  Add Row
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-gray-800">
                  <thead className="bg-slate-100 dark:bg-gray-950">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">Medicine Name</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">Qty</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-gray-800">
                    {medicineRows.map((row, index) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={row.medicineName}
                            onChange={(event) => updateMedicineRow(row.id, "medicineName", event.target.value)}
                            placeholder={`Medicine ${index + 1}`}
                            className="h-10 w-full rounded-lg border border-slate-300 bg-transparent px-3 text-sm text-slate-700 focus:border-brand-300 focus:outline-hidden dark:border-gray-700 dark:text-white/90"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            value={row.quantity}
                            onChange={(event) => updateMedicineRow(row.id, "quantity", event.target.value)}
                            className="h-10 w-full rounded-lg border border-slate-300 bg-transparent px-3 text-sm text-slate-700 focus:border-brand-300 focus:outline-hidden dark:border-gray-700 dark:text-white/90"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => removeMedicineRow(row.id)}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                            disabled={medicineRows.length === 1}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-4 dark:border-gray-800">
              <p className="text-sm text-slate-500 dark:text-gray-400">
                Prescribed Qty: {prescribedQty || "0"} | Received Qty: {receivedQty || "0"}
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPatientName("");
                    setPrescribedQty("0");
                    setReceivedQty("0");
                    setBillingAmount("");
                    setPaymentStatus(paymentStatusOptions[0]);
                    setMedicineRows([{ id: 1, medicineName: "", quantity: "0" }]);
                    setSubmitMessage(null);
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 focus:outline-hidden focus:ring-3 focus:ring-brand-500/25"
                >
                  Save Dispensing
                </button>
              </div>
            </div>

            {submitMessage ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200">
                {submitMessage}
              </div>
            ) : null}
          </form>
        </div>
      </div>
    </BlankPage>
  );
}
