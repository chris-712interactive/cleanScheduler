import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

/** Plaid amounts: negative = money in (credit). */
function isIncomingCredit(amountCents: number): boolean {
  return amountCents < 0;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export async function generatePaymentMatchSuggestions(
  admin: Admin,
  tenantId: string,
): Promise<number> {
  const { data: transactions } = await admin
    .from('bank_transactions')
    .select('id, amount_cents, name, merchant_name, posted_date')
    .eq('tenant_id', tenantId)
    .is('matched_payment_id', null)
    .eq('pending', false)
    .order('posted_date', { ascending: false })
    .limit(200);

  if (!transactions?.length) return 0;

  const { data: invoices } = await admin
    .from('tenant_invoices')
    .select('id, title, amount_cents, amount_paid_cents, due_date, customers ( customer_identities ( full_name, first_name, last_name ) )')
    .eq('tenant_id', tenantId)
    .eq('status', 'open');

  if (!invoices?.length) return 0;

  let created = 0;

  for (const tx of transactions) {
    if (!isIncomingCredit(tx.amount_cents)) continue;

    const creditCents = Math.abs(tx.amount_cents);
    const txText = normalizeText(`${tx.name ?? ''} ${tx.merchant_name ?? ''}`);

    let best: { invoiceId: string; score: number } | null = null;

    for (const inv of invoices) {
      const remaining = inv.amount_cents - inv.amount_paid_cents;
      if (remaining <= 0) continue;

      let score = 0;
      if (remaining === creditCents) score += 0.55;
      else if (Math.abs(remaining - creditCents) <= 100) score += 0.35;

      if (txText.includes('zelle')) score += 0.1;

      const ident = inv.customers?.customer_identities;
      const customerName = normalizeText(
        ident?.full_name ?? `${ident?.first_name ?? ''} ${ident?.last_name ?? ''}`,
      );
      if (customerName && txText.includes(customerName.split(' ')[0] ?? '')) {
        score += 0.2;
      }

      const title = normalizeText(inv.title);
      if (title && txText.includes(title.replace(/[^a-z0-9]/g, ''))) {
        score += 0.15;
      }

      if (score >= 0.5 && (!best || score > best.score)) {
        best = { invoiceId: inv.id, score: Math.min(score, 0.99) };
      }
    }

    if (!best) continue;

    await admin
      .from('payment_match_suggestions')
      .update({ status: 'dismissed' })
      .eq('bank_transaction_id', tx.id)
      .eq('status', 'suggested');

    const { error } = await admin.from('payment_match_suggestions').upsert(
      {
        tenant_id: tenantId,
        bank_transaction_id: tx.id,
        invoice_id: best.invoiceId,
        confidence_score: best.score,
        status: 'suggested',
      },
      { onConflict: 'bank_transaction_id,invoice_id' },
    );

    if (!error) created += 1;
  }

  return created;
}
