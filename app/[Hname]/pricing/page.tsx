import type { Metadata } from "next";
import { PricingManagementPage } from "../../../components/pricing-management-page";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Add pricing for multiple products and save row-wise product pricing.",
};

export default async function TenantPricingPage({
  params,
}: {
  params: Promise<{ Hname: string }>;
}) {
  const { Hname } = await params;

  return <PricingManagementPage initialHname={decodeURIComponent(Hname)} />;
}
