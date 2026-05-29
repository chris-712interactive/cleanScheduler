import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { isFieldEmployeeRole } from '@/lib/tenant/fieldEmployeeAccess';
import type { TenantRole } from '@/lib/auth/types';
import { getPortalContext } from '@/lib/portal';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { loadScheduleVisits } from '@/lib/tenant/loadScheduleVisits';
import {
  normalizeDateKey,
  normalizeView,
} from '@/lib/tenant/scheduleDateRange';

export async function GET(request: Request) {
  const { tenantSlug } = await getPortalContext();
  if (!tenantSlug) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const membership = await requireTenantPortalAccess(tenantSlug, '/schedule', {
    skipFieldEmployeeRouteEnforcement: true,
  });

  const auth = await getAuthContext();
  const currentUserId = auth?.user.id ?? '';
  const isFieldEmployee = isFieldEmployeeRole(membership.role as TenantRole);

  const url = new URL(request.url);
  const dateKey = normalizeDateKey(url.searchParams.get('date') ?? undefined);
  const view = normalizeView(url.searchParams.get('view') ?? undefined, {
    defaultForFieldEmployee: isFieldEmployee,
  });
  const locationFilter = (url.searchParams.get('location') ?? '').trim();

  const supabase = createTenantPortalDbClient();
  const { visits, weekDayKeys } = await loadScheduleVisits({
    supabase,
    tenantId: membership.tenantId,
    dateKey,
    view,
    locationFilter,
    fieldEmployeeMode: isFieldEmployee,
    currentUserId,
  });

  return NextResponse.json({
    visits,
    dateKey,
    view,
    weekDayKeys,
  });
}
