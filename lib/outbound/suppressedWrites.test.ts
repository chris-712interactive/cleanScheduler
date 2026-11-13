import { afterEach, describe, expect, it, vi } from 'vitest';
import { processOutreachSendBatch } from '@/lib/admin/processOutreachSendBatch';
import { sendEmailCampaignNow } from '@/lib/campaigns/sendCampaignBatch';
import { deliverTenantWebhookById } from '@/lib/integrations/emitTenantWebhook';
import { exchangeAndSaveBankLink } from '@/lib/plaid/exchangePublicToken';
import { removePlaidItemAtPlaid, revokePlaidBankLink } from '@/lib/plaid/revokePlaidBankLink';
import { isPlaidConfigured } from '@/lib/plaid/server';
import { syncBankTransactionsForTenant } from '@/lib/plaid/syncBankTransactions';
import { sendTransactionalSms } from '@/lib/sms/sendTransactionalSms';
import { sendQuoteNotificationSms } from '@/lib/sms/quoteNotificationSms';
import { sendQuoteNotificationEmail } from '@/lib/tenant/quoteNotifications';
import { OUTBOUND_SUPPRESSED_MESSAGE } from '@/lib/outbound/suppression';

const quoteParams = {
  tenantId: 'tenant-1',
  quoteId: 'quote-1',
  quoteTitle: 'Weekly clean',
  customerId: 'customer-1',
};

function dbThatMustNotBeWritten() {
  return {
    from() {
      throw new Error('database write');
    },
  };
}

