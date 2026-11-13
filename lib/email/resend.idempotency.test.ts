import { beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.hoisted(() =>
  vi.fn(async (payload: unknown, options?: { idempotencyKey?: string }) => {
    void payload;
    void options;
    return { data: { id: 'email_1' }, error: null };
  }),
);

vi.mock('resend', () => ({
  Resend: class {
    emails = { send };
  },
}));

import { sendTransactionalEmail } from '@/lib/email/resend';

describe('sendTransactionalEmail idempotency', () => {
  beforeEach(() => {
    send.mockClear();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.RESEND_FROM_EMAIL = 'quotes@example.com';
  });

  it('passes a stable key as the Resend Idempotency-Key option', async () => {
    const result = await sendTransactionalEmail({
      to: 'customer@example.com',
      subject: 'Quote',
      text: 'Hello',
      html: '<p>Hello</p>',
      idempotencyKey: 'quote-email-11111111-1111-4111-8111-111111111111',
    });

    expect(result).toEqual({ ok: true });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[1]).toEqual({
      idempotencyKey: 'quote-email-11111111-1111-4111-8111-111111111111',
    });
  });

  it('omits the option when the caller has no key', async () => {
    await sendTransactionalEmail({
      to: 'customer@example.com',
      subject: 'Quote',
      text: 'Hello',
      html: '<p>Hello</p>',
    });

    expect(send.mock.calls[0]?.[1]).toBeUndefined();
  });
});
