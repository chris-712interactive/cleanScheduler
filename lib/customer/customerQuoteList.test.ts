import { describe, expect, it } from 'vitest';
import { countPendingCustomerQuotes } from '@/lib/customer/customerQuoteList';

describe('countPendingCustomerQuotes', () => {
  it('returns 0 for empty customer ids', async () => {
    const admin = {
      from: () => ({
        select: () => ({
          in: () => ({
            eq: () => ({
              is: () => Promise.resolve({ count: 0, error: null }),
            }),
          }),
        }),
      }),
    };

    await expect(countPendingCustomerQuotes(admin as never, [])).resolves.toBe(0);
  });
});
