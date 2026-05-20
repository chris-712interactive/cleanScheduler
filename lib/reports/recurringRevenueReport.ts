import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { customerLabelFromIdentity } from '@/lib/reports/customerLabel';
import { MRR_ACTIVE_STATUSES, normalizeToMonthlyCents } from '@/lib/reports/mrr';
import type { ReportSummaryLine } from '@/lib/reports/types';
import { formatUsdFromCents } from '@/lib/format/money';

export interface RecurringRevenueRow {
  subscriptionId: string;
  customerName: string;
  planName: string;
  status: string;
  monthlyCents: number;
  billingInterval: string;
  periodEnd: string | null;
}

export interface RecurringRevenueResult {
  rows: RecurringRevenueRow[];
  summary: ReportSummaryLine[];
}

export async function runRecurringRevenueReport(
  db: SupabaseClient<Database>,
  tenantId: string,
): Promise<RecurringRevenueResult> {
  const { data, error } = await db
    .from('customer_subscriptions')
    .select(
      `
      id,
      status,
      current_period_end,
      cancel_at_period_end,
      customers (
        customer_identities (
          first_name,
          last_name,
          full_name
        )
      ),
      service_plans (
        name,
        amount_cents,
        billing_interval
      )
    `,
    )
    .eq('tenant_id', tenantId)
    .in('status', MRR_ACTIVE_STATUSES);

  if (error || !data) {
    return { rows: [], summary: [{ label: 'MRR', value: '$0.00' }] };
  }

  const rows: RecurringRevenueRow[] = [];
  let mrrTotal = 0;

  for (const sub of data) {
    const plan = sub.service_plans;
    if (!plan) continue;

    const monthlyCents = normalizeToMonthlyCents(plan.billing_interval, plan.amount_cents);
    mrrTotal += monthlyCents;

    const ident = sub.customers?.customer_identities ?? null;
    rows.push({
      subscriptionId: sub.id,
      customerName: customerLabelFromIdentity(ident),
      planName: plan.name,
      status: sub.cancel_at_period_end ? `${sub.status} (cancel scheduled)` : sub.status,
      monthlyCents,
      billingInterval: plan.billing_interval,
      periodEnd: sub.current_period_end,
    });
  }

  rows.sort((a, b) => b.monthlyCents - a.monthlyCents);

  return {
    rows,
    summary: [
      { label: 'MRR', value: formatUsdFromCents(mrrTotal) },
      { label: 'Active subscriptions', value: String(rows.length) },
      { label: 'ARR', value: formatUsdFromCents(mrrTotal * 12) },
    ],
  };
}
