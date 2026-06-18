import {
  MastersFormPage,
  type MastersFormField,
} from "../../../../../components/masters-form-page";

const medicineUsageFields: MastersFormField[] = [
  { id: "code", label: "Code", type: "text", pattern: "[a-zA-Z0-9]*", placeholder: "Auto running number" },
  {
    id: "medicineUsageMethod",
    label: "Medicine usage method",
    type: "text",
    maxLength: 255,
    pattern: "[a-zA-Z\\s]*",
  },
  {
    id: "toBeTakenAt",
    label: "To be taken at",
    type: "multiselect",
    options: ["Morning", "Mid-day", "Evening", "Sleep", "Need basis"],
    note: "Multiple Selection allowed",
  },
  { id: "remarks", label: "Remarks", type: "textarea", fullWidth: true },
  { id: "activeFrom", label: "Active From", type: "datetime-local" },
  {
    id: "inactiveFrom",
    label: "Inactive From",
    type: "datetime-local",
    note: "Initially it's Empty",
  },
  {
    id: "inactiveReason",
    label: "Inactive Reason",
    type: "textarea",
    fullWidth: true,
  },
];

export default function MedicineUsagePage() {
  return (
    <MastersFormPage
      title="Masters - Lab Hospital Facility Masters - Medicine Usage"
      cardTitle="Medicine Usage"
      description=""
      fields={medicineUsageFields}
    />
  );
}
