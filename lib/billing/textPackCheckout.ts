import { textPackPriceId, type TextPackKey } from '@/lib/billing/textPacks';
import { isOutboundSuppressed } from '@/lib/outbound/suppression';
import { getStripe } from '@/lib/stripe/server';

export async function createTextPackCheckoutUrl(params: {
  tenantId: string;
  tenantSlug: string;
  customerEmail: string;
  stripeCustomerId?: string | null;
  packKey: TextPackKey;
  successUrl: string;
  cancelUrl: string;
}): Promise<string | null> {
  if (isOutboundSuppressed()) return null;
  const stripe = getStripe();
  const priceId = textPackPriceId(params.packKey);
  if (!stripe || !priceId) return null;

  const existingCustomerId = params.stripeCustomerId?.trim() || null;
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    ...(existingCustomerId
      ? { customer: existingCustomerId }
      : { customer_email: params.customerEmail }),
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: {
      kind: 'text_pack',
      tenant_id: params.tenantId,
      tenant_slug: params.tenantSlug,
      pack_key: params.packKey,
    },
    success_url: `${params.successUrl}${params.successUrl.includes('?') ? '&' : '?'}checkout=text_pack`,
    cancel_url: params.cancelUrl,
  });

  return session.url;
}
