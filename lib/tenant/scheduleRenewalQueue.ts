import type { SupabaseClient } from '@supabase/supabase-js';
import { formatCustomerDisplayName } from '@/lib/tenant/customerIdentityName';
import type { Database } from '@/lib/supabase/database.types';

export interface ScheduleRenewalReminder {
  customerId: string;
  customerName: string;
  quoteId: string;
  quoteTitle: string;
  href: string;
}

type Admin = SupabaseClient<Database>;

/**
 * Customers with recurring accepted quotes, at least one completed visit,
 * and no remaining scheduled visits — office should book the next block.
 */
export async function listScheduleRenewalReminders(
  admin: Admin,
  tenantId: string,
): Promise<ScheduleRenewalReminder[]> {
  const [{ data: scheduledRows }, { data: completedRows }, { data: quotes }] = await Promise.all([
    admin
      .from('tenant_scheduled_visits')
      .select('customer_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'scheduled'),
    admin
      .from('tenant_scheduled_visits')
      .select('customer_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'completed'),
    admin
      .from('tenant_quotes')
      .select(
        `
        id,
        title,
        customer_id,
        customers (
          customer_identities (
            first_name,
            last_name,
            full_name
          )
        ),
        tenant_quote_line_items (
          frequency
        )
      `,
      )
      .eq('tenant_id', tenantId)
      .eq('status', 'accepted')
      .is('superseded_by_quote_id', null),
  ]);

  const hasScheduled = new Set((scheduledRows ?? []).map((row) => row.customer_id).filter(Boolean));
  const hasCompleted = new Set((completedRows ?? []).map((row) => row.customer_id).filter(Boolean));

  const reminders: ScheduleRenewalReminder[] = [];
  const seenCustomers = new Set<string>();

  for (const quote of quotes ?? []) {
    const customerId = quote.customer_id;
    if (!customerId || hasScheduled.has(customerId) || !hasCompleted.has(customerId)) continue;
    if (seenCustomers.has(customerId)) continue;

    const lines = quote.tenant_quote_line_items ?? [];
    const hasRecurring = lines.some((line) => line.frequency !== 'one_time');
    if (!hasRecurring) continue;

    seenCustomers.add(customerId);
    const identity = quote.customers?.customer_identities;
    const customerName = identity ? formatCustomerDisplayName(identity) : 'Customer';

    reminders.push({
      customerId,
      customerName,
      quoteId: quote.id,
      quoteTitle: quote.title.trim() || 'Quote',
      href: `/schedule/new?customer_id=${encodeURIComponent(customerId)}&quote_id=${encodeURIComponent(quote.id)}`,
    });
  }

  return reminders.sort((a, b) => a.customerName.localeCompare(b.customerName));
}

export async function countScheduleRenewalReminders(
  admin: Admin,
  tenantId: string,
): Promise<number> {
  const reminders = await listScheduleRenewalReminders(admin, tenantId);
  return reminders.length;
}
