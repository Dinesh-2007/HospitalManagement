"use client";

import { useState, useRef, useEffect } from "react";

type MultiSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
};

export function AssetMultiSelect({
  value,
  onChange,
  options,
  placeholder = "Select Equipment / Assets",
  className = "",
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse comma-separated string into selected array
  const selectedValues = value
    ? value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleOption = (option: string) => {
    let next: string[];
    if (selectedValues.includes(option)) {
      next = selectedValues.filter((v) => v !== option);
    } else {
      next = [...selectedValues, option];
    }
    onChange(next.join(", "));
  };

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-h-[32px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded px-2 py-1 text-xs cursor-pointer flex items-center justify-between gap-1 select-none"
      >
        <div className="flex flex-wrap gap-1 flex-1 overflow-hidden min-w-0">
          {selectedValues.length > 0 ? (
            selectedValues.map((val) => (
              <span
                key={val}
                className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded px-1.5 py-0.5 text-[10px] font-medium"
              >
                <span className="truncate max-w-[120px]">{val}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleOption(val);
                  }}
                  className="hover:text-blue-900 dark:hover:text-blue-100 font-bold ml-0.5"
                >
                  ×
                </button>
              </span>
            ))
          ) : (
            <span className="text-gray-400 dark:text-gray-500 text-[11px] truncate">
              {placeholder}
            </span>
          )}
        </div>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg p-2 text-xs">
          {options.length > 3 && (
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Search assets..."
              className="w-full mb-2 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          )}

          {filteredOptions.length > 0 ? (
            <div className="space-y-1">
              {filteredOptions.map((opt) => {
                const checked = selectedValues.includes(opt);
                return (
                  <label
                    key={opt}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer select-none text-slate-700 dark:text-slate-200"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOption(opt)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 shrink-0"
                    />
                    <span className="truncate">{opt}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="p-2 text-center text-gray-400 dark:text-gray-500 text-[11px]">
              No assets found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
