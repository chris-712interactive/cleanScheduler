import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { isFeatureEnabled, resolveTenantPlanTier } from '@/lib/billing/entitlements';
import { isResendApiConfigured } from '@/lib/email/resend';
import { createAdminClient } from '@/lib/supabase/server';
import {
  hasPermission,
  resolveMembershipPermissions,
} from '@/lib/tenant/resolveMembershipPermissions';
import { CustomerImportWizard } from './CustomerImportWizard';
import styles from '../customers.module.scss';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function TenantCustomerImportPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug ?? '', '/customers/import');
  const admin = createAdminClient();
  const permissions = await resolveMembershipPermissions(admin, membership);
  const canImport = hasPermission(permissions, 'customers.manage');
  const tier = await resolveTenantPlanTier(admin, membership.tenantId);
  const portalInvitesAvailable = isFeatureEnabled(tier, 'customerPortal');

  return (
    <>
      <PageHeader
        title="Import customers"
        description="Upload a Jobber Clients export. Names, contact details, and service addresses are created in this workspace."
        breadcrumbs={[{ label: 'Customers', href: '/customers' }, { label: 'Import' }]}
        actions={
          <Link href="/customers" className={styles.backLink}>
            ← Back to directory
          </Link>
        }
      />
      {canImport ? (
        <Card title="Jobber CSV" description="Preview the file before anything is saved.">
          <CustomerImportWizard
            tenantSlug={membership.tenantSlug}
            portalInvitesAvailable={portalInvitesAvailable}
            emailReady={isResendApiConfigured()}
          />
        </Card>
      ) : (
        <Card title="Import unavailable">
          <p>You need permission to manage customers before you can import a CSV.</p>
        </Card>
      )}
    </>
  );
}
