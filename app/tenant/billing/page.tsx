import Link from 'next/link';
import {
  ArrowLeftRight,
  Briefcase,
  CreditCard,
  FileText,
  Landmark,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import type { StatusTone } from '@/components/ui/StatusPill';
import { createAdminClient, createTenantPortalDbClient } from '@/lib/supabase/server';
import { syncTenantPlatformBillingFromStripe } from '@/lib/billing/syncTenantPlatformSubscription';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import type { TenantRole } from '@/lib/auth/types';
import {
  PLATFORM_PLAN_DESCRIPTIONS,
  PLATFORM_PLAN_LABELS,
  parsePlatformPlanTier,
} from '@/lib/billing/platformPlanTier';
import { getEntitlementsForTier } from '@/lib/billing/entitlements';
import {
  canAccessCustomerBillingTools,
  needsSubscriptionPurchase,
  resolveTenantSubscriptionAccess,
  trialDaysRemaining,
} from '@/lib/billing/tenantSubscriptionAccess';
import { formatAutoPurgeDate, getTenantPurgeStatus } from '@/lib/billing/tenantPurge';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import { CUSTOMER_AR_NAV_LINKS } from '@/lib/tenant/customerBillingNav';
import type { Tables } from '@/lib/supabase/database.types';
import { openPlatformBillingPortal, resumePlatformSubscriptionCheckout } from './actions';
import styles from './billing.module.scss';

type TenantBillingRow = Tables<'tenant_billing_accounts'>;

export const dynamic = 'force-dynamic';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function formatPlanStatus(
  access: ReturnType<typeof resolveTenantSubscriptionAccess>,
  billingStatus: TenantBillingRow['status'] | null | undefined,
): { label: string; tone: StatusTone } {
  if (access === 'trial_expired') {
    return { label: 'Trial ended', tone: 'danger' };
  }
  switch (billingStatus) {
    case 'active':
      return { label: 'Active', tone: 'success' };
    case 'trialing':
      return { label: 'Trial', tone: 'info' };
    case 'past_due':
      return { label: 'Past due', tone: 'warning' };
    case 'canceled':
      return { label: 'Canceled', tone: 'danger' };
    default:
      return { label: 'Unknown', tone: 'neutral' };
  }
}

function formatNextPayment(
  access: ReturnType<typeof resolveTenantSubscriptionAccess>,
  billing: TenantBillingRow,
): string {
  if (access === 'trial_expired' || access === 'suspended') {
    return '—';
  }
  const dateSource =
    billing.status === 'trialing' && billing.trial_ends_at ? billing.trial_ends_at : null;
  if (!dateSource) return '—';
  return new Date(String(dateSource)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatPlanAmount(monthlyPriceUsd: number | null): string {
  if (monthlyPriceUsd == null) return '—';
  return `$${monthlyPriceUsd.toFixed(2)} USD`;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const CUSTOMER_AR_ICONS = {
  '/billing/invoices': FileText,
  '/billing/service-plans': Layers,
  '/billing/transactions': ArrowLeftRight,
  '/billing/payment-audits': ShieldCheck,
  '/billing/bank-connection': Landmark,
  '/billing/payment-setup': CreditCard,
} as const;

export default async function TenantBillingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing', {
    internalPathname: '/tenant/billing',
    browserPathname: '/billing',
  });

  const supabase = createTenantPortalDbClient();
  const [billingRes, tenantRes] = await Promise.all([
    supabase.from('tenant_billing_accounts').select('*').eq('tenant_id', membership.tenantId).maybeSingle(),
    supabase.from('tenants').select('is_active').eq('id', membership.tenantId).maybeSingle(),
  ]);
  const billing = billingRes.data as unknown as TenantBillingRow | null;
  const error = billingRes.error;

  const resumeMessage = firstParam(params.message);
  const resumeFlag = firstParam(params.resume);
  const checkoutSuccess = firstParam(params.checkout) === 'success';
  const subscribeRequired = firstParam(params.subscribe) === 'required';

  const subscriptionAccess = resolveTenantSubscriptionAccess({
    billingStatus: billing?.status,
    trialEndsAt: billing?.trial_ends_at,
    tenantIsActive: tenantRes.data?.is_active !== false,
    stripeSubscriptionId: billing?.stripe_subscription_id,
  });

  const mustSubscribe = needsSubscriptionPurchase(subscriptionAccess);
  const customerBillingUnlocked = canAccessCustomerBillingTools(subscriptionAccess);
  const canManageSubscription = canManageTeamInvitesAndRoles(membership.role as TenantRole);
  const daysLeft = trialDaysRemaining(billing?.trial_ends_at ?? null);
  const purgeStatus = getTenantPurgeStatus(billing);
  const isOwner = membership.role === 'owner';

  const planKey = parsePlatformPlanTier(String(billing?.platform_plan ?? ''));
  const planLabel = planKey ? PLATFORM_PLAN_LABELS[planKey] : null;
  const planTagline = planKey ? PLATFORM_PLAN_DESCRIPTIONS[planKey] : null;
  const entitlements = planKey ? getEntitlementsForTier(planKey) : null;
  const planStatus = formatPlanStatus(subscriptionAccess, billing?.status);
  const marketingPlansUrl = `${getPublicOrigin(null)}/start-trial`;

  const canManagePlan =
    Boolean(billing?.stripe_customer_id) &&
    subscriptionAccess === 'active' &&
    billing?.status !== 'canceled';

  const subscribeLead = mustSubscribe
    ? subscriptionAccess === 'trial_expired'
      ? canManageSubscription
        ? 'Your free trial has ended. Subscribe to restore access to scheduling, quotes, customers, and the rest of your workspace.'
        : 'Your free trial has ended. Scheduling and other workspace areas are unavailable until an owner or admin renews the plan.'
      : canManageSubscription
        ? 'This workspace is paused. Subscribe to turn your cleanScheduler plan back on.'
        : 'This workspace is paused. Contact an owner or admin to renew the plan.'
    : subscriptionAccess === 'trialing' && daysLeft != null
      ? `You have ${daysLeft} day${daysLeft === 1 ? '' : 's'} left in your trial. Subscribe now to keep access when it ends.`
      : null;

  return (
    <>
      <PageHeader
        title="Workspace billing"
        titleHint="Platform subscription for cleanScheduler, plus customer invoicing for your clients."
      />

      <Stack gap={6}>
        {subscribeRequired && mustSubscribe ? (
          <p className={styles.bannerError} role="status">
            {canManageSubscription
              ? 'Subscribe below to continue using this workspace. Other pages are unavailable until your plan is active.'
              : 'This workspace needs an active subscription. Ask an owner or admin to renew on this billing page.'}
          </p>
        ) : null}

        {resumeFlag === 'error' && resumeMessage ? (
          <p className={styles.bannerError} role="alert">
            {resumeMessage}
          </p>
        ) : null}

        {checkoutSuccess ? (
          <p className={styles.bannerOk} role="status">
            Checkout completed. Your plan status has been refreshed from Stripe.
          </p>
        ) : null}

        {purgeStatus.neverActivated && purgeStatus.autoPurgeAt && mustSubscribe ? (
          <p className={styles.bannerError} role="status">
            {purgeStatus.autoPurgeOverdue
              ? 'This workspace is scheduled for automatic deletion because the free trial ended without a subscription.'
              : `If you do not subscribe, this workspace will be permanently deleted on ${formatAutoPurgeDate(purgeStatus.autoPurgeAt)} (${purgeStatus.daysUntilAutoPurge} day${purgeStatus.daysUntilAutoPurge === 1 ? '' : 's'} remaining).`}
            {isOwner ? (
              <>
                {' '}
                You can also{' '}
                <Link href="/settings/account" className={styles.inlineLink}>
                  delete the workspace yourself
                </Link>
                .
              </>
            ) : null}
          </p>
        ) : null}

        {mustSubscribe || subscribeLead ? (
          <section className={styles.subscribeCard} aria-labelledby="subscribe-heading">
            <h2 id="subscribe-heading" className={styles.subscribeCardTitle}>
              {mustSubscribe
                ? canManageSubscription
                  ? 'Subscribe to continue'
                  : 'Workspace paused'
                : 'Subscribe early'}
            </h2>
            {subscribeLead ? <p className={styles.subscribeCardLead}>{subscribeLead}</p> : null}
            {canManageSubscription ? (
              <div className={styles.subscribeCardActions}>
                <form action={resumePlatformSubscriptionCheckout}>
                  <input type="hidden" name="tenant_slug" value={membership.tenantSlug} />
                  <Button type="submit" variant="primary">
                    {mustSubscribe ? 'Subscribe now' : 'Subscribe with Stripe'}
                  </Button>
                </form>
                {planLabel && entitlements ? (
                  <span className={styles.muted}>
                    {planLabel} · {formatPlanAmount(entitlements.monthlyPriceUsd)}/mo
                  </span>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        <Card
          title="Customer accounts receivable"
          description={
            customerBillingUnlocked
              ? 'Invoices, offline payment tracking, Stripe setup, and bank reconciliation for your clients.'
              : 'Available after you subscribe to a workspace plan.'
          }
        >
          {customerBillingUnlocked ? (
            <nav className={styles.hubNav} aria-label="Customer billing">
              {CUSTOMER_AR_NAV_LINKS.map(({ href, label }) => {
                const Icon = CUSTOMER_AR_ICONS[href as keyof typeof CUSTOMER_AR_ICONS];
                return (
                  <Link key={href} href={href} className={styles.hubNavLink}>
                    <Icon size={18} strokeWidth={2} aria-hidden />
                    {label}
                  </Link>
                );
              })}
            </nav>
          ) : (
            <p className={styles.customerBillingLocked}>
              {canManageSubscription
                ? 'Customer invoicing, subscription plans, and payment setup unlock once your workspace subscription is active. Use Subscribe above to continue.'
                : 'Customer invoicing and payment tools are unavailable until an owner or admin renews the workspace subscription.'}
            </p>
          )}
        </Card>

        <Card
          title="Your cleanScheduler subscription"
          description="Platform plan for this workspace — separate from customer invoices above."
        >
          {error || !billing ? (
            <p className={styles.muted}>No billing record found for this workspace.</p>
          ) : (
            <div className={styles.planLayout}>
              <div className={styles.planSummary}>
                <div className={styles.planIconWrap} aria-hidden>
                  <Briefcase size={28} strokeWidth={1.75} />
                </div>
                <div className={styles.planSummaryCopy}>
                  <h3 className={styles.planName}>{planLabel ?? 'No plan selected'}</h3>
                  {planTagline ? <p className={styles.planTagline}>{planTagline}</p> : null}
                  <a
                    href={marketingPlansUrl}
                    className={styles.planDetailsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View plan details &gt;
                  </a>
                </div>
              </div>

              <div className={styles.planDivider} aria-hidden />

              <div className={styles.planDetails}>
                <dl className={styles.planFacts}>
                  <div className={styles.planFact}>
                    <dt className={styles.planFactLabel}>Status</dt>
                    <dd className={styles.planFactValue}>
                      <StatusPill tone={planStatus.tone}>{planStatus.label}</StatusPill>
                    </dd>
                  </div>
                  <div className={styles.planFact}>
                    <dt className={styles.planFactLabel}>Billing cycle</dt>
                    <dd className={styles.planFactValue}>Monthly</dd>
                  </div>
                  <div className={styles.planFact}>
                    <dt className={styles.planFactLabel}>Next payment</dt>
                    <dd className={styles.planFactValue}>
                      {formatNextPayment(subscriptionAccess, billing)}
                    </dd>
                  </div>
                  <div className={styles.planFact}>
                    <dt className={styles.planFactLabel}>Amount</dt>
                    <dd className={styles.planFactValue}>
                      {formatPlanAmount(entitlements?.monthlyPriceUsd ?? null)}
                    </dd>
                  </div>
                </dl>

                <div className={styles.planManageForm}>
                  {mustSubscribe && canManageSubscription ? (
                    <form action={resumePlatformSubscriptionCheckout}>
                      <input type="hidden" name="tenant_slug" value={membership.tenantSlug} />
                      <Button type="submit" variant="secondary" className={styles.planManageButton}>
                        Subscribe now
                      </Button>
                    </form>
                  ) : canManagePlan ? (
                    <form action={openPlatformBillingPortal}>
                      <input type="hidden" name="tenant_slug" value={membership.tenantSlug} />
                      <Button type="submit" variant="secondary" className={styles.planManageButton}>
                        Manage plan
                      </Button>
                    </form>
                  ) : subscriptionAccess === 'trialing' && canManageSubscription ? (
                    <form action={resumePlatformSubscriptionCheckout}>
                      <input type="hidden" name="tenant_slug" value={membership.tenantSlug} />
                      <Button type="submit" variant="secondary" className={styles.planManageButton}>
                        Subscribe with Stripe
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </Card>
      </Stack>
    </>
  );
}
