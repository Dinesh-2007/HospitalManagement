"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Country, State, City } from "country-state-city";
import { useParams } from "next/navigation";
import {
  MastersFormPage,
  type MastersFormField,
} from "../../../components/masters-form-page";

export default function PatientRegistrationPage() {
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

    void loadPatientTypes();
  }, [hname]);

  const countries = Country.getAllCountries();
  const states = selectedCountryCode ? State.getStatesOfCountry(selectedCountryCode) : [];
  const cities = selectedStateCode ? City.getCitiesOfState(selectedCountryCode, selectedStateCode) : [];

  const countryNameToCode: Record<string, string> = {};
  countries.forEach((country) => {
    countryNameToCode[country.name] = country.isoCode;
  });

  const stateNameToCode: Record<string, string> = {};
  states.forEach((state) => {
    stateNameToCode[state.name] = state.isoCode;
  });

  const handleCountryChange = (countryName: string) => {
    setSelectedCountryCode(countryNameToCode[countryName] ?? "");
    setSelectedStateCode("");
  };

  const handleStateChange = (stateName: string) => {
    setSelectedStateCode(stateNameToCode[stateName] ?? "");
  };

  const patientRegistrationFields: MastersFormField[] = useMemo(
    () => [
      { id: "patientId", label: "Patient ID", type: "text", maxLength: 50, pattern: "[a-zA-Z0-9]*", size: "small" },
      { id: "patientName", label: "Patient Name", type: "text", maxLength: 500, pattern: "[a-zA-Z\\s]*", size: "medium" },
      {
        id: "gender",
        label: "Gender",
        type: "select",
        options: ["Male", "Female", "Others"],
      },
      { id: "address", label: "Address", type: "textarea", size: "medium" },
      {
        id: "country",
        label: "Country",
        type: "select",
        options: countries.map((country) => country.name),
        onChange: handleCountryChange,
      },
      {
        id: "state",
        label: "State",
        type: "select",
        options: states.map((state) => state.name),
        onChange: handleStateChange,
      },
      {
        id: "city",
        label: "City",
        type: "select",
        options: cities.map((city) => city.name),
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
    ],
    [cities, countries, patientTypeOptions, states],
  );

  return (
    <MastersFormPage
      title="Patient Registration"
      cardTitle="Patient Registration"
      description=""
      fields={patientRegistrationFields}
    />
  );
}
