import {
  MastersFormPage,
  type MastersFormField,
} from "../../../../../components/masters-form-page";

const relationshipFields: MastersFormField[] = [
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
    label: "Relationship Name",
    type: "text",
    pattern: "[a-zA-Z\\s]*",
    placeholder: "Enter relationship name",
    maxLength: 150,
  },
];

export default function RelationshipPage() {
  return (
    <MastersFormPage
      title="Masters - Administrative General Masters - Relationship"
      cardTitle="Relationship"
      description=""
      fields={relationshipFields}
    />
  );
}
