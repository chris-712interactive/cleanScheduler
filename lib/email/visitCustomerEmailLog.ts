import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;
export type VisitCustomerEmailKind = Database['public']['Enums']['visit_customer_email_kind'];

export async function visitCustomerEmailAlreadyLogged(
  admin: Admin,
  params: { tenantId: string; visitId: string; kind: VisitCustomerEmailKind },
): Promise<boolean> {
  const { data } = await admin
    .from('tenant_visit_customer_email_log')
    .select('id')
    .eq('tenant_id', params.tenantId)
    .eq('visit_id', params.visitId)
    .eq('kind', params.kind)
    .maybeSingle();
  return !!data;
}

export async function logVisitCustomerEmail(
  admin: Admin,
  params: { tenantId: string; visitId: string; kind: VisitCustomerEmailKind },
): Promise<void> {
  await admin.from('tenant_visit_customer_email_log').insert({
    tenant_id: params.tenantId,
    visit_id: params.visitId,
    kind: params.kind,
  });
}
