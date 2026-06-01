import {
  MastersFormPage,
  type MastersFormField,
} from "../../../components/masters-form-page";
import { PrescriptionTable } from "./prescription-table";

const doctorConsultationFields: MastersFormField[] = [
  { id: "tokenNumber", label: "Token Number", type: "text", size: "small" },
  { id: "patientDetails", label: "Patient Details", type: "text", size: "small" },
  { id: "diagnosisName", label: "Diagnosis Name", type: "text", size: "small" },
  { id: "symptoms", label: "Symptoms", type: "text", size: "small", colStart: 1 },
  { id: "remarks", label: "Remarks", type: "textarea", size: "medium", colStart: 2 },
];

export default function DoctorConsultationPage() {
  return (
    <MastersFormPage
      title="Doctor Consultation"
      cardTitle="Doctor Consultation Entry"
      description=""
      fields={doctorConsultationFields}
      backButtonText="Back to Doctor Consultation"
      backHref="/doctor-consultation"
      columns={3}
    >
      <PrescriptionTable />
    </MastersFormPage>
  );
}
