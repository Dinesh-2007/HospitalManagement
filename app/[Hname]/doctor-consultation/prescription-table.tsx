"use client";

import { useState } from "react";
import { PlusIcon } from "../../../components/icons/plus"; // Checking if plus icon exists

export function PrescriptionTable() {
  const [rows, setRows] = useState([1]);

  const addRow = () => {
    setRows([...rows, rows.length + 1]);
  };

  return (
    <div className="mt-8 space-y-4">
      <h4 className="text-sm font-medium text-gray-800 dark:text-white/90">
        Prescription Line Item Table
      </h4>
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
            {rows.map((row, index) => (
              <tr key={index}>
                <td className="px-4 py-2">
                  <input type="text" readOnly value={index + 1} className="w-12 rounded-md border border-gray-300 bg-gray-50 px-2 py-1.5 text-center text-sm dark:border-gray-700 dark:bg-gray-900/50" />
                </td>
                <td className="px-4 py-2"><input type="text" className="w-full min-w-[120px] rounded-md border border-gray-300 bg-transparent px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" /></td>
                <td className="px-4 py-2"><input type="text" className="w-full min-w-[120px] rounded-md border border-gray-300 bg-transparent px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" /></td>
                <td className="px-4 py-2"><input type="text" className="w-full min-w-[80px] rounded-md border border-gray-300 bg-transparent px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" /></td>
                <td className="px-4 py-2"><input type="text" className="w-full min-w-[80px] rounded-md border border-gray-300 bg-transparent px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" /></td>
                <td className="px-4 py-2"><input type="text" className="w-full min-w-[80px] rounded-md border border-gray-300 bg-transparent px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" /></td>
                <td className="px-4 py-2"><input type="text" className="w-full min-w-[120px] rounded-md border border-gray-300 bg-transparent px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" /></td>
                <td className="px-4 py-2"><input type="number" className="w-full min-w-[80px] rounded-md border border-gray-300 bg-transparent px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" /></td>
                <td className="px-4 py-2"><input type="number" className="w-full min-w-[80px] rounded-md border border-gray-300 bg-transparent px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Row
        </button>
      </div>
    </div>
  );
}