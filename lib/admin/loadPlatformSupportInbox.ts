import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  isPlatformSupportTicketOpen,
  type PlatformSupportInboxFilter,
} from '@/lib/admin/platformSupportLabels';

export type PlatformSupportInboxRow = {
  id: string;
  subject: string;
  status: string;
  category: string;
  tenant_id: string;
  tenantName: string;
  tenantSlug: string;
  created_at: string;
  updated_at: string;
  lastMessageBody: string | null;
  lastMessageAt: string | null;
  awaitingPlatformReply: boolean;
};

type TicketRow = {
  id: string;
  subject: string;
  status: string;
  category: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
  tenants: { name: string; slug: string } | null;
};

export async function loadPlatformSupportInbox(
  admin: SupabaseClient<Database>,
  options: { filter: PlatformSupportInboxFilter; tenantId?: string | null },
): Promise<PlatformSupportInboxRow[]> {
  let query = admin
    .from('platform_support_tickets')
    .select(
      `
      id,
      subject,
      status,
      category,
      tenant_id,
      created_at,
      updated_at,
      tenants:tenants!inner ( name, slug )
    `,
    )
    .order('updated_at', { ascending: false })
    .limit(200);

  if (options.tenantId) {
    query = query.eq('tenant_id', options.tenantId);
  }

  if (options.filter === 'open') {
    query = query.not('status', 'in', '("resolved","closed")');
  } else if (options.filter === 'closed') {
    query = query.in('status', ['resolved', 'closed']);
  }

  const { data: tickets, error } = await query;
  if (error || !tickets?.length) return [];

  const ticketIds = tickets.map((t) => t.id);
  const { data: messages } = await admin
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

  return (tickets as TicketRow[]).map((ticket) => {
    const last = lastByTicket.get(ticket.id);
    const tenant = ticket.tenants;
    return {
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      category: ticket.category,
      tenant_id: ticket.tenant_id,
      tenantName: tenant?.name ?? 'Tenant',
      tenantSlug: tenant?.slug ?? '',
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      lastMessageBody: last?.body ?? null,
      lastMessageAt: last?.created_at ?? null,
      awaitingPlatformReply:
        isPlatformSupportTicketOpen(ticket.status) && last?.author_side === 'tenant',
    };
  });
}
