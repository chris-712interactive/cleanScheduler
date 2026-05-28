import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { ReportSummaryLine } from '@/lib/reports/types';
import { formatUsdFromCents } from '@/lib/format/money';

export interface CohortLtvRow {
  cohortMonth: string;
  customersInCohort: number;
  monthsSinceFirst: number;
  activeCustomers: number;
  retentionPercent: number;
  revenueCents: number;
}

export interface CohortLtvResult {
  rows: CohortLtvRow[];
  summary: ReportSummaryLine[];
}

const MAX_COHORT_MONTHS = 12;

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function addMonths(yyyyMm: string, delta: number): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  const d = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export async function runCohortLtvReport(
  db: SupabaseClient<Database>,
  tenantId: string,
  fromIso: string | null,
  toIso: string | null,
): Promise<CohortLtvResult> {
  let query = db
    .from('tenant_invoice_payments')
    .select(
      `
      amount_cents,
      recorded_at,
      tenant_invoices ( customer_id )
    `,
    )
    .eq('tenant_id', tenantId)
    .gt('amount_cents', 0);

  if (fromIso) query = query.gte('recorded_at', fromIso);
  if (toIso) query = query.lte('recorded_at', toIso);

  const { data, error } = await query.limit(8000);
  if (error || !data?.length) {
    return {
      rows: [],
      summary: [{ label: 'Cohorts', value: '0' }],
    };
  }

  const firstMonthByCustomer = new Map<string, string>();
  const paymentsByCustomerMonth = new Map<string, number>();

  for (const row of data) {
    const customerId = row.tenant_invoices?.customer_id;
    if (!customerId) continue;
    const m = monthKey(row.recorded_at);
    const key = `${customerId}|${m}`;
    paymentsByCustomerMonth.set(key, (paymentsByCustomerMonth.get(key) ?? 0) + row.amount_cents);

    const existing = firstMonthByCustomer.get(customerId);
    if (!existing || m < existing) {
      firstMonthByCustomer.set(customerId, m);
    }
  }

  const cohortCustomers = new Map<string, Set<string>>();
  for (const [customerId, cohort] of firstMonthByCustomer) {
    const set = cohortCustomers.get(cohort) ?? new Set();
    set.add(customerId);
    cohortCustomers.set(cohort, set);
  }

  const rows: CohortLtvRow[] = [];

  for (const [cohortMonth, customers] of [...cohortCustomers.entries()].sort((a, b) =>
    b[0].localeCompare(a[0]),
  )) {
    const size = customers.size;
    for (let offset = 0; offset <= MAX_COHORT_MONTHS; offset += 1) {
      const activityMonth = addMonths(cohortMonth, offset);
      let active = 0;
      let revenue = 0;
      for (const customerId of customers) {
        const paid = paymentsByCustomerMonth.get(`${customerId}|${activityMonth}`) ?? 0;
        if (paid > 0) {
          active += 1;
          revenue += paid;
        }
      }
      rows.push({
        cohortMonth,
        customersInCohort: size,
        monthsSinceFirst: offset,
        activeCustomers: active,
        retentionPercent: size === 0 ? 0 : Math.round((active / size) * 1000) / 10,
        revenueCents: revenue,
      });
    }
  }

  const latestCohort = rows[0]?.cohortMonth ?? '—';
  const avgLtv =
    firstMonthByCustomer.size === 0
      ? 0
      : [...firstMonthByCustomer.keys()].reduce((sum, cid) => {
          let total = 0;
          for (const [key, cents] of paymentsByCustomerMonth) {
            if (key.startsWith(`${cid}|`)) total += cents;
          }
          return sum + total;
        }, 0) / firstMonthByCustomer.size;

  return {
    rows,
    summary: [
      { label: 'Latest cohort', value: latestCohort },
      { label: 'Customers tracked', value: String(firstMonthByCustomer.size) },
      { label: 'Avg lifetime revenue', value: formatUsdFromCents(Math.round(avgLtv)) },
    ],
  };
}
