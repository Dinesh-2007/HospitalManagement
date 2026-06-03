import type { Metadata } from "next";
import { DiscountSchemaPage } from "../../../components/discount-schema-page";

export const metadata: Metadata = {
  title: "Discount Schema",
  description: "Create discount rules and assign them to product variants.",
};

export default async function TenantDiscountSchemaPage({
  params,
}: {
  params: Promise<{ Hname: string }>;
}) {
  const { Hname } = await params;

  return <DiscountSchemaPage />;
}
