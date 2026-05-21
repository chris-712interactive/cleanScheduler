import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import {
  COMPENSATION_RULE_TYPE_LABEL,
  COMPENSATION_RULE_TYPES,
  formatBpsAsPercent,
  type CompensationRuleType,
} from '@/lib/tenant/compensationRules';
import { formatUsdFromCents } from '@/lib/format/money';
import {
  createCompensationRuleAction,
  deleteCompensationRuleAction,
  setCompensationRuleActiveAction,
} from './actions';
import styles from '../settings.module.scss';

export const dynamic = 'force-dynamic';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function formatRuleRate(
  ruleType: string,
  percentBps: number | null,
  flatCents: number | null,
): string {
  if (ruleType === 'flat_per_job_cents' && flatCents != null) {
    return formatUsdFromCents(flatCents);
  }
  return formatBpsAsPercent(percentBps);
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TenantCompensationSettingsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/compensation');
  const canEdit = canManageTeamInvitesAndRoles(membership.role);

  const supabase = createTenantPortalDbClient();
  const { data: rules } = await supabase
    .from('compensation_rules')
    .select('id, name, rule_type, percent_bps, flat_cents, applies_to_role, is_active, updated_at')
    .eq('tenant_id', membership.tenantId)
    .order('name');

  const errMsg = firstParam(sp.error);
  const saved = firstParam(sp.saved) === '1';

  return (
    <>
      <PageHeader
        title="Compensation"
        titleHint="Tips, commissions, and per-job rates used in payroll and tips reports."
        backHref="/settings"
        backLabel="Settings"
      />

      {saved ? (
        <p className={styles.opsSuccess} role="status">
          Saved.
        </p>
      ) : null}
      {errMsg ? (
        <p className={styles.opsError} role="alert">
          {errMsg}
        </p>
      ) : null}

      {!canEdit ? (
        <p className={styles.readOnlyNotice} role="status">
          You can view compensation rules here. Only owners and admins can make changes.
        </p>
      ) : null}

      {canEdit ? (
        <Card
          title="Add rule"
          description="Rules feed the Payroll export and Tips & commissions reports."
        >
          <form action={createCompensationRuleAction} className={styles.compForm}>
            <input type="hidden" name="tenant_slug" value={membership.tenantSlug} />
            <label className={styles.compField}>
              Name
              <input
                className={styles.compInput}
                name="name"
                required
                maxLength={120}
                placeholder="Lead cleaner commission"
              />
            </label>
            <label className={styles.compField}>
              Type
              <select className={styles.compSelect} name="rule_type" required defaultValue="commission_percent_bps">
                {COMPENSATION_RULE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {COMPENSATION_RULE_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.compField}>
              Percent (for commission / tip split)
              <input
                className={styles.compInput}
                name="percent"
                inputMode="decimal"
                placeholder="10"
              />
            </label>
            <label className={styles.compField}>
              Flat per job (USD, for flat type)
              <input
                className={styles.compInput}
                name="flat_dollars"
                inputMode="decimal"
                placeholder="25.00"
              />
            </label>
            <label className={styles.compField}>
              Applies to role (optional)
              <input
                className={styles.compInput}
                name="applies_to_role"
                maxLength={80}
                placeholder="employee"
              />
            </label>
            <Button type="submit" variant="primary">
              Add rule
            </Button>
          </form>
        </Card>
      ) : null}

      <Card title="Rules" description={`${rules?.length ?? 0} configured`}>
        {!rules?.length ? (
          <p className={styles.muted}>No compensation rules yet.</p>
        ) : (
          <ul className={styles.compList}>
            {rules.map((rule) => (
              <li key={rule.id} className={styles.compListItem}>
                <div className={styles.compListMain}>
                  <span className={styles.compListTitle}>
                    {rule.name}
                    {!rule.is_active ? (
                      <span className={styles.compInactive}> (inactive)</span>
                    ) : null}
                  </span>
                  <span className={styles.compListMeta}>
                    {COMPENSATION_RULE_TYPE_LABEL[rule.rule_type as CompensationRuleType] ??
                      rule.rule_type}{' '}
                    · {formatRuleRate(rule.rule_type, rule.percent_bps, rule.flat_cents)}
                    {rule.applies_to_role ? ` · ${rule.applies_to_role}` : ''}
                  </span>
                </div>
                {canEdit ? (
                  <div className={styles.compListActions}>
                    <form action={setCompensationRuleActiveAction}>
                      <input type="hidden" name="tenant_slug" value={membership.tenantSlug} />
                      <input type="hidden" name="rule_id" value={rule.id} />
                      <input
                        type="hidden"
                        name="is_active"
                        value={rule.is_active ? '0' : '1'}
                      />
                      <Button type="submit" variant="secondary" size="sm">
                        {rule.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </form>
                    <form action={deleteCompensationRuleAction}>
                      <input type="hidden" name="tenant_slug" value={membership.tenantSlug} />
                      <input type="hidden" name="rule_id" value={rule.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        Delete
                      </Button>
                    </form>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
