import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { TenantOperationalSettingsSnapshot } from '@/lib/tenant/loadTenantOperationalSettings';

type Admin = SupabaseClient<Database>;

export interface QuoteAcceptanceFollowUpInput {
  tenantId: string;
  quoteId: string;
  customerId: string;
  quoteTitle: string;
  amountCents: number | null;
  currency: string;
  ops: TenantOperationalSettingsSnapshot;
}

export interface QuoteAcceptanceFollowUpResult {
  prepayInvoiceId?: string;
  skippedPrepayReason?: string;
}

/**
 * Post-accept side effects driven by tenant operational settings.
 * Idempotent where possible (prepay invoice keyed by quote_id).
 */
export async function applyQuoteAcceptanceFollowUp(
  admin: Admin,
  input: QuoteAcceptanceFollowUpInput,
): Promise<QuoteAcceptanceFollowUpResult> {
  const result: QuoteAcceptanceFollowUpResult = {};

  if (input.ops.invoiceExpectation === 'prepay') {
    const invoiceResult = await ensurePrepayInvoiceForQuote(admin, input);
    if (invoiceResult.invoiceId) {
      result.prepayInvoiceId = invoiceResult.invoiceId;
    } else if (invoiceResult.skippedReason) {
      result.skippedPrepayReason = invoiceResult.skippedReason;
    }
  }

  // auto_schedule: stored for a future release — no visit materialization here yet.
  return result;
}

async function ensurePrepayInvoiceForQuote(
  admin: Admin,
  input: QuoteAcceptanceFollowUpInput,
): Promise<{ invoiceId?: string; skippedReason?: string }> {
  const amountCents = input.amountCents ?? 0;
  if (amountCents <= 0) {
    return { skippedReason: 'quote_has_no_amount' };
  }

  const { data: existing } = await admin
    .from('tenant_invoices')
    .select('id')
    .eq('tenant_id', input.tenantId)
    .eq('quote_id', input.quoteId)
    .maybeSingle();

  if (existing?.id) {
    return { invoiceId: existing.id };
  }

  const title = `Prepayment — ${input.quoteTitle.trim() || 'Quote'}`.slice(0, 200);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);

  const { data: created, error } = await admin
    .from('tenant_invoices')
    .insert({
      tenant_id: input.tenantId,
      customer_id: input.customerId,
      quote_id: input.quoteId,
      title,
      status: 'open',
      currency: input.currency || 'usd',
      amount_cents: amountCents,
      amount_paid_cents: 0,
      due_date: dueDate.toISOString(),
      notes: 'Created automatically when the customer accepted this quote (prepay setting).',
    })
    .select('id')
    .single();

  if (error || !created) {
    console.error('[quoteAcceptanceFollowUp] prepay invoice failed:', error?.message);
    return { skippedReason: 'invoice_create_failed' };
  }

  return { invoiceId: created.id };
}
