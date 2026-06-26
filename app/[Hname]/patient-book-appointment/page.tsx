"use client";

import { useParams } from "next/navigation";
import { PatientProfileLayout } from "../../../components/patient-profile-layout";
import BookAppointmentContent from "../book-appointment/page";

export default function PatientBookAppointmentPage() {
    const params = useParams();
    const hname = params?.Hname ? decodeURIComponent(params.Hname as string) : "";

    return (
        <PatientProfileLayout activeTab="book" hname={hname}>
            <div className="mx-auto max-w-6xl">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Book Appointment</h2>
                    <p className="mt-1 text-sm text-gray-500">Choose a doctor and select your preferred time slot</p>
                </div>
                <BookAppointmentContent />
            </div>
        </PatientProfileLayout>
    );
}
