"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { BlankPage } from "../../../components/blank-page";
import { withSalutation } from "../../../lib/salutation";

/* ─── Types ─────────────────────────────────────────────────────── */
type AppointmentRow = {
  id?: number;
  appointment_date?: string | null;
  appointment_time?: string | null;
  appointment_end_time?: string | null;
  department?: string | null;
  doctor?: string | null;
  status?: string | null;
  reschedule_count?: number | null;
  patient_name?: string | null;
  patient_phone?: string | null;
  transferred_from_doctor?: string | null;
  transferred_to_doctor?: string | null;
  transferred_at?: string | null;
  created_at?: string | null;
};

type FamilyMember = {
  id: number;
  name: string;
  phone: string;
  relationship: string;
};

type DisplayRow = {
  id: string | number;
  appointment_date: string | null;
  appointment_time: string | null;
  appointment_end_time: string | null;
  department: string | null;
  doctor: string | null;
  status: string;
  displayStatus: string;
  reschedule_count: number | null;
  patient_name: string | null;
  isTransferred?: boolean;
};

/* ─── Helpers ────────────────────────────────────────────────────── */
function formatTimeRange(start?: string | null, end?: string | null) {
  if (!start) return "–";
  const fmt = (t: string) => {
    const m = t.trim().match(/^(\d{1,2}):(\d{2})/);
    if (!m) return t;
    const h = Number(m[1]), min = Number(m[2]);
    return `${h % 12 || 12}:${String(min).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  };
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

function formatDate(d?: string | null) {
  if (!d) return "–";
  try {
    const [y, mo, da] = d.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "2-digit" })
      .format(new Date(y, mo - 1, da));
  } catch { return d; }
}

function normalizePhone(v: string) { return v.replace(/\D/g, ""); }

function synthesizeRows(appts: AppointmentRow[], patientLabel: string | null): DisplayRow[] {
  const list: DisplayRow[] = [];
  for (const a of appts) {
    const date = a.appointment_date ?? null;
    const time = a.appointment_time ?? null;
    const endTime = a.appointment_end_time ?? null;
    const pname = patientLabel ?? a.patient_name ?? null;

    // Transferred origin row
    if (a.transferred_from_doctor) {
      list.push({
        id: `${a.id ?? Math.random()}_transferred`,
        appointment_date: date,
        appointment_time: time,
        appointment_end_time: endTime,
        department: a.department ?? null,
        doctor: a.transferred_from_doctor,
        status: "Transferred",
        displayStatus: `Transferred → ${a.doctor}`,
        reschedule_count: null,
        patient_name: pname,
        isTransferred: true,
      });
    }

    // Active row
    list.push({
      id: a.id ?? Math.random(),
      appointment_date: date,
      appointment_time: time,
      appointment_end_time: endTime,
      department: a.department ?? null,
      doctor: a.doctor ?? null,
      status: a.status || "Scheduled",
      displayStatus:
        a.status === "Cancelled"
          ? "Cancelled"
          : a.transferred_from_doctor
            ? `${a.status || "Scheduled"} (from ${a.transferred_from_doctor})`
            : a.status || "Scheduled",
      reschedule_count: a.reschedule_count ?? null,
      patient_name: pname,
    });
  }
  return list;
}

/* ─── Component ──────────────────────────────────────────────────── */
export default function HospitalPatientAppointmentsPage() {
  const params = useParams();
  const hname = params?.Hname ? decodeURIComponent(params.Hname as string) : null;

  // Logged-in patient
  const [self, setSelf] = useState<{ phone: string; name: string; gender: string } | null>(null);
  // Family members linked to this patient
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);

  // Map: phone → appointments[]
  const [allAppointments, setAllAppointments] = useState<Record<string, AppointmentRow[]>>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state: "all" | "myself" | relationship string
  const [filterRelationship, setFilterRelationship] = useState<string>("all");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* — load self from localStorage — */
  useEffect(() => {
    try {
      const phone = window.localStorage.getItem("patientPhone") ?? "";
      const name = window.localStorage.getItem("patientName") ?? "";
      const gender = window.localStorage.getItem("patientGender") ?? "";
      if (phone || name) setSelf({ phone, name, gender });
    } catch { /**/ }
  }, []);

  /* — close dropdown on outside click — */
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  /* — load family members + appointments — */
  useEffect(() => {
    if (!hname || !self) return;

    async function loadAll() {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch patient table to find family members
        const ptRes = await fetch(
          `/api/${encodeURIComponent(hname!)}/forms/patient_registration`,
          { cache: "no-store" }
        );
        const ptData = (await ptRes.json().catch(() => ({}))) as { rows?: Record<string, unknown>[] };
        const ptRows = ptData.rows ?? [];

        const myPhone = normalizePhone(self!.phone);
        const myName = self!.name.trim().toLowerCase();

        const members: FamilyMember[] = ptRows
          .filter((r) => {
            const linked = String(r.linked_patient_id ?? r.linkedPatientId ?? "").trim();
            if (!linked) return false;
            const linkedPhone = normalizePhone(linked);
            return (
              (myPhone && linkedPhone === myPhone) ||
              (myName && linked.trim().toLowerCase() === myName)
            );
          })
          .map((r) => ({
            id: Number(r.id ?? 0),
            name: String(r.patient_name ?? r.patientName ?? ""),
            phone: String(r.mobile ?? ""),
            relationship: String(
              r.relationship_ship_linked_patient ??
              r.relationshipShipLinkedPatient ??
              r.relationship ?? ""
            ).trim(),
          }))
          .filter((m) => m.name);

        setFamilyMembers(members);

        // 2. Fetch appointments for self + each family member
        const targets: { key: string; label: string; relationship: string }[] = [
          { key: self!.phone || self!.name, label: self!.name || "Myself", relationship: "myself" },
          ...members.map((m) => ({
            key: m.phone || m.name,
            label: m.name,
            relationship: m.relationship || "family",
          })),
        ];

        const map: Record<string, AppointmentRow[]> = {};
        await Promise.all(
          targets.map(async (t) => {
            try {
              const res = await fetch(
                `/api/${encodeURIComponent(hname!)}/appointments?patientId=${encodeURIComponent(t.key)}`,
                { cache: "no-store" }
              );
              const d = (await res.json().catch(() => ({}))) as { rows?: AppointmentRow[] };
              map[t.key] = d.rows ?? [];
            } catch {
              map[t.key] = [];
            }
          })
        );
        setAllAppointments(map);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load appointments.");
      } finally {
        setLoading(false);
      }
    }

    void loadAll();
  }, [hname, self]);

  /* — distinct relationships — */
  const relationships = useMemo(() => {
    const set = new Set<string>();
    for (const m of familyMembers) {
      if (m.relationship) set.add(m.relationship);
    }
    return Array.from(set).sort();
  }, [familyMembers]);

  /* — build display rows based on filter — */
  const rows = useMemo<DisplayRow[]>(() => {
    if (!self) return [];

    const selfKey = self.phone || self.name;

    if (filterRelationship === "myself") {
      return synthesizeRows(allAppointments[selfKey] ?? [], self.name || "Myself");
    }

    if (filterRelationship === "all") {
      const list: DisplayRow[] = [];
      // Self first
      list.push(...synthesizeRows(allAppointments[selfKey] ?? [], self.name || "Myself"));
      // Family members
      for (const m of familyMembers) {
        const key = m.phone || m.name;
        list.push(...synthesizeRows(allAppointments[key] ?? [], m.name));
      }
      return list;
    }

    // Specific relationship filter
    const matched = familyMembers.filter((m) => m.relationship === filterRelationship);
    const list: DisplayRow[] = [];
    for (const m of matched) {
      const key = m.phone || m.name;
      list.push(...synthesizeRows(allAppointments[key] ?? [], m.name));
    }
    return list;
  }, [self, familyMembers, allAppointments, filterRelationship]);

  /* — filter label — */
  const filterLabel = useMemo(() => {
    if (filterRelationship === "all") return "All Members";
    if (filterRelationship === "myself") return self?.name || "Myself";
    return filterRelationship;
  }, [filterRelationship, self]);

  /* ─── Render ─────────────────────────────────────────────────── */
  return (
    <BlankPage title="My Appointments">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white/90 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.08)] backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/60">

          {/* Header */}
          <div className="flex flex-col gap-4 px-8 py-7 border-b border-gray-100 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-bold tracking-tight text-gray-950 dark:text-white">
                Appointment History
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Viewing appointments for{" "}
                <span className="font-semibold text-brand-600 dark:text-brand-400">
                  {filterLabel}
                </span>
              </p>
            </div>

            {/* Family filter dropdown */}
            <div className="relative shrink-0" ref={dropdownRef}>
              <button
                id="family-filter-btn"
                type="button"
                onClick={() => setDropdownOpen((v) => !v)}
                className="inline-flex items-center gap-2.5 rounded-2xl border border-brand-200 bg-brand-50 px-5 py-2.5 text-sm font-semibold text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/20"
              >
                {/* people icon */}
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m4-4a4 4 0 100-8 4 4 0 000 8zm6 0a3 3 0 100-6 3 3 0 000 6z" />
                </svg>
                {filterLabel}
                <svg
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900 animate-in fade-in slide-in-from-top-1 duration-150">
                  {/* ALL */}
                  <button
                    type="button"
                    id="filter-all"
                    onClick={() => { setFilterRelationship("all"); setDropdownOpen(false); }}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      filterRelationship === "all"
                        ? "bg-brand-50 text-brand-700 font-semibold dark:bg-brand-500/10 dark:text-brand-300"
                        : "text-gray-700 dark:text-gray-200"
                    }`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m4-4a4 4 0 100-8 4 4 0 000 8zm6 0a3 3 0 100-6 3 3 0 000 6z" />
                      </svg>
                    </span>
                    All Members
                  </button>

                  {/* MYSELF */}
                  <button
                    type="button"
                    id="filter-myself"
                    onClick={() => { setFilterRelationship("myself"); setDropdownOpen(false); }}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      filterRelationship === "myself"
                        ? "bg-brand-50 text-brand-700 font-semibold dark:bg-brand-500/10 dark:text-brand-300"
                        : "text-gray-700 dark:text-gray-200"
                    }`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-500/20">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </span>
                    <div>
                      <div className="font-medium">{self?.name || "Myself"}</div>
                      <div className="text-xs text-gray-400">Self</div>
                    </div>
                  </button>

                  {/* FAMILY RELATIONSHIPS */}
                  {relationships.length > 0 && (
                    <div className="border-t border-gray-100 dark:border-gray-800">
                      {relationships.map((rel) => {
                        const count = familyMembers.filter((m) => m.relationship === rel).length;
                        return (
                          <button
                            key={rel}
                            type="button"
                            id={`filter-${rel.toLowerCase().replace(/\s+/g, "-")}`}
                            onClick={() => { setFilterRelationship(rel); setDropdownOpen(false); }}
                            className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-gray-50 dark:hover:bg-gray-800 ${
                              filterRelationship === rel
                                ? "bg-brand-50 text-brand-700 font-semibold dark:bg-brand-500/10 dark:text-brand-300"
                                : "text-gray-700 dark:text-gray-200"
                            }`}
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </span>
                            <div className="flex-1">
                              <div className="font-medium capitalize">{rel}</div>
                              <div className="text-xs text-gray-400">{count} member{count !== 1 ? "s" : ""}</div>
                            </div>
                            {filterRelationship === rel && (
                              <svg className="h-4 w-4 text-brand-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" clipRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {familyMembers.length === 0 && (
                    <div className="px-4 py-3 text-xs text-gray-400 text-center">
                      No linked family members found.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-8">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-500"></div>
                <p className="text-sm font-medium text-gray-400">Loading appointment history…</p>
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-5 text-center text-sm text-rose-600 dark:border-rose-900/30 dark:bg-rose-950/10 dark:text-rose-400">
                {error}
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-800">
                  <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                </div>
                <h4 className="mt-4 text-base font-semibold text-gray-700 dark:text-white">No Appointments</h4>
                <p className="mt-1 text-sm text-gray-400 max-w-xs">
                  {filterRelationship === "all"
                    ? "No appointments found for you or your family members."
                    : `No appointments found for ${filterLabel}.`}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="pb-4 pr-6 font-semibold text-gray-500 uppercase tracking-wider text-xs dark:text-gray-400">Patient</th>
                      <th className="pb-4 pr-6 font-semibold text-gray-500 uppercase tracking-wider text-xs dark:text-gray-400">Date</th>
                      <th className="pb-4 pr-6 font-semibold text-gray-500 uppercase tracking-wider text-xs dark:text-gray-400">Time</th>
                      <th className="pb-4 pr-6 font-semibold text-gray-500 uppercase tracking-wider text-xs dark:text-gray-400">Department</th>
                      <th className="pb-4 pr-6 font-semibold text-gray-500 uppercase tracking-wider text-xs dark:text-gray-400">Doctor</th>
                      <th className="pb-4 font-semibold text-gray-500 uppercase tracking-wider text-xs dark:text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100/60 dark:divide-gray-800/60">
                    {rows.map((row) => {
                      const isCancelled = row.status === "Cancelled";
                      const isTransferred = row.status === "Transferred" || row.isTransferred;
                      const isRescheduled = row.status === "Rescheduled";

                      let badgeClass = "bg-teal-50 text-teal-700 border-teal-200/60 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20";
                      let dotColor = "bg-teal-500";

                      if (isCancelled) {
                        badgeClass = "bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20";
                        dotColor = "bg-rose-500";
                      } else if (isTransferred) {
                        badgeClass = "bg-indigo-50 text-indigo-700 border-indigo-200/60 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20";
                        dotColor = "bg-indigo-500";
                      } else if (isRescheduled) {
                        badgeClass = "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-500/10 dark:amber-400 dark:border-amber-500/20";
                        dotColor = "bg-amber-500";
                      }

                      return (
                        <tr
                          key={row.id}
                          className="group hover:bg-gray-50/60 dark:hover:bg-gray-800/20 transition-colors duration-100"
                        >
                          {/* Patient name */}
                          <td className="py-4 pr-6">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">
                                {(row.patient_name ?? "?")[0]?.toUpperCase()}
                              </span>
                              <span className="font-medium text-gray-800 dark:text-white whitespace-nowrap">
                                {row.patient_name
                                  ? withSalutation(
                                      row.patient_name,
                                      row.patient_name === self?.name ? (self?.gender ?? "") : ""
                                    )
                                  : "–"}
                              </span>
                            </span>
                          </td>
                          <td className="py-4 pr-6 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                            {formatDate(row.appointment_date)}
                          </td>
                          <td className="py-4 pr-6 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                            {formatTimeRange(row.appointment_time, row.appointment_end_time)}
                          </td>
                          <td className="py-4 pr-6">
                            <span className="rounded-lg bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800/60 dark:text-gray-400 whitespace-nowrap">
                              {row.department || "–"}
                            </span>
                          </td>
                          <td className="py-4 pr-6 text-gray-900 font-medium dark:text-white whitespace-nowrap">
                            {row.doctor || "–"}
                          </td>
                          <td className="py-4">
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm ${badgeClass}`}>
                              <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${dotColor}`}></span>
                              {row.displayStatus}
                              {row.reschedule_count ? ` (${row.reschedule_count}×)` : ""}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </BlankPage>
  );
}
