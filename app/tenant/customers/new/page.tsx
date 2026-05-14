import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { CustomerCreateForm } from '../CustomerCreateForm';
import styles from '../customers.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantCustomerNewPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug ?? '', '/customers/new');

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
          <CustomerCreateForm tenantSlug={membership.tenantSlug} />
        </Card>
      </Stack>
    </>
  );
}
