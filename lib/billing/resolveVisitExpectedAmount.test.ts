import { describe, expect, it } from 'vitest';
import {
  visitHasBillableAmount,
  visitIsMissingJobPrice,
} from '@/lib/billing/resolveVisitExpectedAmount';

describe('visitIsMissingJobPrice', () => {
  it('does not flag consultations without a price', () => {
    expect(
      visitIsMissingJobPrice({
        visitPurpose: 'consultation',
        expectedAmountCents: null,
        quoteAmountCents: null,
      }),
    ).toBe(false);
  });

  it('flags service visits without a price', () => {
    expect(
      visitIsMissingJobPrice({
        visitPurpose: 'service',
        expectedAmountCents: null,
        quoteAmountCents: null,
      }),
    ).toBe(true);
  });

  it('does not flag priced service visits', () => {
    expect(
      visitIsMissingJobPrice({
        visitPurpose: 'service',
        expectedAmountCents: 15000,
        quoteAmountCents: null,
      }),
    ).toBe(false);
  });
});

describe('visitHasBillableAmount', () => {
  it('treats zero cents as unpriced for service visits', () => {
    expect(visitHasBillableAmount({ expectedAmountCents: 0, quoteAmountCents: null })).toBe(false);
  });
});
