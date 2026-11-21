import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { FeedbackToasts } from '@/components/ui/FeedbackToast';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { Button } from '@/components/ui/Button';
import { createAdminClient, createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { resolveTenantPlanTier } from '@/lib/billing/entitlements';
import {
  countActiveAutomationWorkflows,
  formatAutomationWorkflowUsage,
} from '@/lib/billing/automationWorkflows';
import { formatCustomerDisplayName } from '@/lib/tenant/customerIdentityName';
import { formatPropertyAddressLine } from '@/lib/tenant/formatPropertyAddress';
import type { CustomerPropertyGroup } from '@/app/tenant/quotes/QuoteCreateForm';
import type { Tables } from '@/lib/supabase/database.types';
import { formatCentsAsDollars } from '@/lib/billing/parseMoney';
import { RecurringConceptCallout } from '@/components/billing/RecurringConceptCallout';
import { isoToLocalDatetimeLocalValue } from '@/lib/datetime/isoToLocalDatetimeLocalValue';
import { DEFAULT_TENANT_TIMEZONE } from '@/lib/datetime/formatInTimeZone';
import {
  RECURRING_SERIES_PRESETS,
  recurringPresetIdForRrule,
} from '@/lib/schedule/recurringPresets';
import { deactivateRecurringVisitRuleAction, updateRecurringVisitRuleAction } from './actions';
import { RecurringRuleForm } from './RecurringRuleForm';
import styles from '../schedule.module.scss';

export const dynamic = 'force-dynamic';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

type CustomerPickRow = {
  id: string;
  customer_identities: {
    first_name: string | null;
    last_name: string | null;
    full_name: string | null;
  } | null;
};

type PropertyPickRow = Pick<
  Tables<'tenant_customer_properties'>,
  | 'id'
  | 'customer_id'
  | 'label'
  | 'address_line1'
  | 'address_line2'
  | 'city'
  | 'state'
  | 'postal_code'
  | 'is_primary'
>;

function propertyOptionLabel(property: PropertyPickRow): string {
  const line = formatPropertyAddressLine(property);
  const base = property.label?.trim() || line || 'Location';
  return property.is_primary ? `${base} (primary)` : base;
}

function buildCustomerPropertyGroups(rows: PropertyPickRow[]): CustomerPropertyGroup[] {
  const map = new Map<string, { id: string; label: string }[]>();
  for (const property of rows) {
    const list = map.get(property.customer_id) ?? [];
    list.push({ id: property.id, label: propertyOptionLabel(property) });
    map.set(property.customer_id, list);
  }
  return Array.from(map.entries()).map(([customerId, options]) => ({ customerId, options }));
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RecurringScheduleRulesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/schedule/recurring');
  const admin = createAdminClient();
  const tier = await resolveTenantPlanTier(admin, membership.tenantId);
  const activeWorkflowCount = await countActiveAutomationWorkflows(admin, membership.tenantId);
  const db = createTenantPortalDbClient();

  const err = firstParam(sp.error);
  const created = firstParam(sp.created) === '1';
  const updated = firstParam(sp.updated) === '1';
  const crewLater = firstParam(sp.crew) === 'later';

  const [
    { data: customers },
    { data: properties },
    { data: quotes },
    { data: rules },
    { data: tenantRow },
    { data: members },
  ] = await Promise.all([
    db
      .from('customers')
      .select(
        `
      id,
      customer_identities ( first_name, last_name, full_name )
    `,
      )
      .eq('tenant_id', membership.tenantId)
      .order('created_at', { ascending: false })
      .limit(200),
    db
      .from('tenant_customer_properties')
      .select(
        'id, customer_id, label, address_line1, address_line2, city, state, postal_code, is_primary',
      )
      .eq('tenant_id', membership.tenantId)
      .order('is_primary', { ascending: false }),
    db
      .from('tenant_quotes')
      .select('id, title, amount_cents')
      .eq('tenant_id', membership.tenantId)
      .order('created_at', { ascending: false })
      .limit(40),
    db
      .from('recurring_appointment_rules')
      .select(
        'id, title, rrule_definition, anchor_starts_at, is_active, horizon_days, customer_id, expected_amount_cents',
      )
      .eq('tenant_id', membership.tenantId)
      .order('created_at', { ascending: false }),
    admin.from('tenants').select('timezone').eq('id', membership.tenantId).maybeSingle(),
    db
      .from('tenant_memberships')
      .select('user_id, role')
      .eq('tenant_id', membership.tenantId)
      .eq('is_active', true)
      .order('role', { ascending: true }),
  ]);

  const tenantTimezone = tenantRow?.timezone ?? DEFAULT_TENANT_TIMEZONE;
  const memberIds = [...new Set((members ?? []).map((member) => member.user_id))];
  const { data: memberProfiles } =
    memberIds.length > 0
      ? await db.from('user_profiles').select('user_id, display_name').in('user_id', memberIds)
      : { data: [] as { user_id: string; display_name: string | null }[] };
  const displayByUserId = new Map(
    (memberProfiles ?? []).map((profile) => [profile.user_id, profile.display_name?.trim() || '']),
  );
  const cleanerOptions = (members ?? []).map((member) => ({
    id: member.user_id,
    label: `${displayByUserId.get(member.user_id) || 'Team member'} (${member.role})`,
  }));

  const custList = (customers ?? []) as CustomerPickRow[];
  const customerOptions = custList.map((customer) => ({
    id: customer.id,
    label: formatCustomerDisplayName(customer.customer_identities ?? {}),
  }));
  const customerPropertyGroups = buildCustomerPropertyGroups(
    (properties ?? []) as PropertyPickRow[],
  );
  const quoteOptions = (quotes ?? []).map((quote) => {
    const amount =
      quote.amount_cents != null && Number(quote.amount_cents) > 0
        ? ` · $${formatCentsAsDollars(Number(quote.amount_cents))}`
        : '';
    return {
      id: quote.id,
      label: `${quote.title}${amount}`,
    };
  });

  return (
    <>
      <PageHeader
        title="Recurring visits"
        titleHint="Automatically add calendar appointments on a repeating schedule. Nightly sync materializes visits for the next horizon window."
        actions={
          <Button as="a" href="/schedule" variant="secondary">
            ← Schedule
          </Button>
        }
      />

      <FeedbackToasts
        messages={[
          created
            ? {
                title:
                  'Series saved. The customer gets one email for the series. Visits appear after the next cron run, and those visits are not emailed one by one.',
                variant: 'success',
              }
            : null,
          updated
            ? {
                title: crewLater
                  ? 'Series updated. No upcoming visits are on the calendar yet, so the cleaner was not changed.'
                  : 'Series updated. The customer gets one email when the frequency, time, or cleaner changed.',
                variant: 'success',
              }
            : null,
          err ? { title: err, variant: 'danger' } : null,
        ]}
      />

      <p className={styles.rowMeta} style={{ marginBottom: 'var(--space-4)' }}>
        Automation usage: {formatAutomationWorkflowUsage(activeWorkflowCount, tier)}.{' '}
        <Link href="/billing">Upgrade plan</Link>
      </p>

      <Stack gap={6}>
        <RecurringConceptCallout variant="visits" />

        <Card
          title="Add rule"
          description="First occurrence anchors the series (same local-time idea as new appointments)."
        >
          <RecurringRuleForm
            tenantSlug={membership.tenantSlug}
            customers={customerOptions}
            customerPropertyGroups={customerPropertyGroups}
            quoteOptions={quoteOptions}
          />
        </Card>

        <Card title="Existing rules">
          {!rules?.length ? (
            <p className={styles.rowMeta}>No rules yet.</p>
          ) : (
            <ul className={styles.list}>
              {rules.map((r) => (
                <li key={r.id} className={styles.row}>
                  <div>
                    <div className={styles.rowTitle}>{r.title}</div>
                    <div className={styles.rowMeta}>
                      {r.is_active ? 'active' : 'inactive'} · horizon {r.horizon_days}d · anchor{' '}
                      {new Date(String(r.anchor_starts_at)).toLocaleString()}
                      {r.expected_amount_cents != null && r.expected_amount_cents > 0
                        ? ` · $${formatCentsAsDollars(r.expected_amount_cents)}/visit`
                        : ' · no job price'}
                    </div>
                    <pre
                      style={{
                        margin: 'var(--space-2) 0 0',
                        fontSize: 'var(--font-size-sm)',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {r.rrule_definition}
                    </pre>
                  </div>
                  {r.is_active ? (
                    <>
                      <form action={updateRecurringVisitRuleAction} className={styles.form}>
                        <input type="hidden" name="tenant_slug" value={membership.tenantSlug} />
                        <input type="hidden" name="rule_id" value={r.id} />
                        <label className={styles.label}>
                          Pattern
                          <select
                            name="preset"
                            className={styles.select}
                            defaultValue={
                              recurringPresetIdForRrule(r.rrule_definition) ?? '__keep__'
                            }
                          >
                            {recurringPresetIdForRrule(r.rrule_definition) ? null : (
                              <option value="__keep__">Keep current pattern</option>
                            )}
                            {RECURRING_SERIES_PRESETS.map((preset) => (
                              <option key={preset.id} value={preset.id}>
                                {preset.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className={styles.label}>
                          Series time ({tenantTimezone})
                          <input
                            name="starts_at"
                            className={styles.input}
                            type="datetime-local"
                            required
                            defaultValue={isoToLocalDatetimeLocalValue(
                              String(r.anchor_starts_at),
                              tenantTimezone,
                            )}
                          />
                        </label>
                        <label className={styles.label}>
                          Cleaner for upcoming visits
                          <select name="cleaner_user_id" className={styles.select} defaultValue="">
                            <option value="">Leave the current crew</option>
                            {cleanerOptions.map((cleaner) => (
                              <option key={cleaner.id} value={cleaner.id}>
                                {cleaner.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Button type="submit" variant="secondary">
                          Save series
                        </Button>
                      </form>
                      <form
                        action={deactivateRecurringVisitRuleAction}
                        style={{ marginTop: 'var(--space-2)' }}
                      >
                        <input type="hidden" name="tenant_slug" value={membership.tenantSlug} />
                        <input type="hidden" name="rule_id" value={r.id} />
                        <Button type="submit" variant="secondary">
                          Cancel series
                        </Button>
                      </form>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Stack>

      <p className={styles.pageFooterHint}>
        <Link href="/schedule" className={styles.inlineLink}>
          Back to schedule
        </Link>
      </p>
    </>
  );
}
