"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { PencilIcon, TrashBinIcon } from "../../../components/icons";

type Medicine = {
  id: string;
  code: string;
  name: string;
  genericName: string;
  type: string;
  strength: string;
  uom: string;
  stock: number;
};

type ItemMasterRow = {
  id?: number | string | null;
  item_code?: string | null;
  item_name?: string | null;
  item_category?: string | null;
  purchase_uom?: string | null;
  sale_uom?: string | null;
  medicine_combination?: string | null;
  current_stock?: number | string | null;
};

type PrescriptionRow = {
  id: string;
  medicine: Medicine;
  schedule: {
    morning: boolean;
    afternoon: boolean;
    night: boolean;
  };
  foodTiming: string;
  days: string;
  totalQty: string;
};

type SerializedPrescriptionLine = {
  medicineName: string;
  genericName: string;
  medicineType: string;
  strength: string;
  uom: string;
  frequency?: string;
  morning?: boolean;
  afternoon?: boolean;
  night?: boolean;
  foodTiming: string;
  days: string;
  totalQty: string;
};

type PrescriptionTableProps = {
  value?: string;
  onChange?: (value: string) => void;
  isSended?: boolean;
  onSendToPharmacy?: () => void;
  isSubmitting?: boolean;
};

const DEFAULT_FOOD_TIMING = "After Food";
const FOOD_TIMING_OPTIONS = [
  "After Food",
  "Before Food",
  "With Food",
  "Empty Stomach",
  "As Directed",
] as const;

const FALLBACK_UOM_OPTIONS = [
  "Tabs",
  "Caps",
  "Syrup",
  "Inj",
  "Drops",
  "Ointment",
  "Sachet",
  "Bottle",
  "Vial",
  "Ampoule",
  "Pcs",
  "Nos",
  "Ml",
  "Mg",
  "Gm",
  "Puffs",
  "Tube",
  "Strip",
];

const FALLBACK_MEDICINE_TYPE_OPTIONS = [
  "Tablet",
  "Capsule",
  "Syrup",
  "Injection",
  "Drops",
  "Ointment",
  "Gel",
  "Cream",
  "Inhaler",
  "Sachet",
  "Lotion",
  "Suspension",
  "Powder",
  "Spray",
  "Other",
];

function buildEmptyMedicine(): Medicine {
  return {
    id: "",
    code: "",
    name: "",
    genericName: "",
    type: "",
    strength: "",
    uom: "",
    stock: 0,
  };
}

function buildEmptySchedule() {
  return {
    morning: false,
    afternoon: false,
    night: false,
  };
}

function serializeSchedule(schedule: PrescriptionRow["schedule"]): string {
  return [schedule.morning, schedule.afternoon, schedule.night]
    .map((val) => (val ? "1" : "0"))
    .join("");
}

function calculateTotalQty(schedule: PrescriptionRow["schedule"], days: string): string {
  const totalDays = Number(days);
  if (!Number.isFinite(totalDays) || totalDays <= 0) {
    return "";
  }
  const dosesPerDay =
    Number(schedule.morning) + Number(schedule.afternoon) + Number(schedule.night);
  if (dosesPerDay === 0) return "";
  return String(dosesPerDay * totalDays);
}

function serializeRows(rows: PrescriptionRow[]): string {
  const serializedRows: SerializedPrescriptionLine[] = rows.map((row) => ({
    medicineName: row.medicine.name || row.medicine.genericName,
    genericName: row.medicine.genericName,
    medicineType: row.medicine.type,
    strength: row.medicine.strength,
    uom: row.medicine.uom,
    frequency: serializeSchedule(row.schedule),
    morning: row.schedule.morning,
    afternoon: row.schedule.afternoon,
    night: row.schedule.night,
    foodTiming: row.foodTiming,
    days: row.days,
    totalQty: row.totalQty,
  }));
  return JSON.stringify(serializedRows);
}

