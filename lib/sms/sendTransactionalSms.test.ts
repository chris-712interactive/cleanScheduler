import { beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.fn();

vi.mock('@/lib/sms/sentDmServer', () => ({
  isSentDmConfigured: () => true,
  shouldUseSentDmSandbox: () => true,
  getSentDmClient: () => ({ messages: { send } }),
}));

vi.mock('@/lib/sms/sentTemplateConfig', () => ({
  renderSmsBodyFromPayload: () => 'Interview reminder',
  buildSentTemplateRequest: () => ({ id: 'tpl', parameters: {} }),
}));

import { sendTransactionalSms } from '@/lib/sms/sendTransactionalSms';

const TENANT = '11111111-1111-4111-8111-111111111111';

function adminWithReservation() {
  const releases: { id: string; refund: boolean }[] = [];
  const admin = {
    releases,
    from(table: string) {
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      chain.select = self;
      chain.eq = self;
      chain.gte = self;
      chain.insert = async () => {
        if (table === 'tenant_sms_messages') {
          return { data: null, error: { message: 'log failed' } };
        }
        return { data: null, error: null };
      };
      chain.maybeSingle = async () => {
        if (table === 'tenant_billing_accounts') {
          return { data: { status: 'active', platform_plan: 'pro' }, error: null };
        }
        return { data: null, error: null };
      };
      chain.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve);
      return chain;
    },
    rpc: async (name: string, args: { p_reservation?: string; p_refund_pack?: boolean }) => {
      if (name === 'reserve_sms_segments') {
        return {
          data: { ok: true, from_pack: 4, reservation_id: 'res-1' },
          error: null,
        };
      }
      if (name === 'release_sms_reservation') {
        releases.push({
          id: args.p_reservation ?? '',
          refund: Boolean(args.p_refund_pack),
        });
        return { data: null, error: null };
      }
      return { data: null, error: { code: 'PGRST202', message: `${name} does not exist` } };
    },
  };
  return admin;
}

describe('sendTransactionalSms pack release', () => {
  beforeEach(() => {
    send.mockReset();
    delete process.env.OUTBOUND_SUPPRESSED;
  });

  it('refunds the reserved pack when the provider accepts the text and logging writes nothing', async () => {
    send.mockResolvedValue({
      success: true,
      data: {
        recipients: [{ message_id: 'msg-1', channel: 'sms', body: 'Interview reminder' }],
      },
    });
    const admin = adminWithReservation();
    const result = await sendTransactionalSms({
      admin: admin as never,
      tenantId: TENANT,
      toPhone: '4155552671',
      payload: {
        purpose: 'visit_reminder',
        tenantName: 'Acme',
        visitTitle: 'Weekly',
        when: 'Tue 9am',
      },
    });
    expect(result).toEqual({
      ok: false,
      error: 'sent.dm send succeeded but logging failed.',
    });
    expect(admin.releases).toEqual([{ id: 'res-1', refund: true }]);
  });
});
