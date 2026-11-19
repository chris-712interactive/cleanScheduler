import { describe, expect, it } from 'vitest';
import { EntitlementGateError } from '@/lib/billing/entitlements';
import { assertCanSendSmsSegments } from '@/lib/billing/smsCredits';
import {
  allowanceWarning,
  allocateSmsSegments,
  BUSINESS_APPLICANT_SMS_MONTHLY,
  creditTextPackPurchase,
  parseTextPackCredit,
  textPackPricesConfigured,
  textPackPurchaseDenial,
  TEXT_PACKS,
  TEXT_PACKS_UNAVAILABLE_MESSAGE,
  TEXTING_UNLOCKS_MESSAGE,
} from '@/lib/billing/textPacks';
import { PLATFORM_TIER_ENTITLEMENTS } from '@/lib/billing/entitlements';

const TENANT = '11111111-1111-4111-8111-111111111111';

function creditInput(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'cs_test_pack_1',
    mode: 'payment',
    paymentStatus: 'paid',
    amountTotal: 1500,
    currency: 'usd',
    metadata: {
      kind: 'text_pack',
      tenant_id: TENANT,
      pack_key: 'pack_1000',
    },
    ...overrides,
  };
}

type BillingRow = { status: string | null; platform_plan: string | null } | null;

