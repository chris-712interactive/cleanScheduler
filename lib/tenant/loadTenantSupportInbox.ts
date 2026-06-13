import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  customerHasAnyNameParts,
  formatCustomerDisplayName,
} from '@/lib/tenant/customerIdentityName';

export type SupportInboxFilter = 'open' | 'closed' | 'all';

export type TenantSupportInboxRow = {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  customer_id: string;
  customerName: string;
  lastMessageBody: string | null;
  lastMessageFromCustomer: boolean | null;
  lastMessageAt: string | null;
  awaitingReply: boolean;
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

function customerLabelFromRow(row: ThreadRow): string {
  const ident = row.customers?.customer_identities;
  if (!ident || !customerHasAnyNameParts(ident)) return 'Customer';
  const name = formatCustomerDisplayName(ident);
  return name === 'Unnamed' ? 'Customer' : name;
}

export async function loadTenantSupportInbox(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  options?: { filter?: SupportInboxFilter; customerId?: string | null },
): Promise<TenantSupportInboxRow[]> {
  const filter = options?.filter ?? 'open';

  let query = supabase
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
    .order('updated_at', { ascending: false });

  if (filter === 'open') query = query.eq('status', 'open');
  if (filter === 'closed') query = query.eq('status', 'closed');
  if (options?.customerId) query = query.eq('customer_id', options.customerId);

  const { data: threads, error } = await query;
  if (error || !threads?.length) return [];

  const rows = threads as ThreadRow[];
  const threadIds = rows.map((row) => row.id);

  const { data: messages } = await supabase
    .from('customer_support_messages')
    .select('thread_id, body, is_from_customer, created_at')
    .in('thread_id', threadIds)
    .order('created_at', { ascending: false });

  const lastByThread = new Map<
    string,
    { body: string; is_from_customer: boolean; created_at: string }
  >();
  for (const message of messages ?? []) {
    if (!lastByThread.has(message.thread_id)) {
      lastByThread.set(message.thread_id, {
        body: message.body,
        is_from_customer: message.is_from_customer,
        created_at: message.created_at,
      });
    }
  }

  return rows.map((row) => {
    const last = lastByThread.get(row.id) ?? null;
    return {
      id: row.id,
      subject: row.subject,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      customer_id: row.customer_id,
      customerName: customerLabelFromRow(row),
      lastMessageBody: last?.body ?? null,
      lastMessageFromCustomer: last?.is_from_customer ?? null,
      lastMessageAt: last?.created_at ?? row.updated_at,
      awaitingReply: row.status === 'open' && last?.is_from_customer === true,
    };
  });
}
