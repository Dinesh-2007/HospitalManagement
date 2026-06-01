"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  MastersFormPage,
  type MastersFormField,
} from "../../../../../components/masters-form-page";

export default function AdministrativeHolidayMasterPage() {
  const params = useParams();
  const hname = params?.Hname as string;
  const [holidayTypeOptions, setHolidayTypeOptions] = useState<string[]>([]);

  useEffect(() => {
    async function loadHolidayTypes() {
      if (!hname) return;

      try {
        const res = await fetch(`/api/${hname}/forms/holiday_type`, { method: "GET", cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { rows?: Array<Record<string, unknown>> };
        const options = (data.rows ?? [])
          .map((r) => String(r.name ?? r.holiday_type_name ?? "").trim())
          .filter(Boolean);

        setHolidayTypeOptions(options);
      } catch (e) {
        console.error("Failed to load holiday types", e);
      }
    }

    void loadHolidayTypes();
  }, [hname]);

  const holidayMasterFields: MastersFormField[] = [
  {
    id: "code",
    label: "Code",
    type: "text",
    pattern: "[a-zA-Z0-9]*",
    placeholder: "Enter code",
    note: "",
  },
  {
    id: "holidayName",
    label: "Holiday Name",
    type: "text",
    pattern: "[a-zA-Z\\s]*",
    placeholder: "Enter holiday name",
    maxLength: 120,
    note: "",
  },
  {
    id: "date",
    label: "Date",
    type: "datetime-local",
    note: "Date Time",
  },
    {
      id: "holidayType",
      label: "Holiday Type",
      type: "select",
      options: holidayTypeOptions.length > 0 ? holidayTypeOptions : ["National", "Festival", "Regional", "Special"],
      note: "LOV",
    },
  {
    id: "activeFrom",
    label: "Active From",
    type: "datetime-local",
    note: "Date Time",
  },
  {
    id: "inactiveDateFrom",
    label: "Inactive Date From",
    type: "datetime-local",
    note: "Date Time",
  },
  {
    id: "inactiveReason",
    label: "Inactive Reason",
    type: "textarea",
    placeholder: "Enter inactive reason",
    maxLength: 250,
    fullWidth: true,
  },
];

  return (
    <MastersFormPage
      title="Masters - Administrative General Masters - Holiday Master"
      cardTitle="Holiday Master"
      description=""
      fields={holidayMasterFields}
    />
  );
}
