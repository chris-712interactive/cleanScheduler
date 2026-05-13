'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';

export type CustomerQuoteResponseState = { error?: string; success?: boolean };

export async function respondToCustomerQuote(
  _prev: CustomerQuoteResponseState,
  formData: FormData,
): Promise<CustomerQuoteResponseState> {
  const quoteId = String(formData.get('quote_id') ?? '').trim();
  const decision = String(formData.get('decision') ?? '').trim();

  if (!quoteId || (decision !== 'accept' && decision !== 'decline')) {
    return { error: 'Invalid request.' };
  }

  const auth = await requirePortalAccess('customer', `/quotes/${quoteId}`);
  const ctx = await getCustomerPortalContext(auth.user.id);
  if (!ctx) {
    return { error: 'Account not found.' };
  }

  const admin = createAdminClient();
  const { data: quote, error } = await admin
    .from('tenant_quotes')
    .select('id, tenant_id, customer_id, status, is_locked')
    .eq('id', quoteId)
    .maybeSingle();

  if (error || !quote?.customer_id) {
    return { error: 'Quote not found.' };
  }

  if (!ctx.customerIds.includes(quote.customer_id)) {
    return { error: 'Quote not found.' };
  }

  if (quote.status !== 'sent') {
    return { error: 'This quote is not open for a response right now.' };
  }

  if (quote.is_locked) {
    return { error: 'This quote is no longer open for changes.' };
  }

  const nextStatus = decision === 'accept' ? 'accepted' : 'declined';
  const upd = await admin
    .from('tenant_quotes')
    .update({ status: nextStatus })
    .eq('id', quoteId)
    .eq('tenant_id', quote.tenant_id);

  if (upd.error) {
    return { error: upd.error.message };
  }

  revalidatePath('/customer', 'layout');
  revalidatePath('/customer/quotes', 'page');
  revalidatePath(`/customer/quotes/${quoteId}`, 'page');
  revalidatePath('/tenant', 'layout');
  revalidatePath('/tenant/quotes', 'page');
  revalidatePath(`/tenant/quotes/${quoteId}`, 'page');
  return { success: true };
}