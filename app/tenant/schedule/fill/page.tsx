import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { isFieldEmployeeRole } from '@/lib/tenant/fieldEmployeeAccess';
import type { TenantRole } from '@/lib/auth/types';
import { normalizeDateKey } from '@/lib/tenant/scheduleDateRange';
import { redirect } from 'next/navigation';
import { FillScheduleForm } from './FillScheduleForm';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function FillSchedulePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug ?? '', '/schedule/fill');
  if (isFieldEmployeeRole(membership.role as TenantRole)) {
    redirect('/schedule');
  }
  const anchorDate = normalizeDateKey(sp.date);

  return (
    <div>
      <PageHeader
        title="Fill schedule"
        description="Places accepted quotes on the cadence the customer agreed to, and books consultations for new website leads. Closed days, visits already inside that cadence, and one-time jobs that are already booked are left alone. Crew is chosen with your scheduling rules."
        actions={
          <Link href={`/schedule?date=${anchorDate}`}>Back to schedule</Link>
        }
      />
      <FillScheduleForm tenantSlug={membership.tenantSlug ?? tenantSlug ?? ''} anchorDate={anchorDate} />
    </div>
  );
}
