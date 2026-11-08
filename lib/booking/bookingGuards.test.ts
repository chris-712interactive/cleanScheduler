import { describe, expect, it } from 'vitest';
import {
  amountMismatchDisposition,
  balanceDueCents,
  bookingResolutionMessage,
  bookingReturnState,
  checkoutFinalizeOutcome,
  customerCreateFailureCode,
  depositWritePlan,
  emailsEqual,
  escapeIlikePattern,
  firstVisitAndRecurringCents,
  groupSlotsByDate,
  instantBookingPlacesVisit,
  openHoldStillActive,
  paidCustomerCreateDisposition,
  previewFeedback,
  previewMatchesOffer,
  propertyFactPatch,
  publicSlotPayload,
  rateLimitAllows,
  rateLimitWindowStartMs,
  shouldAttemptBookingNotification,
  smsOptInGranted,
  trustedClientIp,
} from '@/lib/booking/bookingGuards';
import { computeInstantSlots, slotBlockedForCrew } from '@/lib/booking/computeInstantSlots';
import { localWallClockInTimeZoneToUtcIso } from '@/lib/schedule/nextWorkDayVisitWindow';
import type { EffectiveMemberSchedule } from '@/lib/tenant/memberAvailabilityDays';

describe('booking QA guards', () => {
  it('escapes like wildcards and compares email exactly', () => {
    expect(escapeIlikePattern('jane_doe%@x.com')).toBe('jane\\_doe\\%@x.com');
    expect(emailsEqual('Jane.Doe@example.com', 'jane.doe@example.com')).toBe(true);
    expect(emailsEqual('jane.doe@example.com', 'jane_doe@example.com')).toBe(false);
  });

  it('requires an explicit SMS opt-in before a phone can receive texts', () => {
    expect(smsOptInGranted({ phone: '555-0100', optedIn: false })).toBe(false);
    expect(smsOptInGranted({ phone: '', optedIn: true })).toBe(false);
    expect(smsOptInGranted({ phone: '555-0100', optedIn: true })).toBe(true);
  });

  it('records the balance after the deposit', () => {
    expect(balanceDueCents(12000, 5000)).toBe(7000);
    expect(balanceDueCents(4000, 5000)).toBe(0);
  });

  it('does not clear stored beds, baths, or square feet with blanks', () => {
    expect(
      propertyFactPatch({
        bedrooms: null,
        bathrooms: null,
        sqft: null,
        zoneId: null,
        latitude: null,
        longitude: null,
        geocodeReason: null,
      }),
    ).toEqual({});
    expect(
      propertyFactPatch({
        bedrooms: 3,
        bathrooms: null,
        sqft: 1800,
        zoneId: null,
        latitude: null,
        longitude: null,
        geocodeReason: null,
      }),
    ).toEqual({ bedrooms: 3, sqft: 1800 });
  });

  it('drops a price preview when the service changes', () => {
    expect(previewMatchesOffer('offer-a', 'offer-a')).toBe(true);
    expect(previewMatchesOffer('offer-a', 'offer-b')).toBe(false);
  });

  it('refunds and flags a paid booking that cannot create the customer', () => {
    const limitMessage =
      'Starter allows up to 500 for Active customers. Upgrade or purchase an add-on to continue.';
    expect(customerCreateFailureCode(limitMessage)).toBe('capacity');
    expect(paidCustomerCreateDisposition(limitMessage)).toEqual({
      code: 'capacity',
      refund: true,
      releaseHold: true,
      flagForOffice: true,
    });
    expect(paidCustomerCreateDisposition('Could not save your contact details.')).toMatchObject({
      code: 'generic',
      refund: true,
      flagForOffice: true,
      releaseHold: true,
    });
  });

  it('refunds and flags a checkout whose amount is not the deposit', () => {
    expect(amountMismatchDisposition()).toEqual({
      code: 'amount_mismatch',
      refund: true,
      releaseHold: true,
      flagForOffice: true,
    });
  });

  it('tells the customer the real reason a deposit was returned', () => {
    const paid = { depositRefunded: true, paymentCollected: true };
    expect(bookingResolutionMessage({ code: 'slot_taken', ...paid })).toMatch(/no longer open/);
    expect(bookingResolutionMessage({ code: 'capacity', ...paid })).toMatch(/another customer/);
    expect(bookingResolutionMessage({ code: 'amount_mismatch', ...paid })).toMatch(/did not match/);
    expect(bookingResolutionMessage({ code: 'generic', ...paid })).toMatch(/could not be booked/);
    expect(bookingResolutionMessage({ code: 'capacity', ...paid })).not.toMatch(/no longer open/);
    expect(bookingResolutionMessage({ code: 'amount_mismatch', ...paid })).not.toMatch(
      /no longer open/,
    );
  });

  it('settles a paid finalize and keeps the full price on later visits', () => {
    expect(checkoutFinalizeOutcome({ paymentCollected: true })).toBe('refund');
    expect(checkoutFinalizeOutcome({ paymentCollected: false })).toBe('flag_for_office');
    expect(firstVisitAndRecurringCents(12000, 12000)).toEqual({
      firstVisitCents: 0,
      recurringCents: 12000,
    });
    expect(firstVisitAndRecurringCents(12000, 5000)).toEqual({
      firstVisitCents: 7000,
      recurringCents: 12000,
    });
  });

  it('records one deposit invoice when the webhook and the return URL both run', () => {
    expect(
      depositWritePlan({
        depositCents: 5000,
        bookingInvoiceId: null,
        sessionPaymentInvoiceId: null,
      }),
    ).toBe('create');
    expect(
      depositWritePlan({
        depositCents: 5000,
        bookingInvoiceId: null,
        sessionPaymentInvoiceId: 'inv_existing',
      }),
    ).toBe('link_existing');
    expect(
      depositWritePlan({
        depositCents: 5000,
        bookingInvoiceId: 'inv_existing',
        sessionPaymentInvoiceId: 'inv_existing',
      }),
    ).toBe('link_existing');
  });

  it('shows preview errors when the slot list is missing', () => {
    expect(
      previewFeedback({ error: 'Enter a valid ZIP code.', slotCount: null, offerMatches: true }),
    ).toBe('error');
    expect(previewFeedback({ error: undefined, slotCount: 0, offerMatches: true })).toBe('empty');
    expect(previewFeedback({ slotCount: 2, offerMatches: false })).toBe('none');
  });

  it('retries a confirmation email that never set notified_at', () => {
    expect(shouldAttemptBookingNotification({ status: 'confirmed', notifiedAt: null })).toBe(true);
    expect(
      shouldAttemptBookingNotification({ status: 'confirmed', notifiedAt: '2026-01-01T00:00:00Z' }),
    ).toBe(false);
    expect(shouldAttemptBookingNotification({ status: 'hold', notifiedAt: null })).toBe(false);
  });

  it('keeps a paid return token off the fresh booking form', () => {
    expect(bookingReturnState('hold')).toBe('pending');
    expect(bookingReturnState('refunded')).toBe('refunded');
    expect(bookingReturnState('needs_review')).toBe('needs_review');
    expect(bookingReturnState(null)).toBe('open_form');
  });

  it('hides crew ids behind an opaque slot token', () => {
    expect(
      publicSlotPayload({
        token: 'tok_abc',
        label: 'Wednesday, May 12 at 9:00 AM',
        dateLabel: 'Wednesday, May 12',
        timeLabel: '9:00 AM',
        assigneeUserId: 'user-1',
      }),
    ).toEqual({
      token: 'tok_abc',
      label: 'Wednesday, May 12 at 9:00 AM',
      dateLabel: 'Wednesday, May 12',
      timeLabel: '9:00 AM',
    });
  });

  it('groups open times under the day they belong to', () => {
    expect(
      groupSlotsByDate([
        { token: 'a', dateLabel: 'Monday, November 9', timeLabel: '8:00 AM' },
        { token: 'b', dateLabel: 'Monday, November 9', timeLabel: '8:30 AM' },
        { token: 'c', dateLabel: 'Tuesday, November 10', timeLabel: '8:00 AM' },
      ]),
    ).toEqual([
      {
        date: 'Monday, November 9',
        slots: [
          { token: 'a', dateLabel: 'Monday, November 9', timeLabel: '8:00 AM' },
          { token: 'b', dateLabel: 'Monday, November 9', timeLabel: '8:30 AM' },
        ],
      },
      {
        date: 'Tuesday, November 10',
        slots: [{ token: 'c', dateLabel: 'Tuesday, November 10', timeLabel: '8:00 AM' }],
      },
    ]);
  });

  it('uses the platform client IP instead of a spoofed forwarded hop', () => {
    const headers = new Headers({
      'x-forwarded-for': '198.51.100.9, 10.0.0.1',
      'x-vercel-forwarded-for': '203.0.113.10',
    });
    expect(trustedClientIp(headers)).toBe('203.0.113.10');
  });

  it('counts durable rate-limit hits inside a fixed window', () => {
    expect(rateLimitWindowStartMs(1_000_500, 1_000)).toBe(1_000_000);
    expect(rateLimitAllows(5, 5)).toBe(true);
    expect(rateLimitAllows(6, 5)).toBe(false);
  });

  it('places an instant visit only when a deposit or a saved card is required', () => {
    expect(instantBookingPlacesVisit({ depositCents: 0, collectCard: false })).toBe(false);
    expect(instantBookingPlacesVisit({ depositCents: 5000, collectCard: false })).toBe(true);
    expect(instantBookingPlacesVisit({ depositCents: 0, collectCard: true })).toBe(true);
  });

  it('blocks a second hold while the first one is still open', () => {
    const now = Date.parse('2026-11-07T18:00:00.000Z');
    expect(openHoldStillActive(null, now)).toBe(true);
    expect(openHoldStillActive('2026-11-07T18:20:00.000Z', now)).toBe(true);
    expect(openHoldStillActive('2026-11-07T17:00:00.000Z', now)).toBe(false);
  });
});

