import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export type PlatformSupportMessageRow = {
  id: string;
  body: string;
  author_side: string;
  created_at: string;
  author_user_id: string | null;
};

export type PlatformSupportTicketDetail = {
  id: string;
  subject: string;
  status: string;
  category: string;
  tenant_id: string;
  tenantName: string;
  tenantSlug: string;
  assigned_to_user_id: string | null;
  created_at: string;
  updated_at: string;
  messages: PlatformSupportMessageRow[];
};

type TicketRow = {
  id: string;
  subject: string;
  status: string;
  category: string;
  tenant_id: string;
  assigned_to_user_id: string | null;
  created_at: string;
  updated_at: string;
  tenants: { name: string; slug: string } | null;
};

export async function loadPlatformSupportTicketDetail(
  admin: SupabaseClient<Database>,
  ticketId: string,
): Promise<PlatformSupportTicketDetail | null> {
  const { data: ticket, error } = await admin
    .from('platform_support_tickets')
    .select(
      `
      id,
      subject,
      status,
      category,
      tenant_id,
      assigned_to_user_id,
      created_at,
      updated_at,
      tenants:tenants!inner ( name, slug )
    `,
    )
    .eq('id', ticketId)
    .maybeSingle();

  if (error || !ticket) return null;

  const row = ticket as TicketRow;
  const { data: messages, error: messagesError } = await admin
    .from('platform_support_messages')
    .select('id, body, author_side, created_at, author_user_id')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (messagesError) return null;

  const tenant = row.tenants;
  return {
    id: row.id,
    subject: row.subject,
    status: row.status,
    category: row.category,
    tenant_id: row.tenant_id,
    tenantName: tenant?.name ?? 'Tenant',
    tenantSlug: tenant?.slug ?? '',
    assigned_to_user_id: row.assigned_to_user_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    messages: (messages ?? []) as PlatformSupportMessageRow[],
  };
}
