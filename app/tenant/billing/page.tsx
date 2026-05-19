import Link from 'next/link';
import {
  ArrowLeftRight,
  Briefcase,
  CreditCard,
  FileText,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import type { StatusTone } from '@/components/ui/StatusPill';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import {
  PLATFORM_PLAN_DESCRIPTIONS,
  PLATFORM_PLAN_LABELS,
  parsePlatformPlanTier,
} from '@/lib/billing/platformPlanTier';
import { getEntitlementsForTier } from '@/lib/billing/entitlements';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import type { Tables } from '@/lib/supabase/database.types';
import { openPlatformBillingPortal, resumePlatformSubscriptionCheckout } from './actions';
import styles from './billing.module.scss';

type TenantBillingRow = Tables<'tenant_billing_accounts'>;

export const dynamic = 'force-dynamic';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function formatPlanStatus(status: TenantBillingRow['status'] | null | undefined): {
  label: string;
  tone: StatusTone;
} {
  switch (status) {
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

function formatNextPayment(billing: TenantBillingRow): string {
  const dateSource =
    billing.status === 'trialing' && billing.trial_ends_at
      ? billing.trial_ends_at
      : null;
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

const HUB_LINKS = [
  { href: '/billing/invoices', label: 'Open invoices', icon: FileText },
  { href: '/billing/service-plans', label: 'Service plans', icon: Layers },
  { href: '/billing/payment-setup', label: 'Payment setup', icon: CreditCard },
  { href: '/billing/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/billing/payment-audits', label: 'Payment audits', icon: ShieldCheck },
] as const;

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
  const planLabel = planKey ? PLATFORM_PLAN_LABELS[planKey] : null;
  const planTagline = planKey ? PLATFORM_PLAN_DESCRIPTIONS[planKey] : null;
  const entitlements = planKey ? getEntitlementsForTier(planKey) : null;
  const planStatus = formatPlanStatus(billing?.status);
  const marketingPlansUrl = `${getPublicOrigin(null)}/start-trial`;

  const suspended = billing?.status === 'canceled';
  const canManagePlan = Boolean(billing?.stripe_customer_id) && !suspended;

  return (
    <>
      <PageHeader
        title="Workspace billing"
        titleHint="Platform subscription for cleanScheduler, plus customer invoicing for your clients."
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

        <Card
          title="Customer invoices"
          description="View and manage your invoices, payments, and billing history."
        >
          <nav className={styles.hubNav} aria-label="Customer billing">
            {HUB_LINKS.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={styles.hubNavLink}>
                <Icon size={18} strokeWidth={2} aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
        </Card>

        <Card title="Current plan">
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
                    <dd className={styles.planFactValue}>{formatNextPayment(billing)}</dd>
                  </div>
                  <div className={styles.planFact}>
                    <dt className={styles.planFactLabel}>Amount</dt>
                    <dd className={styles.planFactValue}>
                      {formatPlanAmount(entitlements?.monthlyPriceUsd ?? null)}
                    </dd>
                  </div>
                </dl>

                {canManagePlan ? (
                  <form action={openPlatformBillingPortal} className={styles.planManageForm}>
                    <input type="hidden" name="tenant_slug" value={membership.tenantSlug} />
                    <Button type="submit" variant="secondary" className={styles.planManageButton}>
                      Manage plan
                    </Button>
                  </form>
                ) : null}
              </div>
            </div>
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
