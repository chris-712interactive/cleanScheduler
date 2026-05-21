import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { formatInvoiceReference } from '@/lib/billing/formatInvoiceReference';
import {
  customerHasAnyNameParts,
  formatCustomerDisplayName,
} from '@/lib/tenant/customerIdentityName';
import { customerIdentitySearchOrClause } from '@/lib/tenant/customerDirectorySearch';

export interface GlobalSearchHit {
  id: string;
  label: string;
  detail: string;
  href: string;
}

export interface GlobalSearchResults {
  customers: GlobalSearchHit[];
  invoices: GlobalSearchHit[];
  quotes: GlobalSearchHit[];
  visits: GlobalSearchHit[];
}

const LIMIT = 5;

export async function runTenantGlobalSearch(
  db: SupabaseClient<Database>,
  tenantId: string,
  query: string,
): Promise<GlobalSearchResults> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { customers: [], invoices: [], quotes: [], visits: [] };
  }

  const escaped = trimmed.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  const ilikePat = `%${escaped}%`;
  const textOr = `title.ilike.${ilikePat},id.ilike.${ilikePat}`;

  const { data: identityMatches } = await db
    .from('customer_identities')
    .select('id, first_name, last_name, full_name, email')
    .or(customerIdentitySearchOrClause(trimmed))
    .limit(20);

  const identityIds = (identityMatches ?? []).map((row) => row.id);

  const [customersRes, invoicesRes, quotesRes, visitsRes] = await Promise.all([
    identityIds.length > 0
      ? db
          .from('customers')
          .select(
            'id, status, customer_identities ( first_name, last_name, full_name, email )',
          )
          .eq('tenant_id', tenantId)
          .in('customer_identity_id', identityIds)
          .limit(LIMIT)
      : Promise.resolve({ data: [] as never[] }),
    db
      .from('tenant_invoices')
      .select('id, title, status, customers(customer_identities(first_name, last_name, full_name))')
      .eq('tenant_id', tenantId)
      .or(textOr)
      .order('created_at', { ascending: false })
      .limit(LIMIT),
    db
      .from('tenant_quotes')
      .select('id, title, status, customers(customer_identities(first_name, last_name, full_name))')
      .eq('tenant_id', tenantId)
      .is('superseded_by_quote_id', null)
      .or(textOr)
      .order('created_at', { ascending: false })
      .limit(LIMIT),
    db
      .from('tenant_scheduled_visits')
      .select('id, title, starts_at, status, customers(customer_identities(first_name, last_name, full_name))')
      .eq('tenant_id', tenantId)
      .or(textOr)
      .order('starts_at', { ascending: false })
      .limit(LIMIT),
  ]);

  const customers: GlobalSearchHit[] = (customersRes.data ?? []).map((row) => {
    const ident = row.customer_identities;
    const name = ident ? formatCustomerDisplayName(ident) : 'Customer';
    return {
      id: row.id,
      label: name === 'Unnamed' ? ident?.email?.trim() || 'Customer' : name,
      detail: row.status === 'active' ? 'Active customer' : 'Inactive customer',
      href: `/customers/${row.id}`,
    };
  });

  const invoices = (invoicesRes.data ?? []).map((row) => {
    const ident = (row.customers as { customer_identities: Parameters<typeof formatCustomerDisplayName>[0] | null } | null)
      ?.customer_identities;
    const customerName =
      ident && customerHasAnyNameParts(ident) ? formatCustomerDisplayName(ident) : null;
    return {
      id: row.id,
      label: formatInvoiceReference(row.id, row.title),
      detail: [customerName, row.status].filter(Boolean).join(' · '),
      href: `/billing/invoices/${row.id}`,
    };
  });

  const quotes = (quotesRes.data ?? []).map((row) => {
    const ident = (row.customers as { customer_identities: Parameters<typeof formatCustomerDisplayName>[0] | null } | null)
      ?.customer_identities;
    const customerName =
      ident && customerHasAnyNameParts(ident) ? formatCustomerDisplayName(ident) : null;
    return {
      id: row.id,
      label: row.title,
      detail: [customerName, row.status].filter(Boolean).join(' · '),
      href: `/quotes/${row.id}`,
    };
  });

  const visits = (visitsRes.data ?? []).map((row) => {
    const ident = (row.customers as { customer_identities: Parameters<typeof formatCustomerDisplayName>[0] | null } | null)
      ?.customer_identities;
    const customerName =
      ident && customerHasAnyNameParts(ident) ? formatCustomerDisplayName(ident) : null;
    const when = new Date(row.starts_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    return {
      id: row.id,
      label: row.title,
      detail: [customerName, when, row.status].filter(Boolean).join(' · '),
      href: `/schedule/${row.id}`,
    };
  });

  return { customers, invoices, quotes, visits };
}