function parseRows(value?: string): PrescriptionRow[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item) => {
      const line = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
      const schedule =
        typeof line.morning === "boolean" ||
        typeof line.afternoon === "boolean" ||
        typeof line.night === "boolean"
          ? {
              morning: Boolean(line.morning),
              afternoon: Boolean(line.afternoon),
              night: Boolean(line.night),
            }
          : typeof line.frequency === "string" && /^[01]{3}$/.test(line.frequency)
            ? {
                morning: line.frequency[0] === "1",
                afternoon: line.frequency[1] === "1",
                night: line.frequency[2] === "1",
              }
            : buildEmptySchedule();

      const daysVal = typeof line.days === "string" ? line.days : (line.days ? String(line.days) : "");
      const totalQtyVal =
        typeof line.totalQty === "string"
          ? line.totalQty
          : (line.totalQty ? String(line.totalQty) : calculateTotalQty(schedule, daysVal));

      return {
        id: crypto.randomUUID(),
        medicine: {
          ...buildEmptyMedicine(),
          name:
            typeof line.medicineName === "string"
              ? line.medicineName
              : typeof line.name === "string"
                ? line.name
                : "",
          genericName: typeof line.genericName === "string" ? line.genericName : "",
          type:
            typeof line.medicineType === "string"
              ? line.medicineType
              : typeof line.type === "string"
                ? line.type
                : "",
          strength: typeof line.strength === "string" ? line.strength : "",
          uom: typeof line.uom === "string" ? line.uom : "",
        },
        schedule,
        foodTiming:
          typeof line.foodTiming === "string" && line.foodTiming.trim()
            ? line.foodTiming
            : DEFAULT_FOOD_TIMING,
        days: daysVal,
        totalQty: totalQtyVal,
      };
    });
  } catch {
    return [];
  }
}

type ModalFormState = {
  id: string | null;
  name: string;
  code: string;
  genericName: string;
  type: string;
  uom: string;
  strength: string;
  morning: boolean;
  afternoon: boolean;
  night: boolean;
  foodTiming: string;
  days: string;
  totalQty: string;
  stock?: number;
};

function emptyFormState(defaultType = "", defaultUom = ""): ModalFormState {
  return {
    id: null,
    name: "",
    code: "",
    genericName: "",
    type: defaultType || "Tablet",
    uom: defaultUom || "Tabs",
    strength: "",
    morning: false,
    afternoon: false,
    night: false,
    foodTiming: DEFAULT_FOOD_TIMING,
    days: "5",
    totalQty: "",
  };
}

