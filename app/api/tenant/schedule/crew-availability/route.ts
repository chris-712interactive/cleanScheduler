import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getPortalContext } from '@/lib/portal';
import { createAdminClient } from '@/lib/supabase/server';
import { findAvailableEmployees, UNAVAILABILITY_LABEL } from '@/lib/schedule/employeeAvailability';
import { firstNameFromDisplayName } from '@/lib/profile/displayName';

export async function GET(request: Request) {
  const { tenantSlug } = await getPortalContext();
  if (!tenantSlug) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const membership = await requireTenantPortalAccess(tenantSlug, '/schedule/new', {
    skipFieldEmployeeRouteEnforcement: true,
  });

  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const startsAt = (url.searchParams.get('starts_at') ?? '').trim();
  const endsAt = (url.searchParams.get('ends_at') ?? '').trim();

  if (!startsAt || !endsAt) {
    return NextResponse.json({ error: 'starts_at and ends_at are required.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: members } = await admin
    .from('tenant_memberships')
    .select('user_id')
    .eq('tenant_id', membership.tenantId)
    .eq('is_active', true);

  const userIds = (members ?? []).map((m) => m.user_id);
  const results = await findAvailableEmployees(admin, {
    tenantId: membership.tenantId,
    startsAt,
    endsAt,
    userIds,
  });

  const profileIds = results.map((r) => r.userId);
  const { data: profiles } =
    profileIds.length > 0
      ? await admin.from('user_profiles').select('user_id, display_name').in('user_id', profileIds)
      : { data: [] };

  const nameByUser = new Map(
    (profiles ?? []).map((p) => [p.user_id, p.display_name?.trim() || 'Member']),
  );

  return NextResponse.json({
    crew: results.map((row) => ({
      userId: row.userId,
      name: firstNameFromDisplayName(nameByUser.get(row.userId) || '') || 'Member',
      available: row.available,
      reasons: row.reasons.map((reason) => UNAVAILABILITY_LABEL[reason]),
    })),
  });
}
