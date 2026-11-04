import { describe, expect, it } from 'vitest';
import {
  billingReasonOpensGrant,
  customerCoverageLabel,
  decideVisitBilling,
  finishedVisitsToInvoice,
  grantStatusAfterDispute,
  isInitialCleanTitle,
  manualPaymentOpensGrant,
  paidCleansUnscheduled,
  propertyIdToBind,
  refundReversesGrant,
  rruleMatchesCadence,
  upcomingCoverageIssue,
  waitingVisitIdsToCover,
  type CoverageGrantInput,
  type CoverageOccupant,
  type CoverageSubscriptionInput,
  type CoverageVisitInput,
} from '@/lib/billing/subscriptionCoverage';

const periodStart = '2026-11-01T00:00:00.000Z';
const periodEnd = '2026-12-01T00:00:00.000Z';

function subscription(
  overrides: Partial<CoverageSubscriptionInput> = {},
): CoverageSubscriptionInput {
  return {
    status: 'active',
    propertyId: 'prop-1',
    includedCleans: 2,
    overageAmountCents: 4500,
    createdAt: '2026-10-01T00:00:00.000Z',
    periodStart,
    periodEnd,
    ...overrides,
  };
}

function visit(
  id: string,
  day: number,
  overrides: Partial<CoverageVisitInput> = {},
): CoverageVisitInput {
  return {
    id,
    startsAt: `2026-11-${String(day).padStart(2, '0')}T15:00:00.000Z`,
    createdAt: `2026-10-01T00:00:0${day}.000Z`,
    purpose: 'service',
    title: 'Bi-weekly clean',
    propertyId: 'prop-1',
    hasVisitInvoice: false,
    coverageStatus: null,
    completedBeforeSubscription: false,
    ...overrides,
  };
}

function occupant(
  row: CoverageVisitInput,
  overrides: Partial<CoverageOccupant> = {},
): CoverageOccupant {
  return {
    id: row.id,
    startsAt: row.startsAt,
    createdAt: row.createdAt,
    occupies: true,
    waiting: false,
    invoiced: row.hasVisitInvoice,
    ...overrides,
  };
}

function grant(overrides: Partial<CoverageGrantInput> = {}): CoverageGrantInput {
  return {
    id: 'grant-1',
    status: 'open',
    periodStart,
    periodEnd,
    includedCleans: 2,
    overageAmountCents: 4500,
    coverageEndsOn: null,
    ...overrides,
  };
}

function decide(
  row: CoverageVisitInput,
  occupants: CoverageOccupant[],
  options: {
    subscription?: CoverageSubscriptionInput | null;
    grants?: CoverageGrantInput[];
    makeupAvailable?: boolean;
    expectedAmountCents?: number | null;
  } = {},
) {
  return decideVisitBilling({
    visit: row,
    subscription: options.subscription === undefined ? subscription() : options.subscription,
    grants: options.grants ?? [],
    occupants,
    makeupAvailable: options.makeupAvailable ?? false,
    expectedAmountCents: options.expectedAmountCents ?? 12000,
  });
}

