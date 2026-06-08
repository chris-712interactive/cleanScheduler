import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  customerHasAnyNameParts,
  formatCustomerDisplayName,
} from '@/lib/tenant/customerIdentityName';

export type SupportMessageRow = {
  id: string;
  body: string;
  is_from_customer: boolean;
  created_at: string;
  author_user_id: string | null;
};

export type SupportThreadDetail = {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  customer_id: string;
  customerName: string;
  messages: SupportMessageRow[];
};

type ThreadRow = {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  customer_id: string;
  customers: {
    customer_identities: {
      first_name: string | null;
      last_name: string | null;
      full_name: string | null;
    } | null;
  } | null;
};

export async function loadTenantSupportThreadDetail(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  threadId: string,
): Promise<SupportThreadDetail | null> {
  const { data: thread, error } = await supabase
    .from('customer_support_threads')
    .select(
      `
      id,
      subject,
      status,
      created_at,
      updated_at,
      customer_id,
      customers!inner (
        customer_identities ( first_name, last_name, full_name )
      )
    `,
    )
    .eq('tenant_id', tenantId)
    .eq('id', threadId)
    .maybeSingle();

  if (error || !thread) return null;

  const row = thread as ThreadRow;
  const ident = row.customers?.customer_identities;
  let customerName = 'Customer';
  if (ident && customerHasAnyNameParts(ident)) {
    const formatted = formatCustomerDisplayName(ident);
    customerName = formatted === 'Unnamed' ? 'Customer' : formatted;
  }

  const { data: messages, error: messagesError } = await supabase
    .from('customer_support_messages')
    .select('id, body, is_from_customer, created_at, author_user_id')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (messagesError) return null;

  return {
    id: row.id,
    subject: row.subject,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    customer_id: row.customer_id,
    customerName,
    messages: (messages ?? []) as SupportMessageRow[],
  };
}

export async function loadCustomerSupportThreadDetail(
  admin: SupabaseClient<Database>,
  threadId: string,
  customerIds: string[],
): Promise<(SupportThreadDetail & { tenantName: string }) | null> {
  const { data: thread, error } = await admin
    .from('customer_support_threads')
    .select(
      `
      id,
      subject,
      status,
      created_at,
      updated_at,
      customer_id,
      tenants:tenants!inner ( name ),
      customers!inner (
        customer_identities ( first_name, last_name, full_name )
      )
    `,
    )
    .eq('id', threadId)
    .maybeSingle();

  if (error || !thread) return null;

  const row = thread as ThreadRow & { tenants: { name: string } | null };
  if (!customerIds.includes(row.customer_id)) return null;

  const ident = row.customers?.customer_identities;
  let customerName = 'You';
  if (ident && customerHasAnyNameParts(ident)) {
    const formatted = formatCustomerDisplayName(ident);
    customerName = formatted === 'Unnamed' ? 'You' : formatted;
  }

  const { data: messages, error: messagesError } = await admin
    .from('customer_support_messages')
    .select('id, body, is_from_customer, created_at, author_user_id')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (messagesError) return null;

  return {
    id: row.id,
    subject: row.subject,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    customer_id: row.customer_id,
    customerName,
    tenantName: row.tenants?.name ?? 'Provider',
    messages: (messages ?? []) as SupportMessageRow[],
  };
}
