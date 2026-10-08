import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { resolveScheduleOptimizerPolicy } from '@/lib/schedule/optimizer/policy';
import { createAdminClient } from '@/lib/supabase/server';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import { SchedulingPolicyForm } from './SchedulingPolicyForm';
import styles from './scheduling-settings.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantSchedulingSettingsPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/scheduling');
  const canEdit = canManageTeamInvitesAndRoles(membership.role);
  const admin = createAdminClient();
  const { data } = await admin
    .from('tenant_operational_settings')
    .select('schedule_optimizer_policy')
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  const policy = resolveScheduleOptimizerPolicy(data?.schedule_optimizer_policy);

  return (
    <>
      <PageHeader
        title="Scheduling logic"
        titleHint="Choose what a good day looks like for this company, then weight it."
        backHref="/settings"
        backLabel="Settings"
      />

      <Stack gap={4}>
        {!canEdit ? (
          <p className={styles.readOnlyNotice} role="status">
            You can review these weights. Only owners and admins can change them.
          </p>
        ) : null}
        <SchedulingPolicyForm
          tenantSlug={tenantSlug ?? ''}
          initialPolicy={policy}
          readOnly={!canEdit}
        />
      </Stack>
    </>
  );
}
