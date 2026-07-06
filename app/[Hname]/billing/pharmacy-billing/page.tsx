import { PageLayout } from "../../../../components/page-layout";
import { PharmacyBillingDashboard } from "../../../../components/pharmacy-billing-dashboard";

export default async function TenantPharmacyBillingPage({
  params,
}: {
  params: Promise<{ Hname: string }>;
}) {
  const { Hname } = await params;

  return (
    <PageLayout title={`Billing - Pharmacy Billing (${decodeURIComponent(Hname)})`}>
      <PharmacyBillingDashboard />
    </PageLayout>
  );
}
