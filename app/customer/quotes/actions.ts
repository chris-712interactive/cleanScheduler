'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { sendQuoteNotificationEmail } from '@/lib/tenant/quoteNotifications';
import type { Database } from '@/lib/supabase/database.types';

export type CustomerQuoteResponseState = { error?: string; success?: boolean };

function clientIpFromHeaders(h: Headers): string | null {
  const fwd = h.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  const real = h.get('x-real-ip')?.trim();
  if (real) return real.slice(0, 128);
  return null;
}

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
    .select('id, tenant_id, customer_id, status, is_locked, title')
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

  const h = await headers();
  const ua = (h.get('user-agent') ?? '').slice(0, 2000);
  const ip = clientIpFromHeaders(h);

  if (decision === 'accept') {
    const kindRaw = String(formData.get('signature_kind') ?? 'typed_name').trim();
    const kind: Database['public']['Enums']['quote_acceptance_signature_kind'] =
      kindRaw === 'drawn_png' ? 'drawn_png' : 'typed_name';

    let typedFullName: string | null = null;
    let drawnBase64: string | null = null;

    if (kind === 'typed_name') {
      typedFullName = String(formData.get('typed_full_name') ?? '').trim();
      if (typedFullName.length < 2) {
        return { error: 'Type your full name exactly as you are signing this agreement.' };
      }
    } else {
      drawnBase64 = String(formData.get('drawn_signature_data') ?? '').trim();
      if (
        drawnBase64.length < 200 ||
        drawnBase64.length > 900_000 ||
        !drawnBase64.startsWith('data:image/')
      ) {
        return { error: 'Draw your signature in the box, or switch to typing your full name.' };
      }
    }

    const insSign = await admin.from('tenant_quote_acceptance_e_signatures').insert({
      quote_id: quoteId,
      signer_auth_user_id: auth.user.id,
      signature_kind: kind,
      typed_full_name: typedFullName,
      drawn_png_base64: drawnBase64,
      client_ip: ip,
      user_agent: ua || null,
    });

    if (insSign.error) {
      return { error: insSign.error.message };
    }
  }

  const nextStatus = decision === 'accept' ? 'accepted' : 'declined';
  const upd = await admin
    .from('tenant_quotes')
    .update({ status: nextStatus })
    .eq('id', quoteId)
    .eq('tenant_id', quote.tenant_id);

  if (upd.error) {
    if (decision === 'accept') {
      await admin.from('tenant_quote_acceptance_e_signatures').delete().eq('quote_id', quoteId);
    }
    const msg = upd.error.message ?? '';
    if (msg.includes('QUOTE_ACCEPT_REQUIRES_ESIGNATURE')) {
      return { error: 'Signature could not be recorded. Please try again.' };
    }
    return { error: msg };
  }

  if (decision === 'accept') {
    await sendQuoteNotificationEmail(admin, 'quote_accepted', {
      tenantId: quote.tenant_id as string,
      quoteId,
      quoteTitle: (quote.title as string) ?? 'Quote',
      customerId: quote.customer_id as string,
    });
  } else {
    await sendQuoteNotificationEmail(admin, 'quote_declined', {
      tenantId: quote.tenant_id as string,
      quoteId,
      quoteTitle: (quote.title as string) ?? 'Quote',
      customerId: quote.customer_id as string,
    });
  }

  revalidatePath('/customer', 'layout');
  revalidatePath('/customer/quotes', 'page');
  revalidatePath(`/customer/quotes/${quoteId}`, 'page');
  revalidatePath('/tenant', 'layout');
  revalidatePath('/tenant/quotes', 'page');
  revalidatePath(`/tenant/quotes/${quoteId}`, 'page');
  return { success: true };
}
