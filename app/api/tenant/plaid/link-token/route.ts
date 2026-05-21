import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import {
  createPlaidLinkToken,
  createPlaidUpdateLinkToken,
  isPlaidConfigured,
} from '@/lib/plaid/server';

export async function GET() {
  if (!isPlaidConfigured()) {
    return NextResponse.json({ error: 'Plaid is not configured on this server.' }, { status: 501 });
  }

  const { tenantSlug } = await getPortalContext();
  if (!tenantSlug) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/bank-connection');
  const admin = createAdminClient();

  const { data: link } = await admin
    .from('bank_links')
    .select('plaid_access_token, status')
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  try {
    const linkToken =
      link?.plaid_access_token && link.status === 'login_required'
        ? await createPlaidUpdateLinkToken(membership.tenantId, link.plaid_access_token)
        : await createPlaidLinkToken(membership.tenantId);

    return NextResponse.json({ link_token: linkToken });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not create Plaid link token.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
