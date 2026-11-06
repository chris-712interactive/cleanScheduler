import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { TenantRole } from '@/lib/auth/types';
import { loadMileageYear } from '@/lib/mileage/store';
import {
  mileageYearCsv,
  mileageYearRows,
  parseMileageYear,
  renderMileageYearPdf,
} from '@/lib/mileage/yearReport';
import { getPortalContext } from '@/lib/portal';
import { createAdminClient } from '@/lib/supabase/server';
import {
  hasPermission,
  resolveMembershipPermissions,
} from '@/lib/tenant/resolveMembershipPermissions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const { tenantSlug } = await getPortalContext();
  if (!tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const membership = await requireTenantPortalAccess(tenantSlug, '/schedule/miles');
  const auth = await getAuthContext();
  const actorId = auth?.user.id ?? '';
  if (!actorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const year = parseMileageYear(url.searchParams.get('year')?.trim() ?? '');
  if (year == null) {
    return NextResponse.json({ error: 'Choose a calendar year.' }, { status: 400 });
  }
  const format = url.searchParams.get('format') === 'pdf' ? 'pdf' : 'csv';
  const admin = createAdminClient();
  const permissions = await resolveMembershipPermissions(admin, membership);
  const role = membership.role as TenantRole;
  const canReview =
    role === 'owner' || role === 'admin' || hasPermission(permissions, 'mileage.review');
  const requestedUser = url.searchParams.get('user')?.trim() ?? '';
  const userId = UUID_RE.test(requestedUser) && canReview ? requestedUser : actorId;

  const yearLog = await loadMileageYear({
    admin,
    tenantId: membership.tenantId,
    userId,
    year,
  });
  const rows = mileageYearRows(yearLog.days);
  const filename = `mileage-${year}.${format}`;

  if (format === 'pdf') {
    const pdf = await renderMileageYearPdf({ personName: yearLog.personName, year, rows });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  const csv = mileageYearCsv(yearLog.personName, year, rows);
  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}
