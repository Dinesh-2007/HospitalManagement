"use client";

import React, { FC, useEffect, useRef, useState } from "react";
import { defaultCountries, FlagImage } from "react-international-phone";
import { parsePhoneNumber } from "libphonenumber-js";
import "react-international-phone/style.css";
import { useHospitalTimezone } from "../context/HospitalTimezoneContext";

interface PhoneInputProps {
  id?: string;
  name?: string;
  value?: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  error?: boolean;
  /** Override the country from context */
  defaultCountry?: string;
}

type CountryItem = {
  name: string;
  iso2: string;
  dialCode: string; // e.g. "+91"
};

// Parse defaultCountries into a structured array
const ALL_COUNTRIES: CountryItem[] = defaultCountries.map((c) => ({
  name: c[0] as string,
  iso2: c[1] as string,
  dialCode: `+${c[2]}`,
}));

export const PhoneInputField: FC<PhoneInputProps> = ({
  id,
  name,
  value = "",
  onChange,
  required = false,
  disabled = false,
  placeholder,
  className = "",
  error = false,
  defaultCountry: overrideDefaultCountry,
}) => {
  const { country: hospitalCountry } = useHospitalTimezone();
  const [selectedIso2, setSelectedIso2] = useState<string>("in");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Set default country based on context or prop override
  useEffect(() => {
    if (overrideDefaultCountry) {
      setSelectedIso2(overrideDefaultCountry.toLowerCase());
      return;
    }
    if (hospitalCountry) {
      const found = ALL_COUNTRIES.find(
        (c) => c.name.toLowerCase() === hospitalCountry.toLowerCase()
      );
      if (found) {
        setSelectedIso2(found.iso2);
      }
    }
  }, [hospitalCountry, overrideDefaultCountry]);

  // Derive country from value if value starts with '+'
  useEffect(() => {
    if (value && value.startsWith("+")) {
      try {
        const parsed = parsePhoneNumber(value);
        if (parsed && parsed.country) {
          setSelectedIso2(parsed.country.toLowerCase());
        }
      } catch {
        // Fallback: match by prefix
        const found = ALL_COUNTRIES.find((c) => value.startsWith(c.dialCode));
        if (found) setSelectedIso2(found.iso2);
      }
    }
  }, [value]);

  // Get current country object
  const currentCountry =
    ALL_COUNTRIES.find((c) => c.iso2 === selectedIso2) ||
    ALL_COUNTRIES.find((c) => c.iso2 === "in")!;

  // Extract subscriber digits from value
  const getSubscriberNumber = (val: string, dialCode: string) => {
    if (!val) return "";
    if (val.startsWith(dialCode)) {
      return val.slice(dialCode.length).replace(/\D/g, "");
    }
    if (val.startsWith("+")) {
      // Strips leading country code if starts with +
      const match = ALL_COUNTRIES.find((c) => val.startsWith(c.dialCode));
      if (match) {
        return val.slice(match.dialCode.length).replace(/\D/g, "");
      }
    }
    return val.replace(/\D/g, "");
  };

  const subscriberNumber = getSubscriberNumber(value, currentCountry.dialCode);

  // Handle subscriber number input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawDigits = e.target.value.replace(/\D/g, "");
    const fullNumber = rawDigits ? `${currentCountry.dialCode}${rawDigits}` : "";
    onChange(fullNumber);
  };

  // Handle country selection
  const handleSelectCountry = (countryItem: CountryItem) => {
    setSelectedIso2(countryItem.iso2);
    setIsDropdownOpen(false);
    setSearchQuery("");
    const fullNumber = subscriberNumber
      ? `${countryItem.dialCode}${subscriberNumber}`
      : "";
    onChange(fullNumber);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter countries by search
  const filteredCountries = ALL_COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.dialCode.includes(searchQuery) ||
      c.iso2.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Base styling for the container and elements
  const borderClasses = error
    ? "border-error-500 focus-within:ring-error-500/10"
    : "border-gray-300 dark:border-gray-700 focus-within:border-brand-300 focus-within:ring-brand-500/10";

  return (
    <div ref={containerRef} className="relative flex w-full">
      {name && <input type="hidden" name={name} value={value} />}

      {/* Country Button on the Left displaying Flag AND Country Dial Code (+91) */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsDropdownOpen((prev) => !prev)}
        className={`flex h-11 items-center gap-1.5 rounded-l-xl border border-r-0 bg-gray-50 px-3 text-sm font-medium text-gray-700 shadow-theme-xs transition dark:bg-gray-800 dark:text-gray-200 ${
          disabled ? "cursor-not-allowed opacity-60" : "hover:bg-gray-100 dark:hover:bg-gray-750"
        } ${borderClasses}`}
        aria-label="Select country code"
      >
        <FlagImage iso2={currentCountry.iso2} style={{ width: "20px", height: "14px", borderRadius: "2px" }} />
        <span className="font-mono text-xs font-semibold text-gray-800 dark:text-gray-200">
          {currentCountry.dialCode}
        </span>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Phone Number Input Box (Subscriber digits only) */}
      <input
        id={id}
        type="tel"
        value={subscriberNumber}
        onChange={handleInputChange}
        required={required}
        disabled={disabled}
        placeholder={placeholder || "Phone number"}
        className={`h-11 w-full appearance-none rounded-r-xl border px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-none focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 ${
          disabled
            ? "cursor-not-allowed border-gray-300 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
            : borderClasses
        } ${className}`}
      />

      {/* Dropdown Menu for Country Selection */}
      {isDropdownOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-60 w-72 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-800 dark:bg-gray-900">
          <input
            type="text"
            placeholder="Search country or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-2 h-9 w-full rounded-lg border border-gray-200 px-3 text-xs focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            autoFocus
          />
          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {filteredCountries.length === 0 ? (
              <div className="p-2 text-xs text-gray-400 text-center">No country found</div>
            ) : (
              filteredCountries.map((c) => (
                <button
                  key={c.iso2}
                  type="button"
                  onClick={() => handleSelectCountry(c)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition ${
                    c.iso2 === currentCountry.iso2
                      ? "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FlagImage iso2={c.iso2} style={{ width: "18px", height: "12px", borderRadius: "2px" }} />
                    <span className="truncate">{c.name}</span>
                  </div>
                  <span className="font-mono text-gray-400 dark:text-gray-500 ml-2">{c.dialCode}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

