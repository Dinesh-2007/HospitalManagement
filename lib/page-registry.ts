/**
 * Page Registry
 * =============
 * Flat, canonical list of all navigable pages in HSMS.
 * This is the single source of truth for the RBAC permission system.
 *
 * Rules:
 *  - `key`        : normalized path (no Hname prefix), matches NavigationSection.href
 *  - `label`      : human-readable display name
 *  - `group`      : top-level section label (for grouping in the UI)
 *  - `subgroup`   : optional sub-section label
 *  - `isAdminOnly`: if true, only admin users can access this; not assignable to roles
 */

export type PageEntry = {
  key: string;
  label: string;
  group: string;
  subgroup?: string;
  isAdminOnly?: boolean;
};

export const PAGE_REGISTRY: PageEntry[] = [
  // ── Masters ────────────────────────────────────────────────────────────────
  // Clinical Masters
  { key: "/masters/clinical-masters/symptoms",        label: "Symptoms",                  group: "Masters", subgroup: "Clinical Masters" },
  { key: "/masters/clinical-masters/allergy",         label: "Allergy",                   group: "Masters", subgroup: "Clinical Masters" },
  { key: "/masters/clinical-masters/disease",         label: "Disease",                   group: "Masters", subgroup: "Clinical Masters" },
  { key: "/masters/clinical-masters/medicine-usage",  label: "Medicine Usage (Clinical)", group: "Masters", subgroup: "Clinical Masters" },
  { key: "/masters/clinical-masters/patient-type",    label: "Patient Type",              group: "Masters", subgroup: "Clinical Masters" },

  // Consultant Doctor Management
  { key: "/masters/consultant-doctor-management/consultant-doctor",          label: "Consultant Doctor",          group: "Masters", subgroup: "Consultant Doctor Management" },
  { key: "/masters/consultant-doctor-management/consultant-doctor-schedule", label: "Consultant Doctor Schedule", group: "Masters", subgroup: "Consultant Doctor Management" },
  { key: "/masters/consultant-doctor-management/department-master",          label: "Department Master",          group: "Masters", subgroup: "Consultant Doctor Management" },

  // Lab Hospital Facility Masters
  { key: "/masters/lab-hospital-facility-masters/lab",               label: "Lab",               group: "Masters", subgroup: "Lab Hospital Facility Masters" },
  { key: "/masters/lab-hospital-facility-masters/building-master",   label: "Building Master",   group: "Masters", subgroup: "Lab Hospital Facility Masters" },
  { key: "/masters/lab-hospital-facility-masters/floor-master",      label: "Floor Master",      group: "Masters", subgroup: "Lab Hospital Facility Masters" },
  { key: "/masters/lab-hospital-facility-masters/ward",              label: "Ward",              group: "Masters", subgroup: "Lab Hospital Facility Masters" },
  { key: "/masters/lab-hospital-facility-masters/room-type",         label: "Room Type",         group: "Masters", subgroup: "Lab Hospital Facility Masters" },
  { key: "/masters/lab-hospital-facility-masters/room-purpose",      label: "Room Purpose",      group: "Masters", subgroup: "Lab Hospital Facility Masters" },
  { key: "/masters/lab-hospital-facility-masters/room-master",       label: "Room Master",       group: "Masters", subgroup: "Lab Hospital Facility Masters" },
  { key: "/masters/lab-hospital-facility-masters/bed-type",          label: "Bed Type",          group: "Masters", subgroup: "Lab Hospital Facility Masters" },
  { key: "/masters/lab-hospital-facility-masters/operation-theater", label: "Operation Theater", group: "Masters", subgroup: "Lab Hospital Facility Masters" },
  { key: "/masters/lab-hospital-facility-masters/equipment-master",  label: "Equipment Master",  group: "Masters", subgroup: "Lab Hospital Facility Masters" },

  // Pharmacy Inventory Masters
  { key: "/masters/pharmacy-inventory-masters/item-category",      label: "Item Category",      group: "Masters", subgroup: "Pharmacy Inventory Masters" },
  { key: "/masters/pharmacy-inventory-masters/item-uom",           label: "Item UOM",           group: "Masters", subgroup: "Pharmacy Inventory Masters" },
  { key: "/masters/pharmacy-inventory-masters/manufacturer",       label: "Manufacturer",       group: "Masters", subgroup: "Pharmacy Inventory Masters" },
  { key: "/masters/pharmacy-inventory-masters/item-master",        label: "Item Master",        group: "Masters", subgroup: "Pharmacy Inventory Masters" },
  { key: "/masters/pharmacy-inventory-masters/medicine-usage",     label: "Medicine Usage",     group: "Masters", subgroup: "Pharmacy Inventory Masters" },
  { key: "/masters/pharmacy-inventory-masters/service",            label: "Service",            group: "Masters", subgroup: "Pharmacy Inventory Masters" },
  { key: "/masters/pharmacy-inventory-masters/warehouse-master",   label: "Warehouse Master",   group: "Masters", subgroup: "Pharmacy Inventory Masters" },
  { key: "/masters/pharmacy-inventory-masters/assets",             label: "Assets",             group: "Masters", subgroup: "Pharmacy Inventory Masters" },

  // Accounts Finance Masters
  { key: "/masters/accounts-finance-masters/ledger-type",             label: "Ledger Type",             group: "Masters", subgroup: "Accounts Finance Masters" },
  { key: "/masters/accounts-finance-masters/account-type",            label: "Account Type",            group: "Masters", subgroup: "Accounts Finance Masters" },
  { key: "/masters/accounts-finance-masters/ledger-master",           label: "Ledger Master",           group: "Masters", subgroup: "Accounts Finance Masters" },
  { key: "/masters/accounts-finance-masters/sub-ledger-master",       label: "Sub Ledger Master",       group: "Masters", subgroup: "Accounts Finance Masters" },
  { key: "/masters/accounts-finance-masters/credit-card-type-master", label: "Credit Card Type Master", group: "Masters", subgroup: "Accounts Finance Masters" },
  { key: "/masters/accounts-finance-masters/bank-master",             label: "Bank Master",             group: "Masters", subgroup: "Accounts Finance Masters" },
  { key: "/masters/accounts-finance-masters/currency",                label: "Currency",                group: "Masters", subgroup: "Accounts Finance Masters" },
  { key: "/masters/accounts-finance-masters/pay-mode",                label: "Pay Mode",                group: "Masters", subgroup: "Accounts Finance Masters" },
  { key: "/masters/accounts-finance-masters/payment-terms",           label: "Payment Terms",           group: "Masters", subgroup: "Accounts Finance Masters" },

  // Administrative General Masters
  { key: "/masters/administrative-general-masters/holiday-master",      label: "Holiday Master",      group: "Masters", subgroup: "Administrative General Masters" },
  { key: "/masters/administrative-general-masters/holiday-type",        label: "Holiday Type",        group: "Masters", subgroup: "Administrative General Masters" },
  { key: "/masters/administrative-general-masters/medical-certificate", label: "Medical Certificate", group: "Masters", subgroup: "Administrative General Masters" },
  { key: "/masters/administrative-general-masters/reason",              label: "Reason",              group: "Masters", subgroup: "Administrative General Masters" },
  { key: "/masters/administrative-general-masters/relationship",        label: "Relationship",        group: "Masters", subgroup: "Administrative General Masters" },

  // ── Patient Flow ────────────────────────────────────────────────────────────
  { key: "/patient-login",        label: "Patient Login",        group: "Patient Flow" },
  { key: "/checkin",              label: "Check In",             group: "Patient Flow" },
  { key: "/patient-vitals",       label: "Patient Vitals",       group: "Patient Flow" },
  { key: "/patient-registration", label: "Patient Registration", group: "Patient Flow" },

  // ── Doctor ──────────────────────────────────────────────────────────────────
  { key: "/doctor-consultation", label: "Doctor Consultation", group: "Doctor" },
  { key: "/doctor-schedule",     label: "Doctor Schedule",     group: "Doctor" },

  // ── Pharmacy ────────────────────────────────────────────────────────────────
  { key: "/pharmacy-dispensing",         label: "Pharmacy Dispensing", group: "Pharmacy" },
  { key: "/pricing",                     label: "Pricing",             group: "Pharmacy" },
  { key: "/discount-schema",             label: "Discount Schema",     group: "Pharmacy" },
  { key: "/pharmacy/purchase",           label: "Purchase",            group: "Pharmacy", subgroup: "Pharmacy (Advanced)" },
  { key: "/pharmacy/inventory",          label: "Inventory",           group: "Pharmacy", subgroup: "Pharmacy (Advanced)" },
  { key: "/pharmacy/dispensing",         label: "Dispensing",          group: "Pharmacy", subgroup: "Pharmacy (Advanced)" },
  { key: "/pharmacy/grn",                label: "GRN",                 group: "Pharmacy", subgroup: "Pharmacy (Advanced)" },
  { key: "/pharmacy/supplier",           label: "Supplier",            group: "Pharmacy", subgroup: "Pharmacy (Advanced)" },

  // ── Billing ─────────────────────────────────────────────────────────────────
  { key: "/billing/consultation-billing", label: "Consultation Billing", group: "Billing" },
  { key: "/billing/pharmacy-billing",     label: "Pharmacy Billing",     group: "Billing" },
  { key: "/billing/discharge-billing",    label: "Discharge Billing",    group: "Billing" },

  // ── Bed Management ──────────────────────────────────────────────────────────
  { key: "/bed-management/infrastructure", label: "Infrastructure Setup", group: "Bed Management" },
  { key: "/bed-management/allocation",     label: "Bed Allocation",       group: "Bed Management" },
  { key: "/bed-management/discharge",      label: "Clinical Discharge",   group: "Bed Management" },
  { key: "/bed-management/care-plan",      label: "Care Plans",           group: "Bed Management" },
  { key: "/housekeeping",                  label: "Housekeeping",         group: "Bed Management" },
  { key: "/bed-management/reports",        label: "Reports",              group: "Bed Management" },

  // ── Queue Management ────────────────────────────────────────────────────────
  { key: "/queue-management/out-patient",       label: "Out Patient",       group: "Queue Management" },
  { key: "/queue-management/in-patient",        label: "In Patient",        group: "Queue Management" },
  { key: "/queue-management/pharmacist-screen", label: "Pharmacist Screen", group: "Queue Management" },

  // ── Records ─────────────────────────────────────────────────────────────────
  { key: "/records", label: "Records", group: "Records" },

  // ── Admin Only ──────────────────────────────────────────────────────────────
  { key: "/manage-users", label: "Manage Users", group: "Administration", isAdminOnly: true },
  { key: "/settings",     label: "Settings",     group: "Administration", isAdminOnly: true },
];

