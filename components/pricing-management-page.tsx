"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

type PricingManagementPageProps = {
  initialHname?: string | null;
};

type ItemMasterRow = Record<string, unknown>;

type PricingRow = {
  id: string;
  sourceKey: string;
  raw: ItemMasterRow;
  checked: boolean;
  productCode: string;
  productName: string;
  productType: string;
  baseCost: string;
  marginValue: string;
  taxPercent: string;
};

type SaveField = {
  id: string;
  type:
    | "text"
    | "number"
    | "date";
};

const MODAL_EXCLUDED_COLUMNS = new Set([
  "created_at",
  "last_purchase_price",
  "active_from",
  "inactive_from",
  "inactive_reason",
  "updated_at",
]);

const MODAL_COLUMN_ORDER = [
  "id",
  "item_code",
  "item_name",
  "item_category",
  "purchase_uom",
  "sale_uom",
  "conversion_factor",
  "sales_price",
  "medicine_combination",
  "current_stock",
  "minimum_stock_qty",
  "maximum_stock_qty",
  "manufacturer",
  "last_purchase_vendor",
];

const PRICING_FIELDS: SaveField[] = [
  { id: "productCode", type: "text" },
  { id: "productName", type: "text" },
  { id: "productType", type: "text" },
  { id: "baseCost", type: "number" },
  { id: "marginType", type: "text" },
  { id: "marginValue", type: "number" },
  { id: "taxPercent", type: "number" },
  { id: "marginAmount", type: "number" },
  { id: "taxAmount", type: "number" },
  { id: "unitPrice", type: "number" },
  { id: "landedPrice", type: "number" },
  { id: "sellingPrice", type: "number" },
  { id: "effectiveDate", type: "date" },
  { id: "expiresAt", type: "date" },
];

const PRICING_MODAL_COLUMNS = [
  "base_cost",
  "margin_value",
  "tax_percent",
  "margin_amount",
  "tax_amount",
  "unit_price",
  "landed_price",
  "selling_price",
];

const FORCED_MODAL_ORDER = [
  "item_code",
  "product_code",
  "item_name",
  "product_name",
  "item_category",
  "product_type",
];

function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function readString(row: ItemMasterRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
}

function readNumber(row: ItemMasterRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return 0;
}

function formatColumnLabel(column: string) {
  // handle underscores and camelCase, then title-case words
  const spaced = column.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");

  const normalized = spaced.replace(/\b\w/g, (character) =>
    character.toUpperCase(),
  );

  if (/tax(_|\b|Percent|percent)/i.test(column)) {
    return "Tax %";
  }

  return normalized;
}

