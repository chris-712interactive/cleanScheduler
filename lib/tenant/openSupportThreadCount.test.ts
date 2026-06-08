import { describe, expect, it } from 'vitest';
import {
  countOpenSupportThreads,
  countSupportThreadsAwaitingReply,
} from '@/lib/tenant/openSupportThreadCount';

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

describe('countSupportThreadsAwaitingReply', () => {
  it('returns zero when thread query fails', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: null, error: { message: 'fail' } }),
          }),
        }),
      }),
    };

    await expect(
      countSupportThreadsAwaitingReply(supabase as never, '00000000-0000-4000-8000-000000000001'),
    ).resolves.toBe(0);
  });

  it('counts only open threads whose latest message is from the customer', async () => {
    const supabase = {
      from: (table: string) => {
        if (table === 'customer_support_threads') {
          return {
            select: () => ({
              eq: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [{ id: 'thread-a' }, { id: 'thread-b' }, { id: 'thread-c' }],
                    error: null,
                  }),
              }),
            }),
          };
        }

        return {
          select: () => ({
            in: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      thread_id: 'thread-a',
                      is_from_customer: true,
                      created_at: '2026-06-01T12:00:00Z',
                    },
                    {
                      thread_id: 'thread-b',
                      is_from_customer: false,
                      created_at: '2026-06-01T11:00:00Z',
                    },
                    {
                      thread_id: 'thread-b',
                      is_from_customer: true,
                      created_at: '2026-06-01T10:00:00Z',
                    },
                    {
                      thread_id: 'thread-c',
                      is_from_customer: false,
                      created_at: '2026-06-01T09:00:00Z',
                    },
                  ],
                  error: null,
                }),
            }),
          }),
        };
      },
    };

    await expect(
      countSupportThreadsAwaitingReply(supabase as never, '00000000-0000-4000-8000-000000000001'),
    ).resolves.toBe(1);
  });
});
