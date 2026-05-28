import type Stripe from 'stripe';

/** Stripe resource id from a string id or expanded object. */
export function stripeResourceId(
  value: string | { id?: string } | null | undefined,
): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : (value.id ?? null);
}

/** Subscription id from a Basil-era invoice (`parent.subscription_details`). */
export function stripeSubscriptionFromInvoice(
  invoice: Stripe.Invoice,
): string | Stripe.Subscription | null {
  const details = invoice.parent?.subscription_details;
  if (!details?.subscription) return null;
  return details.subscription;
}

export function stripeSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  return stripeResourceId(stripeSubscriptionFromInvoice(invoice));
}

export function stripeSubscriptionMetadataFromInvoice(
  invoice: Stripe.Invoice,
): Stripe.Metadata | null {
  const parentMeta = invoice.parent?.subscription_details?.metadata;
  if (parentMeta && Object.keys(parentMeta).length > 0) return parentMeta;

  const sub = stripeSubscriptionFromInvoice(invoice);
  if (typeof sub === 'object' && sub?.metadata) return sub.metadata;

  return null;
}

/** PaymentIntent id from invoice payments (Basil) or last finalization error. */
export function stripePaymentIntentFromInvoice(
  invoice: Stripe.Invoice,
): string | Stripe.PaymentIntent | null {
  const payments = invoice.payments?.data ?? [];
  for (const payment of payments) {
    const pi = payment.payment?.payment_intent;
    if (pi) return pi;
  }

  const errPi = invoice.last_finalization_error?.payment_intent;
  if (errPi) return errPi;

  return null;
}

export function stripePaymentIntentIdFromInvoice(invoice: Stripe.Invoice): string | null {
  return stripeResourceId(stripePaymentIntentFromInvoice(invoice));
}

export function stripePaymentIntentLastErrorFromInvoice(
  invoice: Stripe.Invoice,
): Stripe.PaymentIntent.LastPaymentError | null | undefined {
  const pi = stripePaymentIntentFromInvoice(invoice);
  if (typeof pi === 'object' && pi) return pi.last_payment_error;
  return null;
}

/** Current billing period from subscription items (Basil moved period off Subscription). */
export function subscriptionPeriodBounds(subscription: Stripe.Subscription): {
  start: number | null;
  end: number | null;
} {
  const items = subscription.items?.data ?? [];
  if (items.length === 0) return { start: null, end: null };

  const first = items[0];
  if (!first) return { start: null, end: null };

  let start = first.current_period_start;
  let end = first.current_period_end;
  for (const item of items.slice(1)) {
    if (item.current_period_start < start) start = item.current_period_start;
    if (item.current_period_end > end) end = item.current_period_end;
  }

  return { start, end };
}

export function subscriptionPeriodIso(subscription: Stripe.Subscription): {
  start: string | null;
  end: string | null;
} {
  const { start, end } = subscriptionPeriodBounds(subscription);
  return {
    start: start != null ? new Date(start * 1000).toISOString() : null,
    end: end != null ? new Date(end * 1000).toISOString() : null,
  };
}

export async function retrieveConnectSubscription(
  stripe: Stripe,
  subscriptionId: string,
  connectAccountId: string,
  params?: Stripe.SubscriptionRetrieveParams,
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.retrieve(subscriptionId, params, {
    stripeAccount: connectAccountId,
  });
}
