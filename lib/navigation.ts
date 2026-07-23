export type NavigationSection = {
  title: string;
  href?: string;
  items?: NavigationSection[];
};

export const mastersData: NavigationSection[] = [
  {
    title: "Clinical Masters",
    href: "/masters/clinical-masters/symptoms",
    items: [
      { title: "Symptoms", href: "/masters/clinical-masters/symptoms" },
      { title: "Allergy", href: "/masters/clinical-masters/allergy" },
      { title: "Disease", href: "/masters/clinical-masters/disease" },
      { title: "Medicine Usage", href: "/masters/clinical-masters/medicine-usage" },
      { title: "Patient Type", href: "/masters/clinical-masters/patient-type" },
    ],
  },
  {
    title: "Consultant Doctor Management",
    href: "/masters/consultant-doctor-management/patient-type",
    items: [
      { title: "Consultant Doctor", href: "/masters/consultant-doctor-management/consultant-doctor" },
      { title: "Consultant Doctor Schedule", href: "/masters/consultant-doctor-management/consultant-doctor-schedule" },
      { title: "Department Master", href: "/masters/consultant-doctor-management/department-master" },
    ],
  },
  {
    title: "Lab Hospital Facility Masters",
    href: "/masters/lab-hospital-facility-masters/item-master",
    items: [
      { title: "Lab", href: "/masters/lab-hospital-facility-masters/lab" },
      { title: "Building Master", href: "/masters/lab-hospital-facility-masters/building-master" },
      { title: "Floor Master", href: "/masters/lab-hospital-facility-masters/floor-master" },
      { title: "Ward", href: "/masters/lab-hospital-facility-masters/ward" },
      { title: "Room Type", href: "/masters/lab-hospital-facility-masters/room-type" },
      { title: "Room Purpose", href: "/masters/lab-hospital-facility-masters/room-purpose" },
      { title: "Room Master", href: "/masters/lab-hospital-facility-masters/room-master" },
      { title: "Bed", href: "/masters/lab-hospital-facility-masters/bed" },
      { title: "Operation Theater", href: "/masters/lab-hospital-facility-masters/operation-theater" },
      { title: "Equipment Master", href: "/masters/lab-hospital-facility-masters/equipment-master" },
    ],
  },
  {
    title: "Pharmacy Inventory Masters",
    href: "/masters/pharmacy-inventory-masters/ledger-master",
    items: [
      { title: "Item Category", href: "/masters/pharmacy-inventory-masters/item-category" },
      { title: "Item UOM", href: "/masters/pharmacy-inventory-masters/item-uom" },
      { title: "Manufacturer", href: "/masters/pharmacy-inventory-masters/manufacturer" },
      { title: "Item Master", href: "/masters/pharmacy-inventory-masters/item-master" },
      { title: "Medicine Usage", href: "/masters/pharmacy-inventory-masters/medicine-usage" },
      { title: "Service", href: "/masters/pharmacy-inventory-masters/service" },
      { title: "Warehouse Master", href: "/masters/pharmacy-inventory-masters/warehouse-master" },
    ],
  },
  {
    title: "Accounts Finance Masters",
    href: "/masters/accounts-finance-masters/reason",
    items: [
      { title: "Ledger Type", href: "/masters/accounts-finance-masters/ledger-type" },
      { title: "Account Type", href: "/masters/accounts-finance-masters/account-type" },
      { title: "Ledger Master", href: "/masters/accounts-finance-masters/ledger-master" },
      { title: "Sub Ledger Master", href: "/masters/accounts-finance-masters/sub-ledger-master" },
      { title: "Credit Card Type Master", href: "/masters/accounts-finance-masters/credit-card-type-master" },
      { title: "Bank Master", href: "/masters/accounts-finance-masters/bank-master" },
      { title: "Currency", href: "/masters/accounts-finance-masters/currency" },
      { title: "Pay Mode", href: "/masters/accounts-finance-masters/pay-mode" },
      { title: "Payment Terms", href: "/masters/accounts-finance-masters/payment-terms" },
    ],
  },
  {
    title: "Administrative General Masters",
    href: "/masters/administrative-general-masters/holiday-master",
    items: [
      { title: "Holiday Master", href: "/masters/administrative-general-masters/holiday-master" },
      { title: "Holiday Type", href: "/masters/administrative-general-masters/holiday-type" },
      { title: "Medical Certificate", href: "/masters/administrative-general-masters/medical-certificate" },
      { title: "Reason", href: "/masters/administrative-general-masters/reason" },
      { title: "Relationship", href: "/masters/administrative-general-masters/relationship" },
    ],
  },
];

export const navigation: NavigationSection[] = [
  {
    title: "Masters",
    href: "/masters",
  },
  {
    title: "Patient Login",
    href: "/patient-login",
  },
  {
    title: "Check in",
    href: "/checkin",
  },
  {
    title: "Patient Vitals",
    href: "/patient-vitals"
  },
  {
    title: "Doctor Consultation",
    href: "/doctor-consultation",
  },
  {
    title: "Schedule",
    href: "/doctor-schedule",
  },

  {
    title: "Pharmacy",
    items: [
      {
        title: "Pharmacy Dispensing",
        href: "/pharmacy-dispensing",
      },
      { title: "Pricing", href: "/pricing" },
      {
        title: "Discount Schema",
        href: "/discount-schema",
      },
    ],
  },
  {
    title: "Billing",
    items: [
      { title: "Consultation Billing", href: "/billing/consultation-billing" },
      { title: "Pharmacy Billing", href: "/billing/pharmacy-billing" },
    ],
  },

  {
    title: "Bed Management",
    items: [
      { title: "Infrastructure Setup", href: "/bed-management/infrastructure" },
      { title: "Floor Plan", href: "/bed-management/floor-plan" },
      { title: "Bed Allocation", href: "/bed-management/allocation" },
      { title: "Bed Transfer", href: "/bed-management/transfer" },
      { title: "Dashboard", href: "/bed-management/dashboard" },
      { title: "Reports", href: "/bed-management/reports" },
    ],
  },

  {
    title: "Records",
    href: "/records",
  },
  {
    title: "Manage Users",
    href: "/manage-users",
  },
  {
    title: "Hidden",
    items: [
      {
        title: "Pharmacy",
        items: [
          { title: "Purchase", href: "/pharmacy/purchase" },
          { title: "Inventory", href: "/pharmacy/inventory" },
          { title: "Dispensing", href: "/pharmacy/dispensing" },
          { title: "GRN", href: "/pharmacy/grn" },
          { title: "Supplier", href: "/pharmacy/supplier" },
        ],
      },
      {
        title: "Queue Management",
        items: [
          { title: "Out Patient", href: "/queue-management/out-patient" },
          { title: "In Patient", href: "/queue-management/in-patient" },
          { title: "Pharmacist Screen", href: "/queue-management/pharmacist-screen" },
        ],
      },
      {
        title: "Patient Registration",
        href: "/patient-registration",
      },
    ],
  }
];
