"use client";

import {
  MastersFormPage,
  type MastersFormField,
} from "../../../../../components/masters-form-page";

const buildingMasterFields: MastersFormField[] = [
  { id: "code", label: "Code", type: "text", pattern: "[a-zA-Z0-9]*" },
  { id: "buildingName", label: "Building Name", type: "text", maxLength: 200 },
  {
    id: "description",
    label: "Description",
    type: "text",
    maxLength: 500,
    pattern: "[a-zA-Z\\s]*",
  },
  {
    id: "status",
    label: "Status",
    type: "select",
    options: ["Active", "Inactive", "Under Construction"],
  },
  { id: "activeFrom", label: "Active From", type: "datetime-local" },
  {
    id: "inactiveDateFrom",
    label: "Inactivate Date From",
    type: "datetime-local",
  },
  {
    id: "inactiveReason",
    label: "Inactivate Reason",
    type: "textarea",
    fullWidth: true,
  },
];

export default function BuildingMasterPage() {
  return (
    <MastersFormPage
      title="Masters - Lab Hospital Facility Masters - Building Master"
      cardTitle="Building Master"
      description=""
      fields={buildingMasterFields}
    />
  );
}
