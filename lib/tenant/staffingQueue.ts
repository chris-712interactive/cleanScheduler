import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  customerHasAnyNameParts,
  formatCustomerDisplayName,
} from '@/lib/tenant/customerIdentityName';

export interface StaffingQueueItem {
  visitId: string;
  title: string;
  startsAt: string;
  customerName: string;
  href: string;
}

type Admin = SupabaseClient<Database>;

export async function countVisitsNeedingStaffing(admin: Admin, tenantId: string): Promise<number> {
  const { count, error } = await admin
    .from('tenant_scheduled_visits')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'scheduled')
    .eq('staffing_status', 'needs_staffing')
    .gte('starts_at', new Date().toISOString());

  if (error) return 0;
  return count ?? 0;
}

export async function listVisitsNeedingStaffing(
  admin: Admin,
  tenantId: string,
  limit = 10,
): Promise<StaffingQueueItem[]> {
  const { data } = await admin
    .from('tenant_scheduled_visits')
    .select(
      `
      id,
      title,
      starts_at,
      customers (
        customer_identities (
          first_name,
          last_name,
          full_name
        )
      )
    `,
    )
    .eq('tenant_id', tenantId)
    .eq('status', 'scheduled')
    .eq('staffing_status', 'needs_staffing')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(limit);

  return (data ?? []).map((row) => {
    const ident = row.customers?.customer_identities;
    const customerName =
      ident && customerHasAnyNameParts(ident) ? formatCustomerDisplayName(ident) : 'Customer';
    return {
      visitId: row.id,
      title: row.title.trim() || 'Visit',
      startsAt: row.starts_at,
      customerName,
      href: `/schedule/${row.id}`,
    };
  });
}
