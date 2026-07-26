"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Country, State, City } from "country-state-city";
import { useParams } from "next/navigation";
import {
  MastersFormPage,
  type MastersFormField,
} from "../../../../../components/masters-form-page";

export default function ConsultantDoctorPage() {
  const params = useParams();
  const hname = params?.Hname as string;
  const [selectedCountryCode, setSelectedCountryCode] = useState("");
  const [selectedStateCode, setSelectedStateCode] = useState("");
  const [payModeOptions, setPayModeOptions] = useState<string[]>([]);
  const [paymentTermsOptions, setPaymentTermsOptions] = useState<string[]>([]);
  const [clinicOptions, setClinicOptions] = useState<string[]>([]);

  useEffect(() => {
    async function loadPayModes() {
      if (!hname) {
        return;
      }

      try {
        const response = await fetch(`/api/${hname}/forms/pay_mode`, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          rows?: Array<Record<string, unknown>>;
        };

        const options = (data.rows ?? [])
          .map((row) => String(row.code ?? "").trim())
          .map((code, index) => {
            const description = String(
              data.rows?.[index]?.description ?? "",
            ).trim();

            return description ? `${code} - ${description}` : code;
          })
          .filter(Boolean);

        setPayModeOptions(options);
      } catch (error) {
        console.error("Failed to load pay mode options", error);
      }
    }

    void loadPayModes();
  }, [hname]);

  useEffect(() => {
    async function loadPaymentTerms() {
      if (!hname) {
        return;
      }

      try {
        const response = await fetch(`/api/${hname}/forms/payment_terms`, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          rows?: Array<Record<string, unknown>>;
        };

        const options = (data.rows ?? [])
          .map((row) => {
            const code = String(row.code ?? "").trim();
            const name = String(row.name ?? "").trim();

            if (!code) {
              return "";
            }

            return name ? `${code} - ${name}` : code;
          })
          .filter(Boolean);

        setPaymentTermsOptions(options);
      } catch (error) {
        console.error("Failed to load payment terms options", error);
      }
    }

    void loadPaymentTerms();
  }, [hname]);

  useEffect(() => {
    async function loadDepartments() {
      if (!hname) return;

      try {
        const response = await fetch(`/api/${hname}/forms/department_master`, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) return;

        const data = (await response.json()) as { rows?: Array<Record<string, unknown>> };

        const options = (data.rows ?? [])
          .map((row) => String(row.department_type ?? row.departmentType ?? row.department_name ?? row.name ?? "").trim())
          .filter(Boolean);

        setClinicOptions(options);
      } catch (error) {
        console.error("Failed to load department options", error);
      }
    }

    void loadDepartments();
  }, [hname]);

  const countries = Country.getAllCountries();
  const states = selectedCountryCode ? State.getStatesOfCountry(selectedCountryCode) : [];
  const cities = selectedStateCode ? City.getCitiesOfState(selectedCountryCode, selectedStateCode) : [];

  const countryNameToCode: { [key: string]: string } = {};
  countries.forEach((c) => {
    countryNameToCode[c.name] = c.isoCode;
  });

  const stateNameToCode: { [key: string]: string } = {};
  states.forEach((s) => {
    stateNameToCode[s.name] = s.isoCode;
  });

  const handleCountryChange = (countryName: string) => {
    const countryCode = countryNameToCode[countryName];
    setSelectedCountryCode(countryCode);
    setSelectedStateCode("");
  };

  const handleStateChange = (stateName: string) => {
    const stateCode = stateNameToCode[stateName];
    setSelectedStateCode(stateCode);
  };

  const consultantDoctorFields: MastersFormField[] = useMemo(
    () => [
      { id: "code", label: "Code", type: "text", maxLength: 50, pattern: "[a-zA-Z0-9]*" },
      {
        id: "type",
        label: "Type",
        type: "select",
        options: ["Consultant", "Doctor"],
      },
      {
        id: "doctorConsultantName",
        label: "Doctor / Consultant Name",
        type: "text",
        maxLength: 255,
        pattern: "[a-zA-Z\\s]*",
      },
      { id: "address", label: "Address", type: "textarea", fullWidth: true },
      {
        id: "country",
        label: "Country",
        type: "select",
        options: countries.map((c) => c.name),
        onChange: handleCountryChange,
      },
      {
        id: "state",
        label: "State",
        type: "select",
        options: states.map((s) => s.name),
        onChange: handleStateChange,
      },
      {
        id: "city",
        label: "City",
        type: "select",
        options: cities.map((c) => c.name),
      },
      { id: "zipCode", label: "ZIP Code", type: "text", maxLength: 6, pattern: "[0-9]{6}", inputMode: "numeric" },
      { id: "email", label: "eMail", type: "text", maxLength: 255 },
      { id: "phoneOffice", label: "Phone - Office", type: "text", maxLength: 10, pattern: "[0-9]{10}", inputMode: "tel" },
      { id: "phoneResi", label: "Phone - Resi", type: "text", maxLength: 10, pattern: "[0-9]{10}", inputMode: "tel" },
      { id: "mobile", label: "Mobile", type: "text", maxLength: 10, pattern: "[0-9]{10}", inputMode: "tel" },
      { id: "roomNo", label: "Room No.", type: "text", maxLength: 30, pattern: "[a-zA-Z0-9]*" },
      {
        id: "specialization",
        label: "Specialization",
        type: "text",
        maxLength: 255,
        pattern: "[a-zA-Z\\s]*",
      },
      {
        id: "registrationNumber",
        label: "Registration Number",
        type: "text",
        maxLength: 50,
        pattern: "[a-zA-Z0-9]*",
      },
      {
        id: "clinic",
        label: "Clinic",
        type: "select",
        options: clinicOptions,
      },
      {
        id: "appointmentScheduleLimit",
        label: "Appointment Schedule Limit",
        type: "number",
        min: 0,
      },
      { id: "activeFrom", label: "Active From", type: "datetime-local" },
      { id: "inactiveFrom", label: "Inactive From", type: "datetime-local" },
      {
        id: "inactiveReason",
        label: "Inactive Reason",
        type: "textarea",
        fullWidth: true,
      },
      { id: "bankBranch", label: "Bank Branch", type: "text", maxLength: 255, pattern: "[a-zA-Z\\s]*" },
      {
        id: "bankAccountNumber",
        label: "Bank Account Number",
        type: "text",
        maxLength: 18,
        pattern: "[0-9]*",
      },
      {
        id: "bankBranchCode",
        label: "Bank Brach Code",
        type: "text",
        maxLength: 11,
        pattern: "[a-zA-Z0-9]*",
      },
      {
        id: "payMode",
        label: "Pay Mode",
        type: "select",
        options: payModeOptions,
      },
      {
        id: "paymentTermsDays",
        label: "Payment Terms Days",
        type: "select",
        options: paymentTermsOptions,
      },
      { id: "username", label: "Username", type: "text", maxLength: 50, pattern: "[a-zA-Z0-9]*" },
    ],
    [countries, states, cities, payModeOptions, paymentTermsOptions],
  );

  return (
    <MastersFormPage
      title="Masters - Clinical Masters - Consultant Doctor"
      cardTitle="Consultant / Doctor Master"
      description=""
      fields={consultantDoctorFields}
    />
  );
}
