import { ArrowUpRight, Calendar, CreditCard, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Grid } from '@/components/layout/Grid';
import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';

export default function TenantDashboardPage() {
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
          <Card title="Active customers" description="With at least one upcoming visit">
            <Stack gap={2}>
              <strong style={{ fontSize: 'var(--font-size-3xl)' }}>0</strong>
              <StatusPill tone="neutral" icon={<UsersRound size={14} />}>
                Add your first customer
              </StatusPill>
            </Stack>
          </Card>
        </Grid>

        <Card title="Get started" description="A few steps to get this tenant ready to take work.">
          <EmptyState
            title="No data yet"
            description="As you add customers, schedule jobs, and connect Stripe, this dashboard will fill in with live activity."
            action={<Button variant="primary">Add your first customer</Button>}
          />
        </Card>
      </Stack>
    </>
  );
}
