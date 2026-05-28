import type { Database } from '@/lib/supabase/database.types';

type BillingInterval = Database['public']['Enums']['service_plan_billing_interval'];

export function normalizeToMonthlyCents(interval: BillingInterval, amountCents: number): number {
  if (interval === 'month') return amountCents;
  if (interval === 'week') return Math.round((amountCents * 52) / 12);
  return Math.round(amountCents / 12);
}

export const MRR_ACTIVE_STATUSES: Database['public']['Enums']['tenant_customer_subscription_status'][] =
  ['active', 'trialing', 'past_due'];
