"use client";

import type React from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header/header";
import { Backdrop } from "./backdrop";
import { useSidebar } from "./context/SidebarContext";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function DashboardShellContent({ children }: { children: React.ReactNode }) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const segments = pathname.split('/').filter(Boolean);
  const isLoginPage = segments.length === 1 && segments[0] !== 'create-account';
  const isPatientLoginPage = pathname.endsWith("/patient-login");
  const isBookAppointment = pathname.endsWith("/book-appointment");
  const isCalendarPage = pathname.endsWith("/calendar");
  const ispatientDash = pathname.endsWith("/patient-dashboard");
  const isfamily = pathname.endsWith("/manage-family");
  const isPatientAppointments = pathname.endsWith("/patient-appointments");
  const isPatientHistory = pathname.endsWith("/patient-history");
  const isPatientRegistrationEdit = pathname.endsWith("/patient-registration") && searchParams?.get("mode") === "edit";
  const isPatientProfile = pathname.endsWith("/patient-profile");
  const isPatientBookAppointment = pathname.endsWith("/patient-book-appointment");

  const hideNavAndSidebar =
    pathname === "/" ||
    pathname === "/create-account" ||
    isLoginPage ||
    isPatientLoginPage ||
    isBookAppointment ||
    isPatientBookAppointment ||
    ispatientDash ||
    isfamily ||
    isCalendarPage ||
    isPatientAppointments ||
    isPatientHistory ||
    isPatientProfile ||
    isPatientRegistrationEdit;

  const mainContentMargin = isMobileOpen
    ? "ml-0"
    : hideNavAndSidebar
      ? "ml-0"
      : isExpanded || isHovered
        ? "lg:ml-[290px]"
        : "lg:ml-[90px]";

  return (
    <div className="min-h-screen xl:flex">
      {!hideNavAndSidebar && <Sidebar />}
      {!hideNavAndSidebar && <Backdrop />}
      <div
        className={`flex min-w-0 flex-1 flex-col transition-all duration-300 ease-in-out ${mainContentMargin}`}
      >
        {!hideNavAndSidebar && <Header />}
        <main className="min-w-0 flex-1 bg-gray-50 dark:bg-gray-800">
          <div className="mx-auto max-w-[1600px] p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 dark:bg-gray-800" />}>
      <DashboardShellContent>{children}</DashboardShellContent>
    </Suspense>
  );
}
