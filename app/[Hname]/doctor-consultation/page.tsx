"use client";

import {
  MastersFormPage,
  type MastersFormField,
  type MastersFormPageRenderProps,
} from "../../../components/masters-form-page";
import { PrescriptionTable } from "./prescription-table";

const doctorConsultationFields: MastersFormField[] = [
  { id: "tokenNumber", label: "Token Number", type: "text", size: "small" },
  { id: "patientDetails", label: "Patient Details", type: "text", size: "small" },
  { id: "diagnosisName", label: "Diagnosis Name", type: "text", size: "small" },
  { id: "symptoms", label: "Symptoms", type: "text", size: "small", colStart: 1 },
  { id: "remarks", label: "Remarks", type: "textarea", size: "medium", colStart: 2 },
  { id: "followUpDays", label: "Follow-up Days", type: "number", size: "small" },
  { id: "consultationAmount", label: "Consultation Amount", type: "number", size: "small" },
  // Pharmacy needs prescribed medicine lines; store as JSON textarea.
  { id: "prescriptionLines", label: "Prescription Lines", type: "textarea", size: "medium", colStart: 1, note: "Auto-saved medicine lines for Pharmacy Dispensing" },
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
      {({ formValues, updateFieldValueById, formStateVersion }: MastersFormPageRenderProps) => (
        <PrescriptionTable
          key={formStateVersion}
          value={typeof formValues.prescriptionLines === "string" ? formValues.prescriptionLines : ""}
          onChange={(value) => updateFieldValueById("prescriptionLines", value)}
        />
      )}
    </MastersFormPage>
  );
}
