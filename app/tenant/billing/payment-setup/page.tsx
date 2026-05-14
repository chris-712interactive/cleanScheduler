import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { Button } from '@/components/ui/Button';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { refreshStripeConnectAccountAction, startStripeConnectOnboardingAction } from './actions';
import styles from '../billing.module.scss';

export const dynamic = 'force-dynamic';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not started',
  pending: 'Onboarding in progress',
  complete: 'Live — card payments enabled',
  restricted: 'Restricted — action required',
};

export default async function TenantPaymentSetupPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/payment-setup');

  const connectParam = firstParam(sp.connect);
  const err = firstParam(sp.error);
  const ok = connectParam === 'synced';

  const db = createTenantPortalDbClient();
  const [{ data: tenant }, { data: acct }] = await Promise.all([
    db.from('tenants').select('stripe_connect_status').eq('id', membership.tenantId).maybeSingle(),
    db.from('tenant_stripe_connect_accounts').select('*').eq('tenant_id', membership.tenantId).maybeSingle(),
  ]);

  const status = tenant?.stripe_connect_status ?? 'not_started';
  const statusLabel = STATUS_LABEL[status] ?? status;

  return (
    <>
      <PageHeader
        title="Payment setup"
        description="Connect Stripe Express so customers can pay open invoices by card. Cash, check, and Zelle recording still works without Connect."
      />

      <p className={styles.backLinkWrap}>
        <Link href="/billing" className={styles.backLink}>
          ← Workspace billing
        </Link>
      </p>

      {err ? (
        <p className={styles.bannerError} role="alert">
          {err}
        </p>
      ) : null}
      {ok ? (
        <p className={styles.bannerOk} role="status">
          Stripe account details refreshed.
        </p>
      ) : null}
      {connectParam === 'return' ? (
        <p className={styles.bannerOk} role="status">
          If Stripe still shows onboarding steps, use Refresh status below after you finish in Stripe.
        </p>
      ) : null}

      <Stack gap={6}>
        <Card title="Stripe Connect" description="One connected account per workspace. Funds settle with Stripe; platform fees are optional (see STRIPE_CONNECT_APPLICATION_FEE_BPS).">
          <p className={styles.muted} style={{ marginTop: 0 }}>
            Status: <strong>{statusLabel}</strong>
            {acct?.stripe_account_id ? (
              <>
                {' '}
                · Account <code>{acct.stripe_account_id}</code>
              </>
            ) : null}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
            <form action={startStripeConnectOnboardingAction}>
              <input type="hidden" name="tenant_slug" value={membership.tenantSlug} />
              <Button type="submit" variant="primary">
                {acct ? 'Continue Stripe onboarding' : 'Start Stripe onboarding'}
              </Button>
            </form>
            {acct ? (
              <form action={refreshStripeConnectAccountAction}>
                <input type="hidden" name="tenant_slug" value={membership.tenantSlug} />
                <Button type="submit" variant="secondary">
                  Refresh status from Stripe
                </Button>
              </form>
            ) : null}
          </div>
        </Card>

        <Card title="Webhooks" description="Configure your Stripe webhook to send Connect events to the same endpoint as platform billing.">
          <p className={styles.muted} style={{ marginTop: 0 }}>
            Endpoint: <code>/api/webhooks/stripe</code> — include <code>checkout.session.completed</code> (payment
            mode) and <code>account.updated</code> for connected accounts. Use the signing secret from that endpoint in{' '}
            <code>STRIPE_WEBHOOK_SECRET</code>.
          </p>
        </Card>
      </Stack>
    </>
  );
}