function formatCellValue(value: unknown) {
  if (value == null) {
    return "-";
  }

  if (typeof value === "string") {
    return value.trim().length > 0 ? value : "-";
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function parseDecimal(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return value.toFixed(2);
}

function calculateAmounts(row: PricingRow, marginType: string) {
  const baseCost = parseDecimal(row.baseCost);
  const marginValue = parseDecimal(row.marginValue);
  const taxPercent = parseDecimal(row.taxPercent);
  const marginAmount =
    marginType === "amount" ? marginValue : (baseCost * marginValue) / 100;
  const unitPrice = baseCost + marginAmount;
  const taxAmount = (unitPrice * taxPercent) / 100;
  const landedPrice = unitPrice + taxAmount;
  const sellingPrice = landedPrice;

  return {
    marginAmount,
    unitPrice,
    taxAmount,
    landedPrice,
    sellingPrice,
  };
}

function openDatePicker(input: HTMLInputElement | null) {
  if (!input) {
    return;
  }

  const picker = input as HTMLInputElement & { showPicker?: () => void };

  if (typeof picker.showPicker === "function") {
    picker.showPicker();
    return;
  }

  input.focus();
}

function getCookieTenant() {
  if (typeof document === "undefined") {
    return "";
  }

  const authCookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("auth_"));

  if (!authCookie) {
    return "";
  }

  const cookieName = authCookie.split("=")[0] ?? "";
  return cookieName.replace(/^auth_/, "");
}

function getItemSelectionKey(row: ItemMasterRow) {
  const directId = row.id;

  if (typeof directId === "string" && directId.trim().length > 0) {
    return directId;
  }

  if (typeof directId === "number" && Number.isFinite(directId)) {
    return String(directId);
  }

  const itemCode = readString(row, ["item_code", "itemCode", "product_code"]);

  if (itemCode) {
    return itemCode;
  }

  const itemName = readString(row, ["item_name", "itemName", "product_name"]);

  if (itemName) {
    return itemName;
  }

  return JSON.stringify(row);
}

function getModalCellValue(row: ItemMasterRow, column: string, marginType: string) {
  // product code / name / type aliases
  if (column === "item_code" || column === "product_code" || column === "itemCode" || column === "productCode") {
    return readString(row, ["item_code", "itemCode", "product_code", "productCode"]) || "-";
  }

  if (column === "item_name" || column === "product_name" || column === "itemName" || column === "productName") {
    return readString(row, ["item_name", "itemName", "product_name", "productName"]) || "-";
  }

  if (column === "item_category" || column === "product_type" || column === "itemCategory" || column === "productType") {
    return readString(row, ["item_category", "itemCategory", "product_type", "productType"]) || "Uncategorized";
  }

  if (column === "sale_uom" || column === "saleUom" || column === "sale_unit" || column === "saleUnit") {
    return readString(row, ["sale_uom", "saleUom", "sale_unit", "saleUnit", "purchase_uom"]) || "-";
  }

  // pricing pseudo-columns
  if (column === "base_cost") {
    const value = readNumber(row, ["last_purchase_price", "lastPurchasePrice", "sales_price", "salesPrice"]);
    return formatMoney(value);
  }

  if (column === "margin_value") {
    return "0.00";
  }

  if (column === "tax_percent") {
    const value = readNumber(row, ["tax_percentage", "taxPercent", "gst_percentage"]);
    return formatMoney(value);
  }

  if (column === "margin_amount" || column === "unit_price" || column === "tax_amount" || column === "landed_price" || column === "selling_price") {
    const baseCost = readNumber(row, ["last_purchase_price", "lastPurchasePrice", "sales_price", "salesPrice"]);
    const marginValue = 0;
    const taxPercent = readNumber(row, ["tax_percentage", "taxPercent", "gst_percentage"]);

    const marginAmount = marginType === "amount" ? marginValue : (baseCost * marginValue) / 100;
    const unitPrice = baseCost + marginAmount;
    const taxAmount = (unitPrice * taxPercent) / 100;
    const landedPrice = unitPrice + taxAmount;
    const sellingPrice = landedPrice;

    switch (column) {
      case "margin_amount":
        return formatMoney(marginAmount);
      case "unit_price":
        return formatMoney(unitPrice);
      case "tax_amount":
        return formatMoney(taxAmount);
      case "landed_price":
        return formatMoney(landedPrice);
      case "selling_price":
        return formatMoney(sellingPrice);
      default:
        return "-";
    }
  }

  // fallback to raw value
  const raw = row[column];
  return formatCellValue(raw);
}

function buildModalColumns(rows: ItemMasterRow[]) {
  const discoveredColumns = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!MODAL_EXCLUDED_COLUMNS.has(key)) {
        discoveredColumns.add(key);
      }
    }
  }

  const orderedColumns = MODAL_COLUMN_ORDER.filter((column) =>
    discoveredColumns.has(column),
  );
  const remainingColumns = Array.from(discoveredColumns).filter(
    (column) => !MODAL_COLUMN_ORDER.includes(column),
  );

  return [...orderedColumns, ...remainingColumns];
}

