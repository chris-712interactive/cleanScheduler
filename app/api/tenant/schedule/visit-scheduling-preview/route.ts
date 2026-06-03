import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getPortalContext } from '@/lib/portal';
import { createAdminClient } from '@/lib/supabase/server';
import { buildVisitSchedulingPreview } from '@/lib/schedule/visitSchedulingPreview';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const { tenantSlug } = await getPortalContext();
  if (!tenantSlug) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const visitId = (url.searchParams.get('visit_id') ?? '').trim();
  const startsAt = (url.searchParams.get('starts_at') ?? '').trim();
  const endsAt = (url.searchParams.get('ends_at') ?? '').trim();
  const assigneeUserIds = url.searchParams
    .getAll('assignee_user_id')
    .map((id) => id.trim())
    .filter((id) => UUID_RE.test(id));

  if (!visitId || !UUID_RE.test(visitId) || !startsAt || !endsAt) {
    return NextResponse.json(
      { error: 'visit_id, starts_at, and ends_at are required.' },
      { status: 400 },
    );
  }

  const membership = await requireTenantPortalAccess(tenantSlug, `/schedule/${visitId}`, {
    skipFieldEmployeeRouteEnforcement: true,
  });

  const admin = createAdminClient();
  const { data: tenantRow } = await admin
    .from('tenants')
    .select('timezone')
    .eq('id', membership.tenantId)
    .maybeSingle();
  const tenantTimezone = tenantRow?.timezone ?? 'America/New_York';

  const preview = await buildVisitSchedulingPreview(admin, {
    tenantId: membership.tenantId,
    visitId,
    startsAt,
    endsAt,
    assigneeUserIds,
    tenantTimezone,
  });

  if (!preview) {
    return NextResponse.json({ error: 'Visit not found.' }, { status: 404 });
  }

  return NextResponse.json(preview);
}
