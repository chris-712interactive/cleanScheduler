import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

/**
 * A customer belongs on the new-quote picker when the tenant imported them,
 * or when a consultation form was saved (or that consultation was completed).
 */
export function customerQualifiesForQuotePicker(input: {
  importedAt: string | null;
  consultationFormCompleted: boolean;
}): boolean {
  return Boolean(input.importedAt) || input.consultationFormCompleted;
}

export async function loadQuotePickerEligibleCustomerIds(
  admin: Admin,
  tenantId: string,
): Promise<{ ids: Set<string>; error: string | null }> {
  const [importedRes, intakeRes, completedRes] = await Promise.all([
    admin
      .from('customers')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .not('imported_at', 'is', null),
    admin
      .from('tenant_scheduled_visits')
      .select('customer_id')
      .eq('tenant_id', tenantId)
      .eq('visit_purpose', 'consultation')
      .neq('status', 'cancelled')
      .not('consultation_intake', 'is', null),
    admin
      .from('tenant_scheduled_visits')
      .select('customer_id')
      .eq('tenant_id', tenantId)
      .eq('visit_purpose', 'consultation')
      .eq('status', 'completed'),
  ]);

  const error =
    importedRes.error?.message ?? intakeRes.error?.message ?? completedRes.error?.message ?? null;
  if (error) return { ids: new Set(), error };

  const ids = new Set<string>();
  for (const row of importedRes.data ?? []) ids.add(row.id);
  for (const row of intakeRes.data ?? []) ids.add(row.customer_id);
  for (const row of completedRes.data ?? []) ids.add(row.customer_id);
  return { ids, error: null };
}

export async function customerQualifiesForNewQuote(
  admin: Admin,
  tenantId: string,
  customerId: string,
): Promise<boolean> {
  const { data: customer, error } = await admin
    .from('customers')
    .select('imported_at, status')
    .eq('id', customerId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error || !customer || customer.status !== 'active') return false;
  if (customer.imported_at) return true;

  const [completedRes, intakeRes] = await Promise.all([
    admin
      .from('tenant_scheduled_visits')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .eq('visit_purpose', 'consultation')
      .eq('status', 'completed'),
    admin
      .from('tenant_scheduled_visits')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .eq('visit_purpose', 'consultation')
      .neq('status', 'cancelled')
      .not('consultation_intake', 'is', null),
  ]);
  if (completedRes.error || intakeRes.error) return false;
  return (completedRes.count ?? 0) > 0 || (intakeRes.count ?? 0) > 0;
}