export function PricingManagementPage({
  initialHname,
}: PricingManagementPageProps) {
  const params = useParams<{ Hname?: string }>();
  const [resolvedHname, setResolvedHname] = useState(initialHname ?? "");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const effectiveDateRef = useRef<HTMLInputElement | null>(null);
  const expiresAtRef = useRef<HTMLInputElement | null>(null);
  const [marginType, setMarginType] = useState("percentage");
  const [tableSearch, setTableSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [dialogSearch, setDialogSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [savingRows, setSavingRows] = useState(false);
  const [itemRows, setItemRows] = useState<ItemMasterRow[]>([]);
  const [pricingRows, setPricingRows] = useState<PricingRow[]>([]);
  const [savedFormsOpen, setSavedFormsOpen] = useState(true);
  const [savedForms, setSavedForms] = useState<ItemMasterRow[]>([]);
  const [loadingSavedForms, setLoadingSavedForms] = useState(false);
  const [savedFormsError, setSavedFormsError] = useState("");
  const [selectedProductKeys, setSelectedProductKeys] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const nextHname =
      initialHname ||
      (typeof params?.Hname === "string" && params.Hname.trim().length > 0
        ? params.Hname
        : getCookieTenant());

    if (nextHname) {
      Promise.resolve().then(() => setResolvedHname(nextHname));
    }
  }, [initialHname, params]);

  useEffect(() => {
    if (!resolvedHname || !savedFormsOpen) {
      return;
    }

    let active = true;

    const loadSavedForms = async () => {
      setLoadingSavedForms(true);
      setSavedFormsError("");

      try {
        const response = await fetch(
          `/api/${encodeURIComponent(resolvedHname)}/forms/pricing`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error("Unable to load saved pricing forms.");
        }

        const data = (await response.json()) as {
          rows?: ItemMasterRow[];
        };

        if (active) {
          setSavedForms(data.rows ?? []);
        }
      } catch (error) {
        if (active) {
          setSavedFormsError(
            error instanceof Error
              ? error.message
              : "Unable to load saved pricing forms.",
          );
        }
      } finally {
        if (active) {
          setLoadingSavedForms(false);
        }
      }
    };

    void loadSavedForms();

    return () => {
      active = false;
    };
  }, [resolvedHname, savedFormsOpen]);

  useEffect(() => {
    async function loadItems() {
      if (!resolvedHname) {
        setItemRows([]);
        return;
      }

      setLoadingItems(true);
      setErrorMessage("");

      try {
        const response = await fetch(
          `/api/${encodeURIComponent(resolvedHname)}/forms/item_master_medicine`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error("Unable to load item master records.");
        }

        const data = (await response.json()) as {
          rows?: ItemMasterRow[];
        };

        setItemRows(data.rows ?? []);
      } catch (error) {
        console.error("Failed to load item master rows", error);
        setErrorMessage("Unable to load item master products right now.");
      } finally {
        setLoadingItems(false);
      }
    }

    void loadItems();
  }, [resolvedHname]);

  const availableTypes = Array.from(
    new Set(
      itemRows
        .map((row) =>
          readString(row, ["item_category", "itemCategory"]) || "Uncategorized",
        )
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));

  const filteredPricingRows = pricingRows.filter((row) => {
    const matchesSearch =
      tableSearch.trim().length === 0 ||
      row.productCode.toLowerCase().includes(tableSearch.toLowerCase()) ||
      row.productName.toLowerCase().includes(tableSearch.toLowerCase());
    const matchesType =
      typeFilter === "All Types" || row.productType === typeFilter;

    return matchesSearch && matchesType;
  });

  const filteredDialogRows = itemRows.filter((row) => {
    if (dialogSearch.trim().length === 0) {
      return true;
    }

    const searchableText = Object.entries(row)
      .filter(([key]) => !MODAL_EXCLUDED_COLUMNS.has(key))
      .map(([, value]) => formatCellValue(value).toLowerCase())
      .join(" ");

    return searchableText.includes(dialogSearch.toLowerCase());
  });

  // Only show these four columns in the Select Products modal per request
  const DIALOG_VISIBLE_COLUMNS = [
    "item_code",
    "item_name",
    "item_category",
    "sale_uom",
  ];

  const modalColumns = DIALOG_VISIBLE_COLUMNS;

  const allVisibleRowsSelected =
    filteredPricingRows.length > 0 &&
    filteredPricingRows.every((row) => row.checked);

  const selectedDialogCount = selectedProductKeys.length;
  const checkedPricingRows = pricingRows.filter((row) => row.checked);

  function resetForm(clearStatus: boolean) {
    setEffectiveDate(getTodayDate());
    setExpiresAt("");
    setMarginType("percentage");
    setTableSearch("");
    setTypeFilter("All Types");
    setDialogSearch("");
    setDialogOpen(false);
    setPricingRows([]);
    setSelectedProductKeys([]);

    if (clearStatus) {
      setStatusMessage("");
      setErrorMessage("");
    }
  }

  function toggleDialogSelection(productKey: string) {
    setSelectedProductKeys((currentKeys) =>
      currentKeys.includes(productKey)
        ? currentKeys.filter((key) => key !== productKey)
        : [...currentKeys, productKey],
    );
  }

  function toggleAllVisibleDialogRows() {
    const visibleKeys = filteredDialogRows.map((row) => getItemSelectionKey(row));

    setSelectedProductKeys((currentKeys) => {
      const everyVisibleSelected = visibleKeys.every((key) =>
        currentKeys.includes(key),
      );

      if (everyVisibleSelected) {
        return currentKeys.filter((key) => !visibleKeys.includes(key));
      }

      return Array.from(new Set([...currentKeys, ...visibleKeys]));
    });
  }

  function addSelectedProducts() {
    const selectedRows = itemRows.filter((row) => {
      const productKey = getItemSelectionKey(row);
      return selectedProductKeys.includes(productKey);
    });

    setPricingRows((currentRows) => {
      const existingKeys = new Set(currentRows.map((row) => row.sourceKey));
      const nextRows = [...currentRows];

      for (const row of selectedRows) {
        const sourceKey = getItemSelectionKey(row);

        if (existingKeys.has(sourceKey)) {
          continue;
        }

        nextRows.push({
          id: crypto.randomUUID(),
          sourceKey,
          raw: row,
          checked: true,
          productCode: readString(row, ["item_code", "itemCode"]),
          productName: readString(row, ["item_name", "itemName"]),
          productType:
            readString(row, ["item_category", "itemCategory"]) || "Uncategorized",
          baseCost: formatMoney(
            readNumber(row, [
              "last_purchase_price",
              "lastPurchasePrice",
              "sales_price",
              "salesPrice",
            ]),
          ),
          marginValue: "0",
          taxPercent: formatMoney(
            readNumber(row, ["tax_percentage", "taxPercent", "gst_percentage"]),
          ),
        });
      }

      return nextRows;
    });

    setDialogOpen(false);
    setSelectedProductKeys([]);
    setDialogSearch("");
    setStatusMessage("");
    setErrorMessage("");
  }

  function updatePricingRow(
    rowId: string,
    field: keyof Pick<PricingRow, "baseCost" | "marginValue" | "taxPercent">,
    value: string,
  ) {
    setPricingRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row,
      ),
    );
  }

  function togglePricingRow(rowId: string) {
    setPricingRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId ? { ...row, checked: !row.checked } : row,
      ),
    );
  }

  function toggleAllVisiblePricingRows() {
    const visibleIds = new Set(filteredPricingRows.map((row) => row.id));

    setPricingRows((currentRows) =>
      currentRows.map((row) =>
        visibleIds.has(row.id)
          ? { ...row, checked: !allVisibleRowsSelected }
          : row,
      ),
    );
  }

  async function savePricingRows(resetAfterSave: boolean) {
    if (!resolvedHname) {
      setErrorMessage(
        "Hospital context is missing, so products cannot be loaded or saved here.",
      );
      setStatusMessage("");
      return;
    }

    if (checkedPricingRows.length === 0) {
      setErrorMessage("Select at least one product row before creating pricing.");
      setStatusMessage("");
      return;
    }

    setSavingRows(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const responses = await Promise.all(
        checkedPricingRows.map(async (row) => {
          const amounts = calculateAmounts(row, marginType);
          const response = await fetch(
            `/api/${encodeURIComponent(resolvedHname)}/forms/pricing`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                cardTitle: "Pricing",
                fields: PRICING_FIELDS,
                values: {
                  productCode: row.productCode,
                  productName: row.productName,
                  productType: row.productType,
                  baseCost: formatMoney(parseDecimal(row.baseCost)),
                  marginType,
                  marginValue: formatMoney(parseDecimal(row.marginValue)),
                  taxPercent: formatMoney(parseDecimal(row.taxPercent)),
                  marginAmount: formatMoney(amounts.marginAmount),
                  taxAmount: formatMoney(amounts.taxAmount),
                  unitPrice: formatMoney(amounts.unitPrice),
                  landedPrice: formatMoney(amounts.landedPrice),
                  sellingPrice: formatMoney(amounts.sellingPrice),
                  effectiveDate,
                  expiresAt,
                },
              }),
            },
          );

          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as
              | { error?: string }
              | null;

            throw new Error(payload?.error || "Failed to save pricing rows.");
          }

          return response;
        }),
      );

      setStatusMessage(
        `${responses.length} pricing row${responses.length === 1 ? "" : "s"} created successfully.`,
      );
      setSavedFormsOpen(true);

      if (resetAfterSave) {
        resetForm(false);
      }

      await loadSavedPricingForms();
    } catch (error) {
      console.error("Failed to save pricing rows", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save pricing rows.",
      );
    } finally {
      setSavingRows(false);
    }
  }

  async function loadSavedPricingForms() {
    if (!resolvedHname) {
      setSavedForms([]);
      return;
    }

    setLoadingSavedForms(true);
    setSavedFormsError("");

    try {
      const response = await fetch(
        `/api/${encodeURIComponent(resolvedHname)}/forms/pricing`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error("Unable to load saved pricing forms.");
      }

      const data = (await response.json()) as {
        rows?: ItemMasterRow[];
        error?: string;
      };

      if (data.error) {
        throw new Error(data.error);
      }

      setSavedForms(data.rows ?? []);
    } catch (error) {
      console.error("Failed to load saved pricing forms", error);
      setSavedFormsError(
        error instanceof Error ? error.message : "Failed to load saved pricing forms.",
      );
    } finally {
      setLoadingSavedForms(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 border-b border-gray-200 px-5 py-5 sm:px-6 lg:flex-row lg:items-start lg:justify-between dark:border-gray-800">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Add Pricing
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Select multiple products and update row-wise pricing.
            </p>
            {resolvedHname ? (
              <p className="mt-2 text-xs font-medium uppercase tracking-[0.24em] text-brand-500">
                Hospital: {resolvedHname}
              </p>
            ) : (
              <p className="mt-2 text-xs font-medium uppercase tracking-[0.24em] text-amber-600 dark:text-amber-400">
                No hospital context detected
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {savedFormsOpen && (
              <button
                type="button"
                onClick={() => setSavedFormsOpen(false)}
                disabled={!resolvedHname}
                className="inline-flex items-center justify-center rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Add Pricing
              </button>
            )}
          </div>
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          {!savedFormsOpen ? (
            <>
              <div className="grid gap-4 lg:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                    Effective Date
                  </span>
                  <div className="relative">
                    <input
                      ref={effectiveDateRef}
                      id="effectiveDate"
                      type="date"
                      value={effectiveDate}
                      onChange={(event) => setEffectiveDate(event.target.value)}
                      className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 pr-12 text-sm text-gray-900 outline-hidden transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    />

                    <button
                      type="button"
                      onClick={() => openDatePicker(effectiveDateRef.current)}
                      aria-label="Open calendar"
                      className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900/20 dark:text-gray-300"
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
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                    Expires At (Optional)
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <input
                        ref={expiresAtRef}
                        id="expiresAt"
                        type="date"
                        value={expiresAt}
                        onChange={(event) => setExpiresAt(event.target.value)}
                        className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 pr-12 text-sm text-gray-900 outline-hidden transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      />

                      <button
                        type="button"
                        onClick={() => openDatePicker(expiresAtRef.current)}
                        aria-label="Open calendar"
                        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900/20 dark:text-gray-300"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                    Margin Type
                  </span>
                  <select
                    value={marginType}
                    onChange={(event) => setMarginType(event.target.value)}
                    className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-sm text-gray-900 outline-hidden transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="amount">Amount</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_auto]">
                <label className="relative block">
                  <span className="sr-only">Search products</span>
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={(event) => setTableSearch(event.target.value)}
                    placeholder="Search by product name, code, or SKU..."
                    className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-sm text-gray-900 outline-hidden transition placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
                  />
                </label>
                <label className="space-y-2">
                  <span className="sr-only">Filter by type</span>
                  <select
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value)}
                    className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-sm text-gray-900 outline-hidden transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="All Types">All Types</option>
                    {availableTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setDialogOpen(true)}
                    disabled={!resolvedHname || loadingItems}
                    className="inline-flex h-12 items-center justify-center rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loadingItems ? "Loading Items..." : "Select Items"}
                  </button>
                </div>
              </div>

              {errorMessage ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                  {errorMessage}
                </div>
              ) : null}

              <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
                    <thead className="bg-gray-50 dark:bg-gray-900/60">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={allVisibleRowsSelected}
                            onChange={toggleAllVisiblePricingRows}
                            className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                          />
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">
                          Product Code
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">
                          Product Name
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">
                          Base Cost
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">
                          Margin Value
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">
                          Tax %
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">
                          Margin Amount
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">
                          Tax Amount
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">
                          Unit Price
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">
                          Landed Price
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">
                          Selling Price
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-transparent">
                      {filteredPricingRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={11}
                            className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400"
                          >
                            Select products to start building pricing rows.
                          </td>
                        </tr>
                      ) : (
                        filteredPricingRows.map((row) => {
                          const amounts = calculateAmounts(row, marginType);

                          return (
                            <tr key={row.id} className="align-top">
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={row.checked}
                                  onChange={() => togglePricingRow(row.id)}
                                  className="mt-2 h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                                />
                              </td>
                              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                {row.productCode || "-"}
                              </td>
                              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                                <div>{row.productName || "-"}</div>
                                <div className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-400">
                                  {row.productType}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={row.baseCost}
                                  onChange={(event) =>
                                    updatePricingRow(row.id, "baseCost", event.target.value)
                                  }
                                  className="h-11 min-w-[120px] rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-hidden transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={row.marginValue}
                                  onChange={(event) =>
                                    updatePricingRow(row.id, "marginValue", event.target.value)
                                  }
                                  className="h-11 min-w-[120px] rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-hidden transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={row.taxPercent}
                                  onChange={(event) =>
                                    updatePricingRow(row.id, "taxPercent", event.target.value)
                                  }
                                  className="h-11 min-w-[100px] rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-hidden transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                />
                              </td>
                              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                                <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-900/70">
                                  {formatMoney(amounts.marginAmount)}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                                <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-900/70">
                                  {formatMoney(amounts.taxAmount)}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                                <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-900/70">
                                  {formatMoney(amounts.unitPrice)}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                                <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-900/70">
                                  {formatMoney(amounts.landedPrice)}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                                <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-900/70">
                                  {formatMoney(amounts.sellingPrice)}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => resetForm(true)}
                  className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void savePricingRows(true)}
                  disabled={savingRows}
                  className="inline-flex items-center justify-center rounded-xl border border-brand-200 bg-brand-50 px-5 py-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/20"
                >
                  {savingRows ? "Saving..." : "Create & Add New"}
                </button>
                <button
                  type="button"
                  onClick={() => void savePricingRows(false)}
                  disabled={savingRows}
                  className="inline-flex items-center justify-center rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingRows ? "Saving..." : "Create"}
                </button>
              </div>
            </>
          ) : (
            <>
              {statusMessage ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                  {statusMessage}
                </div>
              ) : null}

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">Saved Pricing Forms</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {savedForms.length} saved form{savedForms.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  {savedFormsError ? (
                    <p className="text-xs text-red-500">{savedFormsError}</p>
                  ) : null}
                </div>
                <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
                  <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
                    <thead className="bg-white text-left dark:bg-gray-900">
                      <tr>
                        {[
                          "product_code",
                          "product_name",
                          "product_type",
                          "base_cost",
                          "margin_type",
                          "margin_value",
                          "tax_percent",
                          "unit_price",
                          "landed_price",
                          "selling_price",
                          "effective_date",
                          "expires_at",
                          "created_at",
                        ].map((column) => (
                          <th
                            key={column}
                            className="whitespace-nowrap px-3 py-2 font-semibold text-gray-500 dark:text-gray-400"
                          >
                            {formatColumnLabel(column)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-transparent">
                      {loadingSavedForms ? (
                        <tr>
                          <td colSpan={13} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                            Loading saved forms...
                          </td>
                        </tr>
                      ) : savedForms.length === 0 ? (
                        <tr>
                          <td colSpan={13} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                            No saved pricing forms found.
                          </td>
                        </tr>
                      ) : (
                        savedForms.map((form, index) => (
                          <tr key={`${form.id ?? index}-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-900/60">
                            {[
                              "product_code",
                              "product_name",
                              "product_type",
                              "base_cost",
                              "margin_type",
                              "margin_value",
                              "tax_percent",
                              "unit_price",
                              "landed_price",
                              "selling_price",
                              "effective_date",
                              "expires_at",
                              "created_at",
                            ].map((column) => (
                              <td key={`${index}-${column}`} className="whitespace-nowrap px-3 py-2 text-gray-700 dark:text-gray-300">
                                {formatCellValue((form as Record<string, unknown>)[column])}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="flex max-h-[96vh] w-full max-w-8xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-950">
            <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between dark:border-gray-800">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Select Items
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Item master data is shown here except Created At, Last Purchase Price, Active From, Inactive From, Inactive Reason, and Updated At.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 overflow-auto px-5 py-5 sm:px-6">
              <input
                type="text"
                value={dialogSearch}
                onChange={(event) => setDialogSearch(event.target.value)}
                placeholder="Search item master data..."
                className="h-11 w-full rounded-xl border border-gray-300 bg-white px-4 text-sm text-gray-900 outline-hidden transition placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
              />

              <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={
                              filteredDialogRows.length > 0 &&
                              filteredDialogRows.every((row) =>
                                selectedProductKeys.includes(getItemSelectionKey(row)),
                              )
                            }
                            onChange={toggleAllVisibleDialogRows}
                            className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                          />
                        </th>
                              {modalColumns.map((column) => (
                          <th
                            key={column}
                            className="whitespace-nowrap px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400"
                          >
                            {formatColumnLabel(column)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-transparent">
                      {loadingItems ? (
                        <tr>
                          <td
                            colSpan={modalColumns.length + 1}
                            className="px-4 py-10 text-center text-gray-500 dark:text-gray-400"
                          >
                            Loading item master records...
                          </td>
                        </tr>
                      ) : filteredDialogRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={modalColumns.length + 1}
                            className="px-4 py-10 text-center text-gray-500 dark:text-gray-400"
                          >
                            No item master records found.
                          </td>
                        </tr>
                      ) : (
                        filteredDialogRows.map((row) => {
                          const productKey = getItemSelectionKey(row);

                          return (
                            <tr
                              key={productKey}
                              className="cursor-pointer transition hover:bg-gray-50 dark:hover:bg-gray-900/60"
                              onClick={() => toggleDialogSelection(productKey)}
                            >
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={selectedProductKeys.includes(productKey)}
                                  onChange={() => toggleDialogSelection(productKey)}
                                  onClick={(event) => event.stopPropagation()}
                                  className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                                />
                              </td>
                              {modalColumns.map((column) => (
                                <td
                                  key={`${productKey}-${column}`}
                                  className="whitespace-nowrap px-4 py-3 text-gray-700 dark:text-gray-300"
                                >
                                  {getModalCellValue(row, column, marginType)}
                                </td>
                              ))}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {selectedDialogCount} product{selectedDialogCount === 1 ? "" : "s"} selected
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={addSelectedProducts}
                  disabled={selectedDialogCount === 0}
                  className="inline-flex items-center justify-center rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Add Selected Items
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
