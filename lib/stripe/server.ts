import Stripe from 'stripe';
import { serverEnv } from '@/lib/env';

let stripeSingleton: Stripe | null | undefined;

/** Returns null when Stripe is not configured (local dev). */
export function getStripe(): Stripe | null {
  if (stripeSingleton !== undefined) return stripeSingleton;
  const key = serverEnv.STRIPE_SECRET_KEY;
  if (!key) {
    stripeSingleton = null;
    return stripeSingleton;
  }
  stripeSingleton = new Stripe(key);
  return stripeSingleton;
}
