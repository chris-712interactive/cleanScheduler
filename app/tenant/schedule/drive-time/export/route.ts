import { NextResponse } from 'next/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import {
  featureUpgradeMessage,
  isFeatureEnabled,
  resolveTenantRoutingPlan,
} from '@/lib/billing/entitlements';
import { getPortalContext } from '@/lib/portal';
import { driveTimeReportCsv } from '@/lib/routing/driveTimeReport';
import { loadDriveTimeReport } from '@/lib/routing/loadDriveTimeReport';
import { canApplyStopOrder } from '@/lib/routing/locks';
import { createAdminClient } from '@/lib/supabase/server';
import { isCalendarDateKey } from '@/lib/tenant/scheduleDateRange';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { tenantSlug } = await getPortalContext();
  if (!tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const membership = await requireTenantPortalAccess(tenantSlug, '/schedule/drive-time');
  if (!canApplyStopOrder(membership.role)) {
    return NextResponse.json({ error: 'Only the office can view drive time.' }, { status: 403 });
  }
  const admin = createAdminClient();
  const plan = await resolveTenantRoutingPlan(admin, membership.tenantId);
  if (!isFeatureEnabled(plan, 'driveTimeReports')) {
    return NextResponse.json({ error: featureUpgradeMessage('driveTimeReports') }, { status: 403 });
  }
  const url = new URL(request.url);
  const from = url.searchParams.get('from')?.trim() ?? '';
  const to = url.searchParams.get('to')?.trim() ?? '';
  if (!isCalendarDateKey(from) || !isCalendarDateKey(to)) {
    return NextResponse.json({ error: 'Enter a date range.' }, { status: 400 });
  }
  const report = await loadDriveTimeReport({
    supabase: admin,
    tenantId: membership.tenantId,
    from: from <= to ? from : to,
    to: from <= to ? to : from,
  });
  return new NextResponse(driveTimeReportCsv(report), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="drive-time-${from}-to-${to}.csv"`,
    },
  });
}
