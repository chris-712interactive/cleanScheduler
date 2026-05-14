import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { Button } from '@/components/ui/Button';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { formatUsdFromCents } from '@/lib/format/money';
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
    .select('id, name, amount_cents, billing_interval, is_active, created_at')
    .eq('tenant_id', membership.tenantId)
    .order('created_at', { ascending: false });

  const errMsg = firstParam(sp.error);
  const created = firstParam(sp.created) === '1';

  return (
    <>
      <PageHeader
        title="Service plans"
        description="Recurring prices you offer end customers. Checkout runs on your Stripe Connect account."
      />

      <p className={styles.backLinkWrap}>
        <a href="/billing" className={styles.backLink}>
          ← Workspace billing
        </a>
      </p>

      {created ? (
        <p className={styles.bannerOk} role="status">
          Service plan created.
        </p>
      ) : null}
      {errMsg ? (
        <p className={styles.bannerError} role="alert">
          {errMsg}
        </p>
      ) : null}

      <Stack gap={6}>
        <Card title="Add a plan" description="Amount is billed each billing period (USD).">
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
