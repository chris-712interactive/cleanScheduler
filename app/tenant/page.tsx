import { ArrowUpRight, Calendar, ClipboardList, CreditCard, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Grid } from '@/components/layout/Grid';
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

export const dynamic = 'force-dynamic';

export default async function TenantDashboardPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug ?? '', '/');
  const trial = await getTenantTrialSummaryBySlug(membership.tenantSlug);
  const supabase = createTenantPortalDbClient();

  const [customersCountRes, quotesCountRes, outstandingInvoices, todaysJobs] = await Promise.all([
    supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', membership.tenantId)
      .eq('status', 'active'),
    supabase
      .from('tenant_quotes')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', membership.tenantId),
    getTenantOutstandingInvoicesSummary(supabase, membership.tenantId),
    getTenantTodaysJobsSummary(supabase, membership.tenantId),
  ]);

  const activeCustomerCount = customersCountRes.error ? 0 : (customersCountRes.count ?? 0);
  const quoteCount = quotesCountRes.error ? 0 : (quotesCountRes.count ?? 0);
  const { totalCents: outstandingCents, invoiceCount: outstandingCount, pastDueCount } =
    outstandingInvoices;
  const {
    count: todaysJobCount,
    scheduledCount: todaysScheduledCount,
    completedCount: todaysCompletedCount,
    todayKey,
  } = todaysJobs;

  return (
    <>
      <PageHeader
        title="Today's overview"
        titleHint="A quick read on your jobs, money, and team for today."
        actions={
          <Button as="a" href="/schedule" iconRight={<ArrowUpRight size={16} />}>
            Open schedule
          </Button>
        }
      />

      <Stack gap={6}>
        {trial?.status === 'trialing' ? (
          <Card title="Free trial" titleHint="Your workspace is in trial mode.">
            <StatusPill tone="brand" icon={<Calendar size={14} />}>
              {trial.daysRemaining === 0
                ? 'Trial ends today'
                : `${trial.daysRemaining ?? 0} day${trial.daysRemaining === 1 ? '' : 's'} left`}
            </StatusPill>
          </Card>
        ) : null}

        <Grid min="240px" gap={4}>
          <Card title="Quotes" titleHint="Draft and sent proposals">
            <Stack gap={2}>
              <strong style={{ fontSize: 'var(--font-size-3xl)' }}>{quoteCount}</strong>
              {quoteCount > 0 ? (
                <>
                  <StatusPill tone="brand" icon={<ClipboardList size={14} />}>
                    In your pipeline
                  </StatusPill>
                  <Button variant="secondary" size="sm" as="a" href="/quotes">
                    Open quotes
                  </Button>
                </>
              ) : (
                <>
                  <StatusPill tone="neutral" icon={<ClipboardList size={14} />}>
                    Create your first quote
                  </StatusPill>
                  <Button variant="secondary" size="sm" as="a" href="/quotes">
                    Go to quotes
                  </Button>
                </>
              )}
            </Stack>
          </Card>
          <Card title="Today's jobs" titleHint="Scheduled appointments today">
            <Stack gap={2}>
              <strong style={{ fontSize: 'var(--font-size-3xl)' }}>{todaysJobCount}</strong>
              {todaysJobCount > 0 ? (
                <StatusPill tone="brand" icon={<Calendar size={14} />}>
                  {todaysScheduledCount > 0
                    ? `${todaysScheduledCount} scheduled`
                    : 'On the calendar'}
                  {todaysCompletedCount > 0
                    ? ` · ${todaysCompletedCount} completed`
                    : ''}
                </StatusPill>
              ) : (
                <StatusPill tone="neutral" icon={<Calendar size={14} />}>
                  Nothing scheduled today
                </StatusPill>
              )}
              <Button
                variant="secondary"
                size="sm"
                as="a"
                href={
                  todaysJobCount > 0
                    ? `/schedule?date=${todayKey}&view=day`
                    : '/schedule'
                }
              >
                Open schedule
              </Button>
            </Stack>
          </Card>
          <Card title="Outstanding invoices" titleHint="Open balances awaiting payment">
            <Stack gap={2}>
              <strong style={{ fontSize: 'var(--font-size-3xl)' }}>
                {formatUsdFromCents(outstandingCents)}
              </strong>
              {outstandingCount > 0 ? (
                <>
                  <StatusPill
                    tone={pastDueCount > 0 ? 'warning' : 'brand'}
                    icon={<CreditCard size={14} />}
                  >
                    {outstandingCount} invoice{outstandingCount === 1 ? '' : 's'}
                    {pastDueCount > 0
                      ? ` · ${pastDueCount} past due`
                      : ' with balance due'}
                  </StatusPill>
                  <Button variant="secondary" size="sm" as="a" href="/billing/invoices">
                    Open invoices
                  </Button>
                </>
              ) : (
                <StatusPill tone="neutral" icon={<CreditCard size={14} />}>
                  Nothing outstanding
                </StatusPill>
              )}
            </Stack>
          </Card>
          <Card
            title="Active customers"
            titleHint="Contacts marked active in your workspace directory (visits and scheduling are next)."
          >
            <Stack gap={2}>
              <strong style={{ fontSize: 'var(--font-size-3xl)' }}>{activeCustomerCount}</strong>
              {activeCustomerCount > 0 ? (
                <>
                  <StatusPill tone="brand" icon={<UsersRound size={14} />}>
                    In your directory
                  </StatusPill>
                  <Button variant="secondary" size="sm" as="a" href="/customers">
                    Open customers
                  </Button>
                </>
              ) : (
                <>
                  <StatusPill tone="neutral" icon={<UsersRound size={14} />}>
                    Add your first customer
                  </StatusPill>
                  <Button variant="secondary" size="sm" as="a" href="/customers/new">
                    Add customer
                  </Button>
                </>
              )}
            </Stack>
          </Card>
        </Grid>

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
