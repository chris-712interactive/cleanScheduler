import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe/server';

const DEFAULT_ACCOUNT_COUNTRY = 'US';

export function assertStripeConfigured(): Stripe {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error('Stripe is not configured (set STRIPE_SECRET_KEY).');
  }
  return stripe;
}

export async function createExpressConnectedAccount(options: {
  tenantId: string;
  email?: string | null;
}): Promise<Stripe.Account> {
  const stripe = assertStripeConfigured();
  return stripe.accounts.create({
    type: 'express',
    country: DEFAULT_ACCOUNT_COUNTRY,
    email: options.email ?? undefined,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: {
      tenant_id: options.tenantId,
    },
  });
}

export async function createAccountOnboardingLink(options: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}): Promise<Stripe.AccountLink> {
  const stripe = assertStripeConfigured();
  return stripe.accountLinks.create({
    account: options.accountId,
    refresh_url: options.refreshUrl,
    return_url: options.returnUrl,
    type: 'account_onboarding',
  });
}

export async function retrieveConnectAccount(accountId: string): Promise<Stripe.Account> {
  const stripe = assertStripeConfigured();
  return stripe.accounts.retrieve(accountId);
}
