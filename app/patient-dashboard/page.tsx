"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../components/ui/button";

export default function PatientDashboardPage() {
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
        <h1 className="text-2xl font-semibold">Patient Dashboard</h1>
        <div className="flex items-center gap-3 relative">
          <div className="text-sm text-gray-700">WELCOME {patientName}</div>
          <Button variant="outline" onClick={() => router.push(`/patient-appointments`)}>Profile</Button>
        </div>
      </div>

      <div className="mt-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6">This is a simple patient dashboard placeholder.</div>
      </div>
    </div>
  );
}
