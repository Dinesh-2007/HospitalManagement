"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  MastersFormPage,
  type MastersFormField,
} from "../../../../../components/masters-form-page";

export default function ItemMasterPage() {
  const params = useParams();
  const hname = params?.Hname as string;
  const [itemCategoryOptions, setItemCategoryOptions] = useState<string[]>([]);
  const [uomOptions, setUomOptions] = useState<string[]>([]);
  const [manufacturerOptions, setManufacturerOptions] = useState<string[]>([]);

  useEffect(() => {
    async function loadItemCategories() {
      if (!hname) {
        return;
      }

      try {
        const response = await fetch(`/api/${hname}/forms/item_category_master`, {
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
          .map((row) => String(row.group_name ?? row.groupName ?? "").trim())
          .filter(Boolean);

        setItemCategoryOptions(options);
      } catch (error) {
        console.error("Failed to load item category options", error);
      }
    }

    void loadItemCategories();
  }, [hname]);

  useEffect(() => {
    async function loadUoms() {
      if (!hname) {
        return;
      }

      try {
        const response = await fetch(`/api/${hname}/forms/uom_master`, {
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
            const code = String(row.uom_code ?? row.uomCode ?? "").trim();
            const description = String(
              row.uom_description ?? row.uomDescription ?? "",
            ).trim();

            if (!code) {
              return "";
            }

            return description ? `${code} - ${description}` : code;
          })
          .filter(Boolean);

        setUomOptions(options);
      } catch (error) {
        console.error("Failed to load UOM options", error);
      }
    }

    void loadUoms();
  }, [hname]);

  useEffect(() => {
    async function loadManufacturers() {
      if (!hname) {
        return;
      }

      try {
        const response = await fetch(`/api/${hname}/forms/manufacturer_master`, {
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
            const code = String(
              row.manufacturer_code ?? row.manufacturerCode ?? "",
            ).trim();
            const name = String(
              row.manufacturer_name ?? row.manufacturerName ?? "",
            ).trim();

            if (!code) {
              return "";
            }

            return name ? `${code} - ${name}` : code;
          })
          .filter(Boolean);

        setManufacturerOptions(options);
      } catch (error) {
        console.error("Failed to load manufacturer options", error);
      }
    }

    void loadManufacturers();
  }, [hname]);

  const itemMasterFields: MastersFormField[] = useMemo(
    () => [
      { id: "itemCode", label: "Item Code", type: "text", pattern: "[a-zA-Z0-9]*", placeholder: "Auto running number" },
      { id: "itemName", label: "Item Name", type: "text", maxLength: 255, pattern: "[a-zA-Z\\s]*" },
      {
        id: "itemCategory",
        label: "Item Category",
        type: "select",
        options: itemCategoryOptions,
      },
      {
        id: "purchaseUom",
        label: "Purchase UOM",
        type: "select",
        options: uomOptions,
      },
      {
        id: "saleUom",
        label: "Sale UOM",
        type: "select",
        options: uomOptions,
      },
      { id: "conversionFactor", label: "Conversion Factor", type: "number" },
      {
        id: "lastPurchasePrice",
        label: "Last Purchase Price",
        type: "display",
        placeholder: "Auto display",
      },
      { id: "salesPrice", label: "Sales Price", type: "number" },
      { id: "medicineCombination", label: "Medicine Combination", type: "text", maxLength: 255, pattern: "[a-zA-Z\\s]*" },
      { id: "currentStock", label: "Current Stock", type: "number" },
      { id: "minimumStockQty", label: "Minimum Stock Qty", type: "number" },
      { id: "maximumStockQty", label: "Maximum Stock Qty", type: "number" },
      {
        id: "manufacturer",
        label: "Manufacturer",
        type: "select",
        options: manufacturerOptions,
      },
      {
        id: "lastPurchaseVendor",
        label: "Last Purchase Vendor",
        type: "display",
        placeholder: "Auto display",
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
    [itemCategoryOptions, uomOptions, manufacturerOptions],
  );

  return (
    <MastersFormPage
      title="Masters - Lab Hospital Facility Masters - Item Master"
      cardTitle="Item Master (Medicine)"
      description=""
      fields={itemMasterFields}
    />
  );
}
