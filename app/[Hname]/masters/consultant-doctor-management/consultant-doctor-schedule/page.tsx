"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  MastersFormPage,
  type MastersFormField,
} from "../../../../../components/masters-form-page";

const consultantDoctorScheduleFields: MastersFormField[] = [
  { id: "scheduleNo", label: "Schedule No", type: "text", maxLength: 50, pattern: "[a-zA-Z0-9]*" },
  {
    id: "consultantDoctorName",
    label: "Consultant / Doctor Name",
    type: "select",
    options: [], // Will be populated dynamically
  },
  {
    id: "appointmentFromDate",
    label: "Appointment From Date",
    type: "date",
  },
  {
    id: "appointmentToDate",
    label: "Appointment To Date",
    type: "date",
  },
  { id: "availableTimeFrom", label: "Available Time From", type: "time" },
  { id: "availableTimeTo", label: "Available Time To", type: "time" },
  {
    id: "daysAvailable",
    label: "Days Available",
    type: "checkbox",
    options: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  },
  {
    id: "timeSlotMinutes",
    label: "Time Slot (In minutes)",
    type: "number",
    min: 0,
  },
  { id: "activeFrom", label: "Active From", type: "datetime-local" },
  { id: "inactiveFrom", label: "Inactive From", type: "datetime-local" },
  {
    id: "inactiveReason",
    label: "Inactive Reason",
    type: "textarea",
    fullWidth: true,
  },
];

export default function ConsultantDoctorSchedulePage() {
  const params = useParams();
  const hname = params?.Hname as string;
  const [doctorOptions, setDoctorOptions] = useState<string[]>([]);

  useEffect(() => {
    async function loadDoctors() {
      if (!hname) return;
      
      try {
        const response = await fetch(`/api/${hname}/forms/consultant_doctor_master`, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          rows?: Array<Record<string, unknown>>;
        };

        const options = (data.rows || [])
          .map((row) => String(row.doctor_consultant_name ?? row.doctorConsultantName ?? row.name ?? "").trim())
          .filter(Boolean);

        setDoctorOptions(options);
      } catch (error) {
        console.error("Failed to load doctor options", error);
      }
    }

    void loadDoctors();
  }, [hname]);

  // Update the field options with the loaded doctor names
  const updatedFields = consultantDoctorScheduleFields.map(field => {
    if (field.id === "consultantDoctorName") {
      return {
        ...field,
        options: doctorOptions.length > 0 ? doctorOptions : ["No doctors available"]
      };
    }
    return field;
  });

  return (
    <MastersFormPage
      title="Masters - Clinical Masters - Consultant Doctor Schedule"
      cardTitle="Consultant / Doctor Schedule"
      description=""
      fields={updatedFields}
    />
  );
}
