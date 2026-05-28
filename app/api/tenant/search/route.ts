import { NextResponse } from 'next/server';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { isFieldEmployeeRole } from '@/lib/tenant/fieldEmployeeAccess';
import { runTenantGlobalSearch } from '@/lib/tenant/globalSearch';

const EMPTY_RESULTS = {
  customers: [],
  invoices: [],
  quotes: [],
  visits: [],
};

export async function GET(request: Request) {
  const { tenantSlug } = await getPortalContext();
  if (!tenantSlug) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const membership = await requireTenantPortalAccess(tenantSlug, '/', {
    skipFieldEmployeeRouteEnforcement: true,
  });

  if (isFieldEmployeeRole(membership.role)) {
    return NextResponse.json(EMPTY_RESULTS);
  }
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim();

  if (q.length < 2) {
    return NextResponse.json({
      customers: [],
      invoices: [],
      quotes: [],
      visits: [],
    });
  }

  const db = createTenantPortalDbClient();
  const results = await runTenantGlobalSearch(db, membership.tenantId, q);
  return NextResponse.json(results);
}
