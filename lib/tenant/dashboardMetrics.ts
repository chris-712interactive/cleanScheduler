import type { SupabaseClient } from '@supabase/supabase-js';
import { startOfCalendarMonthInTimeZone } from '@/lib/datetime/tenantCalendarDay';
import { DEFAULT_TENANT_TIMEZONE } from '@/lib/datetime/formatInTimeZone';
import type { Database } from '@/lib/supabase/database.types';

export async function getTenantSentQuotesCount(
  db: SupabaseClient<Database>,
  tenantId: string,
): Promise<number> {
  const { count, error } = await db
    .from('tenant_quotes')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'sent')
    .is('superseded_by_quote_id', null);

  if (error) return 0;
  return count ?? 0;
}

export async function getTenantCustomersAddedThisMonthCount(
  db: SupabaseClient<Database>,
  tenantId: string,
): Promise<number> {
  const { data: tenantRow } = await db
    .from('tenants')
    .select('timezone')
    .eq('id', tenantId)
    .maybeSingle();

  const timeZone = tenantRow?.timezone ?? DEFAULT_TENANT_TIMEZONE;
  const monthStart = startOfCalendarMonthInTimeZone(timeZone);

  const { count, error } = await db
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .gte('created_at', monthStart.toISOString());

  if (error) return 0;
  return count ?? 0;
}
