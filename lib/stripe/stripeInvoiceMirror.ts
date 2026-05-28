import type Stripe from 'stripe';
import {
  stripeSubscriptionIdFromInvoice,
  stripeSubscriptionMetadataFromInvoice,
} from '@/lib/stripe/stripeBasilCompat';

export type TenantInvoiceStatus = 'draft' | 'open' | 'paid' | 'void';

export { stripeSubscriptionIdFromInvoice };

export function stripeCustomerIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const customer = invoice.customer;
  return typeof customer === 'string' ? customer : (customer?.id ?? null);
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

  const subMeta = stripeSubscriptionMetadataFromInvoice(invoice);
  if (subMeta?.service_plan_id) return 'Subscription invoice';

  return invoice.number ? `Invoice ${invoice.number}` : 'Stripe invoice';
}

export function stripeInvoiceAmountCents(invoice: Stripe.Invoice): number {
  return invoice.total ?? invoice.amount_due ?? 0;
}

export function stripeInvoicePaidCents(invoice: Stripe.Invoice): number {
  return invoice.amount_paid ?? 0;
}
