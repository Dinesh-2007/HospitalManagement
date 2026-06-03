"use client";

import { useMemo, useRef, useState } from "react";
import { BlankPage } from "./blank-page";

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

export function DiscountSchemaPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState("Percentage");
  const [value, setValue] = useState("");
  const [priority, setPriority] = useState("1");
  const [couponCode, setCouponCode] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const startDateRef = useRef<HTMLInputElement | null>(null);
  const endDateRef = useRef<HTMLInputElement | null>(null);
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);

  const selectedVariants = useMemo(
    () => availableVariants.filter((variant) => selectedVariantIds.includes(variant.id)),
    [selectedVariantIds],
  );

  const selectedCount = selectedVariants.length;

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
    <BlankPage title="Discount Schema">
      <section className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Create Discount</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Define the discount details and apply them to selected product variants.
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
                Value
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
                {selectedCount} variant{selectedCount === 1 ? "" : "s"} selected
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
                      No variants selected.
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
              setSelectedVariantIds([]);
            }}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            Create Discount
          </button>
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
    </BlankPage>
  );
}
