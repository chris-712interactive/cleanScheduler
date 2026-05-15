import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { parseCentsFromDollars } from '@/lib/billing/parseMoney';
import { sendTenantInvoiceEmailForInvoice } from '@/lib/billing/sendTenantInvoiceEmail';

type AdminClient = SupabaseClient<Database>;
type PaymentMethod = Database['public']['Enums']['tenant_payment_method'];

export interface CompleteVisitBillingInput {
  paymentCollected: boolean;
  collectedMethod?: 'cash' | 'check';
  checkNumber?: string;
  amountDollars: string;
}

export async function resolveVisitBillingAmountCents(
  admin: AdminClient,
  quoteId: string | null,
): Promise<number | null> {
  if (!quoteId) return null;
  const { data: quote } = await admin
    .from('tenant_quotes')
    .select('amount_cents')
    .eq('id', quoteId)
    .maybeSingle();
  if (quote?.amount_cents == null) return null;
  const cents = Number(quote.amount_cents);
  return Number.isFinite(cents) && cents > 0 ? cents : null;
}

function parseBillingAmountCents(
  amountDollars: string,
  quoteAmountCents: number | null,
): number | null {
  const fromForm = parseCentsFromDollars(amountDollars);
  if (fromForm != null && fromForm > 0) return fromForm;
  if (quoteAmountCents != null && quoteAmountCents > 0) return quoteAmountCents;
  return null;
}

async function createVisitInvoice(
  admin: AdminClient,
  params: {
    tenantId: string;
    customerId: string;
    visitId: string;
    title: string;
    amountCents: number;
  },
): Promise<{ invoiceId: string } | { error: string }> {
  const { data, error } = await admin
    .from('tenant_invoices')
    .insert({
      tenant_id: params.tenantId,
      customer_id: params.customerId,
      visit_id: params.visitId,
      title: params.title,
      status: 'open',
      amount_cents: params.amountCents,
      amount_paid_cents: 0,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { error: error?.message ?? 'Could not create invoice.' };
  }
  return { invoiceId: data.id };
}

export async function applyVisitCompletionBilling(
  admin: AdminClient,
  params: {
    tenantId: string;
    tenantSlug: string;
    visitId: string;
    customerId: string;
    quoteId: string | null;
    visitTitle: string;
    billing: CompleteVisitBillingInput;
  },
): Promise<{ invoiceId: string; emailed: boolean; amountCents: number } | { error: string }> {
  const quoteAmountCents = await resolveVisitBillingAmountCents(admin, params.quoteId);
  const amountCents = parseBillingAmountCents(params.billing.amountDollars, quoteAmountCents);
  if (amountCents == null || amountCents <= 0) {
    return { error: 'Enter the job amount to bill.' };
  }

  const invoiceTitle = params.visitTitle.trim() || 'Service visit';

  if (params.billing.paymentCollected) {
    const method = params.billing.collectedMethod;
    if (method !== 'cash' && method !== 'check') {
      return { error: 'Select cash or check for on-site payment.' };
    }
    if (method === 'check') {
      const checkNumber = params.billing.checkNumber?.trim() ?? '';
      if (!checkNumber) {
        return { error: 'Check number is required.' };
      }
    }

    const created = await createVisitInvoice(admin, {
      tenantId: params.tenantId,
      customerId: params.customerId,
      visitId: params.visitId,
      title: invoiceTitle,
      amountCents,
    });
    if ('error' in created) return created;

    const notes =
      method === 'check'
        ? `Check #${params.billing.checkNumber?.trim()} (collected at job completion)`
        : 'Collected at job completion';

    const { error: payErr } = await admin.from('tenant_invoice_payments').insert({
      tenant_id: params.tenantId,
      invoice_id: created.invoiceId,
      amount_cents: amountCents,
      method: method as PaymentMethod,
      notes,
    });

    if (payErr) {
      return { error: payErr.message };
    }

    return { invoiceId: created.invoiceId, emailed: false, amountCents };
  }

  const created = await createVisitInvoice(admin, {
    tenantId: params.tenantId,
    customerId: params.customerId,
    visitId: params.visitId,
    title: invoiceTitle,
    amountCents,
  });
  if ('error' in created) return created;

  const sent = await sendTenantInvoiceEmailForInvoice(admin, {
    tenantId: params.tenantId,
    tenantSlug: params.tenantSlug,
    invoiceId: created.invoiceId,
  });

  if (!sent.ok) {
    return { error: sent.error };
  }

  return { invoiceId: created.invoiceId, emailed: true, amountCents };
}
