"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "../../../components/ui/button";
import BookAppointmentPage from "../book-appointment/page";

export default function HospitalPatientDashboardPage() {
  const params = useParams();
  const hname = params?.Hname ? decodeURIComponent(params.Hname as string) : null;
  const router = useRouter();
  const [patientName, setPatientName] = useState<string | null>(null);

  useEffect(() => {
    try {
      const name = localStorage.getItem("patientName");
      setPatientName(name || "Patient");
    } catch (e) {
      setPatientName("Patient");
    }
  }, []);

  return (
    <div className="min-h-[60vh]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{hname ? `${hname} - Patient Dashboard` : "Patient Dashboard"}</h1>
        <div className="flex items-center gap-3 relative">
          <div className="text-sm text-gray-700">WELCOME {patientName}</div>
          <Button variant="outline" onClick={() => router.push(`/${hname}/patient-appointments`)}>Profile</Button>
        </div>
      </div>

      <div className="mt-6">
        <BookAppointmentPage />
      </div>
    </div>
  );
}
