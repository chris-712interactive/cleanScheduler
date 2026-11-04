import { PageHeader } from '@/components/portal/PageHeader';
import { FeedbackToasts } from '@/components/ui/FeedbackToast';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { Button } from '@/components/ui/Button';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { formatUsdFromCents } from '@/lib/format/money';
import { RecurringConceptCallout } from '@/components/billing/RecurringConceptCallout';
import { deactivateServicePlanAction, createServicePlanAction } from './actions';
import styles from '../billing.module.scss';

export const dynamic = 'force-dynamic';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function intervalLabel(i: string): string {
  if (i === 'week') return 'Weekly';
  if (i === 'year') return 'Yearly';
  return 'Monthly';
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TenantServicePlansPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/service-plans');
  const db = createTenantPortalDbClient();
  const { data: rows, error } = await db
    .from('service_plans')
    .select(
      'id, name, amount_cents, billing_interval, is_active, created_at, included_cleans, service_cadence, overage_amount_cents',
    )
    .eq('tenant_id', membership.tenantId)
    .order('created_at', { ascending: false });

  const errMsg = firstParam(sp.error);
  const created = firstParam(sp.created) === '1';

  return (
    <>
      <PageHeader
        title="Subscription plans (Stripe)"
        backHref="/billing"
        backLabel="Workspace billing"
        titleHint="Recurring prices you charge customers through Stripe Connect — separate from calendar recurring visits."
      />

      <FeedbackToasts
        messages={[
          created ? { title: 'Service plan created.', variant: 'success' } : null,
          errMsg ? { title: errMsg, variant: 'danger' } : null,
        ]}
      />

      <Stack gap={6}>
        <RecurringConceptCallout variant="billing" />

        <Card
          title="Add a plan"
          description="Amount is billed each billing period (USD). The included count is copied onto each paid charge. Changing it later changes the next charge for every customer on this plan."
        >
          <form action={createServicePlanAction} className={styles.invoiceRow}>
            <label className={styles.field}>
              Name
              <input
                className={styles.input}
                name="name"
                required
                maxLength={120}
                placeholder="Bi-weekly standard"
              />
            </label>
            <label className={styles.field}>
              Amount (USD)
              <input className={styles.input} name="amount_dollars" required placeholder="199.00" />
            </label>
            <label className={styles.field}>
              Interval
              <select
                className={styles.select}
                name="billing_interval"
                required
                defaultValue="month"
              >
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
                <option value="year">Yearly</option>
              </select>
            </label>
            <label className={styles.field}>
              Visit cadence
              <select
                className={styles.select}
                name="service_cadence"
                required
                defaultValue="biweekly"
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every 2 weeks</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <label className={styles.field}>
              Cleans included per charge
              <input
                className={styles.input}
                name="included_cleans"
                type="number"
                min={1}
                required
                defaultValue={2}
              />
            </label>
            <label className={styles.field}>
              Extra clean price (optional)
              <input className={styles.input} name="overage_dollars" placeholder="120.00" />
            </label>
            <Button type="submit" variant="primary">
              Save plan
            </Button>
          </form>
        </Card>

        <Card
          title="Plans"
          description="Deactivate a plan to hide it from new subscription checkout."
        >
          {error ? (
            <p className={styles.muted}>{error.message}</p>
          ) : !rows?.length ? (
            <p className={styles.muted}>No plans yet.</p>
          ) : (
            <ul className={styles.muted} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {rows.map((r) => (
                <li
                  key={r.id}
                  style={{
                    padding: 'var(--space-3) 0',
                    borderTop: '1px solid var(--color-border)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 'var(--space-3)',
                    alignItems: 'center',
                  }}
                >
                  <span>
                    <strong>{r.name}</strong>
                    <span className={styles.muted}>
                      {' '}
                      · {formatUsdFromCents(r.amount_cents)} / {intervalLabel(r.billing_interval)}
                      {r.included_cleans
                        ? ` · ${r.included_cleans} cleans / charge`
                        : ' · billed per visit'}
                      {r.is_active ? '' : ' · inactive'}
                    </span>
                  </span>
                  {r.is_active ? (
                    <form action={deactivateServicePlanAction}>
                      <input type="hidden" name="plan_id" value={r.id} />
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
    </>
  );
}
