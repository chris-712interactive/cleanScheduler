import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export async function countPendingRescheduleRequests(
  supabase: SupabaseClient<Database>,
  tenantId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('visit_reschedule_requests')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'pending');

  if (error) return 0;
  return count ?? 0;
}
