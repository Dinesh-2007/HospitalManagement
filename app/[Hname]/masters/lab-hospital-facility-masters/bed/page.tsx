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

  useEffect(() => {
    async function loadWardOptions() {
      if (!hname) {
        return;
      }

      try {
        const response = await fetch(`/api/${hname}/forms/ward_master`, {
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
            const description = String(row.description ?? "").trim();

            if (!code) {
              return "";
            }

            return description ? `${code} - ${description}` : code;
          })
          .filter(Boolean);

        setWardOptions(options);
      } catch (error) {
        console.error("Failed to load ward options", error);
      }
    }

    void loadWardOptions();
  }, [hname]);

  const bedFields: MastersFormField[] = useMemo(
    () => [
      { id: "code", label: "Code", type: "text", pattern: "[a-zA-Z0-9]*" },
      { id: "description", label: "Description", type: "text", maxLength: 500, pattern: "[a-zA-Z\\s]*" },
      { id: "rate", label: "Rate", type: "number" },
      {
        id: "ward",
        label: "Ward",
        type: "select",
        options: wardOptions,
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
    [wardOptions],
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
