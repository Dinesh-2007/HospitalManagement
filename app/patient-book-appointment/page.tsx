import { redirect } from "next/navigation";

export default function PatientBookAppointmentPage() {
  // Redirect to the hospital-scoped book appointment page
  // In a real scenario, this would need to know the hospital name
  // For now, redirect to home (patient can access from dashboard with hospital context)
  redirect("/");
}
