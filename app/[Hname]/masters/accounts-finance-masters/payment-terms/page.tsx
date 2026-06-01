import {
  MastersFormPage,
  type MastersFormField,
} from "../../../../../components/masters-form-page";

const dayOptions = Array.from({ length: 31 }, (_, index) => `${index + 1}`);

const paymentTermsFields: MastersFormField[] = [
  {
    id: "code",
    label: "Code",
    type: "text",
    pattern: "[a-zA-Z0-9]*",
    placeholder: "Enter code",
    inputMode: "text",
  },
  {
    id: "name",
    label: "Name",
    type: "text",
    pattern: "[a-zA-Z0-9\\s]*",
    placeholder: "Enter name",
    maxLength: 200,
  },
  {
    id: "type",
    label: "Type",
    type: "select",
    options: ["Immediate", "Days", "Month"],
  },
  {
    id: "days",
    label: "Days",
    type: "select",
    options: dayOptions,
  },
  {
    id: "month",
    label: "Month",
    type: "select",
    options: dayOptions,
  },
  {
    id: "description",
    label: "Description",
    type: "text",
    pattern: "[a-zA-Z\\s]*",
    placeholder: "Enter description",
    maxLength: 300,
    fullWidth: true,
  },
];

export default function PaymentTermsPage() {
  return (
    <MastersFormPage
      title="Masters - Accounts Finance Masters - Payment Terms"
      cardTitle="Payment Terms"
      description=""
      fields={paymentTermsFields}
    />
  );
}
