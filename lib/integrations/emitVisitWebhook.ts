import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { emitTenantWebhook } from '@/lib/integrations/emitTenantWebhook';

type Admin = SupabaseClient<Database>;

export async function emitVisitWebhookEvent(
  admin: Admin,
  event: 'visit.scheduled' | 'visit.completed',
  params: {
    tenantId: string;
    visitId: string;
    customerId: string;
    title: string;
    startsAt?: string;
    status?: string;
  },
): Promise<void> {
  await emitTenantWebhook({
    admin,
    tenantId: params.tenantId,
    eventType: event,
    data: {
      visit_id: params.visitId,
      customer_id: params.customerId,
      title: params.title,
      starts_at: params.startsAt ?? null,
      status: params.status ?? event.split('.')[1],
    },
  });
}
