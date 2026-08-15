"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  MastersFormPage,
  type MastersFormField,
} from "../../../../../components/masters-form-page";

export default function BedPage() {
  const params = useParams();
  const hname = params?.Hname as string;
  const [wardOptions, setWardOptions] = useState<string[]>([]);
  const [bedTypeOptions, setBedTypeOptions] = useState<string[]>([]);

  useEffect(() => {
    async function loadOptions() {
      if (!hname) {
        return;
      }

      try {
        const [wardRes, bedTypeRes] = await Promise.all([
          fetch(`/api/${hname}/forms/ward_master`, { method: "GET", cache: "no-store" }),
          fetch(`/api/${hname}/forms/bed_type_master`, { method: "GET", cache: "no-store" })
        ]);

        if (wardRes.ok) {
          const data = (await wardRes.json()) as { rows?: Array<Record<string, unknown>> };
          const options = (data.rows ?? []).map(row => {
            const code = String(row.code ?? "").trim();
            const description = String(row.description ?? "").trim();
            if (!code) return "";
            return description ? `${code} - ${description}` : code;
          }).filter(Boolean);
          setWardOptions(options);
        }

        if (bedTypeRes.ok) {
          const data = (await bedTypeRes.json()) as { rows?: Array<Record<string, unknown>> };
          const options = (data.rows ?? []).map(row => {
            const code = String(row.code ?? "").trim();
            const description = String(row.description ?? "").trim();
            if (!code) return "";
            return description ? `${code} - ${description}` : code;
          }).filter(Boolean);
          setBedTypeOptions(options);
        }
      } catch (error) {
        console.error("Failed to load options", error);
      }
    }

    void loadOptions();
  }, [hname]);

  const bedFields: MastersFormField[] = useMemo(
    () => [
      { id: "code", label: "Code", type: "text", pattern: "[a-zA-Z0-9]*" },
      { id: "description", label: "Description", type: "text", maxLength: 500, pattern: "[a-zA-Z\\s]*" },
      { id: "bedNumber", label: "Bed Number", type: "text", maxLength: 50 },
      {
        id: "bedType",
        label: "Bed Type",
        type: "select",
        options: bedTypeOptions,
      },
      { id: "rate", label: "Rate", type: "number" },
      { id: "charge", label: "Charge Per Day", type: "number" },
      {
        id: "status",
        label: "Status",
        type: "select",
        options: [
          "Available",
          "Occupied",
          "Reserved",
          "Cleaning",
          "Maintenance",
          "Blocked",
        ],
      },
      {
        id: "ward",
        label: "Ward",
        type: "select",
        options: wardOptions,
      },
      { id: "roomName", label: "Room", type: "text", maxLength: 200 },
      { id: "buildingName", label: "Building", type: "text", maxLength: 200 },
      { id: "floorName", label: "Floor", type: "text", maxLength: 200 },
      { id: "departmentName", label: "Department", type: "text", maxLength: 200 },
      { id: "wardName", label: "Ward Name", type: "text", maxLength: 200 },
      { id: "activeFrom", label: "Active From", type: "datetime-local" },
      { id: "inactiveFrom", label: "Inactive From", type: "datetime-local" },
      {
        id: "inactiveReason",
        label: "Inactive Reason",
        type: "textarea",
        fullWidth: true,
      },
    ],
    [wardOptions, bedTypeOptions],
  );

  return (
    <MastersFormPage
      title="Masters - Lab Hospital Facility Masters - Bed"
      cardTitle="Bed Master"
      description=""
      fields={bedFields}
    />
  );
}
