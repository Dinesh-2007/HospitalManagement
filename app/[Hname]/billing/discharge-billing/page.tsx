import { PageLayout } from "../../../../components/page-layout";
import { DischargeBillingDashboard } from "../../../../components/discharge-billing-dashboard";

export default async function TenantDischargeBillingPage({
  params,
}: {
  params: Promise<{ Hname: string }>;
}) {
  const { Hname } = await params;

  return (
    <PageLayout title={`Billing - Discharge Billing (${decodeURIComponent(Hname)})`}>
      <DischargeBillingDashboard />
    </PageLayout>
  );
}
