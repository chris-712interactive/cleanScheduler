import Link from 'next/link';
import {
  ArrowLeftRight,
  ArrowRight,
  Briefcase,
  ChevronRight,
  CreditCard,
  FileText,
  Landmark,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import type { StatusTone } from '@/components/ui/StatusPill';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import type { TenantRole } from '@/lib/auth/types';
import {
  PLATFORM_PLAN_DESCRIPTIONS,
  PLATFORM_PLAN_LABELS,
  parsePlatformPlanTier,
} from '@/lib/billing/platformPlanTier';
import { getPlatformPricingDisplay, formatPlanPriceUsd } from '@/lib/billing/platformPricing';
import {
  canAccessCustomerBillingTools,
  needsSubscriptionPurchase,
  resolveTenantSubscriptionAccess,
  trialDaysRemaining,
} from '@/lib/billing/tenantSubscriptionAccess';
import { formatAutoPurgeDate, getTenantPurgeStatus } from '@/lib/billing/tenantPurge';
import { getTenantOutstandingInvoicesSummary } from '@/lib/billing/outstandingInvoices';
import { getTenantPaidInvoicesLast30DaysCents } from '@/lib/tenant/dashboardMetrics';
import { formatUsdFromCents } from '@/lib/format/money';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import {
  CUSTOMER_BILLING_HUB_PRIMARY,
  CUSTOMER_BILLING_HUB_SECONDARY,
} from '@/lib/tenant/customerBillingHub';
import type { Tables } from '@/lib/supabase/database.types';
import { openPlatformBillingPortal } from './actions';
import { SubscribePlanPicker } from '@/components/billing/SubscribePlanPicker';
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
      return { label: 'Free trial', tone: 'info' };
    case 'past_due':
      return { label: 'Past due', tone: 'warning' };
    case 'canceled':
      return { label: 'Canceled', tone: 'danger' };
    default:
      return { label: 'Unknown', tone: 'neutral' };
  }
}

function formatNextPaymentDate(
  access: ReturnType<typeof resolveTenantSubscriptionAccess>,
  billing: TenantBillingRow,
): string | null {
  if (access === 'trial_expired' || access === 'suspended') {
    return null;
  }
  if (billing.status === 'trialing' && billing.trial_ends_at) {
    return new Date(String(billing.trial_ends_at)).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }
  return null;
}

function formatBillingCycle(interval: TenantBillingRow['billing_interval']): string | null {
  if (interval === 'year') return 'Yearly billing';
  if (interval === 'month') return 'Monthly billing';
  return null;
}

function formatPlanAmountForInterval(
  pricing: {
    monthlyPriceUsd: number;
    annualEffectiveMonthlyUsd: number;
    annualPriceUsd: number;
  } | null,
  interval: TenantBillingRow['billing_interval'],
): string | null {
  if (!pricing) return null;
  if (interval === 'year') {
    return `${formatPlanPriceUsd(pricing.annualPriceUsd, { showCents: true })}/year`;
  }
  return `${formatPlanPriceUsd(pricing.monthlyPriceUsd, { showCents: true })}/month`;
}

function planStatusLine(params: {
  subscriptionAccess: ReturnType<typeof resolveTenantSubscriptionAccess>;
  billing: TenantBillingRow | null;
  daysLeft: number | null;
  planAmount: string | null;
  billingCycle: string | null;
  nextDate: string | null;
}): string {
  const { subscriptionAccess, billing, daysLeft, planAmount, billingCycle, nextDate } = params;

  if (!billing) return 'We could not load your workspace plan details.';

  if (subscriptionAccess === 'trialing' && daysLeft != null) {
    const dayLabel = `${daysLeft} day${daysLeft === 1 ? '' : 's'} left in your trial`;
    return nextDate ? `${dayLabel} · Trial ends ${nextDate}` : dayLabel;
  }

  if (subscriptionAccess === 'trial_expired') {
    return 'Your trial has ended. Subscribe to restore access to your workspace.';
  }

  if (subscriptionAccess === 'suspended' || billing.status === 'canceled') {
    return 'This workspace is paused until a plan is active again.';
  }

  if (billing.status === 'past_due') {
    return 'Your last payment did not go through. Update billing in Stripe to avoid interruption.';
  }

  const parts: string[] = [];
  if (planAmount) parts.push(planAmount);
  if (billingCycle) parts.push(billingCycle);
  if (nextDate) {
    parts.push(
      billing.status === 'trialing' ? `Trial ends ${nextDate}` : `Next payment ${nextDate}`,
    );
  }
  return parts.length > 0 ? parts.join(' · ') : 'Your workspace plan is active.';
}

