"use client";

import { useEffect, useMemo, useState } from "react";
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
  frequency: string;
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
  frequency: string;
  foodTiming: string;
  days: string;
  totalQty: string;
};

type PrescriptionTableProps = {
  value?: string;
  onChange?: (value: string) => void;
};

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

function serializeRows(rows: PrescriptionRow[]): string {
  const serializedRows: SerializedPrescriptionLine[] = rows.map((row) => ({
    medicineName: row.medicine.name || row.medicine.genericName,
    genericName: row.medicine.genericName,
    medicineType: row.medicine.type,
    strength: row.medicine.strength,
    uom: row.medicine.uom,
    frequency: row.frequency,
    foodTiming: row.foodTiming,
    days: row.days,
    totalQty: row.totalQty,
  }));

  return JSON.stringify(serializedRows);
}

function parseRows(value?: string): PrescriptionRow[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((item) => {
      const line = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};

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
        frequency: typeof line.frequency === "string" ? line.frequency : "",
        foodTiming: typeof line.foodTiming === "string" ? line.foodTiming : "",
        days: typeof line.days === "string" ? line.days : "",
        totalQty:
          typeof line.totalQty === "string"
            ? line.totalQty
            : typeof line.prescribedQty === "string"
              ? line.prescribedQty
              : "",
      };
    });
  } catch {
    return [];
  }
}

