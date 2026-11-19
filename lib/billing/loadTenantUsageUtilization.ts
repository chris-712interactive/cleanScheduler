import type { SupabaseClient } from '@supabase/supabase-js';
import { loadMeteredLimitSnapshots, type MeteredLimitKey } from '@/lib/billing/checkLimit';
import { pickHighestUtilizationAlert, type UtilizationAlert } from '@/lib/billing/usageUtilization';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import { applicantUsesSeparateCap } from '@/lib/billing/textPacks';
import { loadTextingBilling } from '@/lib/billing/loadTextingBilling';
import { canUseTexting } from '@/lib/billing/tenantSubscriptionAccess';
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
  const [billing, plan] = await Promise.all([
    loadTextingBilling(admin, tenantId),
    resolveTenantEntitlementPlan(admin, tenantId),
  ]);
  const keys = [...DEFAULT_METER_KEYS];
  const textingPaid = canUseTexting(billing.status, billing.rawStripeStatus);

  if (textingPaid && isFeatureEnabled(plan, 'smsCommunication')) {
    keys.push('includedSmsCreditsMonthly');
  }
  if (textingPaid && applicantUsesSeparateCap(plan)) {
    keys.push('includedApplicantSmsCreditsMonthly');
  }
  if (isFeatureEnabled(plan, 'campaigns')) {
    keys.push('includedEmailCreditsMonthly');
  }

  const snapshots = await loadMeteredLimitSnapshots(admin, tenantId, keys);
  return pickHighestUtilizationAlert(snapshots);
}
