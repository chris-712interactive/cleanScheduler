import { Calendar } from 'lucide-react';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';

export const dynamic = 'force-dynamic';

export default async function TenantSchedulePage() {
  const { tenantSlug } = await getPortalContext();
  await requireTenantPortalAccess(tenantSlug ?? '', '/schedule');

  return (
    <>
      <PageHeader
        title="Schedule"
        description="Appointments and crew assignments once quotes and customers are in place."
      />

      <Stack gap={6}>
        <Card title="Visits & crews" description="Locks in once quotes and customers exist for the job.">
          <EmptyState
            icon={<Calendar size={28} strokeWidth={1.75} />}
            title="Calendar not wired yet"
            description="Scheduling comes after quotes and your customer directory. Draft and track quotes under Quotes; add contacts under Customers until visits live here."
            action={
              <Stack gap={3}>
                <Button variant="primary" as="a" href="/quotes">
                  Quotes
                </Button>
                <Button variant="secondary" as="a" href="/customers">
                  Customers
                </Button>
              </Stack>
            }
          />
        </Card>
      </Stack>
    </>
  );
}
