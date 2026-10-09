import { describe, expect, it } from 'vitest';
import { customerQualifiesForQuotePicker } from '@/lib/tenant/quoteCustomerPicker';

describe('customerQualifiesForQuotePicker', () => {
  it('includes imported customers', () => {
    expect(
      customerQualifiesForQuotePicker({
        importedAt: '2026-10-01T00:00:00.000Z',
        consultationFormCompleted: false,
      }),
    ).toBe(true);
  });

  it('includes customers who completed a consultation form', () => {
    expect(
      customerQualifiesForQuotePicker({
        importedAt: null,
        consultationFormCompleted: true,
      }),
    ).toBe(true);
  });

  it('excludes everyone else', () => {
    expect(
      customerQualifiesForQuotePicker({
        importedAt: null,
        consultationFormCompleted: false,
      }),
    ).toBe(false);
  });
});
