import { beforeEach, describe, expect, it, vi } from 'vitest';

const { syncTenantFromStripeSubscription } = vi.hoisted(() => ({
  syncTenantFromStripeSubscription: vi.fn(async () => true),
}));

vi.mock('@/lib/billing/syncTenantPlatformSubscription', () => ({
  syncTenantFromStripeSubscription,
  syncTenantFromCheckoutSession: vi.fn(),
}));

import { dispatchStripeWebhookEvent } from '@/lib/stripe/handleStripeWebhook';

function subscriptionEvent(type: string, status: string) {
  return {
    id: `evt_${type}`,
    type,
    data: {
      object: {
        id: 'sub_platform',
        status,
        metadata: { tenant_id: '11111111-1111-4111-8111-111111111111' },
      },
    },
  };
}

describe('platform subscription webhook sync', () => {
  beforeEach(() => {
    syncTenantFromStripeSubscription.mockClear();
  });

  it.each([
    ['customer.subscription.paused', 'paused'],
    ['customer.subscription.resumed', 'active'],
    ['customer.subscription.updated', 'active'],
  ] as const)('syncs %s the same way as an update', async (type, status) => {
    await dispatchStripeWebhookEvent(
      {} as never,
      {} as never,
      subscriptionEvent(type, status) as never,
    );
    expect(syncTenantFromStripeSubscription).toHaveBeenCalledTimes(1);
    expect(syncTenantFromStripeSubscription).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'sub_platform', status }),
    );
  });
});
