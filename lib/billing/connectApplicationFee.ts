import { serverEnv } from '@/lib/env';

export function parseConnectApplicationFeeBps(): number {
  const raw = serverEnv.STRIPE_CONNECT_APPLICATION_FEE_BPS;
  if (!raw) return 0;
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 0 || n > 10000) return 0;
  return n;
}

/** One-time Checkout `payment_intent_data.application_fee_amount` (cents). */
export function paymentIntentApplicationFeeAmountCents(
  remainingCents: number,
  feeBps: number,
): number | undefined {
  if (feeBps <= 0 || remainingCents <= 0) return undefined;
  const rawFee = Math.floor((remainingCents * feeBps) / 10000);
  const capped = Math.min(Math.max(0, rawFee), Math.max(0, remainingCents - 1));
  if (capped <= 0) return undefined;
  return capped;
}

/**
 * Subscription Checkout `subscription_data.application_fee_percent` (percent of
 * recurring invoice, 0–100 with up to 4 decimal places per Stripe).
 */
export function subscriptionApplicationFeePercent(feeBps: number): number | undefined {
  if (feeBps <= 0) return undefined;
  const pct = feeBps / 100;
  if (pct <= 0 || pct > 99) return undefined;
  return Math.round(pct * 10000) / 10000;
}
