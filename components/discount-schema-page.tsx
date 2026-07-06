"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { PageLayout } from "./page-layout";

type Variant = {
  id: string;
  product: string;
  variant: string;
  sku: string;
  barcode: string;
};

const availableVariants: Variant[] = [
  {
    id: "1",
    product: "Acme Toothpaste",
    variant: "100ml",
    sku: "ACM-TP-100",
    barcode: "8901234567890",
  },
  {
    id: "2",
    product: "Acme Toothpaste",
    variant: "200ml",
    sku: "ACM-TP-200",
    barcode: "8901234567891",
  },
  {
    id: "3",
    product: "Acme Mouthwash",
    variant: "500ml",
    sku: "ACM-MW-500",
    barcode: "8901234567892",
  },
];

type DiscountRecord = {
  id: number;
  name?: string;
  description?: string;
  discount_type?: string;
  discountType?: string;
  value?: string | number;
  priority?: string | number;
  coupon_code?: string;
  couponCode?: string;
  start_date?: string;
  startDate?: string;
  end_date?: string;
  endDate?: string;
  apply_level?: string;
  applyLevel?: string;
  selected_variants?: string;
  selectedVariants?: string;
};

export function DiscountSchemaPage() {
  const params = useParams();
  const hname = decodeURIComponent(params?.Hname as string || "HSMS");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState("Percentage");
  const [value, setValue] = useState("");
  const [priority, setPriority] = useState("1");
  const [couponCode, setCouponCode] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [applyLevel, setApplyLevel] = useState("Invoice"); // "Invoice" or "Item"
  const startDateRef = useRef<HTMLInputElement | null>(null);
  const endDateRef = useRef<HTMLInputElement | null>(null);
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);

  const [records, setRecords] = useState<DiscountRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const selectedVariants = useMemo(
    () => availableVariants.filter((variant) => selectedVariantIds.includes(variant.id)),
    [selectedVariantIds],
  );

  const selectedCount = selectedVariants.length;

  const loadRecords = async () => {
    setIsLoadingRecords(true);
    try {
      const response = await fetch(`/api/${encodeURIComponent(hname)}/forms/discount_schema`, {
        method: "GET",
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load records");
      setRecords(data.rows || []);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to load discount schemas.");
    } finally {
      setIsLoadingRecords(false);
    }
  };

  useEffect(() => {
    if (hname) {
      void loadRecords();
    }
  }, [hname]);

  const handleCreateDiscount = async () => {
    if (!name || !value) {
      setErrorMsg("Name and Value are required fields.");
      return;
    }
    setIsSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const response = await fetch(`/api/${encodeURIComponent(hname)}/forms/discount_schema`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardTitle: "Discount Schema",
          fields: [
            { id: "name", type: "text" },
            { id: "description", type: "text" },
            { id: "discountType", type: "text" },
            { id: "value", type: "number" },
            { id: "priority", type: "number" },
            { id: "couponCode", type: "text" },
            { id: "startDate", type: "date" },
            { id: "endDate", type: "date" },
            { id: "applyLevel", type: "text" },
            { id: "selectedVariants", type: "text" },
          ],
          values: {
            name,
            description,
            discountType,
            value: Number(value) || 0,
            priority: Number(priority) || 1,
            couponCode,
            startDate,
            endDate,
            applyLevel,
            selectedVariants: JSON.stringify(selectedVariants),
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create discount schema");

      setSuccessMsg("Discount Schema created successfully!");
      // Reset form
      setName("");
      setDescription("");
      setDiscountType("Percentage");
      setValue("");
      setPriority("1");
      setCouponCode("");
      setStartDate("");
      setEndDate("");
      setApplyLevel("Invoice");
      setSelectedVariantIds([]);
      await loadRecords();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create discount schema.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRecord = async (id: number) => {
    if (!confirm("Are you sure you want to delete this discount schema?")) return;
    try {
      const response = await fetch(`/api/${encodeURIComponent(hname)}/forms/discount_schema`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete record.");
      }
      setSuccessMsg("Discount Schema deleted successfully.");
      await loadRecords();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete record.");
    }
  };

  const openDatePicker = (input: HTMLInputElement | null) => {
    if (!input) {
      return;
    }
    const picker = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof picker.showPicker === "function") {
      picker.showPicker();
      return;
    }
    input.focus();
  };

  const toggleVariant = (variantId: string) => {
    setSelectedVariantIds((current) =>
      current.includes(variantId)
        ? current.filter((id) => id !== variantId)
        : [...current, variantId],
    );
  };

  return (
    <PageLayout title="Discount Schema">
      <section className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Create Discount</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Define the discount details and apply them to selected product variants or globally.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                Name
              </span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter discount name"
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-hidden transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                Description
              </span>
              <input
                type="text"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Enter discount description"
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-hidden transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                Discount Type
              </span>
              <select
                value={discountType}
                onChange={(event) => setDiscountType(event.target.value)}
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-hidden transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                <option value="Percentage">Percentage</option>
                <option value="Flat">Flat</option>
                <option value="Buy One Get One">Buy One Get One</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                Value (Amount or %)
              </span>
              <input
                type="text"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="Enter discount value"
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-hidden transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                Apply Level
              </span>
              <select
                value={applyLevel}
                onChange={(event) => setApplyLevel(event.target.value)}
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-hidden transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                <option value="Invoice">Whole Invoice Level</option>
                <option value="Item">Item Level</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                Priority
              </span>
              <input
                type="number"
                min={1}
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
                placeholder="1"
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-hidden transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                Coupon Code
              </span>
              <input
                type="text"
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value)}
                placeholder="Enter coupon code"
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-hidden transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </label>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            Validity
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                Start Date
              </span>
              <div className="relative">
                <input
                  ref={startDateRef}
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 pr-12 text-sm text-slate-900 outline-hidden transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => openDatePicker(startDateRef.current)}
                  aria-label="Open start date picker"
                  className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 dark:bg-gray-900 dark:text-slate-500 dark:hover:bg-gray-800 dark:hover:text-white"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </button>
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                End Date
              </span>
              <div className="relative">
                <input
                  ref={endDateRef}
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 pr-12 text-sm text-slate-900 outline-hidden transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => openDatePicker(endDateRef.current)}
                  aria-label="Open end date picker"
                  className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 dark:bg-gray-900 dark:text-slate-500 dark:hover:bg-gray-800 dark:hover:text-white"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </button>
              </div>
            </label>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Selected Variants</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {selectedCount} variant{selectedCount === 1 ? "" : "s"} selected (Leave empty for all products)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setVariantDialogOpen(true)}
              className="inline-flex items-center justify-center rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              Select Variants
            </button>
          </div>

          <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 dark:border-gray-800 dark:bg-gray-900">
            <table className="min-w-full text-sm text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-100 text-left text-xs uppercase tracking-[0.2em] text-slate-500 dark:bg-gray-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Variant</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Barcode</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-950">
                {selectedVariants.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      No specific variants selected. Applies to all.
                    </td>
                  </tr>
                ) : (
                  selectedVariants.map((variant) => (
                    <tr key={variant.id} className="border-t border-slate-200 dark:border-gray-800">
                      <td className="px-4 py-4">{variant.product}</td>
                      <td className="px-4 py-4">{variant.variant}</td>
                      <td className="px-4 py-4">{variant.sku}</td>
                      <td className="px-4 py-4">{variant.barcode}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {errorMsg && <p className="text-sm text-red-600 font-medium">{errorMsg}</p>}
        {successMsg && <p className="text-sm text-green-600 font-medium">{successMsg}</p>}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => {
              setName("");
              setDescription("");
              setDiscountType("Percentage");
              setValue("");
              setPriority("1");
              setCouponCode("");
              setStartDate("");
              setEndDate("");
              setApplyLevel("Invoice");
              setSelectedVariantIds([]);
            }}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleCreateDiscount}
            className="inline-flex items-center justify-center rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            {isSubmitting ? "Creating..." : "Create Discount"}
          </button>
        </div>

        {/* Saved schemas table: matches look/feel of other master tables */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950 mt-8">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Active Discount Schemas</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Manage defined discounts for invoice and items.</p>
          </div>
          {isLoadingRecords ? (
            <p className="text-sm text-slate-500">Loading saved discount schemas...</p>
          ) : records.length === 0 ? (
            <p className="text-sm text-slate-500">No discount schemas defined yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-gray-800">
              <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
                <thead className="bg-slate-50 dark:bg-white/[0.02]">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">ID</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Type</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Value</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Level</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Coupon</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Start Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">End Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-transparent">
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{r.id}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.name || r.name}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.discount_type || r.discountType}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.value}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          (r.apply_level || r.applyLevel) === "Item" 
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                        }`}>
                          {r.apply_level || r.applyLevel || "Invoice"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.coupon_code || r.couponCode || "-"}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.start_date || r.startDate || "-"}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.end_date || r.endDate || "-"}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => void handleDeleteRecord(r.id)}
                          className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {variantDialogOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-950">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-gray-800">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Select Variants</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Pick the variants that this discount should apply to.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setVariantDialogOpen(false)}
                  className="text-sm font-semibold text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  Close
                </button>
              </div>

              <div className="space-y-3 px-5 py-5">
                {availableVariants.map((variant) => (
                  <label
                    key={variant.id}
                    className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 transition hover:border-slate-300 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  >
                    <div>
                      <p className="font-medium">{variant.product}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {variant.variant} • {variant.sku} • {variant.barcode}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedVariantIds.includes(variant.id)}
                      onChange={() => toggleVariant(variant.id)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                    />
                  </label>
                ))}
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 dark:border-gray-800 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setVariantDialogOpen(false)}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setVariantDialogOpen(false)}
                  className="inline-flex items-center justify-center rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-600"
                >
                  Save Selection
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </PageLayout>
  );
}
