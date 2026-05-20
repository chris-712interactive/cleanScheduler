import { NextResponse } from 'next/server';
import { createAdminClient, createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { resolveTenantPlanTier } from '@/lib/billing/entitlements';
import { assertReportExportRateLimit } from '@/lib/reports/assertReportExportRateLimit';
import { reportResultToCsv } from '@/lib/reports/exportCsv';
import { parseReportDateRange } from '@/lib/reports/parseReportDateRange';
import { isReportEnabled, isReportSlug } from '@/lib/reports/reportCatalog';
import { getOrRunTenantReport } from '@/lib/reports/reportRunCache';
import { isImplementedReportSlug } from '@/lib/reports/runReport';
import { canExportReports } from '@/lib/tenant/reportPermissions';

export async function GET(request: Request) {
  const rateLimited = assertReportExportRateLimit(request);
  if (rateLimited) return rateLimited;

  const { tenantSlug } = await getPortalContext();
  if (!tenantSlug) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const membership = await requireTenantPortalAccess(tenantSlug, '/reports');
  if (!canExportReports(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const slugRaw = url.searchParams.get('slug') ?? '';
  if (!isReportSlug(slugRaw) || !isImplementedReportSlug(slugRaw)) {
    return NextResponse.json({ error: 'Invalid report' }, { status: 400 });
  }

  const admin = createAdminClient();
  const tier = await resolveTenantPlanTier(admin, membership.tenantId);
  if (!isReportEnabled(tier, slugRaw)) {
    return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });
  }

  const range = parseReportDateRange(
    url.searchParams.get('from') ?? undefined,
    url.searchParams.get('to') ?? undefined,
  );

  const supabase = createTenantPortalDbClient();
  const result = await getOrRunTenantReport(supabase, admin, {
    tenantId: membership.tenantId,
    slug: slugRaw,
    fromIso: range.fromIso,
    toIso: range.toIso,
    fromInput: range.fromInput,
    toInput: range.toInput,
    userId: null,
  });

  const csv = reportResultToCsv(result);
  if (!csv) {
    return NextResponse.json({ error: 'Nothing to export' }, { status: 400 });
  }

  const filename = `${slugRaw}-${range.fromInput || 'start'}-${range.toInput || 'end'}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
