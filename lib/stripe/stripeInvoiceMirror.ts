import type Stripe from 'stripe';

export type TenantInvoiceStatus = 'draft' | 'open' | 'paid' | 'void';

export function stripeCustomerIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const customer = invoice.customer;
  return typeof customer === 'string' ? customer : (customer?.id ?? null);
}

export function stripeSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const subscription = invoice.subscription;
  return typeof subscription === 'string' ? subscription : (subscription?.id ?? null);
}

export function mapStripeInvoiceStatus(status: Stripe.Invoice.Status | null): TenantInvoiceStatus {
  switch (status) {
    case 'draft':
      return 'draft';
    case 'paid':
      return 'paid';
    case 'void':
      return 'void';
    case 'open':
    case 'uncollectible':
    default:
      return 'open';
  }
}

export function invoiceTitleFromStripe(invoice: Stripe.Invoice): string {
  const line = invoice.lines?.data?.[0];
  const desc = line?.description?.trim();
  if (desc) return desc;
  const sub =
    typeof invoice.subscription === 'object' && invoice.subscription
      ? invoice.subscription.metadata?.service_plan_id
      : null;
  if (sub) return 'Subscription invoice';
  return invoice.number ? `Invoice ${invoice.number}` : 'Stripe invoice';
}

export function stripeInvoiceAmountCents(invoice: Stripe.Invoice): number {
  return invoice.total ?? invoice.amount_due ?? 0;
}

export function stripeInvoicePaidCents(invoice: Stripe.Invoice): number {
  return invoice.amount_paid ?? 0;
}
