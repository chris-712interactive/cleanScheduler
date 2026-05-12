import { PageHeader } from '@/components/portal/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';

export const dynamic = 'force-dynamic';

export default async function TenantReportsPage() {
  const { tenantSlug } = await getPortalContext();
  await requireTenantPortalAccess(tenantSlug, '/reports');

  return (
    <>
      <PageHeader
        title="Reports"
        description="Invoice audit, aging, field checks, and revenue exports will anchor this module."
      />
      <EmptyState
        title="Coming soon"
        description="CSV and PDF exports with date filters arrive with tenant customer billing and reconciliation work."
      />
    </>
  );
}
