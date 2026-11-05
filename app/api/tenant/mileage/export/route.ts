import { NextResponse } from 'next/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { TenantRole } from '@/lib/auth/types';
import { mileageCsv } from '@/lib/mileage/model';
import { isWorkDate, loadMileageSettings, loadMileageWeek } from '@/lib/mileage/store';
import { getPortalContext } from '@/lib/portal';
import { createAdminClient } from '@/lib/supabase/server';
import {
  hasPermission,
  resolveMembershipPermissions,
} from '@/lib/tenant/resolveMembershipPermissions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { tenantSlug } = await getPortalContext();
  if (!tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const membership = await requireTenantPortalAccess(tenantSlug, '/mileage');
  const admin = createAdminClient();
  const permissions = await resolveMembershipPermissions(admin, membership);
  const role = membership.role as TenantRole;
  const allowed =
    role === 'owner' || role === 'admin' || hasPermission(permissions, 'mileage.review');
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(request.url);
  const from = url.searchParams.get('from')?.trim() ?? '';
  if (!isWorkDate(from)) {
    return NextResponse.json({ error: 'Missing week.' }, { status: 400 });
  }
  const [week, settings] = await Promise.all([
    loadMileageWeek({ admin, tenantId: membership.tenantId, anchorDate: from }),
    loadMileageSettings(admin, membership.tenantId),
  ]);
  const includeAmount = settings.reimbursementEnabled;
  const csv = mileageCsv(
    week.days.map((day) => ({
      date: day.workDate,
      person: day.personName,
      vehicle: day.vehicle,
      miles: day.countedMiles.toFixed(1),
      amount: day.reimbursementCents == null ? null : (day.reimbursementCents / 100).toFixed(2),
      status: day.status,
    })),
    includeAmount,
  );
  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="mileage-${week.weekStart}.csv"`,
    },
  });
}
