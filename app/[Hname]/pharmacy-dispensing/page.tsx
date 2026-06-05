"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { BlankPage } from "../../../components/blank-page";

type ConsultationRecord = {
  id: number;
  token_number?: string | null;
  patient_details?: string | null;
  prescription_lines?: string | null;
  prescription_data?: string | null;
};

type DispensingBillRecord = {
  id: number;
  token_number?: string | null;
  patient_name?: string | null;
  payment_status?: string | null;
  billing_amount?: string | number | null;
  medicine_lines?: string | null;
  created_at?: string | null;
};

type PricingRecord = {
  product_name?: string | null;
  selling_price?: string | number | null;
};

type MedicineRow = {
  id: number;
  medicineName: string;
  prescribedQty: string;
  receivedQty: string;
  medicineAmount: string;
};

type DispensingField = {
  id: string;
  type: "text" | "number" | "select" | "textarea";
};

type SerializedPrescriptionLine = {
  medicineName?: string;
  genericName?: string;
  totalQty?: string;
  prescribedQty?: string;
};

const paymentStatusOptions = ["Pending", "Partially Paid", "Paid", "Cancelled"];

const DISPENSING_FIELDS: DispensingField[] = [
  { id: "tokenNumber", type: "text" },
  { id: "patientName", type: "text" },
  { id: "paymentStatus", type: "select" },
  { id: "billingAmount", type: "number" },
  { id: "medicineLines", type: "textarea" },
];

function parsePrescriptionLines(value?: string | null): Omit<MedicineRow, "id">[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as SerializedPrescriptionLine[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((line) => ({
      medicineName: line.medicineName || line.genericName || "",
      prescribedQty: line.totalQty || line.prescribedQty || "",
      receivedQty: "",
      medicineAmount: "",
    }));
  } catch {
    return [];
  }
}

function normalizeMedicineName(value: string): string {
  return value.trim().toLowerCase();
}

function formatMoney(value: number): string {
  return value.toFixed(2);
}

