import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
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
import { deactivateRecurringVisitRuleAction } from './actions';
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

  const [{ data: customers }, { data: properties }, { data: quotes }, { data: rules }] = await Promise.all([
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
  ]);

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

      {created ? (
        <p className={styles.success} role="status">
          Rule created. Visits appear after the next cron run (see Vercel Cron or hit the cron route
          in dev).
        </p>
      ) : null}
      {err ? (
        <p className={styles.error} role="alert">
          {err}
        </p>
      ) : null}

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
                    <form
                      action={deactivateRecurringVisitRuleAction}
                      style={{ marginTop: 'var(--space-2)' }}
                    >
                      <input type="hidden" name="tenant_slug" value={membership.tenantSlug} />
                      <input type="hidden" name="rule_id" value={r.id} />
                      <Button type="submit" variant="secondary">
                        Deactivate
                      </Button>
                    </form>
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
