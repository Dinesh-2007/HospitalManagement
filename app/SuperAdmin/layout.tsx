import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Super Admin — HSMS",
  description: "Super Admin SaaS control panel for Hospital Management System",
};

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
