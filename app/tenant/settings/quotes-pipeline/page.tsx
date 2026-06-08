import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Stack } from '@/components/layout/Stack';
import { FeatureUpgradePanel } from '@/components/billing/FeatureUpgradePanel';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { hasMinimumTenantRole } from '@/lib/auth/tenantRoleAccess';
import { createAdminClient } from '@/lib/supabase/server';
import { isFeatureEnabled, resolveTenantPlanTier } from '@/lib/billing/entitlements';
import { minimumTierLabelForFeature } from '@/lib/billing/tenantFeatureGate';
import { loadTenantQuotePipelineStages } from '@/lib/tenant/quotePipelineStages';
import { deleteQuotePipelineStageAction, updateQuotePipelineStagesAction } from './actions';
import styles from './quotes-pipeline.module.scss';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function QuotePipelineSettingsPage({ searchParams }: PageProps) {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug ?? '', '/settings/quotes-pipeline');
  if (!hasMinimumTenantRole(membership.role, 'admin')) {
    redirect('/settings');
  }

  const admin = createAdminClient();
  const tier = await resolveTenantPlanTier(admin, membership.tenantId);
  const kanbanEnabled = isFeatureEnabled(tier, 'kanbanCustomization');
  const stages = await loadTenantQuotePipelineStages(admin, membership.tenantId, {
    includeHidden: true,
  });

  const sp = await searchParams;
  const saved = firstParam(sp.saved) === '1';
  const errorCode = firstParam(sp.error);

  return (
    <>
      <PageHeader
        title="Quotes pipeline"
        description="Rename, reorder, hide, and add custom Kanban columns on your quotes board."
        backHref="/settings"
        backLabel="Settings"
      />

      <Stack gap={4}>
        {!kanbanEnabled ? (
          <FeatureUpgradePanel
            title="Upgrade to customize your quotes board"
            description={`${minimumTierLabelForFeature('kanbanCustomization')} plans let you add custom pipeline stages beyond the default columns.`}
          />
        ) : null}

        {saved ? (
          <p className={styles.ok} role="status">
            Pipeline saved.
          </p>
        ) : null}
        {errorCode === 'in_use' ? (
          <p className={styles.err} role="alert">
            Remove all quotes from a custom stage before deleting it.
          </p>
        ) : null}

        <Card title="Pipeline stages">
          <form action={updateQuotePipelineStagesAction} className={styles.form}>
            <input type="hidden" name="tenant_slug" value={tenantSlug ?? ''} />
            <input type="hidden" name="return_to" value="/settings/quotes-pipeline" />
            <ul className={styles.stageList}>
              {stages.map((stage, index) => (
                <li key={stage.id} className={styles.stageRow}>
                  <input type="hidden" name="stage_id" value={stage.id} />
                  <input type="hidden" name="stage_sort" value={index} />
                  <label className={styles.label}>
                    Name
                    <input
                      name="stage_name"
                      defaultValue={stage.name}
                      className={styles.input}
                      disabled={!kanbanEnabled}
                    />
                  </label>
                  {stage.is_system &&
                  stage.system_status &&
                  ['accepted', 'declined', 'expired'].includes(stage.system_status) ? (
                    <span className={styles.muted}>System stage (always visible)</span>
                  ) : (
                    <label className={styles.checkLabel}>
                      <input
                        type="checkbox"
                        name="stage_hidden"
                        defaultChecked={stage.is_hidden}
                        disabled={!kanbanEnabled}
                      />
                      Hidden on board
                    </label>
                  )}
                  {!stage.is_system && kanbanEnabled ? (
                    <Button
                      type="submit"
                      formAction={deleteQuotePipelineStageAction}
                      variant="secondary"
                      size="sm"
                    >
                      Delete
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            {kanbanEnabled ? (
              <>
                <label className={styles.label}>
                  Add custom stage
                  <input
                    name="new_stage_name"
                    className={styles.input}
                    placeholder="e.g. Viewed, Follow-up"
                  />
                </label>
                <Button type="submit" variant="primary">
                  Save pipeline
                </Button>
              </>
            ) : null}
          </form>
        </Card>
      </Stack>
    </>
  );
}
