import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { Button } from '@/components/ui/Button';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { PLATFORM_PLAN_LABELS, parsePlatformPlanTier } from '@/lib/billing/platformPlanTier';
import { getEntitlementsForTier } from '@/lib/billing/entitlements';
import type { Tables } from '@/lib/supabase/database.types';
import { resumePlatformSubscriptionCheckout } from './actions';
import styles from './billing.module.scss';

type TenantBillingRow = Tables<'tenant_billing_accounts'>;

export const dynamic = 'force-dynamic';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TenantBillingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing');

  const supabase = createTenantPortalDbClient();
  const billingRes = await supabase
    .from('tenant_billing_accounts')
    .select('*')
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();
  const billing = billingRes.data as unknown as TenantBillingRow | null;
  const error = billingRes.error;

  const resumeMessage = firstParam(params.message);
  const resumeFlag = firstParam(params.resume);
  const checkoutSuccess = firstParam(params.checkout) === 'success';

  const planKey = parsePlatformPlanTier(String(billing?.platform_plan ?? ''));
  const planLabel = planKey ? PLATFORM_PLAN_LABELS[planKey] : '—';
  const listPrice = planKey ? getEntitlementsForTier(planKey).monthlyPriceUsd : null;

  const suspended = billing?.status === 'canceled';

  return (
    <>
      <PageHeader
        title="Workspace billing"
        description="Platform subscription for cleanScheduler, plus customer invoicing for your clients."
      />

      <Stack gap={6}>
        {resumeFlag === 'error' && resumeMessage ? (
          <p className={styles.bannerError} role="alert">
            {resumeMessage}
          </p>
        ) : null}

        {checkoutSuccess ? (
          <p className={styles.bannerOk} role="status">
            Checkout completed. Subscription details will update from Stripe within a minute.
          </p>
        ) : null}

        <Card title="Customer invoices" description="Bill customers in your directory and record manual payments.">
          <p className={styles.muted} style={{ marginTop: 0 }}>
            Create invoices, track balances, and log cash, check, or Zelle payments. Stripe Connect pay-online flows
            come next.
          </p>
          <Button variant="secondary" as="a" href="/billing/invoices">
            Open customer invoices
          </Button>
        </Card>

        <Card title="Current plan" description="Synced from Stripe webhooks after checkout.">
          {error || !billing ? (
            <p className={styles.muted}>No billing record found for this workspace.</p>
          ) : (
            <KeyValueList
              items={[
                { key: 'Plan', value: planLabel },
                ...(listPrice != null ? [{ key: 'List price', value: `$${listPrice}/mo` }] : []),
                { key: 'Status', value: String(billing.status ?? '') },
                {
                  key: 'Trial',
                  value: billing.trial_ends_at
                    ? `ends ${new Date(String(billing.trial_ends_at)).toLocaleString()}`
                    : '—',
                },
                {
                  key: 'Stripe subscription',
                  value: billing.stripe_subscription_id ? String(billing.stripe_subscription_id) : '—',
                },
                {
                  key: 'Canceled',
                  value: billing.canceled_at
                    ? new Date(String(billing.canceled_at)).toLocaleString()
                    : '—',
                },
              ]}
            />
          )}
        </Card>

        {suspended ? (
          <Card
            title="Resume subscription"
            description="Your trial or subscription ended without an active payment method. Start checkout again to reactivate this workspace."
          >
            <form action={resumePlatformSubscriptionCheckout} className={styles.resumeForm}>
              <input type="hidden" name="tenant_slug" value={membership.tenantSlug} />
              <Button type="submit" variant="primary">
                Continue to Stripe checkout
              </Button>
            </form>
          </Card>
        ) : null}
      </Stack>
    </>
  );
}
