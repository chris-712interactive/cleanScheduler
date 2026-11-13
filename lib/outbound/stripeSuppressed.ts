import type Stripe from 'stripe';
import {
  logOutboundSuppressed,
  OutboundSuppressedError,
  suppressedId,
} from '@/lib/outbound/suppression';

const LIST_METHODS = new Set(['list', 'listLineItems', 'search']);

/** These must not look like Stripe accepted money, an account, or a cancel. */
const REFUSE_SUCCESS = new Set([
  'refunds.create',
  'accounts.create',
  'accountLinks.create',
  'subscriptions.update',
  'subscriptions.cancel',
  'paymentIntents.create',
  'paymentIntents.confirm',
  'paymentIntents.capture',
  'charges.create',
  'checkout.sessions.create',
  'billingPortal.sessions.create',
]);

function operationKey(path: string[]): string {
  const method = path[path.length - 1] ?? 'call';
  const resource = path.slice(0, -1).join('.');
  return `${resource}.${method}`;
}

function stripeResult(path: string[]): Record<string, unknown> {
  const method = path[path.length - 1] ?? 'call';
  const resource = path.slice(0, -1).join('.');
  const key = operationKey(path);
  if (REFUSE_SUCCESS.has(key)) {
    logOutboundSuppressed('stripe', key);
    throw new OutboundSuppressedError();
  }
  logOutboundSuppressed('stripe', key);
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
      url: null,
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
    url: null,
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
      try {
        return Promise.resolve(stripeResult(path));
      } catch (error) {
        return Promise.reject(error);
      }
    },
  });
}

/** Stripe-shaped client. No method opens a socket. Webhook verification fails closed. */
export function suppressedStripeClient(): Stripe {
  return stripeProxy([]) as Stripe;
}
