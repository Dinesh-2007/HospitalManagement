import { useParams } from "next/navigation";

export default function HospitalPatientProfilePage() {
  const params = useParams();
  const hname = params?.Hname ? decodeURIComponent(params.Hname as string) : null;
  return (
    <div>
      <h1 className="text-2xl font-semibold">{hname ? `${hname} - Edit Profile` : "Edit Profile"}</h1>
      <p className="mt-4">Placeholder for editing patient profile.</p>
    </div>
  );
}
