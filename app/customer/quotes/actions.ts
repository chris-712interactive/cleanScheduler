'use server';

import { revalidatePath } from 'next/cache';
import { invalidateCustomerQuoteBadge } from '@/lib/portal/invalidatePortalCache';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { sendQuoteNotificationEmail } from '@/lib/tenant/quoteNotifications';
import { sendQuoteNotificationSms } from '@/lib/sms/quoteNotificationSms';
import { emitQuoteWebhookEvent } from '@/lib/integrations/emitQuoteWebhook';
import {
  loadTenantOperationalSettings,
  resolveRequiredPreferredPaymentMethod,
} from '@/lib/tenant/loadTenantOperationalSettings';
import { applyQuoteAcceptanceFollowUp } from '@/lib/tenant/quoteAcceptanceFollowUp';
import { applyCustomerQuotePromotions } from '@/lib/promotions/applyCustomerQuotePromotions';
import { finalizeQuotePromotionsOnAccept } from '@/lib/promotions/quotePromotions';
import type { Database } from '@/lib/supabase/database.types';
import { applyQuoteStatusAndStage } from '@/lib/tenant/quotePipelineStages';

import type { CustomerQuoteResponsePatch } from '@/lib/tenant/customerQuoteResponsePatch';

export type CustomerQuoteResponseState = {
  error?: string;
  success?: boolean;
  quoteResponse?: CustomerQuoteResponsePatch;
};

export type CustomerQuotePromotionActionState = {
  error?: string;
  success?: boolean;
};

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

export async function applyCustomerQuotePromotionsAction(
  _prev: CustomerQuotePromotionActionState,
  formData: FormData,
): Promise<CustomerQuotePromotionActionState> {
  const quoteId = String(formData.get('quote_id') ?? '').trim();
  if (!quoteId) {
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

  if (quote.status !== 'sent' || quote.is_locked) {
    return { error: 'This quote is not open for promotion changes.' };
  }

  const result = await applyCustomerQuotePromotions(admin, {
    tenantId: quote.tenant_id as string,
    quoteId,
    customerId: quote.customer_id as string,
    rawPromoCode: String(formData.get('promo_code') ?? ''),
    rawWalletCreditDollars: String(formData.get('wallet_credit_dollars') ?? ''),
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath(`/quotes/${quoteId}`, 'page');
  revalidatePath('/quotes', 'page');
  revalidatePath('/', 'page');
  revalidatePath('/referrals', 'page');

  return { success: true };
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
    .select('id, tenant_id, customer_id, status, is_locked, title, amount_cents, currency')
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

  let preferredPaymentMethod: Database['public']['Enums']['tenant_payment_method'] | null = null;

  if (decision === 'accept') {
    const ops = await loadTenantOperationalSettings(admin, quote.tenant_id as string);
    const preferredResult = resolveRequiredPreferredPaymentMethod(
      ops,
      String(formData.get('preferred_payment_method') ?? ''),
    );
    if (typeof preferredResult === 'object' && 'error' in preferredResult) {
      return { error: preferredResult.error };
    }
    preferredPaymentMethod = preferredResult;

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
      preferred_payment_method: preferredPaymentMethod,
    });

    if (insSign.error) {
      return { error: insSign.error.message };
    }
  }

  const nextStatus = decision === 'accept' ? 'accepted' : 'declined';
  const upd = await applyQuoteStatusAndStage(admin, quote.tenant_id as string, quoteId, nextStatus);

  if (upd.error) {
    if (decision === 'accept') {
      await admin.from('tenant_quote_acceptance_e_signatures').delete().eq('quote_id', quoteId);
    }
    const msg = upd.error ?? '';
    if (msg.includes('QUOTE_ACCEPT_REQUIRES_ESIGNATURE')) {
      return { error: 'Signature could not be recorded. Please try again.' };
    }
    return { error: msg };
  }

  if (decision === 'accept') {
    await finalizeQuotePromotionsOnAccept(admin, {
      tenantId: quote.tenant_id as string,
      quoteId,
      customerId: quote.customer_id as string,
    });

    const ops = await loadTenantOperationalSettings(admin, quote.tenant_id as string);
    const followUp = await applyQuoteAcceptanceFollowUp(admin, {
      tenantId: quote.tenant_id as string,
      quoteId,
      customerId: quote.customer_id as string,
      quoteTitle: (quote.title as string) ?? 'Quote',
      amountCents: quote.amount_cents as number | null,
      currency: (quote.currency as string) ?? 'usd',
      ops,
    });

    if (followUp.skippedAutoScheduleReason) {
      console.error(
        '[respondToCustomerQuote] auto-schedule skipped:',
        followUp.skippedAutoScheduleReason,
        { quoteId },
      );
    }

    if (followUp.autoScheduleVisitIds?.length || followUp.autoScheduleVisitId) {
      revalidatePath('/schedule', 'page');
      revalidatePath('/tenant/schedule', 'page');
      revalidatePath('/quotes', 'page');
    }

    await sendQuoteNotificationEmail(admin, 'quote_accepted', {
      tenantId: quote.tenant_id as string,
      quoteId,
      quoteTitle: (quote.title as string) ?? 'Quote',
      customerId: quote.customer_id as string,
    });
    await sendQuoteNotificationSms(admin, 'quote_accepted', {
      tenantId: quote.tenant_id as string,
      quoteId,
      quoteTitle: (quote.title as string) ?? 'Quote',
      customerId: quote.customer_id as string,
    });
    await emitQuoteWebhookEvent(admin, 'quote.accepted', {
      tenantId: quote.tenant_id as string,
      quoteId,
      quoteTitle: (quote.title as string) ?? 'Quote',
      customerId: quote.customer_id as string,
      status: 'accepted',
    });
  } else {
    await sendQuoteNotificationEmail(admin, 'quote_declined', {
      tenantId: quote.tenant_id as string,
      quoteId,
      quoteTitle: (quote.title as string) ?? 'Quote',
      customerId: quote.customer_id as string,
    });
    await sendQuoteNotificationSms(admin, 'quote_declined', {
      tenantId: quote.tenant_id as string,
      quoteId,
      quoteTitle: (quote.title as string) ?? 'Quote',
      customerId: quote.customer_id as string,
    });
    await emitQuoteWebhookEvent(admin, 'quote.declined', {
      tenantId: quote.tenant_id as string,
      quoteId,
      quoteTitle: (quote.title as string) ?? 'Quote',
      customerId: quote.customer_id as string,
      status: 'declined',
    });
  }

  revalidatePath('/customer/quotes', 'page');
  revalidatePath(`/customer/quotes/${quoteId}`, 'page');
  revalidatePath('/tenant/quotes', 'page');
  revalidatePath(`/tenant/quotes/${quoteId}`, 'page');
  revalidatePath('/tenant/billing/invoices', 'page');
  invalidateCustomerQuoteBadge(quote.customer_id as string);

  const acceptedAt = decision === 'accept' ? new Date().toISOString() : null;
  return {
    success: true,
    quoteResponse: {
      status: decision === 'accept' ? 'accepted' : 'declined',
      acceptedAt,
      canRespond: false,
    },
  };
}
