"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type TabKey = "appointments" | "family" | "edit" | "history";

interface PatientProfileLayoutProps {
  activeTab: TabKey;
  children: React.ReactNode;
  hname: string;
}

export function PatientProfileLayout({ activeTab, children, hname }: PatientProfileLayoutProps) {
  const router = useRouter();

  const handleLogout = () => {
    try {
      localStorage.removeItem("patientName");
      localStorage.removeItem("patientPhone");
    } catch (e) { }
    router.push("/");
  };

  const navItems = [
    {
      key: "appointments",
      label: "My appointments",
      href: `/${encodeURIComponent(hname)}/patient-appointments`,
      icon: (props: any) => (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props} xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
      ),
    },
    {
      key: "family",
      label: "Manage Family member",
      href: `/${encodeURIComponent(hname)}/manage-family`,
      icon: (props: any) => (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props} xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
      ),
    },
    {
      key: "edit",
      label: "Edit Profile",
      href: `/${encodeURIComponent(hname)}/patient-registration?mode=edit`,
      icon: (props: any) => (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props} xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
      ),
    },

  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 xl:flex">
      {/* Sidebar Navigation */}
      <aside className="fixed top-0 left-0 z-50 flex h-screen w-[290px] flex-col border-r border-gray-200 bg-white px-4 py-8 text-gray-900 transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-8 flex justify-start px-4">
          <div className="text-xl font-bold tracking-tight text-slate-800 dark:text-white/90">
            Patient Profile
          </div>
        </div>
        <nav className="flex flex-col space-y-1">
          <Link
            href={`/${encodeURIComponent(hname)}/patient-dashboard`}
            className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/5 mb-1"
          >
            <svg className="h-5 w-5 shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to Dashboard
          </Link>

          <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

          {navItems.map((item) => {
            const isActive = activeTab === item.key;
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition ${isActive
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400"
                  : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"
                  }`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${isActive ? "text-brand-600 dark:text-brand-400" : "text-gray-400 dark:text-gray-500"}`} />
                {item.label}
              </Link>
            );
          })}

          <div className="my-2 border-t border-gray-100 dark:border-gray-800" />

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            <svg className="h-5 w-5 shrink-0 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Logout
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col transition-all duration-300 ease-in-out lg:ml-[290px]">
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
