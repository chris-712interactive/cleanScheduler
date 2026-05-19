import type Stripe from 'stripe';
import { serverEnv } from '@/lib/env';

/** Platform (your account) + Connect destinations each have their own signing secret in Stripe. */
export function listStripeWebhookSecrets(): string[] {
  return [
    serverEnv.STRIPE_WEBHOOK_SECRET?.trim(),
    serverEnv.STRIPE_CONNECT_WEBHOOK_SECRET?.trim(),
  ].filter((secret): secret is string => Boolean(secret));
}

/**
 * Verify a webhook using the platform secret and/or the Connect destination secret.
 * Stripe event destinations are scoped to either "Your account" or "Connected accounts"
 * (not both on one destination), so register two destinations and set both env vars.
 */
export function constructStripeWebhookEvent(
  stripe: Stripe,
  rawBody: string,
  signature: string,
): Stripe.Event {
  const secrets = listStripeWebhookSecrets();
  if (secrets.length === 0) {
    throw new Error('No Stripe webhook signing secrets configured');
  }

  let lastError: unknown;
  for (const secret of secrets) {
    try {
      return stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Invalid Stripe webhook signature');
}
