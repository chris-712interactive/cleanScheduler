import { PageHeader } from '@/components/portal/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { requirePortalAccess } from '@/lib/auth/portalAccess';

export const dynamic = 'force-dynamic';

export default async function CustomerPaymentMethodsPage() {
  await requirePortalAccess('customer', '/payment-methods');

  return (
    <>
      <PageHeader
        title="Payment methods"
        description="Cards on file for paying invoices through Stripe will appear here."
      />
      <EmptyState
        title="Not available yet"
        description="Saved payment methods ship with customer invoice checkout. You can still pay individual invoices when your provider enables card payments."
      />
    </>
  );
}
