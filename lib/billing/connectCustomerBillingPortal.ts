import { serverEnv } from '@/lib/env';
import type Stripe from 'stripe';

/**
 * Customer Billing Portal on the connected Express account (manage payment methods).
 */
export async function createConnectCustomerBillingPortalSession(options: {
  stripe: Stripe;
  stripeAccountId: string;
  stripeCustomerId: string;
  returnUrl: string;
}): Promise<string | null> {
  const cfg = serverEnv.STRIPE_CONNECT_BILLING_PORTAL_CONFIGURATION_ID?.trim();
  try {
    const session = await options.stripe.billingPortal.sessions.create(
      {
        customer: options.stripeCustomerId,
        return_url: options.returnUrl,
        ...(cfg ? { configuration: cfg } : {}),
      },
      { stripeAccount: options.stripeAccountId },
    );
    return session.url;
  } catch {
    return null;
  }
}
