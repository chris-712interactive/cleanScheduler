import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { isPlatformAdminRole } from '@/lib/auth/platformRoles';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { publicEnv } from '@/lib/env';
import { INBOUND_ALERT_WATCH_CURSOR, isAlertCursor } from '@/lib/messaging/inboundSupportAlert';
import { loadInboundSupportAlert } from '@/lib/messaging/loadInboundSupportAlert';
import { getPortalContext, type PortalContext } from '@/lib/portal';
import { inferPortalFromHost } from '@/lib/portal/inferPortalFromHost';
import { resolveActiveTenantPublicDomain } from '@/lib/portal/resolveTenantPublicDomain';
import { createAdminClient } from '@/lib/supabase/server';
import { isFieldEmployeeRole } from '@/lib/tenant/fieldEmployeeAccess';

export const dynamic = 'force-dynamic';

const EMPTY = { cursor: null, alert: null };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

/**
 * `/api` is outside the portal rewrite, so `x-portal` is absent and the host
 * is the only signal for tenant vs customer.
 */
async function resolveInboundPortal(): Promise<PortalContext> {
  const portal = await getPortalContext();
  if (portal.kind === 'tenant' || portal.kind === 'customer') return portal;

  const host = (await headers()).get('host');
  const inferred = inferPortalFromHost(host, publicEnv.NEXT_PUBLIC_APP_DOMAIN);
  if (inferred.kind === 'tenant' || inferred.kind === 'customer') {
    return {
      ...portal,
      kind: inferred.kind,
      tenantSlug: portal.tenantSlug ?? inferred.tenantSlug,
    };
  }

  if (!host) return portal;
  const domain = await resolveActiveTenantPublicDomain(host);
  if (!domain) return portal;
  return {
    kind: 'customer',
    tenantSlug: domain.tenantSlug,
    whiteLabelCustomerPortal: true,
    whiteLabelHostname: domain.hostname,
  };
}

export async function GET(request: Request) {
  const portal = await resolveInboundPortal();
  const url = new URL(request.url);
  const afterParam = url.searchParams.get('after');
  const watch = url.searchParams.get('watch') === '1';
  const after = isAlertCursor(afterParam) ? afterParam : null;

  if (portal.kind === 'tenant') {
    if (!portal.tenantSlug) return json({ error: 'Unauthorized' }, 401);
    const membership = await requireTenantPortalAccess(portal.tenantSlug, '/messages', {
      skipFieldEmployeeRouteEnforcement: true,
      browserPathname: '/messages',
    });
    if (isFieldEmployeeRole(membership.role)) return json(EMPTY);

    const mode = !after && !watch ? null : (after ?? INBOUND_ALERT_WATCH_CURSOR);
    const payload = await loadInboundSupportAlert(
      createAdminClient(),
      { portal: 'tenant', tenantId: membership.tenantId },
      mode,
    );
    return json(payload);
  }

  if (portal.kind === 'customer') {
    const auth = await getAuthContext();
    if (!auth) return json({ error: 'Unauthorized' }, 401);
    if (auth.claims.appRole !== 'customer' && !isPlatformAdminRole(auth.claims.appRole)) {
      return json({ error: 'Forbidden' }, 403);
    }

    const ctx = await getCustomerPortalContext(auth.user.id, {
      scopeTenantSlug: portal.whiteLabelCustomerPortal ? portal.tenantSlug : null,
    });
    if (!ctx) return json(EMPTY);

    const mode = !after && !watch ? null : (after ?? INBOUND_ALERT_WATCH_CURSOR);
    const payload = await loadInboundSupportAlert(
      createAdminClient(),
      { portal: 'customer', customerIds: ctx.customerIds },
      mode,
    );
    return json(payload);
  }

  return json({ error: 'Not found' }, 404);
}
