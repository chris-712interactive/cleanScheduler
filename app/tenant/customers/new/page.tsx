import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createAdminClient } from '@/lib/supabase/server';
import { tenantReferralsNavEnabled } from '@/lib/referrals/tenantReferralsNav';
import { loadServiceZonesForAssignment } from '@/lib/tenant/serviceZones';
import { CustomerCreateForm } from '../CustomerCreateForm';
import styles from '../customers.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantCustomerNewPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug ?? '', '/customers/new');
  const admin = createAdminClient();
  const [referralProgramEnabled, serviceZones] = await Promise.all([
    tenantReferralsNavEnabled(admin, membership.tenantId),
    loadServiceZonesForAssignment(admin, membership.tenantId),
  ]);

  return (
    <>
      <PageHeader
        title="Add customer"
        description="Create a profile for this workspace. You can edit details anytime."
        breadcrumbs={[{ label: 'Customers', href: '/customers' }, { label: 'Add customer' }]}
        actions={
          <Link href="/customers" className={styles.backLink}>
            ← Back to directory
          </Link>
        }
      />

      <Stack gap={6}>
        <Card
          title="Customer details"
          description="Basic info, service address, and internal notes."
        >
          <CustomerCreateForm
            tenantSlug={membership.tenantSlug}
            referralProgramEnabled={referralProgramEnabled}
            serviceZones={serviceZones}
          />
        </Card>
      </Stack>
    </>
  );
}
