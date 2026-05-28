import type { SupabaseClient } from '@supabase/supabase-js';
import { loadMeteredLimitSnapshots, type MeteredLimitKey } from '@/lib/billing/checkLimit';
import { pickHighestUtilizationAlert, type UtilizationAlert } from '@/lib/billing/usageUtilization';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

const DEFAULT_METER_KEYS: MeteredLimitKey[] = [
  'includedOfficeSeats',
  'includedFieldSeats',
  'maxActiveCustomers',
  'maxAutomationWorkflows',
];

export async function loadTenantUsageUtilizationAlert(
  admin: Admin,
  tenantId: string,
): Promise<UtilizationAlert | null> {
  const plan = await resolveTenantEntitlementPlan(admin, tenantId);
  const keys = [...DEFAULT_METER_KEYS];

  if (isFeatureEnabled(plan, 'smsCommunication')) {
    keys.push('includedSmsCreditsMonthly');
  }
  if (isFeatureEnabled(plan, 'campaigns')) {
    keys.push('includedEmailCreditsMonthly');
  }

  const snapshots = await loadMeteredLimitSnapshots(admin, tenantId, keys);
  return pickHighestUtilizationAlert(snapshots);
}