describe('suppressed provider results are not successes', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function enable(): void {
    vi.stubEnv('OUTBOUND_SUPPRESSED', '1');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('NEXT_PUBLIC_APP_DOMAIN', 'dev.cleanscheduler.com');
    vi.stubEnv('NODE_ENV', 'test');
  }

  it('does not settle quote email, SMS, or webhook leases as ok', async () => {
    enable();
    const admin = dbThatMustNotBeWritten();
    const email = await sendQuoteNotificationEmail(admin as never, 'quote_sent', quoteParams);
    const sms = await sendQuoteNotificationSms(admin as never, 'quote_sent', quoteParams);
    for (const result of [email, sms]) {
      expect(result).toMatchObject({
        ok: false,
        suppressed: true,
        error: OUTBOUND_SUPPRESSED_MESSAGE,
      });
      expect(result.ok ? 'ok' : 'failed').toBe('failed');
    }
  });

  it('queues a webhook delivery as pending and does not deliver it', async () => {
    enable();
    const inserts: Record<string, unknown>[] = [];
    let eqCount = 0;
    const endpoints = {
      eq() {
        eqCount += 1;
        if (eqCount >= 2) {
          return Promise.resolve({
            data: [{ id: 'endpoint-1', event_types: ['invoice.paid'] }],
            error: null,
          });
        }
        return endpoints;
      },
    };
    const admin = {
      from(table: string) {
        if (table === 'tenant_webhook_endpoints') {
          return { select: () => endpoints };
        }
        if (table === 'tenant_webhook_deliveries') {
          return {
            insert(row: Record<string, unknown>) {
              inserts.push(row);
              return {
                select: () => ({
                  maybeSingle: async () => ({ data: { id: 'delivery-1' }, error: null }),
                }),
              };
            },
            select() {
              throw new Error('delivery was attempted');
            },
            update() {
              throw new Error('delivery was marked');
            },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };
    const { emitTenantWebhook } = await import('@/lib/integrations/emitTenantWebhook');
    const result = await emitTenantWebhook({
      admin: admin as never,
      tenantId: 'tenant-1',
      eventType: 'invoice.paid',
      eventId: 'event-1',
      data: { invoice_id: 'invoice-1' },
    });
    expect(result).toMatchObject({ ok: false, suppressed: true });
    expect(inserts).toEqual([
      expect.objectContaining({
        tenant_id: 'tenant-1',
        endpoint_id: 'endpoint-1',
        event_type: 'invoice.paid',
        event_id: 'event-1',
        status: 'pending',
      }),
    ]);
    expect(inserts[0]).not.toHaveProperty('delivered_at');
  });

  it('does not insert an SMS row or consume the allowance', async () => {
    enable();
    const result = await sendTransactionalSms({
      admin: dbThatMustNotBeWritten() as never,
      tenantId: 'tenant-1',
      toPhone: '+15555550123',
      payload: { purpose: 'quote_accepted', tenantName: 'North Clean', quoteTitle: 'Weekly' },
    });
    expect(result).toMatchObject({ ok: false, suppressed: true });
  });

  it('does not mark a campaign or outreach batch as sent', async () => {
    enable();
    const admin = dbThatMustNotBeWritten();
    const campaign = await sendEmailCampaignNow({
      admin: admin as never,
      tenantId: 'tenant-1',
      campaignId: 'campaign-1',
      actorUserId: 'user-1',
    });
    const outreach = await processOutreachSendBatch(admin as never);
    expect(campaign).toMatchObject({ ok: false, suppressed: true });
    expect(outreach).toMatchObject({
      processed: 0,
      sent: 0,
      failed: 0,
      suppressed: true,
    });
  });

  it('does not write a bank link, cursor, or successful Plaid removal', async () => {
    enable();
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role');
    await expect(
      exchangeAndSaveBankLink(
        dbThatMustNotBeWritten() as never,
        'tenant-1',
        'public-token',
        { id: 'acct', name: 'Checking', mask: '1234', type: 'depository', subtype: 'checking' },
        null,
      ),
    ).rejects.toThrow(/suppressed/);
    const updates: unknown[] = [];
    const admin = {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: {
                      id: 'link-1',
                      plaid_access_token: 'access-real',
                      transactions_cursor: 'cursor-real',
                      status: 'active',
                    },
                    error: null,
                  }),
                };
              },
            };
          },
          update(payload: unknown) {
            updates.push(payload);
            return { eq: async () => ({ error: null }) };
          },
        };
      },
    };
    const sync = await syncBankTransactionsForTenant(admin as never, 'tenant-1');
    expect(sync).toEqual({ added: 0, modified: 0, removed: 0 });
    expect(updates).toEqual([]);
    expect(await removePlaidItemAtPlaid('access-real')).toBe(false);
    expect(isPlaidConfigured()).toBe(false);

    let revokedToken = false;
    const disconnectAdmin = {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: {
                      id: 'link-1',
                      plaid_access_token: 'access-real',
                      plaid_item_id: 'item-1',
                      status: 'active',
                    },
                  }),
                };
              },
            };
          },
          update() {
            revokedToken = true;
            return { eq: async () => ({ error: null }) };
          },
        };
      },
    };
    const revoked = await revokePlaidBankLink(disconnectAdmin as never, 'tenant-1', {
      reason: 'tenant_disconnected',
    });
    expect(revoked).toMatchObject({ revoked: false, suppressed: true, plaidItemRemoved: false });
    expect(revokedToken).toBe(false);
  });

  it('leaves a webhook delivery pending and does not set delivered_at', async () => {
    enable();
    const updates: Record<string, unknown>[] = [];
    const admin = {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: {
                      id: 'delivery-1',
                      status: 'pending',
                      attempt_count: 1,
                      tenant_webhook_endpoints: {
                        url: 'https://hooks.example/hook',
                        signing_secret: 'secret',
                        enabled: true,
                      },
                    },
                    error: null,
                  }),
                };
              },
            };
          },
          update(payload: Record<string, unknown>) {
            updates.push(payload);
            return { eq: async () => ({ error: null }) };
          },
        };
      },
    };
    const result = await deliverTenantWebhookById(admin as never, 'delivery-1');
    expect(result).toBe('skipped');
    expect(updates).toHaveLength(1);
    expect(updates[0]?.status).toBe('pending');
    expect(updates[0]).not.toHaveProperty('delivered_at');
    expect(updates[0]?.attempt_count).toBeUndefined();
  });
});