describe('subscription visit coverage', () => {
  it('covers the first two waiting visits and leaves the third at the overage price', () => {
    const first = visit('a', 3, { coverageStatus: 'waiting' });
    const second = visit('b', 17, { coverageStatus: 'waiting' });
    const third = visit('c', 28, { hasVisitInvoice: true });
    const rows = [
      occupant(first, { waiting: true }),
      occupant(second, { waiting: true }),
      occupant(third),
    ];
    expect(waitingVisitIdsToCover(rows, 2)).toEqual(['a', 'b']);
    expect(decide(visit('c', 28), rows, { grants: [grant()] }).kind).toBe('extra');
    expect(decide(visit('c', 28), rows, { grants: [grant()] }).amountCents).toBe(4500);
  });

  it('covers the first two completions when the grant already exists and invoices the third', () => {
    const rows = [visit('a', 3), visit('b', 17), visit('c', 28)].map((row) => occupant(row));
    const open = [grant()];
    expect(decide(visit('a', 3), rows, { grants: open }).kind).toBe('covered');
    expect(decide(visit('b', 17), rows, { grants: open }).kind).toBe('covered');
    expect(decide(visit('c', 28), rows, { grants: open }).kind).toBe('extra');
  });

  it('does not let a later completion take an earlier slot', () => {
    const rows = [visit('a', 3), visit('b', 17), visit('c', 28)].map((row) => occupant(row));
    expect(decide(visit('c', 28), rows, { grants: [grant()] }).kind).toBe('extra');
    expect(decide(visit('a', 3), rows, { grants: [grant()] }).kind).toBe('covered');
  });

  it('opens a grant for cycle and create invoices, including a zero-dollar cycle, and skips proration', () => {
    expect(billingReasonOpensGrant('subscription_cycle')).toBe(true);
    expect(billingReasonOpensGrant('subscription_create')).toBe(true);
    expect(billingReasonOpensGrant('subscription_update')).toBe(false);
    expect(
      manualPaymentOpensGrant({
        source: 'stripe_billing',
        stripeSubscriptionId: 'sub_1',
        status: 'paid',
        amountCents: 0,
        amountPaidCents: 0,
      }),
    ).toBe(true);
  });

  it('opens one grant when a manual payment pays the subscription invoice in full', () => {
    expect(
      manualPaymentOpensGrant({
        source: 'stripe_billing',
        stripeSubscriptionId: 'sub_1',
        status: 'paid',
        amountCents: 19900,
        amountPaidCents: 19900,
      }),
    ).toBe(true);
    expect(
      manualPaymentOpensGrant({
        source: 'stripe_billing',
        stripeSubscriptionId: 'sub_1',
        status: 'open',
        amountCents: 19900,
        amountPaidCents: 5000,
      }),
    ).toBe(false);
  });

  it('leaves a visit that already has an invoice on that invoice', () => {
    const row = visit('a', 3, { hasVisitInvoice: true });
    expect(decide(row, [occupant(row)], { grants: [grant()] }).kind).toBe('already_invoiced');
  });

  it('keeps a covered visit on its grant when the date moves', () => {
    const row = visit('a', 3, { coverageStatus: 'covered', startsAt: '2027-01-15T15:00:00.000Z' });
    expect(decide(row, [occupant(row)], { grants: [grant()] }).kind).toBe('already_covered');
  });

  it('returns a slot when the company cancels and keeps it when the customer cancels', () => {
    const kept = visit('a', 3);
    const later = visit('b', 17);
    const third = visit('c', 28);
    const companyReleased = [occupant(later), occupant(third)];
    expect(decide(later, companyReleased, { grants: [grant()] }).kind).toBe('covered');
    const customerKept = [occupant(kept), occupant(later), occupant(third)];
    expect(decide(third, customerKept, { grants: [grant()] }).kind).toBe('extra');
  });

  it('still invoices a consultation and an initial deep clean', () => {
    const consult = visit('a', 3, { purpose: 'consultation', title: 'Consultation' });
    const initial = visit('b', 17, { title: 'Initial Deep Cleaning' });
    expect(isInitialCleanTitle(initial.title)).toBe(true);
    expect(decide(consult, [occupant(consult)], { grants: [grant()] }).kind).toBe('standard');
    expect(decide(initial, [occupant(initial)], { grants: [grant()] }).kind).toBe('standard');
  });

  it('invoices every completion when the plan has no included cleans', () => {
    const row = visit('a', 3);
    expect(
      decide(row, [occupant(row)], { subscription: subscription({ includedCleans: null }) }).kind,
    ).toBe('legacy');
  });

  it('keeps an invoiced waiting clean invoiced after the charge succeeds', () => {
    const billed = visit('a', 3, { hasVisitInvoice: true, coverageStatus: 'waiting' });
    const other = visit('b', 17, { coverageStatus: 'waiting' });
    const rows = [occupant(billed, { waiting: true }), occupant(other, { waiting: true })];
    expect(waitingVisitIdsToCover(rows, 2)).toEqual(['b']);
  });

  it('flags an unpaid upcoming visit and clears it when the grant is open', () => {
    const now = '2026-11-01T00:00:00.000Z';
    const soon = '2026-11-10T15:00:00.000Z';
    expect(
      upcomingCoverageIssue({ status: 'past_due', grantStatus: null, startsAt: soon, now }),
    ).toBe('unpaid_subscription');
    expect(
      upcomingCoverageIssue({ status: 'active', grantStatus: 'open', startsAt: soon, now }),
    ).toBeNull();
    expect(
      upcomingCoverageIssue({ status: 'paused', grantStatus: null, startsAt: soon, now }),
    ).toBe('subscription_paused');
  });

  it('invoices a paused subscription at completion', () => {
    const row = visit('a', 3);
    expect(
      decide(row, [occupant(row)], { subscription: subscription({ status: 'paused' }) }).kind,
    ).toBe('standard');
  });

  it('flags a paid period with nothing upcoming', () => {
    expect(
      paidCleansUnscheduled({
        includedCleans: 2,
        occupantCount: 0,
        upcomingCount: 0,
        periodStarted: true,
      }),
    ).toBe(true);
    expect(
      paidCleansUnscheduled({
        includedCleans: 2,
        occupantCount: 1,
        upcomingCount: 1,
        periodStarted: true,
      }),
    ).toBe(false);
  });

  it('leaves a partial refund covered and invoices finished cleans after a full refund', () => {
    expect(refundReversesGrant(19900, 5000, false)).toBe(false);
    expect(refundReversesGrant(19900, 0, false)).toBe(true);
    expect(refundReversesGrant(19900, 19900, true)).toBe(true);
    expect(
      finishedVisitsToInvoice(
        [
          { id: 'a', completed: true, coverageStatus: 'covered', invoiced: false },
          { id: 'b', completed: true, coverageStatus: 'waiting', invoiced: false },
          { id: 'c', completed: true, coverageStatus: 'covered', invoiced: true },
        ],
        'reversal',
      ),
    ).toEqual(['a', 'b']);
  });

  it('flags upcoming visits during a dispute, clears a won dispute, and invoices a lost one', () => {
    const now = '2026-11-01T00:00:00.000Z';
    expect(grantStatusAfterDispute('needs_response')).toBe('disputed');
    expect(grantStatusAfterDispute('won')).toBe('open');
    expect(grantStatusAfterDispute('lost')).toBe('reversed');
    expect(
      upcomingCoverageIssue({
        status: 'active',
        grantStatus: 'disputed',
        startsAt: '2026-11-08T15:00:00.000Z',
        now,
      }),
    ).toBe('unpaid_subscription');
    expect(
      upcomingCoverageIssue({
        status: 'active',
        grantStatus: grantStatusAfterDispute('won'),
        startsAt: '2026-11-08T15:00:00.000Z',
        now,
      }),
    ).toBeNull();
    expect(
      finishedVisitsToInvoice(
        [{ id: 'a', completed: true, coverageStatus: 'covered', invoiced: false }],
        'reversal',
      ),
    ).toEqual(['a']);
  });

  it('covers a visit inside the paid period and invoices the next one after cancel', () => {
    const inside = visit('a', 20);
    const after = visit('b', 3, { startsAt: '2026-12-05T15:00:00.000Z' });
    const canceled = subscription({ status: 'canceled' });
    expect(
      decide(inside, [occupant(inside)], { subscription: canceled, grants: [grant()] }).kind,
    ).toBe('covered');
    expect(
      decide(after, [occupant(after)], { subscription: canceled, grants: [grant()] }).kind,
    ).toBe('standard');
  });

  it('uses a makeup before a new grant and after the subscription is canceled', () => {
    const row = visit('a', 3, { startsAt: '2026-12-05T15:00:00.000Z' });
    expect(
      decide(row, [occupant(row)], {
        subscription: subscription({ status: 'canceled' }),
        grants: [grant()],
        makeupAvailable: true,
      }).kind,
    ).toBe('makeup');
    const again = visit('b', 4);
    expect(
      decide(again, [occupant(again)], { grants: [grant()], makeupAvailable: true }).kind,
    ).toBe('makeup');
  });

  it('invoices waiting visits when the period ends with no paid grant', () => {
    expect(
      finishedVisitsToInvoice(
        [
          { id: 'a', completed: true, coverageStatus: 'waiting', invoiced: false },
          { id: 'b', completed: true, coverageStatus: 'covered', invoiced: false },
        ],
        'period_ended',
      ),
    ).toEqual(['a']);
  });

  it('stops coverage on the end date and invoices that clean', () => {
    const early = visit('a', 3);
    const onDate = visit('b', 15);
    const ended = grant({ coverageEndsOn: '2026-11-15' });
    expect(decide(early, [occupant(early), occupant(onDate)], { grants: [ended] }).kind).toBe(
      'covered',
    );
    expect(decide(onDate, [occupant(early), occupant(onDate)], { grants: [ended] }).kind).toBe(
      'standard',
    );
  });

  it('binds a null subscription to the original property when a second home is added', () => {
    expect(propertyIdToBind(['prop-1'], 'prop-2')).toBe('prop-1');
    expect(propertyIdToBind(['prop-1', 'prop-2'], 'prop-3')).toBeNull();
  });

  it('matches a recurring rule cadence and labels the customer portal', () => {
    expect(rruleMatchesCadence('FREQ=WEEKLY;INTERVAL=2', 'biweekly')).toBe(true);
    expect(rruleMatchesCadence('FREQ=WEEKLY;INTERVAL=1', 'biweekly')).toBe(false);
    expect(customerCoverageLabel('covered')).toBe('Included in your plan');
    expect(customerCoverageLabel('waiting')).toBe('We are waiting on the plan payment');
    expect(customerCoverageLabel('extra')).toBe('Billed separately');
  });
});
