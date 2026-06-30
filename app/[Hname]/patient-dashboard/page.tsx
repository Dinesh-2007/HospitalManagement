"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PatientProfileLayout } from "../../../components/patient-profile-layout";

type AppointmentRow = {
  id?: number;
  appointment_date?: string | null;
  appointment_time?: string | null;
  appointment_end_time?: string | null;
  department?: string | null;
  doctor?: string | null;
  status?: string | null;
  appointment_id_display?: string | null;
};

function formatDate(d?: string | null) {
  if (!d) return "–";
  try {
    const [y, mo, da] = d.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" })
      .format(new Date(y, mo - 1, da));
  } catch { return d; }
}

function formatTime(t?: string | null) {
  if (!t) return "";
  const m = t.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return t;
  const h = Number(m[1]), min = Number(m[2]);
  return `${h % 12 || 12}:${String(min).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function PatientDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const hname = params?.Hname ? decodeURIComponent(params.Hname as string) : "";

  const [patientName, setPatientName] = useState("Patient");
  const [patientPhone, setPatientPhone] = useState("");
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [familyCount, setFamilyCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const name = window.localStorage.getItem("patientName") ?? "Patient";
      const phone = window.localStorage.getItem("patientPhone") ?? "";
      setPatientName(name || "Patient");
      setPatientPhone(phone);
    } catch { }
  }, []);

  useEffect(() => {
    if (!hname || !patientPhone) return;
    async function loadData() {
      setLoading(true);
      try {
        // Load appointments for the patient
        const res = await fetch(
          `/api/${encodeURIComponent(hname)}/appointments?patientId=${encodeURIComponent(patientPhone)}`,
          { cache: "no-store" }
        );
        const data = (await res.json().catch(() => ({}))) as { rows?: AppointmentRow[] };
        setAppointments(data.rows ?? []);

        // Load family members count
        const parentPhone = window.localStorage.getItem("patientPhone") ?? "";
        const parentName = window.localStorage.getItem("patientName") ?? "";
        const famRes = await fetch(
          `/api/${encodeURIComponent(hname)}/patient-auth?parentPhone=${encodeURIComponent(parentPhone)}&parentName=${encodeURIComponent(parentName)}`,
          { cache: "no-store" }
        );
        const famData = (await famRes.json().catch(() => ({}))) as { rows?: unknown[] };
        setFamilyCount((famData.rows ?? []).length);
      } catch { /* silently fail */ } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, [hname, patientPhone]);

  const now = new Date();

  const totalVisits = appointments.length;

  const upcomingAppointments = useMemo(() =>
    appointments.filter((a) => {
      if (!a.appointment_date || !a.appointment_time) return false;
      const d = new Date(`${a.appointment_date}T${a.appointment_time}`);
      return !isNaN(d.getTime()) && d >= now && (a.status === "Scheduled" || !a.status);
    }), [appointments]);

  const lastVisit = useMemo(() => {
    const past = appointments
      .filter((a) => {
        if (!a.appointment_date) return false;
        const d = new Date(`${a.appointment_date}T${a.appointment_time ?? "00:00"}`);
        return !isNaN(d.getTime()) && d < now;
      })
      .sort((x, y) => {
        const dx = new Date(`${x.appointment_date}T${x.appointment_time ?? "00:00"}`).getTime();
        const dy = new Date(`${y.appointment_date}T${y.appointment_time ?? "00:00"}`).getTime();
        return dy - dx;
      });
    return past[0] ?? null;
  }, [appointments]);

  const recentAppointments = useMemo(() => {
    return [...appointments]
      .sort((x, y) => {
        const dx = new Date(`${x.appointment_date ?? ""}T${x.appointment_time ?? "00:00"}`).getTime();
        const dy = new Date(`${y.appointment_date ?? ""}T${y.appointment_time ?? "00:00"}`).getTime();
        return dy - dx;
      })
      .slice(0, 5);
  }, [appointments]);

  const statCards = [
    {
      label: "Total Visits",
      value: loading ? "…" : String(totalVisits),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      gradient: "from-blue-500 to-indigo-600",
      bg: "from-blue-50 to-indigo-50",
      iconBg: "bg-blue-100 text-blue-600",
    },
    {
      label: "Upcoming",
      value: loading ? "…" : String(upcomingAppointments.length),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      gradient: "from-emerald-500 to-teal-600",
      bg: "from-emerald-50 to-teal-50",
      iconBg: "bg-emerald-100 text-emerald-600",
    },
    {
      label: "Last Visit",
      value: loading ? "…" : (lastVisit ? formatDate(lastVisit.appointment_date) : "No visits yet"),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradient: "from-violet-500 to-purple-600",
      bg: "from-violet-50 to-purple-50",
      iconBg: "bg-violet-100 text-violet-600",
    },
    {
      label: "Family Members",
      value: loading ? "…" : String(familyCount),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      gradient: "from-rose-500 to-pink-600",
      bg: "from-rose-50 to-pink-50",
      iconBg: "bg-rose-100 text-rose-600",
    },
  ];

  const statusBadge = (status?: string | null) => {
    const now2 = new Date();
    if (status === "Cancelled") return { label: "Cancelled", cls: "bg-rose-100 text-rose-700" };
    if (status === "Scheduled" || !status) return { label: "Scheduled", cls: "bg-teal-100 text-teal-700" };
    if (status === "Rescheduled") return { label: "Rescheduled", cls: "bg-amber-100 text-amber-700" };
    return { label: status, cls: "bg-gray-100 text-gray-600" };
  };

  return (
    <PatientProfileLayout activeTab="dashboard" hname={hname}>
      {/* Welcome Banner */}
      <div className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-500 to-indigo-600 p-8 shadow-2xl shadow-brand-500/20 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.15),transparent_60%)]" />
        <div className="absolute -bottom-8 -right-8 h-48 w-48 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-white/5" />
        <div className="relative">
          <p className="text-sm font-medium text-brand-100 uppercase tracking-widest">{greeting()}</p>
          <h1 className="mt-1 text-3xl font-bold text-white">{patientName} 👋</h1>
          <p className="mt-2 text-brand-100/80 text-sm max-w-md">
            Welcome to your health dashboard at <span className="font-semibold text-white">{hname}</span>. Stay on top of your health journey.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/${encodeURIComponent(hname)}/patient-book-appointment`}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 shadow-md hover:bg-brand-50 transition-all active:scale-95"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Book Appointment
            </Link>
            <Link
              href={`/${encodeURIComponent(hname)}/patient-appointments`}
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20 transition-all active:scale-95"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              My Appointments
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-8">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.bg} border border-white/80 p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 dark:border-gray-800`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{card.label}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{card.value}</p>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.iconBg} shadow-sm`}>
                {card.icon}
              </div>
            </div>
            {/* Subtle gradient line */}
            <div className={`absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r ${card.gradient} opacity-60 rounded-b-2xl`} />
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Recent Appointments */}
        <div className="xl:col-span-2 rounded-2xl border border-gray-200/80 bg-white/90 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/60">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5 dark:border-gray-800">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Recent Appointments</h3>
              <p className="text-xs text-gray-500 mt-0.5">Your latest scheduled visits</p>
            </div>
            <Link
              href={`/${encodeURIComponent(hname)}/patient-appointments`}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition"
            >
              View all →
            </Link>
          </div>

          <div className="divide-y divide-gray-100/80 dark:divide-gray-800">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-500" />
              </div>
            ) : recentAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50">
                  <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                </div>
                <p className="mt-3 text-sm font-medium text-gray-500">No appointments yet</p>
                <Link href={`/${encodeURIComponent(hname)}/patient-book-appointment`} className="mt-3 text-xs font-semibold text-brand-600 hover:underline">
                  Book your first appointment →
                </Link>
              </div>
            ) : (
              recentAppointments.map((appt, i) => {
                const badge = statusBadge(appt.status);
                return (
                  <div key={appt.id ?? i} className="flex items-center gap-4 px-6 py-4 transition hover:bg-gray-50/60 dark:hover:bg-gray-800/20">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-gray-900 dark:text-white text-sm">{appt.doctor ?? "Doctor"}</p>
                      <p className="text-xs text-gray-500">{appt.department ?? "General"}</p>
                    </div>
                    {appt.appointment_id_display && (
                      <div className="flex-shrink-0 text-right">
                        <span className="inline-block rounded-md bg-indigo-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-indigo-600">{appt.appointment_id_display}</span>
                      </div>
                    )}
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-medium text-gray-700">{formatDate(appt.appointment_date)}</p>
                      <p className="text-[11px] text-gray-400">{formatTime(appt.appointment_time)}</p>
                    </div>
                    <span className={`ml-2 flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Quick Actions + Upcoming Card */}
        <div className="flex flex-col gap-6">
          {/* Quick Actions */}
          <div className="rounded-2xl border border-gray-200/80 bg-white/90 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/60">
            <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Quick Actions</h3>
            </div>
            <div className="flex flex-col gap-2.5 p-4">
              {[
                {
                  label: "Book Appointment",
                  href: `/${encodeURIComponent(hname)}/patient-book-appointment`,
                  icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
                  cls: "bg-brand-500 text-white hover:bg-brand-600",
                },
                {
                  label: "My Appointments",
                  href: `/${encodeURIComponent(hname)}/patient-appointments`,
                  icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
                  cls: "bg-gray-100 text-gray-700 hover:bg-gray-200",
                },
                {
                  label: "Manage Family",
                  href: `/${encodeURIComponent(hname)}/manage-family`,
                  icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
                  cls: "bg-gray-100 text-gray-700 hover:bg-gray-200",
                },
                {
                  label: "Edit Profile",
                  href: `/${encodeURIComponent(hname)}/patient-registration?mode=edit`,
                  icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
                  cls: "bg-gray-100 text-gray-700 hover:bg-gray-200",
                },
              ].map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all active:scale-95 ${action.cls}`}
                >
                  {action.icon}
                  {action.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Upcoming Appointment Highlight */}
          {upcomingAppointments.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 shadow-sm">
              <div className="border-b border-emerald-100 px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="text-sm font-semibold text-emerald-800">Next Appointment</h3>
                </div>
              </div>
              <div className="px-5 py-4">
                <p className="text-lg font-bold text-gray-900">{upcomingAppointments[0].doctor ?? "Doctor"}</p>
                <p className="text-xs text-gray-500 mt-0.5">{upcomingAppointments[0].department ?? "General"}</p>
                {upcomingAppointments[0].appointment_id_display && (
                  <div className="mt-2">
                    <span className="inline-block rounded-md bg-emerald-100 px-2.5 py-1 font-mono text-xs font-semibold text-emerald-700">{upcomingAppointments[0].appointment_id_display}</span>
                  </div>
                )}
                <div className="mt-3 flex items-center gap-2 text-sm font-medium text-emerald-700">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {formatDate(upcomingAppointments[0].appointment_date)} · {formatTime(upcomingAppointments[0].appointment_time)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </PatientProfileLayout>
  );
}
