import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Calendar, ClipboardList, CreditCard, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getTenantTrialSummaryBySlug } from '@/lib/billing/trial';
import { getTenantOutstandingInvoicesSummary } from '@/lib/billing/outstandingInvoices';
import { formatUsdFromCents } from '@/lib/format/money';
import { getTenantTodaysJobsSummary } from '@/lib/tenant/todaysJobs';
import { getDashboardTodayQueue } from '@/lib/tenant/dashboardTodayQueue';
import { getOwnerOnboardingChecklist } from '@/lib/tenant/ownerOnboardingChecklist';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import { fieldEmployeeHomePath, isFieldEmployeeRole } from '@/lib/tenant/fieldEmployeeAccess';
import type { TenantRole } from '@/lib/auth/types';
import { OwnerOnboardingPanel } from './OwnerOnboardingPanel';
import { OwnerOnboardingSurveyPanel } from './OwnerOnboardingSurveyPanel';
import { CheckoutCancelledNotice } from './CheckoutCancelledNotice';
import { needsOnboardingSurvey } from '@/lib/tenant/onboardingSurvey';
import {
  getTenantCustomersAddedThisMonthCount,
  getTenantSentQuotesCount,
} from '@/lib/tenant/dashboardMetrics';
import { DashboardStatCard } from './DashboardStatCard';
import { TodayQueuePanel } from './TodayQueuePanel';
import styles from './dashboard.module.scss';

