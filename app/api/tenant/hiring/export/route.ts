import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import { getPortalContext } from '@/lib/portal';
import { createAdminClient } from '@/lib/supabase/server';
import {
  hasPermission,
  resolveMembershipPermissions,
} from '@/lib/tenant/resolveMembershipPermissions';

export const dynamic = 'force-dynamic';

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET(request: Request) {
  const { tenantSlug } = await getPortalContext();
  if (!tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const membership = await requireTenantPortalAccess(tenantSlug, '/hiring');
  const admin = createAdminClient();
  const plan = await resolveTenantEntitlementPlan(admin, membership.tenantId);
  if (!isFeatureEnabled(plan, 'hiringDesk')) {
    return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });
  }
  const permissions = await resolveMembershipPermissions(admin, membership);
  const allowed =
    hasPermission(permissions, 'hiring.manage') ||
    membership.role === 'owner' ||
    membership.role === 'admin';
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const openingId = new URL(request.url).searchParams.get('opening')?.trim() ?? '';
  const { data: opening } = await admin
    .from('tenant_hiring_openings')
    .select('id, title')
    .eq('id', openingId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();
  if (!opening) return NextResponse.json({ error: 'Opening not found' }, { status: 404 });

  const { data: rows } = await admin
    .from('tenant_hiring_applications')
    .select('full_name, email, phone_e164, status')
    .eq('opening_id', opening.id)
    .order('created_at', { ascending: true });

  const auth = await getAuthContext();

  const lines = [
    ['name', 'phone', 'email', 'status', 'opening'].join(','),
    ...(rows ?? []).map((row) =>
      [row.full_name ?? '', row.phone_e164 ?? '', row.email ?? '', row.status, opening.title]
        .map((cell) => csvCell(cell))
        .join(','),
    ),
  ];

  await admin.from('tenant_hiring_events').insert({
    tenant_id: membership.tenantId,
    opening_id: opening.id,
    event_type: 'csv_downloaded',
    actor_user_id: auth?.user.id ?? null,
  });

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="hiring.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
