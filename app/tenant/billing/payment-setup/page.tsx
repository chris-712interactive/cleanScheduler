import Link from 'next/link';
import { Check, Circle, CreditCard } from 'lucide-react';
import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import type { StatusTone } from '@/components/ui/StatusPill';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { Enums } from '@/lib/supabase/database.types';
import { refreshStripeConnectAccountAction, startStripeConnectOnboardingAction } from './actions';
import billingStyles from '../billing.module.scss';
import styles from './payment-setup.module.scss';

export const dynamic = 'force-dynamic';

type ConnectStatus = Enums<'tenant_stripe_connect_status'>;

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function connectStatusMeta(status: ConnectStatus): {
  tone: StatusTone;
  pillLabel: string;
  title: string;
  lead: string;
  primaryActionLabel: string;
} {
  switch (status) {
    case 'complete':
      return {
        tone: 'success',
        pillLabel: 'Live',
        title: 'Customers can pay by card',
        lead: 'Send invoices with a secure pay link. Card payments are processed by Stripe and deposited to your connected bank account.',
        primaryActionLabel: 'Continue Stripe setup',
      };
    case 'pending':
      return {
        tone: 'warning',
        pillLabel: 'Setup in progress',
        title: 'Finish verifying with Stripe',
        lead: 'You started setup but a few steps are still open. Complete Stripe’s verification flow to turn on card payments.',
        primaryActionLabel: 'Continue setup',
      };
    case 'restricted':
      return {
        tone: 'danger',
        pillLabel: 'Needs attention',
        title: 'Stripe needs more information',
        lead: 'Your account has open requirements before card payments can go live. Continue in Stripe to review and resolve them.',
        primaryActionLabel: 'Continue in Stripe',
      };
    default:
      return {
        tone: 'neutral',
        pillLabel: 'Not set up',
        title: 'Card payments are not set up yet',
        lead: 'Connect Stripe once to add pay-by-card links to your invoices. Cash, check, and Zelle still work without this.',
        primaryActionLabel: 'Set up card payments',
      };
  }
}

interface SetupStep {
  label: string;
  done: boolean;
}

function buildSetupSteps(
  acct: {
    details_submitted: boolean;
    charges_enabled: boolean;
    payouts_enabled: boolean;
  } | null,
): SetupStep[] {
  if (!acct) return [];

  return [
    { label: 'Business details submitted to Stripe', done: acct.details_submitted },
    { label: 'Ready to accept card payments', done: acct.charges_enabled },
    { label: 'Payouts to your bank enabled', done: acct.payouts_enabled },
  ];
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TenantPaymentSetupPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/payment-setup');

  const connectParam = firstParam(sp.connect);
  const err = firstParam(sp.error);
  const synced = connectParam === 'synced';
  const returnedFromStripe = connectParam === 'return';

  const db = createTenantPortalDbClient();
  const [{ data: tenant }, { data: acct }] = await Promise.all([
    db.from('tenants').select('stripe_connect_status').eq('id', membership.tenantId).maybeSingle(),
    db
      .from('tenant_stripe_connect_accounts')
      .select('details_submitted, charges_enabled, payouts_enabled')
      .eq('tenant_id', membership.tenantId)
      .maybeSingle(),
  ]);

  const status = (tenant?.stripe_connect_status ?? 'not_started') as ConnectStatus;
  const meta = connectStatusMeta(status);
  const setupSteps = buildSetupSteps(acct);
  const showSetupSteps = setupSteps.length > 0 && status !== 'not_started';
  const showRefresh = Boolean(acct) && status !== 'complete';

  return (
    <>
      <PageHeader
        title="Accept card payments"
        backHref="/billing"
        backLabel="Billing"
        titleHint="Add pay-by-card links to customer invoices through Stripe."
      />

      {err ? (
        <p className={billingStyles.bannerError} role="alert">
          {err}
        </p>
      ) : null}
      {synced ? (
        <p className={billingStyles.bannerOk} role="status">
          Status updated from Stripe.
        </p>
      ) : null}
      {returnedFromStripe && status !== 'complete' ? (
        <p className={billingStyles.bannerOk} role="status">
          Welcome back. If Stripe still shows open steps, finish them there, then refresh your
          status below.
        </p>
      ) : null}

      <Stack gap={6}>
        <section className={styles.connectHero} aria-labelledby="card-payments-heading">
          <div className={styles.connectHeroTop}>
            <div className={styles.connectHeroIconWrap} aria-hidden>
              <CreditCard size={28} strokeWidth={1.75} />
            </div>
            <div className={styles.connectHeroCopy}>
              <div className={styles.connectHeroHeadingRow}>
                <p className={styles.connectHeroEyebrow}>Online payments</p>
                <StatusPill tone={meta.tone}>{meta.pillLabel}</StatusPill>
              </div>
              <h2 id="card-payments-heading" className={styles.connectHeroTitle}>
                {meta.title}
              </h2>
              <p className={styles.connectHeroLead}>{meta.lead}</p>
            </div>
          </div>

          {showSetupSteps ? (
            <ul className={styles.setupChecklist} aria-label="Setup progress">
              {setupSteps.map((step) => (
                <li
                  key={step.label}
                  className={styles.setupChecklistItem}
                  data-done={step.done ? 'true' : undefined}
                >
                  {step.done ? (
                    <Check size={16} strokeWidth={2.5} className={styles.setupChecklistIcon} />
                  ) : (
                    <Circle size={16} strokeWidth={2} className={styles.setupChecklistIcon} />
                  )}
                  {step.label}
                </li>
              ))}
            </ul>
          ) : null}

          {status !== 'complete' ? (
            <div className={styles.connectHeroActions}>
              <form action={startStripeConnectOnboardingAction}>
                <input type="hidden" name="tenant_slug" value={membership.tenantSlug} />
                <Button type="submit" variant="primary">
                  {meta.primaryActionLabel}
                </Button>
              </form>
              {showRefresh ? (
                <form action={refreshStripeConnectAccountAction}>
                  <input type="hidden" name="tenant_slug" value={membership.tenantSlug} />
                  <Button type="submit" variant="secondary">
                    Refresh status
                  </Button>
                </form>
              ) : null}
            </div>
          ) : (
            <div className={styles.nextStepCard}>
              <h3 className={styles.nextStepTitle}>You are ready to send pay links</h3>
              <p className={styles.nextStepLead}>
                Open an invoice and share it with your customer. They can pay by card from the link
                you send.
              </p>
              <Link href="/billing/invoices" className={styles.nextStepLink}>
                Go to invoices →
              </Link>
            </div>
          )}
        </section>

        <section className={styles.goodToKnow} aria-labelledby="good-to-know-heading">
          <h3 id="good-to-know-heading" className={styles.goodToKnowTitle}>
            Good to know
          </h3>
          <ul className={styles.goodToKnowList}>
            <li>
              Card payments are optional — you can still record cash, check, and Zelle manually.
            </li>
            <li>
              For Zelle and bank transfers, use{' '}
              <Link href="/billing/bank-connection" className={billingStyles.inlineLink}>
                Deposit matching
              </Link>{' '}
              after the payment hits your bank.
            </li>
            <li>
              Stripe handles secure checkout, identity verification, and payouts to your bank.
            </li>
          </ul>
        </section>
      </Stack>
    </>
  );
}
