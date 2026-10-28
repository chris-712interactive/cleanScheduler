import { PageHeader } from '@/components/portal/PageHeader';
import { FeatureUpgradePanel } from '@/components/billing/FeatureUpgradePanel';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import { getPortalContext } from '@/lib/portal';
import { createAdminClient } from '@/lib/supabase/server';
import { CreateOpeningForm } from '../HiringForms';
import styles from '../hiring.module.scss';

export const dynamic = 'force-dynamic';

export default async function NewOpeningPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/hiring/new');
  const admin = createAdminClient();
  const plan = await resolveTenantEntitlementPlan(admin, membership.tenantId);
  if (!isFeatureEnabled(plan, 'hiringDesk')) {
    return (
      <FeatureUpgradePanel
        title="Hiring is on Business and Pro"
        description="Starter and the free trial cannot open a role."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="New opening"
        backHref="/hiring"
        backLabel="Hiring"
        description="A draft stays off the public link until you add pay, days, and an area."
      />
      <div className={styles.setupCard}>
        <CreateOpeningForm />
      </div>
    </>
  );
}
