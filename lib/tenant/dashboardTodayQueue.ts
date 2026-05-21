import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { getTenantOutstandingInvoicesSummary } from '@/lib/billing/outstandingInvoices';
import { countPendingRescheduleRequests } from '@/lib/tenant/pendingRescheduleRequestCount';
import { getTenantTodaysJobsSummary } from '@/lib/tenant/todaysJobs';

export interface DashboardTodayQueueItem {
  id: string;
  label: string;
  detail: string;
  href: string;
  tone: 'brand' | 'warn' | 'muted';
}

export interface DashboardTodayQueue {
  pendingReschedules: number;
  todaysJobCount: number;
  outstandingCount: number;
  pastDueCount: number;
  awaitingReceiptCount: number;
  awaitingDepositCount: number;
  matchSuggestionCount: number;
  items: DashboardTodayQueueItem[];
}

export async function getDashboardTodayQueue(
  db: SupabaseClient<Database>,
  tenantId: string,
): Promise<DashboardTodayQueue> {
  const [
    pendingReschedules,
    todaysJobs,
    outstanding,
    awaitingReceiptRes,
    awaitingDepositRes,
    matchSuggestionRes,
  ] = await Promise.all([
    countPendingRescheduleRequests(db, tenantId),
    getTenantTodaysJobsSummary(db, tenantId),
    getTenantOutstandingInvoicesSummary(db, tenantId),
    db
      .from('tenant_invoice_payments')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('recorded_via', 'manual')
      .is('received_at', null),
    db
      .from('tenant_invoice_payments')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('recorded_via', 'manual')
      .not('received_at', 'is', null)
      .is('deposited_at', null),
    db
      .from('payment_match_suggestions')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'suggested'),
  ]);

  const awaitingReceiptCount = awaitingReceiptRes.count ?? 0;
  const awaitingDepositCount = awaitingDepositRes.count ?? 0;
  const matchSuggestionCount = matchSuggestionRes.count ?? 0;

  const items: DashboardTodayQueueItem[] = [];

  if (pendingReschedules > 0) {
    items.push({
      id: 'reschedule',
      label: `${pendingReschedules} reschedule request${pendingReschedules === 1 ? '' : 's'}`,
      detail: 'Customers waiting on a new time',
      href: '/schedule/reschedule-requests',
      tone: 'warn',
    });
  }

  if (todaysJobs.count > 0) {
    items.push({
      id: 'schedule',
      label: `${todaysJobs.count} job${todaysJobs.count === 1 ? '' : 's'} today`,
      detail:
        todaysJobs.scheduledCount > 0
          ? `${todaysJobs.scheduledCount} still scheduled`
          : 'Review the day board',
      href: `/schedule?date=${todaysJobs.todayKey}&view=day`,
      tone: 'brand',
    });
  }

  if (outstanding.pastDueCount > 0) {
    items.push({
      id: 'overdue',
      label: `${outstanding.pastDueCount} overdue invoice${outstanding.pastDueCount === 1 ? '' : 's'}`,
      detail: `${outstanding.invoiceCount} open with balance due`,
      href: '/billing/invoices',
      tone: 'warn',
    });
  } else if (outstanding.invoiceCount > 0) {
    items.push({
      id: 'outstanding',
      label: `${outstanding.invoiceCount} open invoice${outstanding.invoiceCount === 1 ? '' : 's'}`,
      detail: 'Follow up on collections',
      href: '/billing/invoices',
      tone: 'brand',
    });
  }

  if (awaitingReceiptCount > 0) {
    items.push({
      id: 'audit-receipt',
      label: `${awaitingReceiptCount} payment${awaitingReceiptCount === 1 ? '' : 's'} awaiting receipt`,
      detail: 'Checks and cash not yet marked received',
      href: '/billing/payment-audits?filter=awaiting_receipt',
      tone: 'warn',
    });
  }

  if (awaitingDepositCount > 0) {
    items.push({
      id: 'audit-deposit',
      label: `${awaitingDepositCount} payment${awaitingDepositCount === 1 ? '' : 's'} awaiting deposit`,
      detail: 'Mark when deposited to the bank',
      href: '/billing/payment-audits?filter=awaiting_deposit',
      tone: 'brand',
    });
  }

  if (matchSuggestionCount > 0) {
    items.push({
      id: 'bank-match',
      label: `${matchSuggestionCount} bank deposit match${matchSuggestionCount === 1 ? '' : 'es'}`,
      detail: 'Review suggested invoice matches',
      href: '/billing/bank-connection',
      tone: 'brand',
    });
  }

  return {
    pendingReschedules,
    todaysJobCount: todaysJobs.count,
    outstandingCount: outstanding.invoiceCount,
    pastDueCount: outstanding.pastDueCount,
    awaitingReceiptCount,
    awaitingDepositCount,
    matchSuggestionCount,
    items,
  };
}
