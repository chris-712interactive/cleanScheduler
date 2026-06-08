import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export async function countOpenSupportThreads(
  supabase: SupabaseClient<Database>,
  tenantId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('customer_support_threads')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'open');

  if (error) return 0;
  return count ?? 0;
}
