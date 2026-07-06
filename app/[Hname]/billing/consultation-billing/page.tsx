import { PageLayout } from "../../../../components/page-layout";
import { ConsultationBillingDashboard } from "../../../../components/consultation-billing-dashboard";

export default async function TenantConsultationBillingPage({
  params,
}: {
  params: Promise<{ Hname: string }>;
}) {
  const { Hname } = await params;

  return (
    <PageLayout title={`Billing - Consultation Billing (${decodeURIComponent(Hname)})`}>
      <ConsultationBillingDashboard />
    </PageLayout>
  );
}
