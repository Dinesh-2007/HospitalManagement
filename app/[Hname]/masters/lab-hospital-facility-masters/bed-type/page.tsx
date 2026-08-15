"use client";

import { useMemo } from "react";
import {
  MastersFormPage,
  type MastersFormField,
} from "../../../../../components/masters-form-page";

export default function BedTypePage() {
  const bedTypeFields: MastersFormField[] = useMemo(
    () => [
      { id: "code", label: "Code", type: "text", pattern: "[a-zA-Z0-9]*" },
      { id: "description", label: "Description", type: "text", maxLength: 500, pattern: "[a-zA-Z\\s]*" },
    ],
    [],
  );

  return (
    <MastersFormPage
      title="Masters - Lab Hospital Facility Masters - Bed Type"
      cardTitle="Bed Type Master"
      description=""
      fields={bedTypeFields}
    />
  );
}
