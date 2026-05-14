import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { formatUsdFromCents } from '@/lib/format/money';
import { createCustomerSubscriptionCheckoutSessionAction } from '@/app/tenant/billing/customerSubscriptionCheckoutActions';
import styles from './recurringBillingPanel.module.scss';

function intervalLabel(i: string): string {
  if (i === 'week') return 'Weekly';
  if (i === 'year') return 'Yearly';
  return 'Monthly';
}

type PlanRow = { id: string; name: string; amount_cents: number; billing_interval: string };

type SubEmbed = {
  id: string;
  status: string;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  service_plans: { name: string; amount_cents: number; billing_interval: string } | null;
};

interface Props {
  tenantSlug: string;
  tenantId: string;
  customerId: string;
}

export async function RecurringBillingPanel({ tenantSlug, tenantId, customerId }: Props) {
  const db = createTenantPortalDbClient();
  const [{ data: tenantRow }, { data: plansData }, { data: subsRaw }] = await Promise.all([
    db.from('tenants').select('stripe_connect_status').eq('id', tenantId).maybeSingle(),
    db
      .from('service_plans')
      .select('id, name, amount_cents, billing_interval')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name'),
    db
      .from('customer_subscriptions')
      .select(
        `
        id,
        status,
        stripe_subscription_id,
        current_period_end,
        cancel_at_period_end,
        service_plans ( name, amount_cents, billing_interval )
      `,
      )
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false }),
  ]);

  const connectComplete = tenantRow?.stripe_connect_status === 'complete';
  const plans = (plansData ?? []) as PlanRow[];
  const subs = (subsRaw ?? []) as SubEmbed[];

  return (
    <Card
      title="Recurring billing (Stripe)"
      description="Charge this customer on a schedule through your connected Stripe account. They complete payment on Stripe Checkout."
    >
      {!connectComplete ? (
        <p className={styles.muted}>
          Finish Stripe Connect under Billing → Payment setup before you can start subscription checkout.
        </p>
      ) : plans.length === 0 ? (
        <p className={styles.muted}>
          Create at least one active service plan under Billing → Service plans, then return here to send checkout.
        </p>
      ) : (
        <form action={createCustomerSubscriptionCheckoutSessionAction} className={styles.row}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <input type="hidden" name="customer_id" value={customerId} />
          <label className={styles.field}>
            Service plan
            <select className={styles.select} name="service_plan_id" required defaultValue="">
              <option value="" disabled>
                Select a plan…
              </option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {formatUsdFromCents(p.amount_cents)} / {intervalLabel(p.billing_interval)}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="primary">
            Open subscription checkout
          </Button>
        </form>
      )}

      {subs.length > 0 ? (
        <ul className={styles.subList}>
          {subs.map((s) => {
            const sp = s.service_plans;
            const label = sp
              ? `${sp.name} · ${formatUsdFromCents(sp.amount_cents)} / ${intervalLabel(sp.billing_interval)}`
              : 'Subscription';
            const end = s.current_period_end
              ? new Date(String(s.current_period_end)).toLocaleDateString()
              : '—';
            return (
              <li key={s.id} className={styles.subItem}>
                <strong>{label}</strong>
                <span className={styles.muted}>
                  {' '}
                  · {s.status}
                  {s.cancel_at_period_end ? ' (cancels at period end)' : ''}
                  {' · '}
                  Current period ends {end}
                  {s.stripe_subscription_id ? ` · ${s.stripe_subscription_id}` : ''}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.muted} style={{ marginTop: 'var(--space-3)' }}>
          No Stripe subscriptions recorded yet for this customer.
        </p>
      )}
    </Card>
  );
}
