import { describe, expect, it } from 'vitest';
import {
  invoiceTitleFromStripe,
  mapStripeInvoiceStatus,
  stripeInvoiceAmountCents,
} from '@/lib/stripe/stripeInvoiceMirror';

describe('stripeInvoiceMirror', () => {
  it('maps Stripe invoice statuses', () => {
    expect(mapStripeInvoiceStatus('paid')).toBe('paid');
    expect(mapStripeInvoiceStatus('uncollectible')).toBe('open');
    expect(mapStripeInvoiceStatus('void')).toBe('void');
  });

  it('prefers line item description for title', () => {
    const title = invoiceTitleFromStripe({
      id: 'in_1',
      object: 'invoice',
      lines: { object: 'list', data: [{ description: 'Monthly cleaning plan' }] },
    } as never);
    expect(title).toBe('Monthly cleaning plan');
  });

  it('uses total when present', () => {
    expect(
      stripeInvoiceAmountCents({
        id: 'in_1',
        object: 'invoice',
        total: 9900,
        amount_due: 5000,
      } as never),
    ).toBe(9900);
  });
});
