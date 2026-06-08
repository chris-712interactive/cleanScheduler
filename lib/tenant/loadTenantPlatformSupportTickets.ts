import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  isPlatformSupportTicketOpen,
  type PlatformSupportInboxFilter,
} from '@/lib/admin/platformSupportLabels';

export type TenantPlatformSupportRow = {
  id: string;
  subject: string;
  status: string;
  category: string;
  created_at: string;
  updated_at: string;
  lastMessageBody: string | null;
  lastMessageAt: string | null;
  awaitingTenantReply: boolean;
};

export async function loadTenantPlatformSupportTickets(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  filter: PlatformSupportInboxFilter,
): Promise<TenantPlatformSupportRow[]> {
  let query = supabase
    .from('platform_support_tickets')
    .select('id, subject, status, category, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })
    .limit(100);

  if (filter === 'open') {
    query = query.not('status', 'in', '("resolved","closed")');
  } else if (filter === 'closed') {
    query = query.in('status', ['resolved', 'closed']);
  }

  const { data: tickets, error } = await query;
  if (error || !tickets?.length) return [];

  const ticketIds = tickets.map((t) => t.id);
  const { data: messages } = await supabase
    .from('platform_support_messages')
    .select('ticket_id, body, author_side, created_at')
    .in('ticket_id', ticketIds)
    .order('created_at', { ascending: false });

  const lastByTicket = new Map<string, { body: string; author_side: string; created_at: string }>();
  for (const message of messages ?? []) {
    if (!lastByTicket.has(message.ticket_id)) {
      lastByTicket.set(message.ticket_id, message);
    }
  }

  return tickets.map((ticket) => {
    const last = lastByTicket.get(ticket.id);
    return {
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      category: ticket.category,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      lastMessageBody: last?.body ?? null,
      lastMessageAt: last?.created_at ?? null,
      awaitingTenantReply:
        isPlatformSupportTicketOpen(ticket.status) && last?.author_side === 'platform',
    };
  });
}

export async function loadTenantPlatformSupportTicketDetail(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  ticketId: string,
): Promise<{
  id: string;
  subject: string;
  status: string;
  category: string;
  created_at: string;
  updated_at: string;
  messages: { id: string; body: string; author_side: string; created_at: string }[];
} | null> {
  const { data: ticket, error } = await supabase
    .from('platform_support_tickets')
    .select('id, subject, status, category, created_at, updated_at')
    .eq('id', ticketId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !ticket) return null;

  const { data: messages, error: messagesError } = await supabase
    .from('platform_support_messages')
    .select('id, body, author_side, created_at')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (messagesError) return null;

  return {
    ...ticket,
    messages: messages ?? [],
  };
}
