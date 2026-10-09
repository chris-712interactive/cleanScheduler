import { describe, expect, it } from 'vitest';
import { planFillPeriod, resolveFillBounds } from '@/lib/schedule/fillPeriod';
import type { FillConsultationDemand, FillServiceDemand } from '@/lib/schedule/fillPeriod';

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const;

function service(overrides: Partial<FillServiceDemand> = {}): FillServiceDemand {
  return {
    key: 'line-1',
    customerId: 'cust-1',
    customerName: 'Ada',
    title: 'Recurring clean',
    frequency: 'weekly',
    durationMinutes: 120,
    anchorDate: '2026-10-05',
    existingDates: ['2026-10-05'],
    arrivalStartMin: null,
    quoteId: 'quote-1',
    lineId: 'line-1',
    propertyId: 'prop-1',
    amountCents: 15000,
    ...overrides,
  };
}

function consult(overrides: Partial<FillConsultationDemand> = {}): FillConsultationDemand {
  return {
    key: 'lead-1',
    leadId: 'lead-1',
    customerId: null,
    customerName: 'Blake',
    preferredDate: '2026-10-14',
    preferredWindow: 'morning',
    durationMinutes: 60,
    alreadyBooked: false,
    ...overrides,
  };
}

describe('resolveFillBounds', () => {
  it('clips a week to today and rejects a finished period', () => {
    expect(
      resolveFillBounds({
        scope: 'week',
        anchorDate: '2026-10-14',
        today: '2026-10-13',
      }),
    ).toEqual({ start: '2026-10-13', end: '2026-10-18' });

    expect(
      resolveFillBounds({
        scope: 'day',
        anchorDate: '2026-10-01',
        today: '2026-10-13',
      }),
    ).toEqual({ error: 'That period is already over.' });
  });
});

describe('planFillPeriod', () => {
  const range = {
    start: '2026-10-12',
    end: '2026-10-18',
    workDays: [...WEEKDAYS],
    workStartMin: 8 * 60,
    workEndMin: 17 * 60,
  };

  it('places the next weekly visit one cadence after the last one', () => {
    const { proposals } = planFillPeriod({
      ...range,
      services: [service()],
      consultations: [],
    });
    expect(proposals.map((item) => item.dateKey)).toEqual(['2026-10-12']);
  });

  it('skips a customer who already has a visit inside the cadence', () => {
    const { proposals, skipped } = planFillPeriod({
      ...range,
      services: [service({ existingDates: ['2026-10-05', '2026-10-12'], anchorDate: '2026-10-12' })],
      consultations: [],
    });
    expect(proposals).toHaveLength(0);
    expect(skipped[0]?.reason).toContain('not due');
  });

  it('skips a one-time clean that is already booked', () => {
    const { proposals, skipped } = planFillPeriod({
      ...range,
      services: [
        service({
          frequency: 'one_time',
          existingDates: ['2026-09-01'],
          anchorDate: '2026-09-01',
        }),
      ],
      consultations: [],
    });
    expect(proposals).toHaveLength(0);
    expect(skipped[0]?.reason).toContain('already');
  });

  it('books a consultation on the date the lead asked for', () => {
    const { proposals } = planFillPeriod({
      ...range,
      services: [],
      consultations: [consult()],
    });
    expect(proposals[0]).toMatchObject({
      kind: 'consultation',
      dateKey: '2026-10-14',
      startMin: 8 * 60,
    });
  });

  it('leaves a consultation alone when the requested date is outside the period', () => {
    const { proposals, skipped } = planFillPeriod({
      ...range,
      services: [],
      consultations: [consult({ preferredDate: '2026-11-02' })],
    });
    expect(proposals).toHaveLength(0);
    expect(skipped[0]?.reason).toContain('after');
  });

  it('moves a Sunday request onto the next open day', () => {
    const { proposals } = planFillPeriod({
      ...range,
      services: [],
      consultations: [consult({ preferredDate: '2026-10-18' })],
    });
    expect(proposals[0]?.dateKey).toBeUndefined();
    const later = planFillPeriod({
      start: '2026-10-12',
      end: '2026-10-20',
      workDays: [...WEEKDAYS],
      workStartMin: 8 * 60,
      workEndMin: 17 * 60,
      services: [],
      consultations: [consult({ preferredDate: '2026-10-18' })],
    });
    expect(later.proposals[0]?.dateKey).toBe('2026-10-19');
  });
});
