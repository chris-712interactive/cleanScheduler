import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { createAdminClient, createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import { resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import { getOwnerOnboardingChecklist } from '@/lib/tenant/ownerOnboardingChecklist';
import { shouldShowDashboardChecklistCard } from '@/lib/tenant/ownerOnboardingState';
import type { TenantRole } from '@/lib/auth/types';
import { redirect } from 'next/navigation';
import { OwnerOnboardingChecklistView } from '../OwnerOnboardingChecklistView';

export const dynamic = 'force-dynamic';

export default async function GettingStartedPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/getting-started', {
    internalPathname: '/tenant/getting-started',
    browserPathname: '/getting-started',
  });

  if (!canManageTeamInvitesAndRoles(membership.role as TenantRole)) {
    redirect('/');
  }

  const supabase = createTenantPortalDbClient();
  const admin = createAdminClient();

  const [{ data: tenantRow }, entitlementPlan] = await Promise.all([
    supabase
      .from('tenants')
      .select('stripe_connect_status')
      .eq('id', membership.tenantId)
      .maybeSingle(),
    resolveTenantEntitlementPlan(admin, membership.tenantId),
  ]);

  const checklist = await getOwnerOnboardingChecklist(supabase, admin, {
    tenantId: membership.tenantId,
    connectStatus: tenantRow?.stripe_connect_status,
    entitlementPlan,
  });

  if (checklist.uiState === 'complete') {
    redirect('/');
  }

  return (
    <>
      <PageHeader
        title="Getting started"
        titleHint={`${checklist.completedCount} of ${checklist.totalRequired} required steps complete`}
      />

      <Stack gap={6}>
        <Card
          title="Setup checklist"
          description="Finish these basics so quotes, scheduling, and billing flow smoothly. Progress is saved for this workspace."
        >
          <OwnerOnboardingChecklistView
            tenantSlug={membership.tenantSlug}
            checklist={checklist}
            variant="page"
          />
        </Card>

        {shouldShowDashboardChecklistCard(checklist.uiState) ? (
          <p className="getting-started-hint" style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            This checklist also appears on your dashboard until you dismiss or snooze it.
          </p>
        ) : null}
      </Stack>
    </>
  );
}