function adminFor(state: {
  billing: BillingRow;
  messages?: { purpose: string; segment_count: number }[];
  balance?: number;
  ledgerMissing?: boolean;
}) {
  const ledger = {
    balance: state.balance ?? 0,
    missing: state.ledgerMissing ?? false,
    sessions: new Set<string>(),
  };
  const reservations: {
    id: string;
    segments: number;
    meter: string;
    pack: number;
    released: boolean;
  }[] = [];
  let lock: Promise<void> = Promise.resolve();

  const admin = {
    ledger,
    reservations,
    from(table: string) {
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      chain.select = self;
      chain.eq = self;
      chain.gte = self;
      chain.insert = async (row: { stripe_checkout_session_id?: string; segments?: number }) => {
        if (ledger.missing) {
          return {
            data: null,
            error: {
              code: '42P01',
              message: 'relation "public.tenant_text_pack_ledger" does not exist',
            },
          };
        }
        const sessionId = row.stripe_checkout_session_id ?? '';
        if (ledger.sessions.has(sessionId)) {
          return { data: null, error: { code: '23505', message: 'duplicate key' } };
        }
        ledger.sessions.add(sessionId);
        ledger.balance += row.segments ?? 0;
        return { data: null, error: null };
      };
      chain.maybeSingle = async () => {
        if (table === 'tenant_billing_accounts') {
          return { data: state.billing, error: null };
        }
        return { data: null, error: null };
      };
      chain.then = (
        resolve: (value: unknown) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => {
        if (table === 'tenant_sms_messages') {
          return Promise.resolve({ data: state.messages ?? [], error: null }).then(resolve, reject);
        }
        if (table === 'tenant_text_pack_ledger') {
          if (ledger.missing) {
            return Promise.resolve({
              data: null,
              error: {
                code: '42P01',
                message: 'relation "public.tenant_text_pack_ledger" does not exist',
              },
            }).then(resolve, reject);
          }
          return Promise.resolve({
            data: [{ segments: ledger.balance }],
            error: null,
          }).then(resolve, reject);
        }
        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
      };
      return chain;
    },
    rpc: async (
      name: string,
      args: {
        p_segments?: number;
        p_meter?: string;
        p_allowance?: number;
        p_separate_applicant?: boolean;
        p_reservation?: string;
        p_refund_pack?: boolean;
      },
    ) => {
      if (
        ledger.missing ||
        (name !== 'reserve_sms_segments' && name !== 'release_sms_reservation')
      ) {
        return {
          data: null,
          error: {
            code: 'PGRST202',
            message: `${name} does not exist`,
          },
        };
      }
      const run = lock.then(async () => {
        if (name === 'release_sms_reservation') {
          const row = reservations.find((item) => item.id === args.p_reservation);
          if (!row || row.released) return { data: null, error: null };
          row.released = true;
          if (args.p_refund_pack) ledger.balance += row.pack;
          return { data: null, error: null };
        }
        const separate = Boolean(args.p_separate_applicant);
        const sent = (state.messages ?? [])
          .filter((row) => !separate || row.purpose.startsWith('hiring_'))
          .reduce((sum, row) => sum + row.segment_count, 0);
        const held = reservations
          .filter((row) => !row.released && (!separate || row.meter === 'applicant'))
          .reduce((sum, row) => sum + row.segments, 0);
        const left = Math.max(0, (args.p_allowance ?? 0) - sent - held);
        const fromPack = Math.max(0, (args.p_segments ?? 0) - left);
        if (fromPack > ledger.balance) {
          return { data: { ok: false, code: 'limit_exceeded' }, error: null };
        }
        ledger.balance -= fromPack;
        const id = `res-${reservations.length + 1}`;
        reservations.push({
          id,
          segments: args.p_segments ?? 0,
          meter: args.p_meter ?? 'customer',
          pack: fromPack,
          released: false,
        });
        return {
          data: { ok: true, from_pack: fromPack, reservation_id: id },
          error: null,
        };
      });
      lock = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  };

  return admin;
}

describe('allocateSmsSegments', () => {
  it('spends the plan allowance before a text pack', () => {
    const split = allocateSmsSegments({
      plan: 'business',
      billingStatus: 'active',
      meter: 'applicant',
      segmentCount: 30,
      generalUsed: 0,
      applicantUsed: 80,
      packRemaining: 100,
      packsAvailable: true,
    });
    expect(split).toEqual({ ok: true, fromAllowance: 20, fromPack: 10 });
  });

  it('keeps a separate 100-segment applicant cap on Business', () => {
    expect(PLATFORM_TIER_ENTITLEMENTS.business.limits.includedApplicantSmsCreditsMonthly).toBe(
      BUSINESS_APPLICANT_SMS_MONTHLY,
    );
    const blocked = allocateSmsSegments({
      plan: 'business',
      billingStatus: 'active',
      meter: 'customer',
      segmentCount: 1,
      generalUsed: 0,
      applicantUsed: 0,
      packRemaining: 5000,
      packsAvailable: true,
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.message).toContain('Pro');
      expect(blocked.message.toLowerCase()).not.toContain('add-on');
    }
  });

  it('draws Pro applicant texts from the Pro allowance, then a text pack', () => {
    const fromAllowance = allocateSmsSegments({
      plan: 'pro',
      billingStatus: 'active',
      meter: 'applicant',
      segmentCount: 5,
      generalUsed: 10,
      applicantUsed: 100,
      packRemaining: 0,
      packsAvailable: true,
    });
    expect(fromAllowance).toEqual({ ok: true, fromAllowance: 5, fromPack: 0 });

    const fromPack = allocateSmsSegments({
      plan: 'pro',
      billingStatus: 'active',
      meter: 'applicant',
      segmentCount: 15,
      generalUsed: 25000,
      applicantUsed: 0,
      packRemaining: 20,
      packsAvailable: true,
    });
    expect(fromPack).toEqual({ ok: true, fromAllowance: 0, fromPack: 15 });
  });

  it('blocks Starter texting', () => {
    for (const meter of ['customer', 'applicant'] as const) {
      const result = allocateSmsSegments({
        plan: 'starter',
        billingStatus: 'active',
        meter,
        segmentCount: 1,
        generalUsed: 0,
        applicantUsed: 0,
        packRemaining: 1000,
        packsAvailable: true,
      });
      expect(result.ok).toBe(false);
    }
  });

  it.each(['trialing', 'past_due', 'canceled', null] as const)(
    'blocks texting when billing status is %s',
    (billingStatus) => {
      const result = allocateSmsSegments({
        plan: 'pro',
        billingStatus,
        meter: 'customer',
        segmentCount: 1,
        generalUsed: 0,
        applicantUsed: 0,
        packRemaining: 1000,
        packsAvailable: true,
      });
      expect(result).toMatchObject({
        ok: false,
        code: 'feature_blocked',
        message: TEXTING_UNLOCKS_MESSAGE,
      });
    },
  );

  it('still blocks a Business or Pro trial even when the plan argument is that tier', () => {
    const businessTrial = allocateSmsSegments({
      plan: 'business',
      billingStatus: 'trialing',
      meter: 'applicant',
      segmentCount: 1,
      generalUsed: 0,
      applicantUsed: 0,
      packRemaining: 0,
      packsAvailable: false,
    });
    expect(businessTrial).toMatchObject({ message: TEXTING_UNLOCKS_MESSAGE });
  });

  it('keeps the monthly allowance when the ledger migration is absent', () => {
    const allowed = allocateSmsSegments({
      plan: 'business',
      billingStatus: 'active',
      meter: 'applicant',
      segmentCount: 1,
      generalUsed: 0,
      applicantUsed: 0,
      packRemaining: 0,
      packsAvailable: false,
    });
    expect(allowed).toEqual({ ok: true, fromAllowance: 1, fromPack: 0 });

    const blocked = allocateSmsSegments({
      plan: 'business',
      billingStatus: 'active',
      meter: 'applicant',
      segmentCount: 1,
      generalUsed: 0,
      applicantUsed: 100,
      packRemaining: 0,
      packsAvailable: false,
    });
    expect(blocked).toMatchObject({ message: TEXT_PACKS_UNAVAILABLE_MESSAGE });
  });

  it('warns at 80 percent and at the limit without calling the extra an add-on', () => {
    expect(allowanceWarning(79, 100, 'Applicant texts')).toBeNull();
    const warn = allowanceWarning(80, 100, 'Applicant texts');
    const limit = allowanceWarning(100, 100, 'Applicant texts');
    expect(warn?.level).toBe('warn');
    expect(warn?.message).toContain('80%');
    expect(warn?.message).toContain('text pack');
    expect(limit?.level).toBe('limit');
    expect(`${warn?.message} ${limit?.message}`.toLowerCase()).not.toContain('add-on');
  });
});

describe('text pack purchase and webhook', () => {
  it('lets an owner or admin buy only on an active paid subscription when prices and the ledger exist', () => {
    const previous1000 = process.env.STRIPE_PRICE_TEXT_PACK_1000;
    const previous2500 = process.env.STRIPE_PRICE_TEXT_PACK_2500;
    process.env.STRIPE_PRICE_TEXT_PACK_1000 = 'price_1000';
    process.env.STRIPE_PRICE_TEXT_PACK_2500 = 'price_2500';
    expect(
      textPackPurchaseDenial({
        role: 'owner',
        plan: 'business',
        billingStatus: 'active',
        pricesConfigured: textPackPricesConfigured(),
        ledgerAvailable: true,
      }),
    ).toBeNull();
    expect(
      textPackPurchaseDenial({
        role: 'admin',
        plan: 'pro',
        billingStatus: 'active',
        pricesConfigured: true,
        ledgerAvailable: true,
      }),
    ).toBeNull();
    expect(
      textPackPurchaseDenial({
        role: 'owner',
        plan: 'starter',
        billingStatus: 'active',
        pricesConfigured: true,
        ledgerAvailable: true,
      }),
    ).toBe('Text packs are available on the Business and Pro plans.');
    expect(
      textPackPurchaseDenial({
        role: 'employee',
        plan: 'business',
        billingStatus: 'active',
        pricesConfigured: true,
        ledgerAvailable: true,
      }),
    ).toContain('owner or admin');
    expect(
      textPackPurchaseDenial({
        role: 'owner',
        plan: 'pro',
        billingStatus: 'trialing',
        pricesConfigured: true,
        ledgerAvailable: true,
      }),
    ).toBe(TEXTING_UNLOCKS_MESSAGE);
    expect(
      textPackPurchaseDenial({
        role: 'owner',
        plan: 'pro',
        billingStatus: 'past_due',
        pricesConfigured: true,
        ledgerAvailable: true,
      }),
    ).toBe(TEXTING_UNLOCKS_MESSAGE);
    expect(
      textPackPurchaseDenial({
        role: 'owner',
        plan: 'pro',
        billingStatus: 'canceled',
        pricesConfigured: true,
        ledgerAvailable: true,
      }),
    ).toBe(TEXTING_UNLOCKS_MESSAGE);
    delete process.env.STRIPE_PRICE_TEXT_PACK_1000;
    delete process.env.STRIPE_PRICE_TEXT_PACK_2500;
    expect(textPackPricesConfigured()).toBe(false);
    expect(
      textPackPurchaseDenial({
        role: 'owner',
        plan: 'business',
        billingStatus: 'active',
        pricesConfigured: textPackPricesConfigured(),
        ledgerAvailable: true,
      }),
    ).toBe(TEXT_PACKS_UNAVAILABLE_MESSAGE);
    if (previous1000 === undefined) delete process.env.STRIPE_PRICE_TEXT_PACK_1000;
    else process.env.STRIPE_PRICE_TEXT_PACK_1000 = previous1000;
    if (previous2500 === undefined) delete process.env.STRIPE_PRICE_TEXT_PACK_2500;
    else process.env.STRIPE_PRICE_TEXT_PACK_2500 = previous2500;
  });

  it('credits a paid Checkout once per session id', async () => {
    const admin = adminFor({ billing: { status: 'active', platform_plan: 'business' } });
    const parsed = parseTextPackCredit(creditInput());
    expect(parsed.action).toBe('credit');
    if (parsed.action !== 'credit') return;
    expect(parsed.segments).toBe(TEXT_PACKS.pack_1000.segments);
    expect(await creditTextPackPurchase(admin as never, parsed)).toBe('credited');
    expect(await creditTextPackPurchase(admin as never, parsed)).toBe('duplicate');
    expect(admin.ledger.balance).toBe(1000);

    expect(parseTextPackCredit(creditInput({ amountTotal: 100 })).action).toBe('ignore');
    expect(parseTextPackCredit(creditInput({ paymentStatus: 'unpaid' })).action).toBe('ignore');
    expect(
      parseTextPackCredit(creditInput({ metadata: { kind: 'subscribe', tenant_id: TENANT } }))
        .action,
    ).toBe('ignore');
  });
});

describe('assertCanSendSmsSegments', () => {
  it('blocks a trialing Business workspace and a past_due or canceled Pro workspace', async () => {
    for (const billing of [
      { status: 'trialing', platform_plan: 'business' },
      { status: 'past_due', platform_plan: 'pro' },
      { status: 'canceled', platform_plan: 'pro' },
      null,
    ] as const) {
      const admin = adminFor({ billing, balance: 1000 });
      await expect(
        assertCanSendSmsSegments({
          admin: admin as never,
          tenantId: TENANT,
          segmentCount: 1,
          meter: billing?.platform_plan === 'business' ? 'applicant' : 'customer',
        }),
      ).rejects.toBeInstanceOf(EntitlementGateError);
      await expect(
        assertCanSendSmsSegments({
          admin: admin as never,
          tenantId: TENANT,
          segmentCount: 1,
          meter: billing?.platform_plan === 'business' ? 'applicant' : 'customer',
        }),
      ).rejects.toThrow(TEXTING_UNLOCKS_MESSAGE);
      expect(admin.ledger.balance).toBe(1000);
    }
  });

  it('uses the Business applicant cap, then the text pack', async () => {
    const admin = adminFor({
      billing: { status: 'active', platform_plan: 'business' },
      messages: [{ purpose: 'hiring_reminder', segment_count: 100 }],
      balance: 40,
    });
    const result = await assertCanSendSmsSegments({
      admin: admin as never,
      tenantId: TENANT,
      segmentCount: 25,
      meter: 'applicant',
    });
    expect(result.fromPack).toBe(25);
    expect(admin.ledger.balance).toBe(15);
  });

  it('lets only one of two overlapping sends take the monthly allowance', async () => {
    const business = adminFor({
      billing: { status: 'active', platform_plan: 'business' },
      balance: 0,
    });
    const results = await Promise.allSettled([
      assertCanSendSmsSegments({
        admin: business as never,
        tenantId: TENANT,
        segmentCount: 100,
        meter: 'applicant',
      }),
      assertCanSendSmsSegments({
        admin: business as never,
        tenantId: TENANT,
        segmentCount: 100,
        meter: 'applicant',
      }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(business.reservations.filter((row) => !row.released)).toHaveLength(1);

    const pro = adminFor({
      billing: { status: 'active', platform_plan: 'pro' },
      balance: 0,
    });
    const proResults = await Promise.allSettled([
      assertCanSendSmsSegments({
        admin: pro as never,
        tenantId: TENANT,
        segmentCount: 25000,
        meter: 'customer',
      }),
      assertCanSendSmsSegments({
        admin: pro as never,
        tenantId: TENANT,
        segmentCount: 25000,
        meter: 'applicant',
      }),
    ]);
    expect(proResults.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(pro.reservations.filter((row) => !row.released)).toHaveLength(1);
  });

  it('lets an active Pro customer text from the monthly allowance', async () => {
    const admin = adminFor({
      billing: { status: 'active', platform_plan: 'pro' },
      messages: [{ purpose: 'visit_reminder', segment_count: 10 }],
      balance: 0,
    });
    const result = await assertCanSendSmsSegments({
      admin: admin as never,
      tenantId: TENANT,
      segmentCount: 2,
      meter: 'customer',
    });
    expect(result.fromPack).toBe(0);
    expect(admin.ledger.balance).toBe(0);
  });
});
