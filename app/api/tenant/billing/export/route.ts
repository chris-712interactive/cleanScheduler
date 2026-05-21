import { NextResponse } from 'next/server';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { assertReportExportRateLimit } from '@/lib/reports/assertReportExportRateLimit';
import { exportInvoicesCsv, exportTransactionsCsv } from '@/lib/billing/exportBillingCsv';
import { canExportReports } from '@/lib/tenant/reportPermissions';

export async function GET(request: Request) {
  const rateLimited = assertReportExportRateLimit(request);
  if (rateLimited) return rateLimited;

  const { tenantSlug } = await getPortalContext();
  if (!tenantSlug) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const membership = await requireTenantPortalAccess(tenantSlug, '/billing');
  if (!canExportReports(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const type = new URL(request.url).searchParams.get('type');
  const db = createTenantPortalDbClient();

  let csv: string;
  let filename: string;

  if (type === 'invoices') {
    csv = await exportInvoicesCsv(db, membership.tenantId);
    filename = 'customer-invoices.csv';
  } else if (type === 'transactions') {
    csv = await exportTransactionsCsv(db, membership.tenantId);
    filename = 'customer-payments.csv';
  } else {
    return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
