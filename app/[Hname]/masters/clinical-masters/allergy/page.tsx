"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  MastersFormPage,
  type MastersFormField,
} from "../../../../../components/masters-form-page";

export default function AllergyPage() {
  const params = useParams();
  const hname = params?.Hname as string;
  const [symptomOptions, setSymptomOptions] = useState<string[]>([]);

  useEffect(() => {
    async function loadAllergyOptions() {
      if (!hname) {
        return;
      }

      try {
        const response = await fetch(`/api/${hname}/forms/symptoms_master`, {
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

        setSymptomOptions([...new Set(options)]);
      } catch (error) {
        console.error("Failed to load symptom options", error);
      }
    }

    void loadAllergyOptions();
  }, [hname]);

  const allergyFields: MastersFormField[] = useMemo(
    () => [
      {
        id: "code",
        label: "Code",
        type: "text",
        maxLength: 50,
        pattern: "[a-zA-Z0-9]*",
        size: "small",
        onChange: async (value: string) => {
          if (!value) {
            const descEl = document.getElementById("description") as HTMLTextAreaElement | null;
            if (descEl) descEl.value = "";
            return;
          }
          
          try {
            const res = await fetch(`/api/${hname}/forms/allergy_master`);
            if (res.ok) {
              const data = await res.json();
              if (data.rows && data.rows.length > 0) {
                const match = data.rows.find((r: any) => 
                  String(r.code).toLowerCase() === value.toLowerCase()
                );
                const descEl = document.getElementById("description") as HTMLTextAreaElement | null;
                if (descEl) {
                  descEl.value = match ? match.description || "" : "";
                }
              }
            }
          } catch (e) {
            console.error("Failed to fetch symptoms:", e);
          }
        },
      },
      {
        id: "description",
        label: "Description",
        type: "textarea",
        maxLength: 500,
        fullWidth: true,
      },
      {
        id: "symptoms",
        label: "Symptoms",
        type: "select",
        options: symptomOptions,
        size: "medium",
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
    [hname, symptomOptions]
  );

  return (
    <MastersFormPage
      title="Masters - Clinical Masters - Allergy"
      cardTitle="Allergy Master"
      description=""
      fields={allergyFields}
    />
  );
}
