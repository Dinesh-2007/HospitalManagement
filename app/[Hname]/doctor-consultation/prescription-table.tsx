"use client";

import { useState, useMemo } from "react";
import { PlusIcon } from "../../../components/icons/plus"; // Checking if plus icon exists

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

const MOCK_MEDICINES: Medicine[] = Array.from({ length: 45 }).map((_, i) => ({
  id: `M${i + 1}`,
  code: `MED-${String(i + 1).padStart(3, "0")}`,
  name: `Medicine ${i + 1}`,
  genericName: `Generic ${i + 1}`,
  type: i % 2 === 0 ? "Tablet" : "Syrup",
  strength: i % 3 === 0 ? "500mg" : "250mg",
  uom: "Nos",
  stock: Math.floor(Math.random() * 500) + 10,
}));

type PrescriptionRow = {
  id: string;
  medicine: Medicine;
  frequency: string;
  foodTiming: string;
  days: string;
  totalQty: string;
};

export function PrescriptionTable() {
  const [rows, setRows] = useState<PrescriptionRow[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Modal state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredMedicines = useMemo(() => {
    return MOCK_MEDICINES.filter(
      (m) =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.genericName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

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
    const medicinesToAdd = MOCK_MEDICINES.filter((m) => selectedIds.has(m.id));
    const newRows: PrescriptionRow[] = medicinesToAdd.map((m) => ({
      id: crypto.randomUUID(),
      medicine: m,
      frequency: "",
      foodTiming: "",
      days: "",
      totalQty: "",
    }));
    
    setRows([...rows, ...newRows]);
    setIsModalOpen(false);
    setSelectedIds(new Set());
    setSearchQuery("");
    setCurrentPage(1);
  };

  const addEmptyRow = () => {
    const emptyRow: PrescriptionRow = {
      id: crypto.randomUUID(),
      medicine: {
        id: "",
        code: "",
        name: "",
        genericName: "",
        type: "",
        strength: "",
        uom: "",
        stock: 0,
      },
      frequency: "",
      foodTiming: "",
      days: "",
      totalQty: "",
    };
    setRows([...rows, emptyRow]);
  };

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
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Medicine Type</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Generic Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">UOM</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Strength</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">M/A/N</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Food Timings</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">No of Days</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Total Qty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-transparent">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  No medicines added yet. Click "Add Medicine" to select.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.id}>
                  <td className="px-4 py-2">
                    <input type="text" readOnly value={index + 1} className="w-12 rounded-md border border-gray-300 bg-gray-50 px-2 py-1.5 text-center text-sm dark:border-gray-700 dark:bg-gray-900/50" />
                  </td>
                  <td className="px-4 py-2"><input type="text" readOnly value={row.medicine.type} className="w-full min-w-[120px] rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900/50" /></td>
                  <td className="px-4 py-2"><input type="text" readOnly value={row.medicine.genericName} className="w-full min-w-[120px] rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900/50" /></td>
                  <td className="px-4 py-2"><input type="text" readOnly value={row.medicine.uom} className="w-full min-w-[80px] rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900/50" /></td>
                  <td className="px-4 py-2"><input type="text" readOnly value={row.medicine.strength} className="w-full min-w-[80px] rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900/50" /></td>
                  <td className="px-4 py-2">
                    <input 
                      type="text" 
                      placeholder="e.g. 1-0-1"
                      value={row.frequency}
                      onChange={(e) => {
                        const newRows = [...rows];
                        newRows[index].frequency = e.target.value;
                        setRows(newRows);
                      }}
                      className="w-full min-w-[80px] rounded-md border border-gray-300 bg-transparent px-3 py-1.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900" 
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input 
                      type="text" 
                      placeholder="Before Food"
                      value={row.foodTiming}
                      onChange={(e) => {
                        const newRows = [...rows];
                        newRows[index].foodTiming = e.target.value;
                        setRows(newRows);
                      }}
                      className="w-full min-w-[120px] rounded-md border border-gray-300 bg-transparent px-3 py-1.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900" 
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input 
                      type="number" 
                      value={row.days}
                      onChange={(e) => {
                        const newRows = [...rows];
                        newRows[index].days = e.target.value;
                        setRows(newRows);
                      }}
                      className="w-full min-w-[80px] rounded-md border border-gray-300 bg-transparent px-3 py-1.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900" 
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input 
                      type="number" 
                      value={row.totalQty}
                      onChange={(e) => {
                        const newRows = [...rows];
                        newRows[index].totalQty = e.target.value;
                        setRows(newRows);
                      }}
                      className="w-full min-w-[80px] rounded-md border border-gray-300 bg-transparent px-3 py-1.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900" 
                    />
                  </td>
                </tr>
              ))
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
                    {currentMedicines.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No medicines found.</td>
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