export default function PharmacyDispensingPage() {
  const params = useParams();
  const hname = params?.Hname as string;

  const [activeView, setActiveView] = useState<"records" | "form" | "bills">("records");
  const [consultationRecords, setConsultationRecords] = useState<ConsultationRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [dispensingBills, setDispensingBills] = useState<DispensingBillRecord[]>([]);
  const [isLoadingBills, setIsLoadingBills] = useState(true);
  const [pricingMap, setPricingMap] = useState<Record<string, number>>({});
  const [selectedConsultationId, setSelectedConsultationId] = useState<number | null>(null);
  const [tokenNumber, setTokenNumber] = useState("");
  const [patientName, setPatientName] = useState("");
  const [paymentStatus, setPaymentStatus] = useState(paymentStatusOptions[0]);
  const nextRowId = useRef(2);
  const createMedicineRow = (overrides?: Partial<Omit<MedicineRow, "id">>): MedicineRow => ({
    id: nextRowId.current++,
    medicineName: "",
    prescribedQty: "",
    receivedQty: "",
    medicineAmount: "",
    ...overrides,
  });
  const [medicineRows, setMedicineRows] = useState<MedicineRow[]>([
    {
      id: 1,
      medicineName: "",
      prescribedQty: "",
      receivedQty: "",
      medicineAmount: "",
    },
  ]);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPricing() {
      try {
        const response = await fetch(`/api/${hname}/forms/pricing`, {
          method: "GET",
          cache: "no-store",
        });
        const data = (await response.json()) as {
          rows?: PricingRecord[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load pricing.");
        }

        const nextPricingMap = (data.rows ?? []).reduce<Record<string, number>>((accumulator, row) => {
          const name = normalizeMedicineName(String(row.product_name ?? ""));
          const sellingPrice = Number(row.selling_price);

          if (name && Number.isFinite(sellingPrice)) {
            accumulator[name] = sellingPrice;
          }

          return accumulator;
        }, {});

        if (isMounted) {
          setPricingMap(nextPricingMap);
        }
      } catch {
        if (isMounted) {
          setPricingMap({});
        }
      }
    }

    if (hname) {
      void loadPricing();
    }

    return () => {
      isMounted = false;
    };
  }, [hname]);

  useEffect(() => {
    let isMounted = true;

    async function loadConsultationRecords() {
      setIsLoadingRecords(true);
      setSubmitError(null);

      try {
        const response = await fetch(`/api/${hname}/forms/doctor_consultation_entry`, {
          method: "GET",
          cache: "no-store",
        });
        const data = (await response.json()) as {
          rows?: ConsultationRecord[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load doctor consultation records.");
        }

        if (isMounted) {
          setConsultationRecords(data.rows ?? []);
        }
      } catch (error) {
        if (isMounted) {
          setSubmitError(
            error instanceof Error
              ? error.message
              : "Failed to load doctor consultation records.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingRecords(false);
        }
      }
    }

    if (hname) {
      void loadConsultationRecords();
    }

    return () => {
      isMounted = false;
    };
  }, [hname]);

  useEffect(() => {
    let isMounted = true;

    async function loadDispensingBills() {
      setIsLoadingBills(true);

      try {
        const response = await fetch(`/api/${hname}/forms/pharmacy_dispensing`, {
          method: "GET",
          cache: "no-store",
        });
        const data = (await response.json()) as {
          rows?: DispensingBillRecord[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load dispensing bills.");
        }

        if (isMounted) {
          setDispensingBills(data.rows ?? []);
        }
      } catch (error) {
        if (isMounted) {
          setSubmitError(
            error instanceof Error ? error.message : "Failed to load dispensing bills.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingBills(false);
        }
      }
    }

    if (hname) {
      void loadDispensingBills();
    }

    return () => {
      isMounted = false;
    };
  }, [hname]);

  const billingAmount = useMemo(() => {
    const total = medicineRows.reduce((sum, row) => {
      const amount = Number(row.medicineAmount);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);

    return total.toFixed(2);
  }, [medicineRows]);

  const medicineQtyTotals = useMemo(() => {
    return medicineRows.reduce(
      (totals, row) => {
        const prescribedValue = Number(row.prescribedQty);
        const receivedValue = Number(row.receivedQty);

        return {
          prescribed:
            totals.prescribed + (Number.isFinite(prescribedValue) ? prescribedValue : 0),
          received: totals.received + (Number.isFinite(receivedValue) ? receivedValue : 0),
        };
      },
      { prescribed: 0, received: 0 },
    );
  }, [medicineRows]);

  useEffect(() => {
    Promise.resolve().then(() => {
      setMedicineRows((currentRows) =>
        currentRows.map((row) => {
          const sellingPrice = pricingMap[normalizeMedicineName(row.medicineName)] ?? 0;
          const receivedQty = Number(row.receivedQty);

          return {
            ...row,
            medicineAmount:
              Number.isFinite(receivedQty) && receivedQty > 0 && sellingPrice > 0
                ? formatMoney(sellingPrice * receivedQty)
                : "",
          };
        }),
      );
    });
  }, [pricingMap]);

  const updateMedicineRow = (
    rowId: number,
    field: keyof Omit<MedicineRow, "id">,
    value: string,
  ) => {
    setMedicineRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        const nextRow = { ...row, [field]: value };
        const sellingPrice = pricingMap[normalizeMedicineName(nextRow.medicineName)] ?? 0;
        const receivedQty = Number(nextRow.receivedQty);

        return {
          ...nextRow,
          medicineAmount:
            Number.isFinite(receivedQty) && receivedQty > 0 && sellingPrice > 0
              ? formatMoney(sellingPrice * receivedQty)
              : "",
        };
      }),
    );
  };

  const addMedicineRow = () => {
    setMedicineRows((currentRows) => [
      ...currentRows,
      createMedicineRow(),
    ]);
  };

  const removeMedicineRow = (rowId: number) => {
    setMedicineRows((currentRows) =>
      currentRows.length > 1 ? currentRows.filter((row) => row.id !== rowId) : currentRows,
    );
  };

  const resetForm = () => {
    nextRowId.current = 2;
    setSelectedConsultationId(null);
    setTokenNumber("");
    setPatientName("");
    setPaymentStatus(paymentStatusOptions[0]);
    setMedicineRows([
      {
        id: 1,
        medicineName: "",
        prescribedQty: "",
        receivedQty: "",
        medicineAmount: "",
      },
    ]);
    setSubmitMessage(null);
    setSubmitError(null);
  };

  const openDispensingForm = (record: ConsultationRecord) => {
    const nextRows = parsePrescriptionLines(
      record.prescription_data ?? record.prescription_lines,
    );
    nextRowId.current = 1;
    const hydratedRows = nextRows.map((row) => createMedicineRow(row));

    setSelectedConsultationId(record.id);
    setTokenNumber(record.token_number ?? "");
    setPatientName(record.patient_details ?? "");
    setPaymentStatus(paymentStatusOptions[0]);
    setMedicineRows(hydratedRows.length > 0 ? hydratedRows : [createMedicineRow()]);
    setSubmitMessage(null);
    setSubmitError(null);
    setActiveView("form");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitMessage(null);
    setSubmitError(null);

    try {
      const response = await fetch(`/api/${hname}/forms/pharmacy_dispensing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cardTitle: "Pharmacy Dispensing",
          fields: DISPENSING_FIELDS,
          values: {
            tokenNumber,
            patientName,
            paymentStatus,
            billingAmount,
            medicineLines: JSON.stringify(medicineRows),
          },
        }),
      });
      const data = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save dispensing record.");
      }

      const billsResponse = await fetch(`/api/${hname}/forms/pharmacy_dispensing`, {
        method: "GET",
        cache: "no-store",
      });
      const billsData = (await billsResponse.json()) as {
        rows?: DispensingBillRecord[];
        error?: string;
      };

      if (!billsResponse.ok) {
        throw new Error(billsData.error ?? "Failed to refresh dispensing bills.");
      }

      setDispensingBills(billsData.rows ?? []);

      resetForm();
      setSubmitMessage("Dispensing record saved successfully.");
      setActiveView("bills");
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to save dispensing record.",
      );
    }
  };

  return (
    <BlankPage title="Pharmacy - Pharmacy Dispensing">
      <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 dark:border-gray-800 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white/90">
                Pharmacy Dispensing
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
                Pick a consultation record, then enter received quantity and medicine amount.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveView("bills")}
                className={`inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition focus:outline-hidden focus:ring-3 ${
                  activeView === "bills"
                    ? "bg-brand-500 text-white hover:bg-brand-600 focus:ring-brand-500/25"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                View Bills
              </button>
              {activeView !== "form" ? (
                <button
                  type="button"
                  onClick={() => setActiveView("records")}
                  className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 focus:outline-hidden focus:ring-3 focus:ring-brand-500/25"
                >
                  Add Dispensing
                </button>
              ) : null}
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {submitMessage ? (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200">
                {submitMessage}
              </div>
            ) : null}

            {submitError ? (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
                {submitError}
              </div>
            ) : null}

            {activeView === "form" ? (
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">
                      Token Number
                    </label>
                    <input
                      type="text"
                      value={tokenNumber}
                      readOnly
                      className="h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 shadow-theme-xs dark:border-gray-700 dark:bg-gray-800/60 dark:text-white/90"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">
                      Patient Name
                    </label>
                    <input
                      type="text"
                      value={patientName}
                      readOnly
                      placeholder="Select a patient from records"
                      className="h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 shadow-theme-xs dark:border-gray-700 dark:bg-gray-800/60 dark:text-white/90"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">
                      Billing Amount
                    </label>
                    <div className="flex items-center rounded-lg border border-slate-300 bg-transparent shadow-theme-xs focus-within:border-brand-300 focus-within:ring-3 focus-within:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900">
                      <span className="px-4 text-sm text-slate-500 dark:text-gray-400">Rs.</span>
                      <input
                        type="number"
                        value={billingAmount}
                        readOnly
                        className="h-11 w-full rounded-r-lg border-0 bg-transparent px-0 py-2.5 text-sm text-slate-700 focus:outline-hidden dark:text-white/90"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">
                      Payment Status
                    </label>
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
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white/90">
                        Medicine List
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-gray-400">
                        Medicine name and prescribed quantity come from Doctor Consultation.
                      </p>
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
                          <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">
                            Medicine Name
                          </th>
                          <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">
                            Prescribed Qty
                          </th>
                          <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">
                            Received Qty
                          </th>
                          <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">
                            Medicine Amount
                          </th>
                          <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-gray-800">
                        {medicineRows.map((row, index) => (
                          <tr key={row.id}>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={row.medicineName}
                                readOnly={row.medicineName.trim().length > 0}
                                onChange={(event) =>
                                  updateMedicineRow(row.id, "medicineName", event.target.value)
                                }
                                placeholder={`Medicine ${index + 1}`}
                                className={`h-10 w-full rounded-lg border px-3 text-sm dark:border-gray-700 dark:text-white/90 ${
                                  row.medicineName.trim().length > 0
                                    ? "border-slate-300 bg-slate-50 text-slate-700 dark:bg-gray-800/60"
                                    : "border-slate-300 bg-transparent text-slate-700 focus:border-brand-300 focus:outline-hidden"
                                }`}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                value={row.prescribedQty}
                                readOnly={row.prescribedQty.trim().length > 0}
                                onChange={(event) =>
                                  updateMedicineRow(row.id, "prescribedQty", event.target.value)
                                }
                                className={`h-10 w-full rounded-lg border px-3 text-sm dark:border-gray-700 dark:text-white/90 ${
                                  row.prescribedQty.trim().length > 0
                                    ? "border-slate-300 bg-slate-50 text-slate-700 dark:bg-gray-800/60"
                                    : "border-slate-300 bg-transparent text-slate-700 focus:border-brand-300 focus:outline-hidden"
                                }`}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                value={row.receivedQty}
                                onChange={(event) =>
                                  updateMedicineRow(row.id, "receivedQty", event.target.value)
                                }
                                className="h-10 w-full rounded-lg border border-slate-300 bg-transparent px-3 text-sm text-slate-700 focus:border-brand-300 focus:outline-hidden dark:border-gray-700 dark:text-white/90"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.medicineAmount}
                                readOnly
                                className="h-10 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-white/90"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => removeMedicineRow(row.id)}
                                className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
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
                    Prescribed Qty: {medicineQtyTotals.prescribed} | Received Qty: {medicineQtyTotals.received}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      Reset
                    </button>
                    <button
                      type="submit"
                      disabled={!tokenNumber || !patientName}
                      className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 focus:outline-hidden focus:ring-3 focus:ring-brand-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Save Dispensing
                    </button>
                  </div>
                </div>
              </form>
            ) : activeView === "bills" ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
                    View Bills
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Saved dispensing bills are listed here for quick review.
                  </p>
                </div>

                {isLoadingBills ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 dark:border-gray-700 dark:bg-gray-950/40 dark:text-gray-400">
                    Loading bills...
                  </div>
                ) : dispensingBills.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 dark:border-gray-700 dark:bg-gray-950/40 dark:text-gray-400">
                    No bills saved yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-gray-800">
                      <thead className="bg-slate-100 dark:bg-gray-950">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">
                            Token Number
                          </th>
                          <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">
                            Patient Name
                          </th>
                          <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">
                            Payment Status
                          </th>
                          <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">
                            Billing Amount
                          </th>
                          <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">
                            Saved At
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-gray-800">
                        {dispensingBills.map((bill) => (
                          <tr key={bill.id}>
                            <td className="px-4 py-3 text-slate-700 dark:text-gray-300">
                              {bill.token_number || "-"}
                            </td>
                            <td className="px-4 py-3 text-slate-700 dark:text-gray-300">
                              {bill.patient_name || "-"}
                            </td>
                            <td className="px-4 py-3 text-slate-700 dark:text-gray-300">
                              {bill.payment_status || "-"}
                            </td>
                            <td className="px-4 py-3 text-slate-700 dark:text-gray-300">
                              {bill.billing_amount ?? "-"}
                            </td>
                            <td className="px-4 py-3 text-slate-700 dark:text-gray-300">
                              {bill.created_at
                                ? new Date(bill.created_at).toLocaleString("en-IN")
                                : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
                    Consultation Records
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Only patient details and token number are shown here. Click a row to open the dispensing form.
                  </p>
                </div>

                {isLoadingRecords ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 dark:border-gray-700 dark:bg-gray-950/40 dark:text-gray-400">
                    Loading consultation records...
                  </div>
                ) : consultationRecords.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 dark:border-gray-700 dark:bg-gray-950/40 dark:text-gray-400">
                    No doctor consultation records saved yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-gray-800">
                      <thead className="bg-slate-100 dark:bg-gray-950">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">
                            Token Number
                          </th>
                          <th className="px-4 py-3 font-semibold text-slate-600 dark:text-gray-300">
                            Patient Details
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-gray-800">
                        {consultationRecords.map((record) => (
                          <tr
                            key={record.id}
                            onClick={() => openDispensingForm(record)}
                            className={`cursor-pointer transition hover:bg-brand-50/60 dark:hover:bg-brand-500/10 ${
                              selectedConsultationId === record.id
                                ? "bg-brand-50 dark:bg-brand-500/10"
                                : ""
                            }`}
                          >
                            <td className="px-4 py-3 text-slate-700 dark:text-gray-300">
                              {record.token_number || "-"}
                            </td>
                            <td className="px-4 py-3 text-slate-700 dark:text-gray-300">
                              {record.patient_details || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </BlankPage>
  );
}
