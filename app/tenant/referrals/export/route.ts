import { NextResponse } from 'next/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createAdminClient } from '@/lib/supabase/server';
import { isFeatureEnabled, resolveTenantPlanTier } from '@/lib/billing/entitlements';
import {
  loadTenantReferralAudit,
  referralAttributionCsvRows,
} from '@/lib/referrals/loadTenantReferralAudit';

export const dynamic = 'force-dynamic';

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(): Promise<Response> {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/referrals/export');
  const admin = createAdminClient();
  const tier = await resolveTenantPlanTier(admin, membership.tenantId);

  if (!isFeatureEnabled(tier, 'customerReferralProgram')) {
    return NextResponse.json({ error: 'Referrals not enabled.' }, { status: 403 });
  }

  const snapshot = await loadTenantReferralAudit(admin, membership.tenantId);
  const rows = referralAttributionCsvRows(snapshot);
  const body = rows.map((row) => row.map(csvEscape).join(',')).join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="referral-attributions.csv"',
    },
  });
}
