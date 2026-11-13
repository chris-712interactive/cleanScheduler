import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { emitTenantWebhook } from '@/lib/integrations/emitTenantWebhook';

type Admin = SupabaseClient<Database>;

export async function emitQuoteWebhookEvent(
  admin: Admin,
  event: 'quote.sent' | 'quote.accepted' | 'quote.declined',
  params: {
    tenantId: string;
    quoteId: string;
    quoteTitle: string;
    customerId: string;
    status?: string;
    eventId?: string;
  },
): Promise<{ ok: boolean; suppressed?: true }> {
  return emitTenantWebhook({
    admin,
    tenantId: params.tenantId,
    eventType: event,
    eventId: params.eventId,
    data: {
      quote_id: params.quoteId,
      customer_id: params.customerId,
      title: params.quoteTitle,
      status: params.status ?? event.split('.')[1],
    },
  });
}
