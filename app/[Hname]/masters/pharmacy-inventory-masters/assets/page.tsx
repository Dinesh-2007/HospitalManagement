import {
  MastersFormPage,
  type MastersFormField,
} from "../../../../../components/masters-form-page";

const assetsFields: MastersFormField[] = [
  {
    id: "code",
    label: "Code",
    type: "text",
    placeholder: "Enter code",
    maxLength: 50,
    pattern: "[a-zA-Z0-9]*",
  },
  {
    id: "description",
    label: "Description",
    type: "text",
    placeholder: "Enter description",
    maxLength: 500,
    pattern: "[a-zA-Z\\s]*",
  },
];

export default function AssetsPage() {
  return (
    <MastersFormPage
      title="Masters - Pharmacy Inventory Masters - Assets"
      cardTitle="Assets Master"
      description=""
      fields={assetsFields}
    />
  );
}
