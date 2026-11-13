import { afterEach, describe, expect, it, vi } from 'vitest';
import { OUTBOUND_SUPPRESSED_MESSAGE } from '@/lib/outbound/suppression';

vi.mock('@/lib/auth/portalAccess', () => ({
  requirePortalAccess: vi.fn(async () => ({ user: { id: 'user-1' } })),
}));

vi.mock('@/lib/auth/tenantAccess', () => ({
  requireTenantPortalAccess: vi.fn(async () => ({
    tenantId: 'tenant-1',
    role: 'owner',
    tenantSlug: 'qa',
  })),
}));

vi.mock('@/lib/auth/requireMfa', () => ({
  assertMfaForBankAdmin: vi.fn(async () => null),
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => {
    throw new Error('bank action should not open the database');
  },
}));

import {
  disconnectBankLinkAction,
  syncBankTransactionsAction,
} from '@/app/tenant/billing/bank-connection/actions';

function form(): FormData {
  const data = new FormData();
  data.set('tenant_slug', 'qa');
  return data;
}

describe('bank actions while outbound calls are suppressed', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function enable(): void {
    vi.stubEnv('OUTBOUND_SUPPRESSED', '1');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('NEXT_PUBLIC_APP_DOMAIN', 'dev.cleanscheduler.com');
    vi.stubEnv('PLAID_CLIENT_ID', 'client');
    vi.stubEnv('PLAID_SECRET', 'secret');
    vi.stubEnv('PLAID_ENV', 'sandbox');
  }

  it('does not report a manual sync as success', async () => {
    enable();
    await expect(syncBankTransactionsAction(form())).resolves.toEqual({
      error: OUTBOUND_SUPPRESSED_MESSAGE,
    });
  });

  it('does not report a disconnect as success', async () => {
    enable();
    await expect(disconnectBankLinkAction(form())).resolves.toEqual({
      error: OUTBOUND_SUPPRESSED_MESSAGE,
    });
  });
});
