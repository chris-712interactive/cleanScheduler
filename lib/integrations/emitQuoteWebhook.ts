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
  },
): Promise<void> {
  await emitTenantWebhook({
    admin,
    tenantId: params.tenantId,
    eventType: event,
    data: {
      quote_id: params.quoteId,
      customer_id: params.customerId,
      title: params.quoteTitle,
      status: params.status ?? event.split('.')[1],
    },
  });
}
