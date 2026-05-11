import { ArrowUpRight, Calendar, CreditCard, UsersRound } from 'lucide-react';
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

  const { count: activeCustomerCountRaw, error: customerCountError } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', membership.tenantId)
    .eq('status', 'active');

  const activeCustomerCount = customerCountError ? 0 : (activeCustomerCountRaw ?? 0);

  return (
    <>
      <PageHeader
        title="Today's overview"
        description="A quick read on your jobs, money, and team for today."
        actions={
          <Button iconRight={<ArrowUpRight size={16} />}>Open scheduler</Button>
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
                  <Button variant="secondary" size="sm" as="a" href="/customers">
                    Go to customers
                  </Button>
                </>
              )}
            </Stack>
          </Card>
        </Grid>

        {activeCustomerCount === 0 ? (
          <Card title="Get started" description="A few steps to get this tenant ready to take work.">
            <EmptyState
              title="No customers yet"
              description="Add people and businesses you serve so quotes, jobs, and billing can attach to real records."
              action={
                <Button variant="primary" as="a" href="/customers">
                  Add your first customer
                </Button>
              }
            />
          </Card>
        ) : null}
      </Stack>
    </>
  );
}