describe('travel conflicts on holds', () => {
  const timezone = 'America/New_York';
  function atLocal(hour: number): string {
    const iso = localWallClockInTimeZoneToUtcIso(timezone, {
      year: 2026,
      month: 6,
      day: 3,
      hour,
      minute: 0,
    });
    if (!iso) throw new Error('clock');
    return iso;
  }

  const naples = { point: null, city: 'Naples', state: 'FL', postalCode: '34102' };
  const tampa = { point: null, city: 'Tampa', state: 'FL', postalCode: '33602' };

  it('blocks a later hold the same way it blocks a later visit', () => {
    const blocked = slotBlockedForCrew({
      assigneeUserId: 'crew-a',
      startsAt: atLocal(11),
      endsAt: atLocal(12),
      bufferMinutes: 30,
      travelMph: 25,
      destination: naples,
      busy: [
        {
          assigneeUserId: 'crew-a',
          startsAt: atLocal(9),
          endsAt: atLocal(10),
          kind: 'lock',
          place: tampa,
        },
      ],
    });
    expect(blocked).toBe(true);
  });

  it('does not offer both travel-conflicting times once one is held', () => {
    const schedule = {
      userId: 'crew-a',
      timezone,
      dayWindows: {
        wed: { startsAt: '08:00', endsAt: '17:00' },
      },
    } satisfies EffectiveMemberSchedule;
    const open = computeInstantSlots({
      timezone,
      workWeekDays: ['wed'],
      workDayStart: '08:00',
      workDayEnd: '17:00',
      durationMinutes: 60,
      slotStepMinutes: 60,
      leadTimeHours: 0,
      windowDays: 1,
      bufferMinutes: 30,
      travelMph: 25,
      destination: naples,
      crew: [{ userId: 'crew-a', schedule }],
      busy: [
        {
          assigneeUserId: 'crew-a',
          startsAt: atLocal(9),
          endsAt: atLocal(10),
          kind: 'lock',
          place: tampa,
        },
      ],
      now: new Date(atLocal(7)),
      limit: 12,
    });
    expect(open.map((slot) => slot.startsAt)).not.toContain(atLocal(11));
  });
});
