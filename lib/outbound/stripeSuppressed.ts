import type Stripe from 'stripe';
import { logOutboundSuppressed, suppressedId } from '@/lib/outbound/suppression';

const LIST_METHODS = new Set(['list', 'listLineItems', 'search']);

function stripeResult(path: string[]): Record<string, unknown> {
  const method = path[path.length - 1] ?? 'call';
  const resource = path.slice(0, -1).join('.');
  logOutboundSuppressed('stripe', `${resource}.${method}`);
  const id = suppressedId('stripe', `${resource}_${method}`);
  if (LIST_METHODS.has(method)) {
    return { object: 'list', data: [], has_more: false, url: '/v1/suppressed' };
  }
  if (resource === 'prices' && method === 'retrieve') {
    return { id, object: 'price', unit_amount: null, recurring: null, livemode: false };
  }
  if (resource === 'accounts') {
    return {
      id,
      object: 'account',
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
      email: null,
      requirements: { disabled_reason: null, currently_due: [] },
      livemode: false,
    };
  }
  if (
    resource === 'accountLinks' ||
    resource.endsWith('sessions') ||
    resource === 'checkout.sessions'
  ) {
    return {
      id,
      object: resource,
      url: `https://outbound-suppressed.invalid/${id}`,
      mode: 'payment',
      payment_status: 'unpaid',
      status: 'open',
      metadata: {},
      amount_total: null,
      livemode: false,
    };
  }
  return {
    id,
    object: resource.split('.').pop() ?? 'suppressed',
    status: method === 'cancel' ? 'canceled' : 'succeeded',
    livemode: false,
    url: `https://outbound-suppressed.invalid/${id}`,
  };
}

function refuseWebhook(): never {
  throw new Error('Stripe webhook verification refused while outbound calls are suppressed.');
}

function stripeProxy(path: string[]): unknown {
  const callable = function suppressedStripeCall(): undefined {
    return undefined;
  };
  return new Proxy(callable, {
    get(_target, prop) {
      if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined;
      if (typeof prop !== 'string') return undefined;
      return stripeProxy([...path, prop]);
    },
    apply() {
      if (path.includes('constructEvent') || path[0] === 'webhooks') refuseWebhook();
      return Promise.resolve(stripeResult(path));
    },
  });
}

/** Stripe-shaped client. No method opens a socket. Webhook verification fails closed. */
export function suppressedStripeClient(): Stripe {
  return stripeProxy([]) as Stripe;
}