export const dynamic = 'force-dynamic';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TenantDashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const checkoutCancelled = firstParam(params.checkout) === 'cancelled';
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug ?? '', '/');
  if (isFieldEmployeeRole(membership.role)) {
    redirect(fieldEmployeeHomePath());
  }
  const trial = await getTenantTrialSummaryBySlug(membership.tenantSlug);
  const supabase = createTenantPortalDbClient();
  const actorRole = membership.role as TenantRole;
  const showOnboarding = canManageTeamInvitesAndRoles(actorRole);

  const [
    customersCountRes,
    quotesCountRes,
    sentQuotesCount,
    customersAddedThisMonth,
    outstandingInvoices,
    todaysJobs,
    todayQueue,
    tenantRowRes,
    onboardingProfileRes,
  ] = await Promise.all([
      supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', membership.tenantId)
        .eq('status', 'active'),
      supabase
        .from('tenant_quotes')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', membership.tenantId)
        .is('superseded_by_quote_id', null),
      getTenantSentQuotesCount(supabase, membership.tenantId),
      getTenantCustomersAddedThisMonthCount(supabase, membership.tenantId),
      getTenantOutstandingInvoicesSummary(supabase, membership.tenantId),
      getTenantTodaysJobsSummary(supabase, membership.tenantId),
      getDashboardTodayQueue(supabase, membership.tenantId),
      supabase
        .from('tenants')
        .select('stripe_connect_status')
        .eq('id', membership.tenantId)
        .maybeSingle(),
      showOnboarding
        ? supabase
            .from('tenant_onboarding_profiles')
            .select('service_area, team_size, referral_source')
            .eq('tenant_id', membership.tenantId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

  const onboardingChecklist = showOnboarding
    ? await getOwnerOnboardingChecklist(
        supabase,
        membership.tenantId,
        tenantRowRes.data?.stripe_connect_status,
      )
    : null;

  const onboardingProfile = onboardingProfileRes.data;
  const showOnboardingSurvey =
    showOnboarding && needsOnboardingSurvey(onboardingProfile ?? null);

  const activeCustomerCount = customersCountRes.error ? 0 : (customersCountRes.count ?? 0);
  const quoteCount = quotesCountRes.error ? 0 : (quotesCountRes.count ?? 0);
  const { totalCents: outstandingCents, invoiceCount: outstandingCount, pastDueCount } =
    outstandingInvoices;
  const {
    count: todaysJobCount,
    scheduledCount: todaysScheduledCount,
    todayKey,
  } = todaysJobs;

  const quotesBadge =
    quoteCount === 0
      ? 'Create your first quote'
      : sentQuotesCount > 0
        ? `${sentQuotesCount} sent`
        : 'In your pipeline';

  const jobsBadge =
    todaysJobCount === 0
      ? 'Nothing scheduled today'
      : todaysScheduledCount > 0
        ? `${todaysScheduledCount} in progress`
        : 'On the calendar today';

  const invoicesBadge =
    outstandingCount === 0
      ? 'Nothing outstanding'
      : pastDueCount > 0
        ? `${pastDueCount} overdue`
        : `${outstandingCount} with balance due`;

  const customersBadge =
    activeCustomerCount === 0
      ? 'Add your first customer'
      : customersAddedThisMonth > 0
        ? `${customersAddedThisMonth} added this month`
        : 'In your directory';

  return (
    <>
      <PageHeader
        title="Today's overview"
        titleHint="A quick read on your jobs, money, and team for today."
        actions={
          <Button as="a" href="/schedule" iconLeft={<Calendar size={16} />}>
            Open schedule
          </Button>
        }
      />

      <Stack gap={6}>
        {checkoutCancelled ? <CheckoutCancelledNotice /> : null}

        {trial?.status === 'trialing' ? (
          <Card title="Free trial" titleHint="Your workspace is in trial mode." className={styles.trialBanner}>
            <StatusPill tone="brand" icon={<Calendar size={14} />}>
              {trial.daysRemaining === 0
                ? 'Trial ends today'
                : `${trial.daysRemaining ?? 0} day${trial.daysRemaining === 1 ? '' : 's'} left`}
            </StatusPill>
          </Card>
        ) : null}

        {showOnboardingSurvey ? (
          <OwnerOnboardingSurveyPanel
            tenantId={membership.tenantId}
            tenantSlug={membership.tenantSlug}
          />
        ) : null}

        {onboardingChecklist ? (
          <OwnerOnboardingPanel tenantId={membership.tenantId} checklist={onboardingChecklist} />
        ) : null}

        <TodayQueuePanel queue={todayQueue} />

        <div className={styles.statGrid}>
          <DashboardStatCard
            icon={<ClipboardList size={20} strokeWidth={2} />}
            label="Quotes"
            value={quoteCount}
            badge={quotesBadge}
            badgeTone={quoteCount === 0 ? 'muted' : 'brand'}
            actionLabel={quoteCount === 0 ? 'Go to quotes' : 'View quotes'}
            actionHref="/quotes"
          />
          <DashboardStatCard
            icon={<Calendar size={20} strokeWidth={2} />}
            label="Today's jobs"
            value={todaysJobCount}
            badge={jobsBadge}
            badgeTone={todaysJobCount === 0 ? 'muted' : 'brand'}
            actionLabel={todaysJobCount === 0 ? 'Open schedule' : "View today's jobs"}
            actionHref={
              todaysJobCount > 0 ? `/schedule?date=${todayKey}&view=day` : '/schedule'
            }
          />
          <DashboardStatCard
            icon={<CreditCard size={20} strokeWidth={2} />}
            label="Outstanding invoices"
            value={formatUsdFromCents(outstandingCents)}
            badge={invoicesBadge}
            badgeTone={
              outstandingCount === 0 ? 'muted' : pastDueCount > 0 ? 'warn' : 'brand'
            }
            actionLabel="View invoices"
            actionHref="/billing/invoices"
          />
          <DashboardStatCard
            icon={<UsersRound size={20} strokeWidth={2} />}
            label="Active customers"
            value={activeCustomerCount}
            badge={customersBadge}
            badgeTone={activeCustomerCount === 0 ? 'muted' : 'brand'}
            actionLabel={activeCustomerCount === 0 ? 'Add customer' : 'View customers'}
            actionHref={activeCustomerCount === 0 ? '/customers/new' : '/customers'}
          />
        </div>

        {activeCustomerCount === 0 ? (
          <Card
            title="Get started"
            titleHint="Ship work in order: quotes, then a solid customer directory, then the schedule."
          >
            <EmptyState
              title="Nothing in the pipeline yet"
              description="Start from Quotes when you are ready to price jobs; add contacts under Customers; lock visits on the Schedule once quoting is live."
              action={
                <Stack gap={3}>
                  <Button variant="primary" as="a" href="/quotes">
                    Go to quotes
                  </Button>
                  <Button variant="secondary" as="a" href="/customers/new">
                    Add customer
                  </Button>
                </Stack>
              }
            />
          </Card>
        ) : null}
      </Stack>
    </>
  );
}
