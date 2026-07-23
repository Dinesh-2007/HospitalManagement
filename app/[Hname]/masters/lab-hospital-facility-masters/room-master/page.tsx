"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  MastersFormPage,
  type MastersFormField,
} from "../../../../../components/masters-form-page";

export default function RoomMasterPage() {
  const params = useParams();
  const hname = params?.Hname as string;
  const [roomTypeOptions, setRoomTypeOptions] = useState<string[]>([]);
  const [roomPurposeOptions, setRoomPurposeOptions] = useState<string[]>([]);

  useEffect(() => {
    async function loadRoomTypes() {
      if (!hname) {
        return;
      }

      try {
        const response = await fetch(`/api/${hname}/forms/room_type_master`, {
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

        setRoomTypeOptions(options);
      } catch (error) {
        console.error("Failed to load room type options", error);
      }
    }

    async function loadRoomPurposes() {
      if (!hname) return;

      try {
        const response = await fetch(
          `/api/${hname}/forms/room_purpose_master`,
          { method: "GET", cache: "no-store" }
        );

        if (!response.ok) return;

        const data = (await response.json()) as {
          rows?: Array<Record<string, unknown>>;
        };

        const options = (data.rows ?? [])
          .map((row) => {
            const code = String(row.code ?? "").trim();
            const description = String(row.description ?? "").trim();
            if (!code) return "";
            return description ? `${code} - ${description}` : code;
          })
          .filter(Boolean);

        setRoomPurposeOptions(options);
      } catch (error) {
        console.error("Failed to load room purpose options", error);
      }
    }

    void loadRoomTypes();
    void loadRoomPurposes();
  }, [hname]);

  const roomMasterFields: MastersFormField[] = useMemo(
    () => [
      { id: "code", label: "Code", type: "text", pattern: "[a-zA-Z0-9]*" },
      { id: "description", label: "Description", type: "text", maxLength: 500, pattern: "[a-zA-Z\\s]*" },
      {
        id: "roomType",
        label: "Room Type",
        type: "select",
        options: roomTypeOptions,
      },
      {
        id: "roomPurpose",
        label: "Room Purpose",
        type: "select",
        options: roomPurposeOptions,
      },
      { id: "rate", label: "Rate", type: "number" },
      { id: "capacity", label: "Capacity", type: "number", min: 1 },
      {
        id: "status",
        label: "Status",
        type: "select",
        options: ["Available", "Partially Occupied", "Full", "Maintenance"],
      },
      { id: "location", label: "Location", type: "text", maxLength: 255 },
      { id: "buildingName", label: "Building", type: "text", maxLength: 200 },
      { id: "floorName", label: "Floor", type: "text", maxLength: 200 },
      { id: "departmentName", label: "Department", type: "text", maxLength: 200 },
      { id: "wardName", label: "Ward", type: "text", maxLength: 200 },
      { id: "activeFrom", label: "Active From", type: "datetime-local" },
      { id: "inactiveDateFrom", label: "Inactivate Date From", type: "datetime-local" },
      {
        id: "inactiveReason",
        label: "Inactivate Reason",
        type: "textarea",
        fullWidth: true,
      },
    ],
    [roomTypeOptions, roomPurposeOptions],
  );

  return (
    <MastersFormPage
      title="Masters - Lab Hospital Facility Masters - Room Master"
      cardTitle="Room Master"
      description=""
      fields={roomMasterFields}
    />
  );
}
