import { describe, expect, it } from 'vitest';
import {
  stripePaymentIntentIdFromInvoice,
  stripeSubscriptionIdFromInvoice,
  stripeSubscriptionMetadataFromInvoice,
  subscriptionPeriodBounds,
} from '@/lib/stripe/stripeBasilCompat';

describe('stripeBasilCompat', () => {
  it('reads subscription id from invoice parent', () => {
    const invoice = {
      id: 'in_1',
      object: 'invoice',
      parent: {
        type: 'subscription_details',
        subscription_details: { subscription: 'sub_123', metadata: {} },
        quote_details: null,
      },
    } as never;

    expect(stripeSubscriptionIdFromInvoice(invoice)).toBe('sub_123');
  });

  it('reads subscription metadata snapshot from invoice parent', () => {
    const invoice = {
      id: 'in_1',
      object: 'invoice',
      parent: {
        type: 'subscription_details',
        subscription_details: {
          subscription: 'sub_123',
          metadata: { service_plan_id: 'plan_1' },
        },
        quote_details: null,
      },
    } as never;

    expect(stripeSubscriptionMetadataFromInvoice(invoice)?.service_plan_id).toBe('plan_1');
  });

  it('reads payment intent from invoice payments', () => {
    const invoice = {
      id: 'in_1',
      object: 'invoice',
      payments: {
        object: 'list',
        data: [
          {
            id: 'inpay_1',
            object: 'invoice_payment',
            payment: { type: 'payment_intent', payment_intent: 'pi_abc' },
          },
        ],
      },
    } as never;

    expect(stripePaymentIntentIdFromInvoice(invoice)).toBe('pi_abc');
  });

  it('derives subscription period from items', () => {
    const bounds = subscriptionPeriodBounds({
      id: 'sub_1',
      object: 'subscription',
      items: {
        object: 'list',
        data: [
          { current_period_start: 100, current_period_end: 200 },
          { current_period_start: 50, current_period_end: 250 },
        ],
      },
    } as never);

    expect(bounds).toEqual({ start: 50, end: 250 });
  });
});
