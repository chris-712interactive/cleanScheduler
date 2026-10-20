import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/portal/PageHeader';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { RequestPropertyForm } from '../RequestPropertyForm';

export const dynamic = 'force-dynamic';

export default async function RequestPropertyPage() {
  const auth = await requirePortalAccess('customer', '/properties/new');
  const ctx = await getCustomerPortalContext(auth.user.id);
  if (!ctx) redirect('/access-denied?reason=no_customer_profile');

  return (
    <>
      <PageHeader
        title="Request a location"
        description="Your cleaner schedules a consultation at the new address before quoting the work there."
        backHref="/properties"
        backLabel="Properties"
      />
      <Card>
        {ctx.links.length === 0 ? (
          <p>Your account is not linked to a cleaning company yet.</p>
        ) : (
          <RequestPropertyForm
            links={ctx.links.map((link) => ({
              tenantId: link.tenantId,
              customerId: link.customerId,
              tenantName: link.tenantName,
            }))}
          />
        )}
      </Card>
    </>
  );
}
