import { createAdminClient } from '@/lib/supabase/server';

export interface PlatformDashboardStats {
  activeTenants: number;
  tenantsOnTrial: number;
  newTenantsLast7Days: number;
  customerRecords: number;
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

/**
 * Founder dashboard aggregates via service role (trusted admin routes only).
 */
export async function getPlatformDashboardStats(): Promise<PlatformDashboardStats> {
  const db = createAdminClient();

  const [
    activeTenantsRes,
    trialRes,
    newTenantsRes,
    customersRes,
  ] = await Promise.all([
    db.from('tenants').select('*', { count: 'exact', head: true }).eq('is_active', true),
    db.from('tenant_billing_accounts').select('*', { count: 'exact', head: true }).eq('status', 'trialing'),
    db.from('tenants').select('*', { count: 'exact', head: true }).gte('created_at', daysAgoIso(7)),
    db.from('customers').select('*', { count: 'exact', head: true }),
  ]);

  const safe = (res: { count?: number | null; error?: unknown }) =>
    res.error ? 0 : (res.count ?? 0);

  return {
    activeTenants: safe(activeTenantsRes),
    tenantsOnTrial: safe(trialRes),
    newTenantsLast7Days: safe(newTenantsRes),
    customerRecords: safe(customersRes),
  };
}