const HUB_ICONS = {
  '/billing/invoices': FileText,
  '/billing/payment-setup': CreditCard,
  '/billing/transactions': ArrowLeftRight,
  '/billing/service-plans': Layers,
  '/billing/bank-connection': Landmark,
  '/billing/payment-audits': ShieldCheck,
} as const;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TenantBillingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing', {
    internalPathname: '/tenant/billing',
    browserPathname: '/billing',
  });

  const supabase = createTenantPortalDbClient();
  const [billingRes, tenantRes, outstandingInvoices, paidLast30DaysCents] = await Promise.all([
    supabase
      .from('tenant_billing_accounts')
      .select('*')
      .eq('tenant_id', membership.tenantId)
      .maybeSingle(),
    supabase
      .from('tenants')
      .select('is_active, stripe_connect_status')
      .eq('id', membership.tenantId)
      .maybeSingle(),
    getTenantOutstandingInvoicesSummary(supabase, membership.tenantId),
    getTenantPaidInvoicesLast30DaysCents(supabase, membership.tenantId),
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
  const connectStatus = tenantRes.data?.stripe_connect_status ?? 'not_started';

  const planKey = parsePlatformPlanTier(String(billing?.platform_plan ?? ''));
  const planLabel = planKey ? PLATFORM_PLAN_LABELS[planKey] : null;
  const planTagline = planKey ? PLATFORM_PLAN_DESCRIPTIONS[planKey] : null;
  const pricingTiers = await getPlatformPricingDisplay();
  const currentPlanPricing = planKey
    ? (pricingTiers.find((tier) => tier.tier === planKey) ?? null)
    : null;
  const planStatus = formatPlanStatus(subscriptionAccess, billing?.status);
  const marketingPlansUrl = `${getPublicOrigin(null)}/pricing`;

  const onTrial = subscriptionAccess === 'trialing';
  const showSubscribePicker =
    canManageSubscription && (mustSubscribe || onTrial) && subscriptionAccess !== 'active';
  const canManagePlan =
    Boolean(billing?.stripe_customer_id) &&
    subscriptionAccess === 'active' &&
    billing?.status !== 'canceled';

  const subscribeLead = mustSubscribe
    ? subscriptionAccess === 'trial_expired'
      ? canManageSubscription
        ? 'Your free trial has ended. Pick a plan to restore scheduling, quotes, customers, and the rest of your workspace.'
        : 'Your free trial has ended. Scheduling and other workspace areas are unavailable until an owner or admin renews the plan.'
      : canManageSubscription
        ? 'This workspace is paused. Pick a plan to turn Clean Scheduler back on.'
        : 'This workspace is paused. Contact an owner or admin to renew the plan.'
    : subscriptionAccess === 'trialing' && daysLeft != null
      ? `You have ${daysLeft} day${daysLeft === 1 ? '' : 's'} left. Subscribe now to keep access when your trial ends.`
      : null;

  const planAmount =
    billing && !onTrial
      ? formatPlanAmountForInterval(currentPlanPricing, billing.billing_interval)
      : null;
  const billingCycle = billing && !onTrial ? formatBillingCycle(billing.billing_interval) : null;
  const nextPaymentDate = billing ? formatNextPaymentDate(subscriptionAccess, billing) : null;
  const statusLine = planStatusLine({
    subscriptionAccess,
    billing,
    daysLeft,
    planAmount,
    billingCycle,
    nextDate: nextPaymentDate,
  });

  const connectLabel =
    connectStatus === 'complete'
      ? 'Stripe connected'
      : connectStatus === 'pending'
        ? 'Stripe setup in progress'
        : connectStatus === 'restricted'
          ? 'Stripe needs attention'
          : 'Card payments not set up';

  const connectTone: StatusTone =
    connectStatus === 'complete'
      ? 'success'
      : connectStatus === 'restricted'
        ? 'danger'
        : connectStatus === 'pending'
          ? 'warning'
          : 'neutral';

  return (
    <>
      <PageHeader
        title="Billing"
        titleHint="Your Clean Scheduler plan and the tools you use to bill customers."
      />

      <Stack gap={6}>
        {subscribeRequired && mustSubscribe ? (
          <p className={styles.bannerError} role="status">
            {canManageSubscription
              ? 'Subscribe below to continue using this workspace. Other pages are unavailable until your plan is active.'
              : 'This workspace needs an active subscription. Ask an owner or admin to renew on this page.'}
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

        <section className={styles.planHero} aria-labelledby="workspace-plan-heading">
          <div className={styles.planHeroTop}>
            <div className={styles.planHeroIconWrap} aria-hidden>
              <Briefcase size={28} strokeWidth={1.75} />
            </div>
            <div className={styles.planHeroCopy}>
              <div className={styles.planHeroHeadingRow}>
                <h2 id="workspace-plan-heading" className={styles.planHeroTitle}>
                  Your workspace plan
                </h2>
                {billing && !error ? (
                  <StatusPill tone={planStatus.tone}>{planStatus.label}</StatusPill>
                ) : null}
              </div>
              {error || !billing ? (
                <p className={styles.planHeroLead}>No billing record found for this workspace.</p>
              ) : (
                <>
                  <p className={styles.planHeroPlanName}>
                    {planLabel ?? (onTrial ? 'Free trial' : 'No plan selected')}
                  </p>
                  <p className={styles.planHeroLead}>{statusLine}</p>
                  {planTagline && !onTrial ? (
                    <p className={styles.planHeroTagline}>{planTagline}</p>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {billing && !error ? (
            <div className={styles.planHeroActions}>
              {canManagePlan ? (
                <form action={openPlatformBillingPortal}>
                  <input type="hidden" name="tenant_slug" value={membership.tenantSlug} />
                  <Button type="submit" variant="secondary">
                    Manage plan in Stripe
                  </Button>
                </form>
              ) : null}
              <a
                href={marketingPlansUrl}
                className={styles.planHeroLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                Compare plans
              </a>
            </div>
          ) : null}

          {showSubscribePicker ? (
            <div className={styles.subscribeBlock}>
              <h3 className={styles.subscribeBlockTitle}>
                {mustSubscribe
                  ? canManageSubscription
                    ? 'Subscribe to continue'
                    : 'Workspace paused'
                  : 'Choose your plan'}
              </h3>
              {subscribeLead ? <p className={styles.subscribeBlockLead}>{subscribeLead}</p> : null}
              {canManageSubscription ? (
                <SubscribePlanPicker
                  tenantSlug={membership.tenantSlug}
                  pricingTiers={pricingTiers}
                  submitLabel={mustSubscribe ? 'Subscribe now' : 'Subscribe with Stripe'}
                />
              ) : null}
            </div>
          ) : null}
        </section>

        {customerBillingUnlocked ? (
          <section className={styles.customerSection} aria-labelledby="customer-billing-heading">
            <header className={styles.customerSectionHeader}>
              <h2 id="customer-billing-heading" className={styles.customerSectionTitle}>
                Bill your customers
              </h2>
              <p className={styles.customerSectionLead}>
                Send invoices, accept payments, and track what you are owed — separate from your
                Clean Scheduler subscription above.
              </p>
            </header>

            <div className={styles.snapshotGrid}>
              <Link href="/billing/invoices" className={styles.snapshotCard}>
                <span className={styles.snapshotLabel}>Outstanding</span>
                <span className={styles.snapshotValue}>
                  {formatUsdFromCents(outstandingInvoices.totalCents)}
                </span>
                <span className={styles.snapshotMeta}>
                  {outstandingInvoices.invoiceCount === 0
                    ? 'No open balances'
                    : `${outstandingInvoices.invoiceCount} open invoice${outstandingInvoices.invoiceCount === 1 ? '' : 's'}`}
                  {outstandingInvoices.pastDueCount > 0
                    ? ` · ${outstandingInvoices.pastDueCount} past due`
                    : ''}
                </span>
              </Link>

              <Link href="/billing/transactions" className={styles.snapshotCard}>
                <span className={styles.snapshotLabel}>Collected (30 days)</span>
                <span className={styles.snapshotValue}>
                  {formatUsdFromCents(paidLast30DaysCents)}
                </span>
                <span className={styles.snapshotMeta}>Recent customer payments</span>
              </Link>

              <Link href="/billing/payment-setup" className={styles.snapshotCard}>
                <span className={styles.snapshotLabel}>Online payments</span>
                <span className={styles.snapshotValueCompact}>
                  <StatusPill tone={connectTone}>{connectLabel}</StatusPill>
                </span>
                <span className={styles.snapshotMeta}>
                  {connectStatus === 'complete'
                    ? 'Customers can pay invoices by card'
                    : 'Set up Stripe to accept cards'}
                </span>
              </Link>
            </div>

            <div className={styles.actionGrid}>
              {CUSTOMER_BILLING_HUB_PRIMARY.map(({ href, label, description }) => {
                const Icon = HUB_ICONS[href as keyof typeof HUB_ICONS];
                return (
                  <Link key={href} href={href} className={styles.actionCard}>
                    <span className={styles.actionCardIconWrap} aria-hidden>
                      <Icon size={22} strokeWidth={1.75} />
                    </span>
                    <span className={styles.actionCardCopy}>
                      <span className={styles.actionCardTitle}>{label}</span>
                      <span className={styles.actionCardDescription}>{description}</span>
                    </span>
                    <ChevronRight
                      size={18}
                      strokeWidth={2}
                      className={styles.actionCardChevron}
                      aria-hidden
                    />
                  </Link>
                );
              })}
            </div>

            <div className={styles.moreTools}>
              <h3 className={styles.moreToolsTitle}>More billing tools</h3>
              <ul className={styles.moreToolsList}>
                {CUSTOMER_BILLING_HUB_SECONDARY.map(({ href, label, description }) => (
                  <li key={href}>
                    <Link href={href} className={styles.moreToolsLink}>
                      <span className={styles.moreToolsLinkCopy}>
                        <span className={styles.moreToolsLinkLabel}>{label}</span>
                        <span className={styles.moreToolsLinkDescription}>{description}</span>
                      </span>
                      <ArrowRight size={16} strokeWidth={2} aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : (
          <section className={styles.customerLocked} aria-labelledby="customer-billing-locked">
            <h2 id="customer-billing-locked" className={styles.customerLockedTitle}>
              Customer invoicing
            </h2>
            <p className={styles.customerLockedLead}>
              {canManageSubscription
                ? 'Invoices, payment setup, and customer payment tracking unlock once your workspace subscription is active.'
                : 'Customer invoicing and payment tools are unavailable until an owner or admin renews the workspace subscription.'}
            </p>
          </section>
        )}
      </Stack>
    </>
  );
}
