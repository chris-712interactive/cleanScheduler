import { describe, expect, it } from 'vitest';
import { countOpenSupportThreads } from '@/lib/tenant/openSupportThreadCount';

describe('countOpenSupportThreads', () => {
  it('returns zero when count query fails', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ count: null, error: { message: 'fail' } }),
          }),
        }),
      }),
    };

    await expect(
      countOpenSupportThreads(supabase as never, '00000000-0000-4000-8000-000000000001'),
    ).resolves.toBe(0);
  });

  it('returns count from supabase head query', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ count: 3, error: null }),
          }),
        }),
      }),
    };

    await expect(
      countOpenSupportThreads(supabase as never, '00000000-0000-4000-8000-000000000001'),
    ).resolves.toBe(3);
  });
});
