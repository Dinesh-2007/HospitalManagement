"use client";

import React, { FC, useEffect, useState } from "react";
import { PhoneInput, defaultCountries } from "react-international-phone";
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
  const { country } = useHospitalTimezone();
  const [defaultCountry, setDefaultCountry] = useState(overrideDefaultCountry || "in");

  useEffect(() => {
    if (overrideDefaultCountry) {
      setDefaultCountry(overrideDefaultCountry);
      return;
    }
    if (country) {
      // Find ISO code for the country name (defaultCountries format: [name, iso2, dialCode, ...])
      const found = defaultCountries.find((c) => c[0].toLowerCase() === country.toLowerCase());
      if (found) {
        setDefaultCountry(found[1] as string);
      }
    }
  }, [country]);

  // Determine input styles based on state (similar to InputField)
  let inputClasses = `h-11 w-full appearance-none rounded-r-xl border border-l-0 px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 ${className}`;

  if (disabled) {
    inputClasses += ` text-gray-500 border-gray-300 cursor-not-allowed dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700`;
  } else if (error) {
    inputClasses += ` text-error-800 border-error-500 focus:ring-3 focus:ring-error-500/10  dark:text-error-400 dark:border-error-500`;
  } else {
    inputClasses += ` bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800`;
  }

  // Country selector styles
  const countrySelectorClasses = `h-11 rounded-l-xl border shadow-theme-xs ${error ? "border-error-500" : "border-gray-300 dark:border-gray-700"
    } bg-gray-50 dark:bg-gray-800`;

  return (
    <div className="relative flex">
      {/* Hidden input for native form submission */}
      {name && <input type="hidden" name={name} value={value} />}

      {/* We use inline styles via style props to override react-international-phone defaults 
          and let Tailwind handle the actual appearance via classNames. */}
      <PhoneInput
        defaultCountry={defaultCountry}
        value={value}
        onChange={(phone) => onChange(phone)}
        disabled={disabled}
        inputProps={{
          id,
          required,
          placeholder: placeholder || "Phone number",
          className: inputClasses,
          style: { width: "100%", height: "100%", border: "none", outline: "none" }
        }}
        countrySelectorStyleProps={{
          buttonClassName: countrySelectorClasses,
          buttonStyle: { height: "100%", border: "none", backgroundColor: "transparent" },
          dropdownStyleProps: { style: { zIndex: 50 } } // Ensure dropdown appears above other fields
        }}
        className="w-full flex"
        style={{ display: "flex", width: "100%" }}
      />
    </div>
  );
};
