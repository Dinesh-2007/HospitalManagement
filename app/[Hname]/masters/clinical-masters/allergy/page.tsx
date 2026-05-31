"use client";

import { useMemo } from "react";
import {
  MastersFormPage,
  type MastersFormField,
} from "../../../../../components/masters-form-page";

export default function AllergyPage() {
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
            const res = await fetch("/api/forms/symptoms_master");
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
        options: ["Cough", "Fever", "Headache", "Skin Rash"],
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
    []
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
