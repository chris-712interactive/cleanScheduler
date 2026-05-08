import { ArrowRight, Calendar, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Grid } from '@/components/layout/Grid';
import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { StatusPill } from '@/components/ui/StatusPill';
import { KeyValueList } from '@/components/ui/KeyValueList';

export default function CustomerHomePage() {
  return (
    <>
      <PageHeader
        title="Welcome back"
        description="Your visits, invoices, and messages - all in one place."
        actions={
          <Button variant="secondary" iconRight={<ArrowRight size={16} />}>
            View all visits
          </Button>
        }
      />

      <Stack gap={6}>
        <Grid min="280px" gap={4}>
          <Card title="Next visit" description="Your upcoming cleaning">
            <Stack gap={3}>
              <StatusPill tone="info" icon={<Calendar size={14} />}>
                Nothing scheduled
              </StatusPill>
              <KeyValueList
                items={[
                  { key: 'Crew', value: '--' },
                  { key: 'Date', value: '--' },
                  { key: 'Time', value: '--' },
                ]}
              />
            </Stack>
          </Card>

          <Card title="Open invoice" description="Awaiting your action">
            <Stack gap={3}>
              <StatusPill tone="neutral" icon={<FileText size={14} />}>
                Nothing due
              </StatusPill>
              <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
                When your provider sends an invoice, it will land here for one-tap
                payment.
              </p>
            </Stack>
          </Card>
        </Grid>

        <Card title="About this portal">
          <p>
            This is your unified customer space. If you have multiple cleaning
            providers using cleanScheduler, you&apos;ll see all of them here under one
            login.
          </p>
        </Card>
      </Stack>
    </>
  );
}
