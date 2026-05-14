import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { formatUsdFromCents } from '@/lib/format/money';
import { createCustomerSubscriptionCheckoutSessionAction } from '@/app/tenant/billing/customerSubscriptionCheckoutActions';
import {
  cancelCustomerSubscriptionAtPeriodEndAction,
  openTenantCustomerBillingPortalAction,
} from '@/app/tenant/billing/subscriptionLifecycleActions';
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
  billing_cycle_anchor: string | null;
  service_plans: { name: string; amount_cents: number; billing_interval: string } | null;
};

interface Props {
  tenantSlug: string;
  tenantId: string;
  customerId: string;
}

function formatAnchor(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString();
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
        billing_cycle_anchor,
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
  const hasMonthlyPlan = plans.some((p) => p.billing_interval === 'month');

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
          {hasMonthlyPlan ? (
            <label className={styles.field}>
              Billing day (optional, monthly plans)
              <input
                className={styles.input}
                name="billing_anchor_day"
                type="number"
                min={1}
                max={28}
                placeholder="1–28"
                title="Day of month for the first full billing period (monthly plans only; Stripe ignores for weekly/yearly)."
              />
            </label>
          ) : null}
          <Button type="submit" variant="primary">
            Open subscription checkout
          </Button>
        </form>
      )}

      {connectComplete ? (
        <form action={openTenantCustomerBillingPortalAction} className={styles.row} style={{ marginTop: 'var(--space-2)' }}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <input type="hidden" name="customer_id" value={customerId} />
          <Button type="submit" variant="secondary">
            Open Stripe billing portal
          </Button>
          <span className={styles.muted}>Payment methods and invoices on your connected account.</span>
        </form>
      ) : null}

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
            const anchorLabel = formatAnchor(s.billing_cycle_anchor);
            const sid = s.stripe_subscription_id;
            const sidShort = sid && sid.length > 10 ? `…${sid.slice(-8)}` : sid;
            const canCancelStripe =
              Boolean(sid) && s.status !== 'canceled' && !s.cancel_at_period_end;
            return (
              <li key={s.id} className={styles.subItem}>
                <strong>{label}</strong>
                <span className={styles.muted}>
                  {' '}
                  · {s.status}
                  {s.cancel_at_period_end ? ' (cancels at period end)' : ''}
                  {' · '}
                  Current period ends {end}
                  {anchorLabel ? ` · Billing anchor ${anchorLabel}` : ''}
                  {sidShort ? ` · ${sidShort}` : ''}
                </span>
                {connectComplete && sid ? (
                  <div className={styles.subActions}>
                    {canCancelStripe ? (
                      <form action={cancelCustomerSubscriptionAtPeriodEndAction}>
                        <input type="hidden" name="tenant_slug" value={tenantSlug} />
                        <input type="hidden" name="customer_id" value={customerId} />
                        <input type="hidden" name="subscription_row_id" value={s.id} />
                        <Button type="submit" variant="secondary">
                          Cancel at period end
                        </Button>
                      </form>
                    ) : null}
                  </div>
                ) : null}
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
