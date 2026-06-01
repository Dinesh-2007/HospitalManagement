import {
  MastersFormPage,
  type MastersFormField,
} from "../../../../../components/masters-form-page";

const departmentMasterFields: MastersFormField[] = [
  {
    id: "code",
    label: "Code",
    type: "text",
    pattern: "[a-zA-Z0-9]*",
    placeholder: "Enter code",
    note: "",
  },
  {
    id: "departmentType",
    label: "Name",
    type: "text",
    placeholder: "Enter department name",
    maxLength: 100,
    note: "Free Text",
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
];

export default function DepartmentMasterPage() {
  return (
    <MastersFormPage
      title="Masters - Pharmacy Inventory Masters - Department Master"
      cardTitle="Department Master"
      description=""
      fields={departmentMasterFields}
    />
  );
}
