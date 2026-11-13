import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  serverEnv: { CRON_SECRET: 'cron-secret' },
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => {
    throw new Error('plaid sync should not open the database');
  },
}));

import { GET } from '@/app/api/cron/plaid-sync/route';

describe('plaid sync cron while outbound calls are suppressed', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is a no-op and does not read bank links', async () => {
    vi.stubEnv('OUTBOUND_SUPPRESSED', '1');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('NEXT_PUBLIC_APP_DOMAIN', 'dev.cleanscheduler.com');
    vi.stubEnv('PLAID_CLIENT_ID', 'client');
    vi.stubEnv('PLAID_SECRET', 'secret');
    vi.stubEnv('PLAID_ENV', 'sandbox');
    const response = await GET(
      new Request('https://dev.cleanscheduler.com/api/cron/plaid-sync', {
        headers: { authorization: 'Bearer cron-secret' },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ suppressed: true, tenants: 0, errors: 0 });
  });
});
