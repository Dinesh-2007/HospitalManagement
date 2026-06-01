"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  MastersFormPage,
  type MastersFormField,
} from "../../../../../components/masters-form-page";

export default function LedgerMasterPage() {
  const params = useParams();
  const hname = params?.Hname as string;
  const [ledgerTypeOptions, setLedgerTypeOptions] = useState<string[]>([]);
  const [accountTypeOptions, setAccountTypeOptions] = useState<string[]>([]);

  useEffect(() => {
    async function loadLedgerTypes() {
      if (!hname) {
        return;
      }

      try {
        const response = await fetch(`/api/${hname}/forms/ledger_type`, {
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

        setLedgerTypeOptions(options);
      } catch (error) {
        console.error("Failed to load ledger type options", error);
      }
    }

    void loadLedgerTypes();
  }, [hname]);

  useEffect(() => {
    async function loadAccountTypes() {
      if (!hname) {
        return;
      }

      try {
        const response = await fetch(`/api/${hname}/forms/account_type`, {
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

        setAccountTypeOptions(options);
      } catch (error) {
        console.error("Failed to load account type options", error);
      }
    }

    void loadAccountTypes();
  }, [hname]);

  const ledgerMasterFields: MastersFormField[] = useMemo(
    () => [
      {
        id: "code",
        label: "Code",
        type: "text",
        pattern: "[a-zA-Z0-9]*",
        placeholder: "Enter ledger code",
        note: "",
      },
      {
        id: "ledgerName",
        label: "Ledger Name",
        type: "text",
        pattern: "[a-zA-Z\\s]*",
        placeholder: "Enter ledger name",
        maxLength: 100,
        note: "",
      },
      {
        id: "controlAccount",
        label: "Control Account",
        type: "select",
        options: ["Yes", "No"],
        note: "Yes / No",
      },
      {
        id: "ledgerType",
        label: "Ledger Type",
        type: "select",
        options: ledgerTypeOptions,
        note: "LOV",
      },
      {
        id: "accountType",
        label: "Account Type",
        type: "select",
        options: accountTypeOptions,
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
        note: "Free Text",
        fullWidth: true,
      },
    ],
    [ledgerTypeOptions, accountTypeOptions],
  );

  return (
    <MastersFormPage
      title="Masters - Pharmacy Inventory Masters - Ledger Master"
      cardTitle="Ledger Master"
      description=""
      fields={ledgerMasterFields}
    />
  );
}
