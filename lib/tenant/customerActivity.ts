import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export interface CustomerActivityQuote {
  id: string;
  title: string;
  status: string;
  amountCents: number;
  createdAt: string;
}

export interface CustomerActivityInvoice {
  id: string;
  title: string;
  status: string;
  amountCents: number;
  amountPaidCents: number;
  createdAt: string;
}

export interface CustomerActivityVisit {
  id: string;
  title: string;
  status: string;
  startsAt: string;
}

export interface CustomerActivityPayment {
  id: string;
  amountCents: number;
  method: string;
  recordedAt: string;
  invoiceId: string;
  invoiceTitle: string;
}

export interface CustomerActivitySnapshot {
  quotes: CustomerActivityQuote[];
  invoices: CustomerActivityInvoice[];
  visits: CustomerActivityVisit[];
  payments: CustomerActivityPayment[];
}

const LIST_LIMIT = 8;

export async function getCustomerActivitySnapshot(
  db: SupabaseClient<Database>,
  tenantId: string,
  customerId: string,
): Promise<CustomerActivitySnapshot> {
  const [quotesRes, invoicesRes, visitsRes] = await Promise.all([
    db
      .from('tenant_quotes')
      .select('id, title, status, amount_cents, created_at')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .is('superseded_by_quote_id', null)
      .order('created_at', { ascending: false })
      .limit(LIST_LIMIT),
    db
      .from('tenant_invoices')
      .select('id, title, status, amount_cents, amount_paid_cents, created_at')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(LIST_LIMIT),
    db
      .from('tenant_scheduled_visits')
      .select('id, title, status, starts_at')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .order('starts_at', { ascending: false })
      .limit(LIST_LIMIT),
  ]);

  const invoices = invoicesRes.data ?? [];
  const invoiceIds = invoices.map((row) => row.id);

  let payments: CustomerActivityPayment[] = [];
  if (invoiceIds.length > 0) {
    const { data: paymentRows } = await db
      .from('tenant_invoice_payments')
      .select(
        `
        id,
        amount_cents,
        method,
        recorded_at,
        invoice_id,
        tenant_invoices ( title )
      `,
      )
      .eq('tenant_id', tenantId)
      .in('invoice_id', invoiceIds)
      .order('recorded_at', { ascending: false })
      .limit(LIST_LIMIT);

    payments = (paymentRows ?? []).map((row) => ({
      id: row.id,
      amountCents: row.amount_cents ?? 0,
      method: row.method,
      recordedAt: row.recorded_at,
      invoiceId: row.invoice_id,
      invoiceTitle:
        (row.tenant_invoices as { title: string } | null)?.title?.trim() || 'Invoice',
    }));
  }

  return {
    quotes: (quotesRes.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      amountCents: row.amount_cents ?? 0,
      createdAt: row.created_at,
    })),
    invoices: invoices.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      amountCents: row.amount_cents ?? 0,
      amountPaidCents: row.amount_paid_cents,
      createdAt: row.created_at,
    })),
    visits: (visitsRes.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      startsAt: row.starts_at,
    })),
    payments,
  };
}