/**
 * Returns a Map of key → PageEntry for O(1) lookups.
 */
export const PAGE_REGISTRY_MAP: Map<string, PageEntry> = new Map(
  PAGE_REGISTRY.map((p) => [p.key, p])
);

/**
 * All groups in the registry (in display order).
 */
export const PAGE_GROUPS: string[] = [
  "Masters",
  "Patient Flow",
  "Doctor",
  "Pharmacy",
  "Billing",
  "Bed Management",
  "Queue Management",
  "Records",
  "Administration",
];

/**
 * Returns all non-admin-only pages grouped by group then subgroup.
 * Used by the Settings UI to render the permission checkboxes.
 */
export function getAssignablePages(): Record<string, Record<string, PageEntry[]>> {
  const result: Record<string, Record<string, PageEntry[]>> = {};

  for (const page of PAGE_REGISTRY) {
    if (page.isAdminOnly) continue;
    const group = page.group;
    const subgroup = page.subgroup ?? "__root__";
    if (!result[group]) result[group] = {};
    if (!result[group][subgroup]) result[group][subgroup] = [];
    result[group][subgroup].push(page);
  }

  return result;
}

/**
 * Given a normalized pathname (e.g. "/billing/consultation-billing"),
 * returns the matching PageEntry or undefined.
 *
 * Uses exact match first, then prefix match for nested routes.
 */
export function findPageByPath(pathname: string): PageEntry | undefined {
  // Exact match
  if (PAGE_REGISTRY_MAP.has(pathname)) {
    return PAGE_REGISTRY_MAP.get(pathname);
  }

  // Prefix match — find the most specific registered key that is a prefix
  let best: PageEntry | undefined;
  for (const entry of PAGE_REGISTRY) {
    if (pathname.startsWith(entry.key)) {
      if (!best || entry.key.length > best.key.length) {
        best = entry;
      }
    }
  }
  return best;
}