export function PrescriptionTable({
  value = "",
  onChange,
  isSended = false,
  onSendToPharmacy,
  isSubmitting = false,
}: PrescriptionTableProps) {
  const params = useParams();
  const hname = params?.Hname as string;
  const [rows, setRows] = useState<PrescriptionRow[]>(() => parseRows(value));
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [medicineTypeOptions, setMedicineTypeOptions] = useState<string[]>(FALLBACK_MEDICINE_TYPE_OPTIONS);
  const [uomOptions, setUomOptions] = useState<string[]>(FALLBACK_UOM_OPTIONS);
  const [isLoadingMedicines, setIsLoadingMedicines] = useState(true);

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState<ModalFormState>(() => emptyFormState());
  const [formError, setFormError] = useState("");

  // Medicine Autocomplete in Modal
  const [medicineSearchQuery, setMedicineSearchQuery] = useState("");
  const [showMedicineSuggestions, setShowMedicineSuggestions] = useState(false);
  const autocompleteContainerRef = useRef<HTMLDivElement | null>(null);

  // Sync rows if external value changes (e.g. consultation loaded)
  useEffect(() => {
    if (value) {
      const parsed = parseRows(value);
      if (parsed.length > 0 && rows.length === 0) {
        setRows(parsed);
      }
    }
  }, [value]);

  // Load medicines, Item Category (Medicine Type), and Item UOM from Masters
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!hname) return;
      setIsLoadingMedicines(true);

      try {
        const [medRes, catRes, uomRes] = await Promise.all([
          // 1. Medicines
          fetch(`/api/${encodeURIComponent(hname)}/forms/item_master_medicine`, {
            method: "GET",
            cache: "no-store",
          }),
          // 2. Item Category (/masters/pharmacy-inventory-masters/item-category)
          fetch(`/api/${encodeURIComponent(hname)}/forms/item_category_master`, {
            method: "GET",
            cache: "no-store",
          }).catch(() => null),
          // 3. Item UOM (/masters/pharmacy-inventory-masters/item-uom)
          fetch(`/api/${encodeURIComponent(hname)}/forms/uom_master`, {
            method: "GET",
            cache: "no-store",
          }).catch(() => null),
        ]);

        let loadedMedicines: Medicine[] = [];

        if (medRes.ok) {
          const medData = await medRes.json().catch(() => ({}));
          const rowsList: ItemMasterRow[] = medData.rows ?? [];
          loadedMedicines = rowsList
            .map((row, index) => {
              const code = String(row.item_code ?? "").trim();
              const name = String(row.item_name ?? "").trim();
              if (!name) return null;

              return {
                id: String((row.id ?? code) || `med-${index}`),
                code,
                name,
                genericName: String(row.medicine_combination ?? "").trim(),
                type: String(row.item_category ?? "").trim() || "Tablet",
                strength: "",
                uom: String(row.sale_uom ?? row.purchase_uom ?? "").trim() || "Tabs",
                stock: Number(row.current_stock ?? 0) || 0,
              } satisfies Medicine;
            })
            .filter((m): m is Medicine => m !== null);

          if (isMounted) {
            setMedicines(loadedMedicines);
          }
        }

        // Process Item Category (Medicine Type) from item_category_master
        if (catRes && catRes.ok) {
          const catData = await catRes.json().catch(() => ({}));
          const catRows = catData.rows || [];
          const fetchedCats = catRows
            .map((r: any) => String(r.group_name || r.groupName || r.name || r.item_category || "").trim())
            .filter(Boolean);

          // Merge with categories from loaded medicines and fallbacks
          const medCats = loadedMedicines.map((m) => m.type).filter(Boolean);
          const mergedCats = Array.from(new Set([...fetchedCats, ...medCats, ...FALLBACK_MEDICINE_TYPE_OPTIONS]));
          if (mergedCats.length > 0 && isMounted) {
            setMedicineTypeOptions(mergedCats);
          }
        } else if (loadedMedicines.length > 0 && isMounted) {
          const medCats = loadedMedicines.map((m) => m.type).filter(Boolean);
          setMedicineTypeOptions(Array.from(new Set([...medCats, ...FALLBACK_MEDICINE_TYPE_OPTIONS])));
        }

        // Process Item UOM from uom_master
        if (uomRes && uomRes.ok) {
          const uomData = await uomRes.json().catch(() => ({}));
          const uomRows = uomData.rows || [];
          const fetchedUoms = uomRows
            .map((r: any) => {
              const code = String(r.uom_code || r.uomCode || r.name || r.code || "").trim();
              return code;
            })
            .filter(Boolean);

          const medUoms = loadedMedicines.map((m) => m.uom).filter(Boolean);
          const mergedUoms = Array.from(new Set([...fetchedUoms, ...medUoms, ...FALLBACK_UOM_OPTIONS]));
          if (mergedUoms.length > 0 && isMounted) {
            setUomOptions(mergedUoms);
          }
        } else if (loadedMedicines.length > 0 && isMounted) {
          const medUoms = loadedMedicines.map((m) => m.uom).filter(Boolean);
          setUomOptions(Array.from(new Set([...medUoms, ...FALLBACK_UOM_OPTIONS])));
        }
      } catch (err) {
        console.error("Failed to load medicines/UOMs/categories", err);
      } finally {
        if (isMounted) {
          setIsLoadingMedicines(false);
        }
      }
    }

    void loadData();
    return () => {
      isMounted = false;
    };
  }, [hname]);

  // Close medicine autocomplete dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        autocompleteContainerRef.current &&
        !autocompleteContainerRef.current.contains(e.target as Node)
      ) {
        setShowMedicineSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtered medicines for autocomplete (prefix match first, then substring)
  const matchingMedicines = useMemo(() => {
    const q = medicineSearchQuery.trim().toLowerCase();
    if (!q) return [];
    const startsWithMatches: Medicine[] = [];
    const containsMatches: Medicine[] = [];

    for (const m of medicines) {
      const name = m.name.toLowerCase();
      const code = m.code.toLowerCase();
      const generic = m.genericName.toLowerCase();

      if (name.startsWith(q) || code.startsWith(q)) {
        startsWithMatches.push(m);
      } else if (name.includes(q) || code.includes(q) || generic.includes(q)) {
        containsMatches.push(m);
      }
    }

    return [...startsWithMatches, ...containsMatches].slice(0, 10);
  }, [medicines, medicineSearchQuery]);

  // Open modal in "Add" mode
  const handleOpenAddModal = () => {
    if (isSended) return;
    const initial = emptyFormState(medicineTypeOptions[0] || "Tablet", uomOptions[0] || "Tabs");
    setModalForm(initial);
    setMedicineSearchQuery("");
    setShowMedicineSuggestions(false);
    setFormError("");
    setIsModalOpen(true);
  };

  // Open modal in "Edit" mode
  const handleOpenEditModal = (row: PrescriptionRow) => {
    if (isSended) return;
    setModalForm({
      id: row.id,
      name: row.medicine.name,
      code: row.medicine.code,
      genericName: row.medicine.genericName,
      type: row.medicine.type || medicineTypeOptions[0] || "Tablet",
      uom: row.medicine.uom || uomOptions[0] || "Tabs",
      strength: row.medicine.strength || "",
      morning: row.schedule.morning,
      afternoon: row.schedule.afternoon,
      night: row.schedule.night,
      foodTiming: row.foodTiming || DEFAULT_FOOD_TIMING,
      days: row.days || "5",
      totalQty: row.totalQty || calculateTotalQty(row.schedule, row.days),
      stock: row.medicine.stock,
    });
    setMedicineSearchQuery(row.medicine.name);
    setShowMedicineSuggestions(false);
    setFormError("");
    setIsModalOpen(true);
  };

  // When medicine is selected from suggestions
  const handleSelectMedicine = (med: Medicine) => {
    setModalForm((prev) => {
      const updated = {
        ...prev,
        name: med.name,
        code: med.code,
        genericName: med.genericName,
        type: med.type || prev.type || medicineTypeOptions[0] || "Tablet",
        uom: med.uom || prev.uom || uomOptions[0] || "Tabs",
        strength: med.strength || prev.strength || "",
        stock: med.stock,
      };
      const schedule = {
        morning: updated.morning,
        afternoon: updated.afternoon,
        night: updated.night,
      };
      updated.totalQty = calculateTotalQty(schedule, updated.days);
      return updated;
    });
    setMedicineSearchQuery(med.name);
    setShowMedicineSuggestions(false);
  };

  // Auto-calculate quantity on days / schedule changes in modal
  const handleModalScheduleChange = (
    key: "morning" | "afternoon" | "night",
    value: boolean
  ) => {
    setModalForm((prev) => {
      const schedule = {
        morning: key === "morning" ? value : prev.morning,
        afternoon: key === "afternoon" ? value : prev.afternoon,
        night: key === "night" ? value : prev.night,
      };
      return {
        ...prev,
        [key]: value,
        totalQty: calculateTotalQty(schedule, prev.days),
      };
    });
  };

  const handleModalDaysChange = (daysVal: string) => {
    setModalForm((prev) => {
      const schedule = {
        morning: prev.morning,
        afternoon: prev.afternoon,
        night: prev.night,
      };
      return {
        ...prev,
        days: daysVal,
        totalQty: calculateTotalQty(schedule, daysVal),
      };
    });
  };

  // Save Modal Form (Add or Edit) - Prevent any form reload!
  const handleSaveModal = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const medName = modalForm.name.trim() || medicineSearchQuery.trim();
    if (!medName) {
      setFormError("Please enter or select a medicine name.");
      return;
    }

    const schedule = {
      morning: modalForm.morning,
      afternoon: modalForm.afternoon,
      night: modalForm.night,
    };

    const finalTotalQty =
      modalForm.totalQty.trim() || calculateTotalQty(schedule, modalForm.days) || "1";

    const medicineObj: Medicine = {
      id: modalForm.code || modalForm.id || `med-${Date.now()}`,
      code: modalForm.code,
      name: medName,
      genericName: modalForm.genericName.trim(),
      type: modalForm.type.trim() || medicineTypeOptions[0] || "Tablet",
      strength: modalForm.strength.trim(),
      uom: modalForm.uom.trim() || uomOptions[0] || "Tabs",
      stock: modalForm.stock ?? 0,
    };

    if (modalForm.id) {
      // Edit existing row
      const updatedRows = rows.map((r) =>
        r.id === modalForm.id
          ? {
              ...r,
              medicine: medicineObj,
              schedule,
              foodTiming: modalForm.foodTiming,
              days: modalForm.days,
              totalQty: finalTotalQty,
            }
          : r
      );
      setRows(updatedRows);
      onChange?.(serializeRows(updatedRows));
    } else {
      // Add new row
      const newRow: PrescriptionRow = {
        id: crypto.randomUUID(),
        medicine: medicineObj,
        schedule,
        foodTiming: modalForm.foodTiming,
        days: modalForm.days,
        totalQty: finalTotalQty,
      };
      const updatedRows = [...rows, newRow];
      setRows(updatedRows);
      onChange?.(serializeRows(updatedRows));
    }

    setIsModalOpen(false);
  };

  // Delete row
  const handleDeleteRow = (rowId: string) => {
    if (isSended) return;
    const updatedRows = rows.filter((r) => r.id !== rowId);
    setRows(updatedRows);
    onChange?.(serializeRows(updatedRows));
  };

  return (
    <div className="mt-6 space-y-4">
      {/* Header and Top Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-gray-800 dark:text-white/90">
            Prescription Table
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {rows.length} {rows.length === 1 ? "medicine" : "medicines"} prescribed
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isSended && onSendToPharmacy && (
            <button
              type="button"
              onClick={onSendToPharmacy}
              disabled={isSubmitting || rows.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-500 bg-white px-3.5 py-2 text-xs font-semibold text-brand-600 shadow-xs hover:bg-brand-50 transition disabled:opacity-50 dark:bg-gray-900 dark:hover:bg-gray-800"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Send to Pharmacy
            </button>
          )}
          {isSended ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/40">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Sent to Pharmacy
            </span>
          ) : (
            <button
              type="button"
              onClick={handleOpenAddModal}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-brand-600 disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Medicine
            </button>
          )}
        </div>
      </div>

      {/* Clean Read-only Prescription Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-xs dark:divide-gray-800">
            <thead className="bg-gray-50/80 font-semibold uppercase tracking-wider text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
              <tr>
                <th scope="col" className="w-8 px-2.5 py-2 text-center">#</th>
                <th scope="col" className="px-2.5 py-2">Medicine Name</th>
                <th scope="col" className="px-2.5 py-2">Type</th>
                <th scope="col" className="px-2.5 py-2">Generic Name</th>
                <th scope="col" className="px-2.5 py-2">UOM</th>
                <th scope="col" className="px-2.5 py-2">Strength</th>
                <th scope="col" className="px-2.5 py-2">Schedule</th>
                <th scope="col" className="px-2.5 py-2">Food Timing</th>
                <th scope="col" className="px-2.5 py-2 text-center">Days</th>
                <th scope="col" className="px-2.5 py-2 text-center">Total Qty</th>
                {!isSended && <th scope="col" className="w-16 px-2.5 py-2 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={isSended ? 10 : 11}
                    className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    <div className="mx-auto flex max-w-sm flex-col items-center justify-center">
                      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-900/20">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                      </div>
                      <p className="font-medium text-gray-700 dark:text-gray-200">No medicines prescribed yet</p>
                      <p className="mt-1 text-xs text-gray-400">
                        Click &ldquo;Add Medicine&rdquo; to prescribe medication for this patient.
                      </p>
                      {!isSended && (
                        <button
                          type="button"
                          onClick={handleOpenAddModal}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-brand-600 transition"
                        >
                          + Add Medicine
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => {
                  return (
                    <tr
                      key={row.id}
                      className="group transition hover:bg-gray-50/70 dark:hover:bg-gray-800/40"
                    >
                      {/* Line Number */}
                      <td className="px-2.5 py-2 text-center text-xs font-medium text-gray-400 dark:text-gray-500">
                        {index + 1}
                      </td>

                      {/* Medicine Name */}
                      <td className="px-2.5 py-2 font-medium text-gray-900 dark:text-white">
                        {row.medicine.name || "—"}
                      </td>

                      {/* Medicine Type */}
                      <td className="px-2.5 py-2 text-gray-600 dark:text-gray-300">
                        {row.medicine.type || "Tablet"}
                      </td>

                      {/* Generic Name */}
                      <td className="px-2.5 py-2 text-gray-600 dark:text-gray-300">
                        {row.medicine.genericName || "—"}
                      </td>

                      {/* UOM */}
                      <td className="px-2.5 py-2 text-gray-700 dark:text-gray-300">
                        {row.medicine.uom || "Tabs"}
                      </td>

                      {/* Strength */}
                      <td className="px-2.5 py-2 text-gray-600 dark:text-gray-300">
                        {row.medicine.strength || "—"}
                      </td>

                      {/* Dosage Schedule */}
                      <td className="px-2.5 py-2">
                        <div className="flex flex-wrap items-center gap-1">
                          {row.schedule.morning && (
                            <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40">
                              Morning
                            </span>
                          )}
                          {row.schedule.afternoon && (
                            <span className="inline-flex items-center rounded-md bg-orange-50 px-1.5 py-0.5 text-[11px] font-medium text-orange-800 border border-orange-200/60 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/40">
                              Afternoon
                            </span>
                          )}
                          {row.schedule.night && (
                            <span className="inline-flex items-center rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-800 border border-indigo-200/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/40">
                              Night
                            </span>
                          )}
                          {!row.schedule.morning && !row.schedule.afternoon && !row.schedule.night && (
                            <span className="text-gray-400">As needed</span>
                          )}
                        </div>
                      </td>

                      {/* Food Timing */}
                      <td className="px-2.5 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {row.foodTiming || DEFAULT_FOOD_TIMING}
                      </td>

                      {/* Days */}
                      <td className="px-2.5 py-2 text-center font-medium text-gray-800 dark:text-gray-200">
                        {row.days ? `${row.days} d` : "—"}
                      </td>

                      {/* Total Qty */}
                      <td className="px-2.5 py-2 text-center font-bold text-brand-600 dark:text-brand-400">
                        {row.totalQty || "—"}
                      </td>

                      {/* Actions */}
                      {!isSended && (
                        <td className="px-2.5 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(row)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                              title="Edit Medicine"
                            >
                              <PencilIcon className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(row.id)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-red-500 transition hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:border-gray-700 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-950/30"
                              title="Delete Medicine"
                            >
                              <TrashBinIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Prescription Modal Dialog (Using div, not form, to prevent page reloads) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900 border border-gray-100 dark:border-gray-800 animate-fadeIn my-8">
            {/* Modal Header */}
            <div className="mb-5 flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {modalForm.id ? "Edit Prescription Item" : "Add Medicine to Prescription"}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Search medicine or enter custom prescription details
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
                {formError}
              </div>
            )}

            {/* Modal Form Content */}
            <div className="space-y-4">
              {/* Medicine Name with Autocomplete */}
              <div className="relative" ref={autocompleteContainerRef}>
                <label className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Medicine Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Type starting letters (e.g. Paracetamol, Amoxicillin)..."
                    value={medicineSearchQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMedicineSearchQuery(val);
                      setModalForm((prev) => ({ ...prev, name: val }));
                      setShowMedicineSuggestions(val.trim().length > 0);
                    }}
                    onFocus={() => {
                      if (medicineSearchQuery.trim().length > 0) {
                        setShowMedicineSuggestions(true);
                      }
                    }}
                    className="h-11 w-full rounded-xl border border-gray-300 bg-white px-4 pr-10 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                  <span className="absolute right-3.5 top-3 text-gray-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                </div>

                {/* Suggestions Dropdown */}
                {showMedicineSuggestions && matchingMedicines.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-2xl dark:border-gray-700 dark:bg-gray-800">
                    <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      Medicines starting with &ldquo;{medicineSearchQuery}&rdquo;
                    </div>
                    {matchingMedicines.map((med) => (
                      <div
                        key={med.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectMedicine(med);
                        }}
                        className="flex cursor-pointer items-center justify-between px-3.5 py-2.5 hover:bg-brand-50/80 dark:hover:bg-brand-900/20 transition"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-gray-900 dark:text-white">
                              {med.name}
                            </span>
                            {med.type && (
                              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                {med.type}
                              </span>
                            )}
                          </div>
                          {med.genericName && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {med.genericName}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
                            {med.uom || "Tabs"}
                          </span>
                          {med.stock !== undefined && (
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              Stock: {med.stock}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Grid 1: Medicine Type (Item Category), Generic Name, UOM, Strength */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                {/* Medicine Type (Dynamically loaded from Item Category Master) */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Medicine Type
                  </label>
                  <select
                    value={modalForm.type}
                    onChange={(e) => setModalForm((prev) => ({ ...prev, type: e.target.value }))}
                    className="h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    {medicineTypeOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {/* UOM Dropdown (Dynamically loaded from UOM Master) */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    UOM (Unit) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={modalForm.uom}
                    onChange={(e) => setModalForm((prev) => ({ ...prev, uom: e.target.value }))}
                    className="h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    {uomOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Strength */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Strength (e.g. 500mg)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 500 mg / 10 ml"
                    value={modalForm.strength}
                    onChange={(e) => setModalForm((prev) => ({ ...prev, strength: e.target.value }))}
                    className="h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                {/* Generic Name */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Generic Name
                  </label>
                  <input
                    type="text"
                    placeholder="Generic salt / name"
                    value={modalForm.genericName}
                    onChange={(e) => setModalForm((prev) => ({ ...prev, genericName: e.target.value }))}
                    className="h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Meaningful Schedule / Dosage Selector (Morning, Afternoon, Night) */}
              <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-800/40">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Dosage Timing (Schedule)
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {/* Morning Toggle */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleModalScheduleChange("morning", !modalForm.morning);
                    }}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold transition ${
                      modalForm.morning
                        ? "border-amber-400 bg-amber-50 text-amber-900 shadow-xs dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-200"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  >
                    <span>Morning</span>
                    <span
                      className={`ml-auto flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                        modalForm.morning
                          ? "bg-amber-500 text-white"
                          : "border border-gray-300 text-transparent dark:border-gray-600"
                      }`}
                    >
                      ✓
                    </span>
                  </button>

                  {/* Afternoon Toggle */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleModalScheduleChange("afternoon", !modalForm.afternoon);
                    }}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold transition ${
                      modalForm.afternoon
                        ? "border-orange-400 bg-orange-50 text-orange-900 shadow-xs dark:border-orange-600 dark:bg-orange-950/40 dark:text-orange-200"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  >
                    <span>Afternoon</span>
                    <span
                      className={`ml-auto flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                        modalForm.afternoon
                          ? "bg-orange-500 text-white"
                          : "border border-gray-300 text-transparent dark:border-gray-600"
                      }`}
                    >
                      ✓
                    </span>
                  </button>

                  {/* Night Toggle */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleModalScheduleChange("night", !modalForm.night);
                    }}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold transition ${
                      modalForm.night
                        ? "border-indigo-400 bg-indigo-50 text-indigo-900 shadow-xs dark:border-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-200"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  >
                    <span>Night</span>
                    <span
                      className={`ml-auto flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                        modalForm.night
                          ? "bg-indigo-600 text-white"
                          : "border border-gray-300 text-transparent dark:border-gray-600"
                      }`}
                    >
                      ✓
                    </span>
                  </button>
                </div>
              </div>

              {/* Grid 2: Food Timings, No of Days, Total Qty */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {/* Food Timing */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Food Timing
                  </label>
                  <select
                    value={modalForm.foodTiming}
                    onChange={(e) => setModalForm((prev) => ({ ...prev, foodTiming: e.target.value }))}
                    className="h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    {FOOD_TIMING_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {/* No. of Days */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Number of Days
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={modalForm.days}
                    onChange={(e) => handleModalDaysChange(e.target.value)}
                    className="h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                {/* Total Quantity */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Total Quantity ({modalForm.uom || "Units"})
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={modalForm.totalQty}
                    onChange={(e) => setModalForm((prev) => ({ ...prev, totalQty: e.target.value }))}
                    className="h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm font-bold text-brand-600 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-brand-400"
                    placeholder="Auto"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSaveModal(e)}
                  className="rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-brand-600 transition"
                >
                  {modalForm.id ? "Update Medicine" : "Add to Prescription"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
