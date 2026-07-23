"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  MastersFormPage,
  type MastersFormField,
} from "../../../../../components/masters-form-page";

export default function FloorMasterPage() {
  const params = useParams();
  const hname = params?.Hname as string;
  const [buildingOptions, setBuildingOptions] = useState<string[]>([]);

  useEffect(() => {
    async function loadBuildingOptions() {
      if (!hname) return;

      try {
        const response = await fetch(
          `/api/${hname}/forms/building_master`,
          { method: "GET", cache: "no-store" }
        );

        if (!response.ok) return;

        const data = (await response.json()) as {
          rows?: Array<Record<string, unknown>>;
        };

        const options = (data.rows ?? [])
          .map((row) => {
            const code = String(row.code ?? "").trim();
            const name = String(row.building_name ?? "").trim();
            if (!code) return "";
            return name ? `${code} - ${name}` : code;
          })
          .filter(Boolean);

        setBuildingOptions(options);
      } catch (error) {
        console.error("Failed to load building options", error);
      }
    }

    void loadBuildingOptions();
  }, [hname]);

  const floorMasterFields: MastersFormField[] = useMemo(
    () => [
      { id: "code", label: "Code", type: "text", pattern: "[a-zA-Z0-9]*" },
      { id: "floorName", label: "Floor Name", type: "text", maxLength: 200 },
      { id: "floorNumber", label: "Floor Number", type: "number", min: 0 },
      {
        id: "building",
        label: "Building",
        type: "select",
        options: buildingOptions,
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
    ],
    [buildingOptions]
  );

  return (
    <MastersFormPage
      title="Masters - Lab Hospital Facility Masters - Floor Master"
      cardTitle="Floor Master"
      description=""
      fields={floorMasterFields}
    />
  );
}
