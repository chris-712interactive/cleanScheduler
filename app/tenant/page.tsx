import { redirect } from 'next/navigation';
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { EmptyState } from '@/components/ui/EmptyState';
import { createAdminClient, createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getTenantTrialSummaryBySlug } from '@/lib/billing/trial';
import { getTenantOutstandingInvoicesSummary } from '@/lib/billing/outstandingInvoices';
import { formatUsdFromCents } from '@/lib/format/money';
import { getTenantTodaysJobsSummary } from '@/lib/tenant/todaysJobs';
import { getDashboardTodayQueue, type DashboardTodayQueue } from '@/lib/tenant/dashboardTodayQueue';
import { resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import { getOwnerOnboardingChecklist } from '@/lib/tenant/ownerOnboardingChecklist';
import {
  isDashboardOnboardingFocusMode,
  shouldShowCompletionCelebration,
} from '@/lib/tenant/ownerOnboardingState';
import { OwnerOnboardingCompletionCelebration } from './OwnerOnboardingCompletionCelebration';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import { fieldEmployeeHomePath, isFieldEmployeeRole } from '@/lib/tenant/fieldEmployeeAccess';
import type { TenantRole } from '@/lib/auth/types';
import { OwnerOnboardingDashboardHero } from './OwnerOnboardingDashboardHero';
import { OwnerOnboardingProgressCard } from './OwnerOnboardingProgressCard';
import { OwnerOnboardingSurveyPanel } from './OwnerOnboardingSurveyPanel';
import { CheckoutCancelledNotice } from './CheckoutCancelledNotice';
import { needsOnboardingSurvey } from '@/lib/tenant/onboardingSurvey';
import {
  getTenantCustomersAddedThisMonthCount,
  getTenantPaidInvoicesLast30DaysCents,
  getTenantSentQuotesCount,
} from '@/lib/tenant/dashboardMetrics';
import { DashboardMetricStrip, type DashboardMetricTone } from './DashboardMetricStrip';
import { DashboardStatSummary } from './DashboardStatSummary';
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

function dashboardLead(queue: DashboardTodayQueue): string {
  const first = queue.items[0];
  if (!first) {
    return 'Nothing urgent right now. Open the schedule or billing when you are ready.';
  }
  const label = first.label.charAt(0).toLowerCase() + first.label.slice(1);
  return `Start with ${label}.`;
}

function getDashboardHeader(
  onboardingFocusMode: boolean,
  daysRemaining: number | null | undefined,
): { title: string; titleHint: string } {
  if (!onboardingFocusMode) {
    return {
      title: "Today's overview",
      titleHint: 'A quick read on your jobs, money, and team for today.',
    };
  }

  if (daysRemaining != null && daysRemaining <= 3) {
    const dayLabel =
      daysRemaining === 0
        ? 'Your trial ends today'
        : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left in your trial`;
    return {
      title: 'Finish your setup',
      titleHint: `${dayLabel}. Run one real job through quotes, schedule, and billing before you decide.`,
    };
  }

  return {
    title: 'Getting started',
    titleHint: 'Run one real job through quotes, schedule, and billing.',
  };
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
    paidLast30DaysCents,
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
    getTenantPaidInvoicesLast30DaysCents(supabase, membership.tenantId),
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
          .select('service_area, team_size, referral_source, survey_dismissed_at')
          .eq('tenant_id', membership.tenantId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const admin = createAdminClient();
  const entitlementPlan = showOnboarding
    ? await resolveTenantEntitlementPlan(admin, membership.tenantId)
    : null;

  const onboardingChecklist =
    showOnboarding && entitlementPlan
      ? await getOwnerOnboardingChecklist(supabase, admin, {
          tenantId: membership.tenantId,
          connectStatus: tenantRowRes.data?.stripe_connect_status,
          entitlementPlan,
        })
      : null;

  const onboardingFocusMode = isDashboardOnboardingFocusMode(onboardingChecklist);
  const header = getDashboardHeader(onboardingFocusMode, trial?.daysRemaining);

  const onboardingProfile = onboardingProfileRes.data;
  const showOnboardingSurvey = showOnboarding && needsOnboardingSurvey(onboardingProfile ?? null);

  const activeCustomerCount = customersCountRes.error ? 0 : (customersCountRes.count ?? 0);
  const quoteCount = quotesCountRes.error ? 0 : (quotesCountRes.count ?? 0);
  const {
    totalCents: outstandingCents,
    invoiceCount: outstandingCount,
    pastDueCount,
  } = outstandingInvoices;
  const { count: todaysJobCount, scheduledCount: todaysScheduledCount, todayKey } = todaysJobs;

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

  const outstandingFormatted = formatUsdFromCents(outstandingCents);
  const revenue30Formatted = formatUsdFromCents(paidLast30DaysCents);
  const showGetStartedEmptyState =
    activeCustomerCount === 0 &&
    !onboardingFocusMode &&
    !(onboardingChecklist && onboardingChecklist.incompleteRequiredCount > 0);

  const quoteTone: DashboardMetricTone = quoteCount === 0 ? 'quiet' : 'default';
  const jobTone: DashboardMetricTone = todaysJobCount === 0 ? 'quiet' : 'default';
  const dueTone: DashboardMetricTone =
    pastDueCount > 0 ? 'warn' : outstandingCount === 0 ? 'quiet' : 'default';
  const revenueTone: DashboardMetricTone = paidLast30DaysCents > 0 ? 'money' : 'quiet';
  const customerTone: DashboardMetricTone = activeCustomerCount === 0 ? 'quiet' : 'default';
  const metrics = [
    {
      slot: 'quotes' as const,
      label: 'Quotes',
      value: String(quoteCount),
      context: quotesBadge,
      href: '/quotes',
      tone: quoteTone,
    },
    {
      slot: 'jobs' as const,
      label: "Today's jobs",
      value: String(todaysJobCount),
      context: jobsBadge,
      href: todaysJobCount > 0 ? `/schedule?date=${todayKey}&view=day` : '/schedule',
      tone: jobTone,
    },
    {
      slot: 'due' as const,
      label: 'Outstanding invoices',
      value: outstandingFormatted,
      context: invoicesBadge,
      href: '/billing/invoices',
      tone: dueTone,
    },
    {
      slot: 'revenue' as const,
      label: 'Revenue (30 days)',
      value: revenue30Formatted,
      context: paidLast30DaysCents > 0 ? 'Paid invoices' : 'No paid invoices yet',
      href: '/billing',
      tone: revenueTone,
    },
    {
      slot: 'customers' as const,
      label: 'Active customers',
      value: String(activeCustomerCount),
      context: customersBadge,
      href: activeCustomerCount === 0 ? '/customers/new' : '/customers',
      tone: customerTone,
    },
  ];

  return (
    <Container size="xl" className={styles.dashboardPage}>
      <PageHeader
        title={header.title}
        titleHint={header.titleHint}
        description={onboardingFocusMode ? undefined : dashboardLead(todayQueue)}
        actions={
          <Button as="a" href="/schedule" iconLeft={<Calendar size={16} />}>
            Open schedule
          </Button>
        }
      />

      <Stack gap={6}>
        {checkoutCancelled ? <CheckoutCancelledNotice /> : null}

        {onboardingChecklist &&
        shouldShowCompletionCelebration(onboardingChecklist.profileState) ? (
          <OwnerOnboardingCompletionCelebration tenantSlug={membership.tenantSlug} />
        ) : null}

        {onboardingFocusMode && onboardingChecklist ? (
          <div className={styles.dashboardGrid}>
            <div className={styles.mainColumn}>
              {showOnboardingSurvey ? (
                <OwnerOnboardingSurveyPanel
                  tenantId={membership.tenantId}
                  tenantSlug={membership.tenantSlug}
                />
              ) : null}
              <OwnerOnboardingDashboardHero checklist={onboardingChecklist} />
              <TodayQueuePanel queue={todayQueue} compactEmpty />
            </div>
            <div className={styles.sideColumn}>
              <OwnerOnboardingProgressCard
                tenantSlug={membership.tenantSlug}
                checklist={onboardingChecklist}
              />
              <DashboardStatSummary
                quotes={quoteCount}
                todaysJobs={todaysJobCount}
                outstanding={outstandingFormatted}
                customers={activeCustomerCount}
              />
            </div>
          </div>
        ) : (
          <>
            {showOnboardingSurvey ? (
              <OwnerOnboardingSurveyPanel
                tenantId={membership.tenantId}
                tenantSlug={membership.tenantSlug}
              />
            ) : null}

            <DashboardMetricStrip metrics={metrics} />
            <TodayQueuePanel queue={todayQueue} />

            {showGetStartedEmptyState ? (
              <Card
                title="Get started"
                titleHint="Ship work in order: customers, then quotes, then the schedule."
              >
                <EmptyState
                  title="Nothing in the pipeline yet"
                  description="Add a customer first, price the job under Quotes, then lock visits on the Schedule."
                  action={
                    <Stack gap={3}>
                      <Button variant="primary" as="a" href="/customers/new">
                        Add customer
                      </Button>
                      <Button variant="secondary" as="a" href="/quotes">
                        Go to quotes
                      </Button>
                    </Stack>
                  }
                />
              </Card>
            ) : null}
          </>
        )}
      </Stack>
    </Container>
  );
}
