import type { SupabaseClient } from '@supabase/supabase-js';
import {
  assertLimitNotExceeded,
  EntitlementGateError,
  getEntitlementsForPlan,
  resolveTenantEntitlementPlan,
  type EntitlementLimitKey,
  type EntitlementPlanKey,
  type NumericEntitlementLimitKey,
} from '@/lib/billing/entitlements';
import { countActiveAutomationWorkflows } from '@/lib/billing/automationWorkflows';
import { countSmsSegmentsUsedThisMonth } from '@/lib/billing/smsCredits';
import { countTeamSeatUsage } from '@/lib/billing/teamSeats';
import { countMarketingSendsThisMonth } from '@/lib/campaigns/campaignLimits';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

/** Limits surfaced in utilization banners and soft-stop modals. */
export type MeteredLimitKey =
  | 'includedOfficeSeats'
  | 'includedFieldSeats'
  | 'maxActiveCustomers'
  | 'includedSmsCreditsMonthly'
  | 'includedEmailCreditsMonthly'
  | 'maxAutomationWorkflows';

export interface LimitUsageSnapshot {
  key: MeteredLimitKey;
  label: string;
  used: number;
  limit: number | null;
}

export interface LimitCheckResult {
  ok: boolean;
  snapshot: LimitUsageSnapshot;
  error?: EntitlementGateError;
}

const METER_LABELS: Record<MeteredLimitKey, string> = {
  includedOfficeSeats: 'Office seats',
  includedFieldSeats: 'Field seats',
  maxActiveCustomers: 'Active customers',
  includedSmsCreditsMonthly: 'SMS segments',
  includedEmailCreditsMonthly: 'Email sends',
  maxAutomationWorkflows: 'Recurring rules',
};

export function isLimitExceededError(error: unknown): error is EntitlementGateError {
  return error instanceof EntitlementGateError && error.code === 'limit_exceeded';
}

export async function measureLimitUsage(
  admin: Admin,
  tenantId: string,
  key: MeteredLimitKey,
  plan: EntitlementPlanKey,
): Promise<LimitUsageSnapshot> {
  const limits = getEntitlementsForPlan(plan).limits;

  switch (key) {
    case 'includedOfficeSeats': {
      const usage = await countTeamSeatUsage(admin, tenantId);
      return {
        key,
        label: METER_LABELS[key],
        used: usage.officeUsed,
        limit: limits.includedOfficeSeats,
      };
    }
    case 'includedFieldSeats': {
      const usage = await countTeamSeatUsage(admin, tenantId);
      return {
        key,
        label: METER_LABELS[key],
        used: usage.fieldUsed,
        limit: limits.includedFieldSeats,
      };
    }
    case 'maxActiveCustomers': {
      const { count, error } = await admin
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);
      if (error) throw new Error(error.message);
      return {
        key,
        label: METER_LABELS[key],
        used: count ?? 0,
        limit: limits.maxActiveCustomers,
      };
    }
    case 'includedSmsCreditsMonthly': {
      const used = await countSmsSegmentsUsedThisMonth(admin, tenantId);
      return {
        key,
        label: METER_LABELS[key],
        used,
        limit: limits.includedSmsCreditsMonthly,
      };
    }
    case 'includedEmailCreditsMonthly': {
      const used = await countMarketingSendsThisMonth(admin, tenantId);
      return {
        key,
        label: METER_LABELS[key],
        used,
        limit: limits.includedEmailCreditsMonthly,
      };
    }
    case 'maxAutomationWorkflows': {
      const used = await countActiveAutomationWorkflows(admin, tenantId);
      return {
        key,
        label: METER_LABELS[key],
        used,
        limit: limits.maxAutomationWorkflows,
      };
    }
    default: {
      const _exhaustive: never = key;
      throw new Error(`Unsupported metered limit: ${String(_exhaustive)}`);
    }
  }
}

export async function checkLimit(
  admin: Admin,
  tenantId: string,
  key: MeteredLimitKey,
  projectedDelta = 0,
): Promise<LimitCheckResult> {
  const plan = await resolveTenantEntitlementPlan(admin, tenantId);
  const snapshot = await measureLimitUsage(admin, tenantId, key, plan);

  if (snapshot.limit === null) {
    return { ok: true, snapshot };
  }

  const projected = snapshot.used + projectedDelta;
  try {
    assertLimitNotExceeded(plan, key as NumericEntitlementLimitKey, projected);
    return { ok: true, snapshot: { ...snapshot, used: projected } };
  } catch (error) {
    if (isLimitExceededError(error)) {
      return { ok: false, snapshot: { ...snapshot, used: projected }, error };
    }
    throw error;
  }
}

/** Team seat invite checks office or field limit depending on role. */
export async function checkTeamSeatLimit(
  admin: Admin,
  tenantId: string,
  seatType: 'office' | 'field',
): Promise<LimitCheckResult> {
  const key: MeteredLimitKey = seatType === 'office' ? 'includedOfficeSeats' : 'includedFieldSeats';
  return checkLimit(admin, tenantId, key, 1);
}

export async function loadMeteredLimitSnapshots(
  admin: Admin,
  tenantId: string,
  keys: MeteredLimitKey[],
): Promise<LimitUsageSnapshot[]> {
  const plan = await resolveTenantEntitlementPlan(admin, tenantId);
  return Promise.all(keys.map((key) => measureLimitUsage(admin, tenantId, key, plan)));
}

export function limitKeyForEntitlement(limit: EntitlementLimitKey): MeteredLimitKey | null {
  const map: Partial<Record<EntitlementLimitKey, MeteredLimitKey>> = {
    includedOfficeSeats: 'includedOfficeSeats',
    includedFieldSeats: 'includedFieldSeats',
    maxActiveCustomers: 'maxActiveCustomers',
    includedSmsCreditsMonthly: 'includedSmsCreditsMonthly',
    includedEmailCreditsMonthly: 'includedEmailCreditsMonthly',
    maxAutomationWorkflows: 'maxAutomationWorkflows',
  };
  return map[limit] ?? null;
}

export async function assertMeteredLimit(
  admin: Admin,
  tenantId: string,
  key: MeteredLimitKey,
  projectedDelta = 0,
): Promise<void> {
  const result = await checkLimit(admin, tenantId, key, projectedDelta);
  if (!result.ok && result.error) {
    throw result.error;
  }
}
