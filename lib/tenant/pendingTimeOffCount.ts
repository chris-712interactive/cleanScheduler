import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export async function countPendingTimeOffRequests(
  supabase: SupabaseClient<Database>,
  tenantId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('tenant_member_time_off')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'pending');

  if (error) return 0;
  return count ?? 0;
}
