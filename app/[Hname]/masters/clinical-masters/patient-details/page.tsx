"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Country, State, City } from "country-state-city";
import { useParams } from "next/navigation";
import {
  MastersFormPage,
  type MastersFormField,
} from "../../../../../components/masters-form-page";

export default function PatientDetailsPage() {
  const params = useParams();
  const hname = params?.Hname as string;
  const [selectedCountryCode, setSelectedCountryCode] = useState("");
  const [selectedStateCode, setSelectedStateCode] = useState("");
  const [patientTypeOptions, setPatientTypeOptions] = useState<string[]>([]);

  useEffect(() => {
    async function loadPatientTypes() {
      if (!hname) {
        return;
      }

      try {
        const response = await fetch(`/api/${hname}/forms/patient_type`, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          rows?: Array<Record<string, unknown>>;
        };

        if (response.ok) {
          const types = (data.rows ?? [])
            .map((row) => {
              const typeCode = String(row.type_code ?? row.typeCode ?? "").trim();
              const description = String(row.description ?? "").trim();

              if (!typeCode) {
                return "";
              }

              return description ? `${typeCode} - ${description}` : typeCode;
            })
            .filter(Boolean);

          setPatientTypeOptions(types);
        }
      } catch (error) {
        console.error("Failed to fetch patient types", error);
      }
    }
    loadPatientTypes();
  }, [hname]);

  const countries = Country.getAllCountries();
  const states = selectedCountryCode ? State.getStatesOfCountry(selectedCountryCode) : [];
  const cities = selectedStateCode ? City.getCitiesOfState(selectedCountryCode, selectedStateCode) : [];

  // Map country name to ISO code
  const countryNameToCode: { [key: string]: string } = {};
  countries.forEach((c) => {
    countryNameToCode[c.name] = c.isoCode;
  });

  // Map state name to ISO code
  const stateNameToCode: { [key: string]: string } = {};
  states.forEach((s) => {
    stateNameToCode[s.name] = s.isoCode;
  });

  const handleCountryChange = (countryName: string) => {
    const countryCode = countryNameToCode[countryName];
    setSelectedCountryCode(countryCode);
    setSelectedStateCode(""); // Reset state
  };

  const handleStateChange = (stateName: string) => {
    const stateCode = stateNameToCode[stateName];
    setSelectedStateCode(stateCode);
  };

  const patientDetailsFields: MastersFormField[] = useMemo(() => [
    { id: "patientId", label: "Patient ID", type: "text", maxLength: 50, pattern: "[a-zA-Z0-9]*", size: "small" },
    { id: "patientName", label: "Patient Name", type: "text", maxLength: 500, pattern: "[a-zA-Z\\s]*", size: "medium" },
    { id: "address", label: "Address", type: "textarea", size: "medium" },
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
    { id: "zipCode", label: "ZIP Code", type: "text", maxLength: 6, pattern: "[0-9]{6}", inputMode: "numeric", size: "small" },
    { id: "email", label: "eMail", type: "text", maxLength: 255, size: "medium" },
    { id: "phoneOffice", label: "Phone - Office", type: "text", maxLength: 10, pattern: "[0-9]{10}", inputMode: "tel", size: "small" },
    { id: "phoneResi", label: "Phone - Resi", type: "text", maxLength: 10, pattern: "[0-9]{10}", inputMode: "tel", size: "small" },
    { id: "mobile", label: "Mobile", type: "text", maxLength: 10, pattern: "[0-9]{10}", inputMode: "tel", size: "small" },
    { id: "hnNumber", label: "HN Number", type: "text", maxLength: 50, size: "small" },
    {
      id: "numberOfVisits",
      label: "Number of Visits till now",
      type: "number",
      min: 0,
      size: "small",
    },
    {
      id: "lastVisitDateTime",
      label: "Last Visit Date & Time",
      type: "datetime-local",
    },
    {
      id: "lastVisitDoctorName",
      label: "Last visit doctor name",
      type: "text",
      maxLength: 255,
      size: "medium",
    },
    { id: "profession", label: "Profession", type: "text", maxLength: 255, size: "medium" },
    {
      id: "patientType",
      label: "Patient Type",
      type: "select",
      options: patientTypeOptions,
    },
    {
      id: "preferredPaymentType",
      label: "Preferred Payment Type",
      type: "select",
      options: ["Cash", "Card"],
    },
    {
      id: "mediclaimPolicyAvailable",
      label: "Mediclaim Policy Available",
      type: "select",
      options: ["Yes", "No"],
    },
    {
      id: "policyDetails",
      label: "Policy Details",
      type: "textarea",
      fullWidth: true,
    },
    {
      id: "linkedPatientId",
      label: "Linked Patient Id",
      type: "select",
      options: ["P1001", "P1002", "P1003", "P1004"],
    },
    {
      id: "relationshipShipLinkedPatient",
      label: "Relation Ship - Linked Patient",
      type: "select",
      options: ["Spouse", "Child", "Parent", "Sibling"],
      note: "",
    },
    { id: "activeFrom", label: "Active From", type: "datetime-local" },
    { id: "inactiveFrom", label: "Inactive From", type: "datetime-local" },
    {
      id: "inactiveReason",
      label: "Inactive Reason",
      type: "textarea",
      fullWidth: true,
    },
  ], [countries, states, cities, patientTypeOptions]);

  return (
    <MastersFormPage
      title="Masters - Clinical Masters - Patient Details"
      cardTitle="Patient Details"
      description=""
      fields={patientDetailsFields}
    />
  );
}
