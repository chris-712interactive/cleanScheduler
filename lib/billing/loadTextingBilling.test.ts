import { describe, expect, it } from 'vitest';
import { loadTextingBilling } from '@/lib/billing/loadTextingBilling';
import { canUseTexting } from '@/lib/billing/tenantSubscriptionAccess';
import { writeTenantBillingAccount } from '@/lib/billing/writeTenantBillingAccount';

const TENANT = '11111111-1111-4111-8111-111111111111';

describe('canUseTexting raw Stripe status', () => {
  it('blocks paused while a null raw status keeps the mapped active rule', () => {
    expect(canUseTexting('active', null)).toBe(true);
    expect(canUseTexting('active', undefined)).toBe(true);
    expect(canUseTexting('active', 'active')).toBe(true);
    expect(canUseTexting('active', 'paused')).toBe(false);
    expect(canUseTexting('active', ' Paused ')).toBe(false);
    expect(canUseTexting('past_due', null)).toBe(false);
    expect(canUseTexting('past_due', 'paused')).toBe(false);
    expect(canUseTexting('trialing', 'active')).toBe(false);
  });
});

describe('loadTextingBilling', () => {
  it('reads the raw status when the column exists', async () => {
    const admin = {
      from() {
        const chain: Record<string, unknown> = {};
        const self = () => chain;
        chain.select = self;
        chain.eq = self;
        chain.maybeSingle = async () => ({
          data: { status: 'active', stripe_subscription_status: 'paused' },
          error: null,
        });
        return chain;
      },
    };
    await expect(loadTextingBilling(admin as never, TENANT)).resolves.toEqual({
      status: 'active',
      rawStripeStatus: 'paused',
    });
  });

  it('treats a missing raw status column as null', async () => {
    const selects: string[] = [];
    const admin = {
      from() {
        const chain: Record<string, unknown> = {};
        let sql = '';
        chain.select = (value: string) => {
          sql = value;
          return chain;
        };
        chain.eq = () => chain;
        chain.maybeSingle = async () => {
          selects.push(sql);
          if (sql.includes('stripe_subscription_status')) {
            return {
              data: null,
              error: {
                code: '42703',
                message: 'column tenant_billing_accounts.stripe_subscription_status does not exist',
              },
            };
          }
          return { data: { status: 'active' }, error: null };
        };
        return chain;
      },
    };
    const loaded = await loadTextingBilling(admin as never, TENANT);
    expect(loaded).toEqual({ status: 'active', rawStripeStatus: null });
    expect(canUseTexting(loaded.status, loaded.rawStripeStatus)).toBe(true);
    expect(selects.some((sql) => !sql.includes('stripe_subscription_status'))).toBe(true);
  });
});

describe('writeTenantBillingAccount', () => {
  it('retries without the raw status when the column is absent', async () => {
    const updates: Record<string, unknown>[] = [];
    const admin = {
      from() {
        return {
          update(payload: Record<string, unknown>) {
            updates.push(payload);
            return {
              eq: async () =>
                'stripe_subscription_status' in payload
                  ? {
                      error: {
                        code: 'PGRST204',
                        message:
                          "Could not find the 'stripe_subscription_status' column of 'tenant_billing_accounts' in the schema cache",
                      },
                    }
                  : { error: null },
            };
          },
        };
      },
    };
    await writeTenantBillingAccount(admin as never, TENANT, {
      status: 'active',
      stripe_subscription_status: 'paused',
    });
    expect(updates[0]?.stripe_subscription_status).toBe('paused');
    expect(updates[1]).toEqual({ status: 'active' });
  });
});
