"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export type TabKey = "dashboard" | "book" | "appointments" | "family" | "edit" | "history";

interface PatientProfileLayoutProps {
  activeTab: TabKey;
  children: React.ReactNode;
  hname: string;
}

export function PatientProfileLayout({ activeTab, children, hname }: PatientProfileLayoutProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [patientName, setPatientName] = useState("Patient");
  const [patientInitials, setPatientInitials] = useState("P");

  useEffect(() => {
    try {
      const name = window.localStorage.getItem("patientName") ?? "Patient";
      setPatientName(name || "Patient");
      const initials = name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0]?.toUpperCase() ?? "")
        .join("") || "P";
      setPatientInitials(initials);
    } catch { }
  }, []);

  const handleLogout = () => {
    try {
      localStorage.removeItem("patientName");
      localStorage.removeItem("patientPhone");
      localStorage.removeItem("patientGender");
    } catch (e) { }
    router.push("/");
  };

  const navItems = [
    {
      key: "dashboard" as TabKey,
      label: "Dashboard",
      href: `/${encodeURIComponent(hname)}/patient-dashboard`,
      icon: (props: React.SVGProps<SVGSVGElement>) => (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      key: "book" as TabKey,
      label: "Book Appointment",
      href: `/${encodeURIComponent(hname)}/patient-book-appointment`,
      icon: (props: React.SVGProps<SVGSVGElement>) => (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      key: "appointments" as TabKey,
      label: "My Appointments",
      href: `/${encodeURIComponent(hname)}/patient-appointments`,
      icon: (props: React.SVGProps<SVGSVGElement>) => (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      key: "family" as TabKey,
      label: "Manage Family",
      href: `/${encodeURIComponent(hname)}/manage-family`,
      icon: (props: React.SVGProps<SVGSVGElement>) => (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      key: "edit" as TabKey,
      label: "Edit Profile",
      href: `/${encodeURIComponent(hname)}/patient-profile`,
      icon: (props: React.SVGProps<SVGSVGElement>) => (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  const activeItem = navItems.find((item) => item.key === activeTab);
  const sidebarWidth = collapsed ? "w-[72px]" : "w-[280px]";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 flex h-screen flex-col border-r border-gray-200/80 bg-white/95 backdrop-blur-xl shadow-xl transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-900/95 ${sidebarWidth}`}
      >
        {/* Header / Profile */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-500 via-brand-600 to-indigo-700 opacity-90" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.15),transparent_70%)]" />
          <div className={`relative flex items-center gap-3 px-4 py-5 ${collapsed ? "justify-center" : ""}`}>
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-sm font-bold text-white shadow-inner ring-2 ring-white/30">
                {patientInitials}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
            </div>

            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-white/70 uppercase tracking-widest">
                  {activeItem?.label ?? "Patient Portal"}
                </p>
                <p className="truncate text-sm font-semibold text-white">{patientName}</p>
              </div>
            )}
          </div>
        </div>

        {/* Toggle button */}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="absolute -right-3.5 top-14 flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white shadow-md text-gray-500 hover:text-brand-600 hover:border-brand-200 transition-all dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg className={`h-3.5 w-3.5 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Nav */}
        <nav className="flex flex-col flex-1 gap-0.5 overflow-y-auto px-2.5 py-4 scrollbar-thin">
          {!collapsed && (
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Navigation
            </p>
          )}

          {navItems.map((item) => {
            const isActive = activeTab === item.key;
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${isActive
                  ? "bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-md shadow-brand-500/30"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                  } ${collapsed ? "justify-center" : ""}`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-white/60" />
                )}
                <Icon className={`h-5 w-5 flex-shrink-0 transition-colors ${isActive ? "text-white" : "text-gray-400 group-hover:text-brand-500 dark:text-gray-500"}`} />
                {!collapsed && <span className="truncate">{item.label}</span>}

                {/* Tooltip on collapsed */}
                {collapsed && (
                  <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-gray-700">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}

          <div className="my-2 border-t border-gray-100 dark:border-gray-800" />

          <button
            type="button"
            onClick={handleLogout}
            title={collapsed ? "Logout" : undefined}
            className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition-all hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 ${collapsed ? "justify-center" : ""}`}
          >
            <svg className="h-5 w-5 flex-shrink-0 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {!collapsed && <span>Logout</span>}
            {collapsed && (
              <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-gray-700">
                Logout
              </span>
            )}
          </button>
        </nav>

        {/* Footer branding */}
        {!collapsed && (
          <div className="border-t border-gray-100 px-4 py-3 dark:border-gray-800">
            <p className="truncate text-center text-[10px] text-gray-400 dark:text-gray-600">
              {hname} · Patient Portal
            </p>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div
        className={`flex min-w-0 flex-1 flex-col transition-all duration-300 ease-in-out ${collapsed ? "ml-[72px]" : "ml-[280px]"}`}
      >
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
