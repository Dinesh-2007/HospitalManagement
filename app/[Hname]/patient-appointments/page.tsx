"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { BlankPage } from "../../../components/blank-page";

type AppointmentRow = {
  id?: number;
  appointment_date?: string | null;
  appointment_time?: string | null;
  appointment_end_time?: string | null;
  department?: string | null;
  doctor?: string | null;
  status?: string | null;
  reschedule_count?: number | null;
  created_at?: string | null;
};

function formatTimeRange(start?: string | null, end?: string | null) {
  if (!start) return "-";
  if (!end) return start;
  return `${start} - ${end}`;
}

export default function HospitalPatientAppointmentsPage() {
  const params = useParams();
  const hname = params?.Hname ? decodeURIComponent(params.Hname as string) : null;
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patient, setPatient] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    try {
      const patientId = typeof window === "undefined" ? "" : window.localStorage.getItem("patientPhone") ?? "";
      const patientName = typeof window === "undefined" ? "" : window.localStorage.getItem("patientName") ?? "";
      if (patientId || patientName) {
        setPatient({ id: patientId, name: patientName });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    async function loadAppointments() {
      if (!hname) return;
      try {
        const patientPhone = typeof window === "undefined" ? "" : window.localStorage.getItem("patientPhone") ?? "";
        const patientName = typeof window === "undefined" ? "" : window.localStorage.getItem("patientName") ?? "";
        const response = await fetch(
          `/api/${encodeURIComponent(hname)}/appointments?patientId=${encodeURIComponent(patientPhone)}&doctorNames=${encodeURIComponent("")}`,
          { cache: "no-store" },
        );
        let data = (await response.json().catch(() => ({}))) as { rows?: AppointmentRow[]; error?: string };

        if (!response.ok || (data.rows ?? []).length === 0) {
          const fallback = await fetch(
            `/api/${encodeURIComponent(hname)}/appointments?patientId=${encodeURIComponent(patientPhone || patientName)}`,
            { cache: "no-store" },
          );
          data = (await fallback.json().catch(() => ({}))) as { rows?: AppointmentRow[]; error?: string };
          if (!fallback.ok) throw new Error(data.error ?? "Failed to load appointments.");
          setAppointments(data.rows ?? []);
          return;
        }

        setAppointments(data.rows ?? []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load appointments.");
      } finally {
        setLoading(false);
      }
    }

    void loadAppointments();
  }, [hname]);

  const rows = useMemo(
    () =>
      appointments.map((appointment) => ({
        ...appointment,
        appointment_date: appointment.appointment_date ?? null,
        appointment_time: appointment.appointment_time ?? null,
        appointment_end_time: appointment.appointment_end_time ?? null,
      })),
    [appointments],
  );

  return (
    <BlankPage title="My Appointments">
      <section className="rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-5">
          <h3 className="text-base font-medium text-gray-800">My Appointments</h3>
          <p className="mt-1 text-sm text-gray-500">Booked appointments for {patient?.name || "you"}.</p>
        </div>
        <div className="p-6">
          {loading ? (
            <p className="text-sm text-gray-500">Loading appointments...</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-500">No appointments booked yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-gray-500">Date</th>
                    <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-gray-500">Time</th>
                    <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-gray-500">Department</th>
                    <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-gray-500">Doctor</th>
                    <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((appointment) => (
                    <tr key={appointment.id}>
                      <td className="px-4 py-3 text-gray-700">{appointment.appointment_date || "-"}</td>
                      <td className="px-4 py-3 text-gray-700">{formatTimeRange(appointment.appointment_time, appointment.appointment_end_time)}</td>
                      <td className="px-4 py-3 text-gray-700">{appointment.department || "-"}</td>
                      <td className="px-4 py-3 text-gray-700">{appointment.doctor || "-"}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {appointment.status || "Scheduled"}
                        {appointment.reschedule_count ? ` (${appointment.reschedule_count})` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </BlankPage>
  );
}
