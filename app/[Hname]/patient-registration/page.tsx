"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Country, State, City } from "country-state-city";
import { useParams, useSearchParams } from "next/navigation";
import {
  MastersFormPage,
  type MastersFormField,
} from "../../../components/masters-form-page";

export default function PatientRegistrationPage() {
  const params = useParams();
  const hname = params?.Hname as string;
  const searchParams = useSearchParams();
  const mode = searchParams?.get("mode");
  const [selectedCountryCode, setSelectedCountryCode] = useState("");
  const [selectedStateCode, setSelectedStateCode] = useState("");
  const [localName, setLocalName] = useState("");
  const [localPhone, setLocalPhone] = useState("");

  useEffect(() => {
    try {
      setLocalName(window.localStorage.getItem("patientName") ?? "");
      setLocalPhone(window.localStorage.getItem("patientPhone") ?? "");
    } catch {}
  }, []);

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
      { id: "patientId", label: "Patient ID", type: "display", size: "small", placeholder: "Auto-generated on check-in", hint: "Auto-generated when the patient checks in for the first time." },
      { id: "patientName", label: "Patient Name", type: mode === "edit" ? "display" : "text", maxLength: 500, pattern: "[a-zA-Z\\s]*", size: "medium", defaultValue: mode === "edit" ? localName : undefined },
      { id: "dob", label: "Date of Birth", type: "date", size: "small" },
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
      { id: "phoneOffice", label: "Phone - Office", type: mode === "edit" ? "display" : "phone", size: "small" },
      { id: "phoneResi", label: "Phone - Resi", type: mode === "edit" ? "display" : "phone", size: "small" },
      { id: "mobile", label: "Mobile", type: mode === "edit" ? "display" : "phone", size: "small", defaultValue: mode === "edit" ? localPhone : undefined },
      { id: "hnNumber", label: "HN Number", type: "text", maxLength: 50, size: "small" },
      { id: "profession", label: "Profession", type: "text", maxLength: 255, size: "medium" },
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
    [cities, countries, states, mode, localName, localPhone],
  );

  return (
    <MastersFormPage
      title="Patient Registration"
      cardTitle="Patient Registration"
      description=""
      fields={patientRegistrationFields}
      backButtonText="Back to Check-in"
      backHref={`/${hname}/checkin`}
      profileLayoutTab={mode === "edit" ? "edit" : undefined}
      enableViewEditToggle={mode === "edit"}
    />
  );
}
