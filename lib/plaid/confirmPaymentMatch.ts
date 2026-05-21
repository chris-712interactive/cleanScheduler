import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { recordTenantPaymentEvent } from '@/lib/audit/recordTenantPaymentEvent';

type Admin = SupabaseClient<Database>;

type PaymentMethod = Database['public']['Enums']['tenant_payment_method'];

function inferPaymentMethod(transaction: {
  payment_channel: string | null;
  name: string | null;
  merchant_name: string | null;
}): PaymentMethod {
  const text = `${transaction.payment_channel ?? ''} ${transaction.name ?? ''} ${transaction.merchant_name ?? ''}`.toLowerCase();
  if (text.includes('zelle')) return 'zelle';
  if (text.includes('ach') || text.includes('direct dep') || transaction.payment_channel === 'online') {
    return 'ach';
  }
  return 'other';
}

export async function matchBankDepositToInvoice(
  admin: Admin,
  tenantId: string,
  bankTransactionId: string,
  invoiceId: string,
): Promise<{ paymentId: string }> {
  const [{ data: transaction, error: txErr }, { data: invoice, error: invErr }] = await Promise.all([
    admin
      .from('bank_transactions')
      .select(
        'id, amount_cents, payment_channel, name, merchant_name, matched_payment_id, pending, posted_date',
      )
      .eq('id', bankTransactionId)
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    admin
      .from('tenant_invoices')
      .select('id, amount_cents, amount_paid_cents, status, title')
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .maybeSingle(),
  ]);

  if (txErr || !transaction) throw new Error('Bank transaction not found.');
  if (transaction.matched_payment_id) throw new Error('This bank deposit is already matched.');
  if (transaction.pending) throw new Error('Pending transactions cannot be matched yet.');
  if (transaction.amount_cents >= 0) throw new Error('Only incoming deposits can be matched.');

  if (invErr || !invoice || invoice.status === 'void' || invoice.status === 'draft') {
    throw new Error('Invoice not found or not open for payment.');
  }

  const creditCents = Math.abs(transaction.amount_cents);
  const remaining = invoice.amount_cents - invoice.amount_paid_cents;
  if (remaining <= 0) throw new Error('Invoice is already paid.');
  const payAmount = Math.min(creditCents, remaining);

  const method = inferPaymentMethod(transaction);
  const notes = `Matched from bank deposit (${transaction.name ?? transaction.merchant_name ?? 'Plaid'})`;
  const depositedAt = `${transaction.posted_date}T12:00:00.000Z`;

  const { data: payment, error: payErr } = await admin
    .from('tenant_invoice_payments')
    .insert({
      tenant_id: tenantId,
      invoice_id: invoice.id,
      amount_cents: payAmount,
      method,
      notes,
      recorded_via: 'manual',
      received_at: depositedAt,
      deposited_at: depositedAt,
    })
    .select('id')
    .single();

  if (payErr || !payment) {
    throw new Error(payErr?.message ?? 'Could not record payment.');
  }

  const { error: txUpdateErr } = await admin
    .from('bank_transactions')
    .update({ matched_payment_id: payment.id })
    .eq('id', transaction.id)
    .eq('tenant_id', tenantId);

  if (txUpdateErr) throw new Error(txUpdateErr.message);

  await admin
    .from('payment_match_suggestions')
    .update({ status: 'dismissed' })
    .eq('bank_transaction_id', transaction.id)
    .eq('status', 'suggested');

  await recordTenantPaymentEvent(admin, {
    tenantId,
    paymentId: payment.id,
    invoiceId: invoice.id,
    bankTransactionId: transaction.id,
    action: 'bank.matched',
    detail: `Matched bank deposit to invoice ${invoice.title}`,
  });

  return { paymentId: payment.id };
}

export async function confirmPaymentMatchSuggestion(
  admin: Admin,
  tenantId: string,
  suggestionId: string,
): Promise<{ paymentId: string }> {
  const { data: suggestion, error: suggestionErr } = await admin
    .from('payment_match_suggestions')
    .select('id, tenant_id, bank_transaction_id, invoice_id, status')
    .eq('id', suggestionId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (suggestionErr || !suggestion) {
    throw new Error('Match suggestion not found.');
  }
  if (suggestion.status !== 'suggested') {
    throw new Error('This suggestion has already been handled.');
  }

  const result = await matchBankDepositToInvoice(
    admin,
    tenantId,
    suggestion.bank_transaction_id,
    suggestion.invoice_id,
  );

  const { error: confirmErr } = await admin
    .from('payment_match_suggestions')
    .update({ status: 'confirmed' })
    .eq('id', suggestion.id);

  if (confirmErr) throw new Error(confirmErr.message);

  return result;
}