export function PrescriptionTable({ value = "", onChange }: PrescriptionTableProps) {
  const params = useParams();
  const hname = params?.Hname as string;
  const [rows, setRows] = useState<PrescriptionRow[]>(() => parseRows(value));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isLoadingMedicines, setIsLoadingMedicines] = useState(true);
  const [medicineLoadError, setMedicineLoadError] = useState<string | null>(null);
  
  // Modal state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    let isMounted = true;

    async function loadMedicines() {
      if (!hname) {
        return;
      }

      setIsLoadingMedicines(true);
      setMedicineLoadError(null);

      try {
        const response = await fetch(`/api/${hname}/forms/item_master_medicine`, {
          method: "GET",
          cache: "no-store",
        });
        const data = (await response.json()) as {
          rows?: ItemMasterRow[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load medicines from item master.");
        }

        const nextMedicines = (data.rows ?? [])
          .map((row, index) => {
            const code = String(row.item_code ?? "").trim();
            const name = String(row.item_name ?? "").trim();

            if (!name) {
              return null;
            }

            return {
              id: String((row.id ?? code) || `medicine-${index}`),
              code,
              name,
              genericName: String(row.medicine_combination ?? "").trim(),
              type: String(row.item_category ?? "").trim(),
              strength: "",
              uom: String(row.sale_uom ?? row.purchase_uom ?? "").trim(),
              stock: Number(row.current_stock ?? 0) || 0,
            } satisfies Medicine;
          })
          .filter((medicine): medicine is Medicine => medicine !== null);

        if (isMounted) {
          setMedicines(nextMedicines);
        }
      } catch (error) {
        if (isMounted) {
          setMedicineLoadError(
            error instanceof Error
              ? error.message
              : "Failed to load medicines from item master.",
          );
          setMedicines([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingMedicines(false);
        }
      }
    }

    void loadMedicines();

    return () => {
      isMounted = false;
    };
  }, [hname]);

  const filteredMedicines = useMemo(() => {
    return medicines.filter(
      (m) =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.genericName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [medicines, searchQuery]);

  const totalPages = Math.ceil(filteredMedicines.length / itemsPerPage);
  const currentMedicines = filteredMedicines.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1); // Reset to first page on search
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleAllSelections = () => {
    if (selectedIds.size === currentMedicines.length && currentMedicines.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentMedicines.map(m => m.id)));
    }
  };

  const addSelectedMedicines = () => {
    const medicinesToAdd = medicines.filter((m) => selectedIds.has(m.id));
    const newRows: PrescriptionRow[] = medicinesToAdd.map((m) => ({
      id: crypto.randomUUID(),
      medicine: m,
      frequency: "",
      foodTiming: "",
      days: "",
      totalQty: "",
    }));
    
    const updatedRows = [...rows, ...newRows];
    setRows(updatedRows);
    onChange?.(serializeRows(updatedRows));
    setIsModalOpen(false);
    setSelectedIds(new Set());
    setSearchQuery("");
    setCurrentPage(1);
  };

  const addEmptyRow = () => {
    const rowId = crypto.randomUUID();
    const emptyRow: PrescriptionRow = {
      id: rowId,
      medicine: buildEmptyMedicine(),
      frequency: "",
      foodTiming: "",
      days: "",
      totalQty: "",
    };
    const updatedRows = [...rows, emptyRow];
    setRows(updatedRows);
    onChange?.(serializeRows(updatedRows));
    setEditingRowId(rowId);
  };

  const deleteRow = (rowId: string) => {
    setRows((currentRows) => {
      const updatedRows = currentRows.filter((row) => row.id !== rowId);
      onChange?.(serializeRows(updatedRows));
      return updatedRows;
    });
    setEditingRowId((currentEditingId) =>
      currentEditingId === rowId ? null : currentEditingId
    );
  };

  const editRow = (rowId: string) => {
    setEditingRowId((currentEditingId) =>
      currentEditingId === rowId ? null : rowId
    );
  };

  const updateRowField = (
    rowId: string,
    field: keyof Pick<PrescriptionRow, "frequency" | "foodTiming" | "days" | "totalQty">,
    value: string
  ) => {
    const nextValue =
      (field === "days" || field === "totalQty") && value !== ""
        ? String(Math.max(0, Number(value)))
        : value;

    setRows((currentRows) => {
      const updatedRows = currentRows.map((row) =>
        row.id === rowId ? { ...row, [field]: nextValue } : row
      );
      onChange?.(serializeRows(updatedRows));
      return updatedRows;
    });
  };

  const updateMedicineField = (
    rowId: string,
    field: keyof Pick<Medicine, "type" | "genericName" | "uom" | "strength">,
    value: string
  ) => {
    setRows((currentRows) => {
      const updatedRows = currentRows.map((row) =>
        row.id === rowId
          ? { ...row, medicine: { ...row.medicine, [field]: value } }
          : row
      );
      onChange?.(serializeRows(updatedRows));
      return updatedRows;
    });
  };

  const editableInputClass = (minWidth: string, isEditing: boolean) =>
    `w-full ${minWidth} rounded-md border px-3 py-1.5 text-sm dark:border-gray-700 ${
      isEditing
        ? "border-gray-300 bg-transparent focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:bg-gray-900"
        : "border-gray-300 bg-gray-50 text-gray-700 dark:bg-gray-900/50 dark:text-gray-300"
    }`;

  const lineNumberInputClass =
    "w-12 rounded-md border border-gray-300 bg-gray-50 px-2 py-1.5 text-center text-sm dark:border-gray-700 dark:bg-gray-900/50";

  const actionButtonClass =
    "inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white";
  const deleteButtonClass =
    "inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-100 bg-white text-red-500 transition hover:bg-red-50 hover:text-red-600 focus:outline-hidden focus:ring-2 focus:ring-red-500/30 dark:border-red-900/40 dark:bg-gray-900 dark:text-red-400 dark:hover:bg-red-950/30";

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-800 dark:text-white/90">
          Prescription Line Item Table
        </h4>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Medicine
        </button>
      </div>
      
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Line No</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Medicine Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Medicine Type</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Generic Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">UOM</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Strength</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">M/A/N</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Food Timings</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">No of Days</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Total Qty</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-transparent">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  No medicines added yet. Click Add Medicine to select.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const isEditing = editingRowId === row.id;

                return (
                  <tr key={row.id}>
                    <td className="px-4 py-2">
                      <input type="text" readOnly value={index + 1} className={lineNumberInputClass} />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        readOnly
                        value={row.medicine.name}
                        placeholder="Selected medicine name"
                        className={editableInputClass("min-w-[160px]", false)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        readOnly={!isEditing}
                        value={row.medicine.type}
                        onChange={(e) => updateMedicineField(row.id, "type", e.target.value)}
                        className={editableInputClass("min-w-[120px]", isEditing)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        readOnly={!isEditing}
                        value={row.medicine.genericName}
                        onChange={(e) => updateMedicineField(row.id, "genericName", e.target.value)}
                        className={editableInputClass("min-w-[120px]", isEditing)}
                        placeholder={row.medicine.name || "Generic name"}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        readOnly={!isEditing}
                        value={row.medicine.uom}
                        onChange={(e) => updateMedicineField(row.id, "uom", e.target.value)}
                        className={editableInputClass("min-w-[80px]", isEditing)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        readOnly={!isEditing}
                        value={row.medicine.strength}
                        onChange={(e) => updateMedicineField(row.id, "strength", e.target.value)}
                        className={editableInputClass("min-w-[80px]", isEditing)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        readOnly={!isEditing}
                        placeholder="e.g. 1-0-1"
                        value={row.frequency}
                        onChange={(e) => updateRowField(row.id, "frequency", e.target.value)}
                        className={editableInputClass("min-w-[80px]", isEditing)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        readOnly={!isEditing}
                        placeholder="Before Food"
                        value={row.foodTiming}
                        onChange={(e) => updateRowField(row.id, "foodTiming", e.target.value)}
                        className={editableInputClass("min-w-[120px]", isEditing)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min={0}
                        readOnly={!isEditing}
                        value={row.days}
                        onChange={(e) => updateRowField(row.id, "days", e.target.value)}
                        className={editableInputClass("min-w-[80px]", isEditing)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min={0}
                        readOnly={!isEditing}
                        value={row.totalQty}
                        onChange={(e) => updateRowField(row.id, "totalQty", e.target.value)}
                        className={editableInputClass("min-w-[80px]", isEditing)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => editRow(row.id)}
                          className={`${actionButtonClass} ${isEditing ? "border-brand-200 text-brand-600 dark:border-brand-500/40 dark:text-brand-400" : ""}`}
                          aria-label={`${isEditing ? "Finish editing" : "Edit"} prescription row ${index + 1}`}
                          title={isEditing ? "Finish editing" : "Edit"}
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteRow(row.id)}
                          className={deleteButtonClass}
                          aria-label={`Delete prescription row ${index + 1}`}
                          title="Delete"
                        >
                          <TrashBinIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add Row Button Below Table */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={addEmptyRow}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Row
        </button>
      </div>

      {/* Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-xl bg-white shadow-2xl dark:bg-gray-900">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 p-5 dark:border-gray-800">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Select Medicines</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex flex-1 flex-col overflow-hidden p-5">
              <div className="mb-4 flex items-center gap-4">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Search by medicine code or name"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="h-10 w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-hidden focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:text-white"
                  />
                </div>
              </div>

              {medicineLoadError ? (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
                  {medicineLoadError}
                </div>
              ) : null}

              <div className="flex-1 overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
                <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/80 backdrop-blur-md">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                          checked={selectedIds.size === currentMedicines.length && currentMedicines.length > 0}
                          onChange={toggleAllSelections}
                        />
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Medicine Code</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Medicine Name</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Generic Name</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Medicine Type</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Strength</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">UOM</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Stock Available</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-transparent">
                    {isLoadingMedicines ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                          Loading medicines from Item Master...
                        </td>
                      </tr>
                    ) : currentMedicines.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No medicines found in Item Master.</td>
                      </tr>
                    ) : (
                      currentMedicines.map((medicine) => (
                        <tr 
                          key={medicine.id} 
                          onClick={() => toggleSelection(medicine.id)}
                          className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        >
                          <td className="px-4 py-3">
                            <input 
                              type="checkbox" 
                              className="rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                              checked={selectedIds.has(medicine.id)}
                              onChange={() => toggleSelection(medicine.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className="px-4 py-3 text-gray-900 dark:text-gray-300">{medicine.code}</td>
                          <td className="px-4 py-3 text-gray-900 dark:text-gray-300">{medicine.name}</td>
                          <td className="px-4 py-3 text-gray-900 dark:text-gray-300">{medicine.genericName}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{medicine.type}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{medicine.strength}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{medicine.uom}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-300">{medicine.stock}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-800">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredMedicines.length)} to {Math.min(currentPage * itemsPerPage, filteredMedicines.length)} of {filteredMedicines.length} items
                </span>
                
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300"
                  >
                    Prev
                  </button>
                  
                  {Array.from({ length: Math.min(3, totalPages) }).map((_, idx) => {
                    // Simple logic to show a few page numbers centered currently around currentPage if possible
                    let pageNum = currentPage;
                    if (currentPage === 1) pageNum = idx + 1;
                    else if (currentPage === totalPages && totalPages > 2) pageNum = totalPages - 2 + idx;
                    else pageNum = currentPage - 1 + idx;

                    if (pageNum > totalPages || pageNum < 1) return null;

                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`min-w-[32px] rounded border px-2 py-1.5 text-sm font-medium ${
                          currentPage === pageNum 
                            ? 'border-brand-500 bg-brand-500 text-white' 
                            : 'border-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 p-5 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addSelectedMedicines}
                disabled={selectedIds.size === 0}
                className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
              >
                Add Selected ({selectedIds.size})
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
