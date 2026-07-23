import {
  MastersFormPage,
  type MastersFormField,
} from "../../../../../components/masters-form-page";

const roomPurposeFields: MastersFormField[] = [
  { id: "code", label: "Code", type: "text", pattern: "[a-zA-Z0-9]*" },
  {
    id: "description",
    label: "Description",
    type: "text",
    maxLength: 500,
    pattern: "[a-zA-Z\\s]*",
  },
  { id: "activeFrom", label: "Active From", type: "datetime-local" },
  {
    id: "inactiveDateFrom",
    label: "Inactivate Date From",
    type: "datetime-local",
  },
  {
    id: "inactiveReason",
    label: "Inactivate Reason",
    type: "textarea",
    fullWidth: true,
  },
];

export default function RoomPurposePage() {
  return (
    <MastersFormPage
      title="Masters - Lab Hospital Facility Masters - Room Purpose"
      cardTitle="Room Purpose Master"
      description=""
      fields={roomPurposeFields}
    />
  );
}
