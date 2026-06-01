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

    void loadRoomTypes();
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
      { id: "rate", label: "Rate", type: "number" },
      { id: "location", label: "Location", type: "text", maxLength: 255 },
      { id: "activeFrom", label: "Active From", type: "datetime-local" },
      { id: "inactiveDateFrom", label: "Inactivate Date From", type: "datetime-local" },
      {
        id: "inactiveReason",
        label: "Inactivate Reason",
        type: "textarea",
        fullWidth: true,
      },
    ],
    [roomTypeOptions],
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
