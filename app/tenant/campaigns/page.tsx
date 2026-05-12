import { PageHeader } from '@/components/portal/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';

export const dynamic = 'force-dynamic';

export default async function TenantCampaignsPage() {
  const { tenantSlug } = await getPortalContext();
  await requireTenantPortalAccess(tenantSlug, '/campaigns');

  return (
    <>
      <PageHeader
        title="Email campaigns"
        description="Plan-gated growth campaigns will live here after the billing MVP ships."
      />
      <EmptyState
        title="Coming soon"
        description="Audience selection, branded sends, and open/click metrics are on the roadmap (Phase 3)."
      />
    </>
  );
}
