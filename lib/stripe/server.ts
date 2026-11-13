import Stripe from 'stripe';
import { serverEnv } from '@/lib/env';
import { isOutboundSuppressed } from '@/lib/outbound/suppression';
import { suppressedStripeClient } from '@/lib/outbound/stripeSuppressed';

let stripeSingleton: Stripe | null | undefined;

/**
 * Returns null when Stripe is not configured (local dev).
 * When outbound suppression is on, returns a local client even if the secret is unset.
 */
export function getStripe(): Stripe | null {
  if (isOutboundSuppressed()) return suppressedStripeClient();
  if (stripeSingleton !== undefined) return stripeSingleton;
  const key = serverEnv.STRIPE_SECRET_KEY;
  if (!key) {
    stripeSingleton = null;
    return stripeSingleton;
  }
  stripeSingleton = new Stripe(key);
  return stripeSingleton;
}
