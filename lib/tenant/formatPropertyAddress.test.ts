import { describe, expect, it } from 'vitest';
import { compactCalendarAddress, formatVisitSiteLine } from '@/lib/tenant/formatPropertyAddress';

describe('compactCalendarAddress', () => {
  it('drops a trailing state and ZIP so the calendar line stays short', () => {
    expect(compactCalendarAddress('775 Forest View Ln, Tuckaseegee, NC, 28783')).toBe(
      '775 Forest View Ln, Tuckaseegee',
    );
    expect(compactCalendarAddress('820 Umber Dr, Fort Myers, FL, 33913')).toBe(
      '820 Umber Dr, Fort Myers',
    );
  });

  it('keeps a unit when the street already has one', () => {
    expect(compactCalendarAddress('123 Main St, Apt 2, Fort Myers, FL, 33913-1234')).toBe(
      '123 Main St, Apt 2, Fort Myers',
    );
  });

  it('does not repeat a property name that is already the street', () => {
    expect(
      formatVisitSiteLine('775 Forest View Ln', '775 Forest View Ln, Tuckaseegee, NC, 28783'),
    ).toBe('775 Forest View Ln, Tuckaseegee, NC, 28783');
  });

  it('keeps a real location name in front of the address', () => {
    expect(formatVisitSiteLine('Lake house', '775 Forest View Ln, Tuckaseegee, NC, 28783')).toBe(
      'Lake house — 775 Forest View Ln, Tuckaseegee, NC, 28783',
    );
  });

  it('leaves a street-only or street-and-city line unchanged', () => {
    expect(compactCalendarAddress('123 Main St')).toBe('123 Main St');
    expect(compactCalendarAddress('123 Main St, Fort Myers')).toBe('123 Main St, Fort Myers');
  });
});
