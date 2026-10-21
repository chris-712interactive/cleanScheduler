import { describe, expect, it } from 'vitest';
import { buildBillingListSearchParams } from '@/lib/billing/billingListPaging';

describe('buildBillingListSearchParams', () => {
  it('keeps the search query on later pages and drops the first page', () => {
    expect(buildBillingListSearchParams({ q: ' Wayne ', page: 2 })).toBe('?q=Wayne&page=2');
    expect(buildBillingListSearchParams({ q: 'Wayne', page: 1 })).toBe('?q=Wayne');
    expect(buildBillingListSearchParams({ page: 2 })).toBe('?page=2');
    expect(buildBillingListSearchParams({})).toBe('');
  });
});
