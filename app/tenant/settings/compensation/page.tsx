import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { Button } from '@/components/ui/Button';
import { FeatureUpgradePanel } from '@/components/billing/FeatureUpgradePanel';
import { StatusPill } from '@/components/ui/StatusPill';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createAdminClient, createTenantPortalDbClient } from '@/lib/supabase/server';
import { isFeatureEnabled, resolveTenantPlanTier } from '@/lib/billing/entitlements';
import { minimumTierLabelForFeature } from '@/lib/billing/tenantFeatureGate';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import {
  COMPENSATION_RULE_TYPE_HINT,
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
import styles from './compensation-settings.module.scss';

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
    return `${formatUsdFromCents(flatCents)} per job`;
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
  const admin = createAdminClient();
  const tier = await resolveTenantPlanTier(admin, membership.tenantId);
  const jobCostingEnabled = isFeatureEnabled(tier, 'jobCosting');

  const supabase = createTenantPortalDbClient();
  const { data: rules } = await supabase
    .from('compensation_rules')
    .select('id, name, rule_type, percent_bps, flat_cents, applies_to_role, is_active, updated_at')
    .eq('tenant_id', membership.tenantId)
    .order('name');

  const errMsg = firstParam(sp.error);
  const saved = firstParam(sp.saved) === '1';
  const activeRules = rules?.filter((rule) => rule.is_active).length ?? 0;

  return (
    <>
      <PageHeader
        title="Compensation"
        titleHint="Tips, commissions, and per-job rates for payroll reports."
        backHref="/settings"
        backLabel="Settings"
        actions={
          jobCostingEnabled ? (
            <Button variant="secondary" as="a" href="/reports">
              View payroll reports
            </Button>
          ) : undefined
        }
      />

      <Stack gap={6}>
        {saved ? (
          <p className={styles.bannerSuccess} role="status">
            Compensation rule saved.
          </p>
        ) : null}
        {errMsg ? (
          <p className={styles.bannerError} role="alert">
            {errMsg}
          </p>
        ) : null}

        {!jobCostingEnabled ? (
          <>
            <FeatureUpgradePanel
              title="Upgrade to unlock tips & commissions"
              description={`${minimumTierLabelForFeature('jobCosting')} plans include compensation rules that feed payroll export and tips & commissions reports.`}
            />
            <div className={styles.lockedSection}>
              <header className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>What compensation rules do</h2>
                <p className={styles.lockedLead}>
                  When unlocked, you can define commission, tip split, and flat per-job rates that
                  automatically feed your payroll and tips reports.
                </p>
              </header>
              <div className={styles.ruleTypeGrid}>
                {COMPENSATION_RULE_TYPES.map((ruleType) => (
                  <div key={ruleType} className={styles.ruleTypeCard}>
                    <p className={styles.ruleTypeTitle}>{COMPENSATION_RULE_TYPE_LABEL[ruleType]}</p>
                    <p className={styles.ruleTypeHint}>{COMPENSATION_RULE_TYPE_HINT[ruleType]}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className={styles.stack}>
            {!canEdit ? (
              <p className={styles.readOnlyNotice} role="status">
                You can view compensation rules here. Only owners and admins can make changes.
              </p>
            ) : null}

            <header className={styles.hero}>
              <h2 className={styles.heroTitle}>Pay rules for your crew</h2>
              <p className={styles.heroLead}>
                Set up how commissions, tip splits, and flat per-job rates are calculated. These
                rules feed your{' '}
                <Link href="/reports" className={styles.inlineLink}>
                  payroll export
                </Link>{' '}
                and tips reports — you do not need to calculate them by hand.
              </p>
              <div className={styles.heroMeta}>
                <span className={styles.metaChip}>
                  {rules?.length ?? 0} {rules?.length === 1 ? 'rule' : 'rules'} total
                </span>
                <span className={styles.metaChip}>
                  {activeRules} active {activeRules === 1 ? 'rule' : 'rules'}
                </span>
              </div>
            </header>

            <section className={styles.settingsSection} aria-labelledby="rule-types-heading">
              <header className={styles.sectionHeader}>
                <h3 id="rule-types-heading" className={styles.sectionTitle}>
                  Rule types
                </h3>
                <p className={styles.sectionLead}>
                  Choose the type that matches how you pay your team.
                </p>
              </header>
              <div className={styles.ruleTypeGrid}>
                {COMPENSATION_RULE_TYPES.map((ruleType) => (
                  <div key={ruleType} className={styles.ruleTypeCard}>
                    <p className={styles.ruleTypeTitle}>{COMPENSATION_RULE_TYPE_LABEL[ruleType]}</p>
                    <p className={styles.ruleTypeHint}>{COMPENSATION_RULE_TYPE_HINT[ruleType]}</p>
                  </div>
                ))}
              </div>
            </section>

            {!rules?.length ? (
              <p className={styles.emptyState}>
                No compensation rules yet. Add one below when you are ready to track commissions or
                tip splits in reports.
              </p>
            ) : (
              <ul className={styles.itemList}>
                {rules.map((rule) => (
                  <li key={rule.id} className={styles.itemCard}>
                    <div className={styles.itemMain}>
                      <p className={styles.itemTitle}>{rule.name}</p>
                      <p className={styles.itemMeta}>
                        {COMPENSATION_RULE_TYPE_LABEL[rule.rule_type as CompensationRuleType] ??
                          rule.rule_type}{' '}
                        · {formatRuleRate(rule.rule_type, rule.percent_bps, rule.flat_cents)}
                        {rule.applies_to_role ? ` · Role: ${rule.applies_to_role}` : ''}
                      </p>
                      <StatusPill tone={rule.is_active ? 'success' : 'neutral'}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </StatusPill>
                    </div>
                    {canEdit ? (
                      <div className={styles.itemActions}>
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
                          <Button type="submit" variant="danger" size="sm">
                            Delete
                          </Button>
                        </form>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {canEdit ? (
              <div className={styles.setupCard}>
                <p className={styles.setupTitle}>Add a compensation rule</p>
                <form action={createCompensationRuleAction} className={styles.formGrid}>
                  <input type="hidden" name="tenant_slug" value={membership.tenantSlug} />
                  <label className={styles.fieldWide}>
                    <span className={styles.fieldLabel}>Rule name</span>
                    <span className={styles.fieldHint}>
                      A name you will recognize in reports, like &ldquo;Lead cleaner
                      commission&rdquo;.
                    </span>
                    <input
                      className={styles.textInput}
                      name="name"
                      required
                      maxLength={120}
                      placeholder="Lead cleaner commission"
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Rule type</span>
                    <select
                      className={styles.selectInput}
                      name="rule_type"
                      required
                      defaultValue="commission_percent_bps"
                    >
                      {COMPENSATION_RULE_TYPES.map((ruleType) => (
                        <option key={ruleType} value={ruleType}>
                          {COMPENSATION_RULE_TYPE_LABEL[ruleType]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Applies to role (optional)</span>
                    <span className={styles.fieldHint}>Leave blank to apply to everyone.</span>
                    <input
                      className={styles.textInput}
                      name="applies_to_role"
                      maxLength={80}
                      placeholder="employee"
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Percent</span>
                    <span className={styles.fieldHint}>
                      For commission or tip split rules — e.g. enter 10 for 10%.
                    </span>
                    <input
                      className={styles.textInput}
                      name="percent"
                      inputMode="decimal"
                      placeholder="10"
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Flat amount per job (USD)</span>
                    <span className={styles.fieldHint}>For flat per-job rules only.</span>
                    <input
                      className={styles.textInput}
                      name="flat_dollars"
                      inputMode="decimal"
                      placeholder="25.00"
                    />
                  </label>
                  <div className={styles.fieldWide}>
                    <Button type="submit" variant="primary">
                      Add rule
                    </Button>
                  </div>
                </form>
              </div>
            ) : null}

            <p className={styles.footnote}>
              Rules appear in payroll export and tips & commissions reports under{' '}
              <Link href="/reports" className={styles.inlineLink}>
                Reports
              </Link>
              .
            </p>
          </div>
        )}
      </Stack>
    </>
  );
}
