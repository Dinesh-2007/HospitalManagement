import type { Metadata } from "next";
import { PricingManagementPage } from "../../components/pricing-management-page";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Add pricing for multiple products and save row-wise product pricing.",
};

export default function PricingPage() {
  return <PricingManagementPage />;
}
