"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "../../../components/ui/button";
import PatientProfileMenu from "../../../components/patient-profile-menu";

export default function HospitalPatientDashboardPage() {
  const params = useParams();
  const hname = params?.Hname ? decodeURIComponent(params.Hname as string) : null;
  const [patientName, setPatientName] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

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
          <Button variant="outline" onClick={() => setIsOpen(true)}>Profile</Button>
          <PatientProfileMenu isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </div>
      </div>

      <div className="mt-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6">This is a simple patient dashboard placeholder.</div>
      </div>
    </div>
  );
}
