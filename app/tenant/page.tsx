import { ArrowUpRight, Calendar, ClipboardList, CreditCard, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Grid } from '@/components/layout/Grid';
import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { createClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getTenantTrialSummaryBySlug } from '@/lib/billing/trial';

export const dynamic = 'force-dynamic';

export default async function TenantDashboardPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug ?? '', '/');
  const [trial, supabase] = await Promise.all([
    getTenantTrialSummaryBySlug(membership.tenantSlug),
    createClient(),
  ]);

  const [customersCountRes, quotesCountRes] = await Promise.all([
    supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', membership.tenantId)
      .eq('status', 'active'),
    supabase
      .from('tenant_quotes')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', membership.tenantId),
  ]);

  const activeCustomerCount = customersCountRes.error ? 0 : (customersCountRes.count ?? 0);
  const quoteCount = quotesCountRes.error ? 0 : (quotesCountRes.count ?? 0);

  return (
    <>
      <PageHeader
        title="Today's overview"
        description="A quick read on your jobs, money, and team for today."
        actions={
          <Button as="a" href="/schedule" iconRight={<ArrowUpRight size={16} />}>
            Open schedule
          </Button>
        }
      />

      <Stack gap={6}>
        {trial?.status === 'trialing' ? (
          <Card title="Free trial" description="Your workspace is in trial mode.">
            <StatusPill tone="brand" icon={<Calendar size={14} />}>
              {trial.daysRemaining === 0
                ? 'Trial ends today'
                : `${trial.daysRemaining ?? 0} day${trial.daysRemaining === 1 ? '' : 's'} left`}
            </StatusPill>
          </Card>
        ) : null}

        <Grid min="240px" gap={4}>
          <Card title="Quotes" description="Draft and sent proposals">
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
          <Card title="Today's jobs" description="Scheduled appointments">
            <Stack gap={2}>
              <strong style={{ fontSize: 'var(--font-size-3xl)' }}>0</strong>
              <StatusPill tone="brand" icon={<Calendar size={14} />}>
                Schedule is empty
              </StatusPill>
            </Stack>
          </Card>
          <Card title="Outstanding invoices" description="Awaiting payment">
            <Stack gap={2}>
              <strong style={{ fontSize: 'var(--font-size-3xl)' }}>$0</strong>
              <StatusPill tone="neutral" icon={<CreditCard size={14} />}>
                Nothing past due
              </StatusPill>
            </Stack>
          </Card>
          <Card
            title="Active customers"
            description="Contacts marked active in your workspace directory (visits and scheduling are next)."
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
            description="Ship work in order: quotes, then a solid customer directory, then the schedule."
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
