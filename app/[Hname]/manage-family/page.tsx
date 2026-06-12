import { useParams } from "next/navigation";

export default function HospitalManageFamilyPage() {
  const params = useParams();
  const hname = params?.Hname ? decodeURIComponent(params.Hname as string) : null;
  return (
    <div>
      <h1 className="text-2xl font-semibold">{hname ? `${hname} - Manage Family member` : "Manage Family member"}</h1>
      <p className="mt-4">Placeholder for managing family members.</p>
    </div>
  );
}
