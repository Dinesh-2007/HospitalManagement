import { redirect } from "next/navigation";

export default async function HospitalPatientProfilePage({
  params,
}: {
  params: Promise<{ Hname: string }>;
}) {
  const resolved = await params;
  redirect(`/${encodeURIComponent(resolved.Hname)}/patient-registration?mode=edit`);
}
