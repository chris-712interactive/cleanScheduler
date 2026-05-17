import { createAdminClient } from '@/lib/supabase/server';

/** Visit IDs with a pending customer reschedule request for this login. */
export async function getCustomerPendingRescheduleVisitIds(
  customerIds: string[],
): Promise<Set<string>> {
  if (customerIds.length === 0) return new Set();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('visit_reschedule_requests')
    .select('visit_id')
    .in('customer_id', customerIds)
    .eq('status', 'pending');

  if (error) return new Set();

  return new Set((data ?? []).map((r) => r.visit_id));
}
