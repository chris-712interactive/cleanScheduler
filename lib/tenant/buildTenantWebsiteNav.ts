import type { SupabaseClient } from '@supabase/supabase-js';
import type { NavItem } from '@/components/portal/types';
import type { Database } from '@/lib/supabase/database.types';

export function buildTenantWebsiteNavItems(params: {
  websiteEnabled: boolean;
  websitePublished: boolean;
  newLeadsCount: number;
}): NavItem[] {
  if (!params.websiteEnabled) return [];

  const items: NavItem[] = [
    {
      label: 'Website',
      href: '/settings/website',
      icon: 'website',
    },
  ];

  if (params.websitePublished) {
    items.push({
      label: 'Leads',
      href: '/settings/website/leads',
      icon: 'inquiries',
      badge:
        params.newLeadsCount > 0
          ? params.newLeadsCount > 99
            ? '99+'
            : params.newLeadsCount
          : undefined,
    });
  }

  return items;
}

export async function countNewTenantMarketingLeads(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<number> {
  const { count, error } = await admin
    .from('tenant_marketing_leads')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'new');

  if (error) return 0;
  return count ?? 0;
}
