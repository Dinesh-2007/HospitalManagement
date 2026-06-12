import { useParams } from "next/navigation";

export default function HospitalPatientAppointmentsPage() {
  const params = useParams();
  const hname = params?.Hname ? decodeURIComponent(params.Hname as string) : null;
  return (
    <div>
      <h1 className="text-2xl font-semibold">{hname ? `${hname} - My Appointments` : "My Appointments"}</h1>
      <p className="mt-4">Placeholder for patient appointments.</p>
    </div>
  );
}
