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
    preferredWeekdays: [],
    quoteId: 'quote-1',
    lineId: 'line-1',
    propertyId: 'prop-1',
    addressLine: null,
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
    addressLine: null,
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

  it('lands a weekly visit on a preferred weekday inside the cadence', () => {
    const { proposals } = planFillPeriod({
      ...range,
      services: [service({ preferredWeekdays: ['thu'] })],
      consultations: [],
    });
    expect(proposals.map((item) => item.dateKey)).toEqual(['2026-10-15']);
    expect(proposals[0]?.startMin).toBe(8 * 60);
  });

  it('uses the next open day when the preferred weekday is closed', () => {
    const { proposals } = planFillPeriod({
      ...range,
      services: [service({ preferredWeekdays: ['sun'], arrivalStartMin: 12 * 60 })],
      consultations: [],
    });
    expect(proposals.map((item) => item.dateKey)).toEqual(['2026-10-12']);
    expect(proposals[0]?.startMin).toBe(12 * 60);
  });

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
      services: [
        service({ existingDates: ['2026-10-05', '2026-10-12'], anchorDate: '2026-10-12' }),
      ],
      consultations: [],
    });
    expect(proposals).toHaveLength(0);
    expect(skipped[0]?.reason).toContain('not due until October 19');
  });

  it('keeps a biweekly property on its own cadence when another property is already booked', () => {
    const weeklyDates = ['2026-10-20', '2026-10-27', '2026-11-03', '2026-11-10', '2026-11-17'];
    const { proposals, skipped } = planFillPeriod({
      start: '2026-10-20',
      end: '2026-11-20',
      workDays: [...WEEKDAYS],
      workStartMin: 8 * 60,
      workEndMin: 17 * 60,
      services: [
        service({
          key: 'weekly-a',
          lineId: 'weekly-a',
          propertyId: 'prop-a',
          frequency: 'weekly',
          title: 'Weekly clean',
          anchorDate: '2026-11-17',
          existingDates: weeklyDates,
        }),
        service({
          key: 'biweekly-b',
          lineId: 'biweekly-b',
          propertyId: 'prop-b',
          addressLine: '3409 Parris Branch Rd',
          frequency: 'biweekly',
          title: 'Bi-weekly regular cleaning',
          anchorDate: null,
          existingDates: [],
        }),
      ],
      consultations: [],
    });

    const biweekly = proposals.filter((item) => item.lineId === 'biweekly-b');
    expect(biweekly.map((item) => item.dateKey)).toEqual([
      '2026-10-20',
      '2026-11-03',
      '2026-11-17',
    ]);
    expect(biweekly[0]?.addressLine).toBe('3409 Parris Branch Rd');
    expect(skipped.some((item) => item.reason.includes('Bi-weekly'))).toBe(false);
  });

  it('places a biweekly clean every two weeks across a month from its own last visit', () => {
    const { proposals, skipped } = planFillPeriod({
      start: '2026-10-20',
      end: '2026-11-20',
      workDays: [...WEEKDAYS],
      workStartMin: 8 * 60,
      workEndMin: 17 * 60,
      services: [
        service({
          frequency: 'biweekly',
          title: 'Bi-weekly regular cleaning',
          addressLine: '775 Forest View Ln',
          anchorDate: '2026-10-06',
          existingDates: ['2026-10-06'],
        }),
      ],
      consultations: [],
    });

    expect(proposals.map((item) => item.dateKey)).toEqual([
      '2026-10-20',
      '2026-11-03',
      '2026-11-17',
    ]);
    expect(proposals[0]?.addressLine).toBe('775 Forest View Ln');
    expect(skipped).toHaveLength(0);
  });

  it('omits a one-time clean whose visit is already complete', () => {
    const { proposals, skipped } = planFillPeriod({
      ...range,
      services: [
        service({
          frequency: 'one_time',
          title: 'Deep clean',
          existingDates: ['2026-09-01'],
          anchorDate: '2026-09-01',
          fulfilled: true,
        }),
      ],
      consultations: [],
    });
    expect(proposals).toHaveLength(0);
    expect(skipped).toHaveLength(0);
  });

  it('starts recurring cleans one full cycle after the initial one-time clean', () => {
    const period = { ...range, end: '2026-11-30' };
    const deep = service({
      key: 'deep',
      lineId: 'deep',
      title: 'Deep clean',
      frequency: 'one_time',
      anchorDate: null,
      existingDates: [],
    });
    const recurring = (frequency: 'weekly' | 'biweekly' | 'monthly') =>
      service({
        key: frequency,
        lineId: frequency,
        title: frequency,
        frequency,
        anchorDate: null,
        existingDates: [],
      });

    const biweekly = planFillPeriod({
      ...period,
      services: [recurring('biweekly'), deep],
      consultations: [],
    });
    expect(biweekly.proposals.find((item) => item.lineId === 'deep')?.dateKey).toBe('2026-10-12');
    expect(
      biweekly.proposals
        .filter((item) => item.lineId === 'biweekly')
        .map((item) => item.dateKey)
        .sort()[0],
    ).toBe('2026-10-26');

    const weekly = planFillPeriod({
      ...period,
      services: [recurring('weekly'), deep],
      consultations: [],
    });
    expect(
      weekly.proposals
        .filter((item) => item.lineId === 'weekly')
        .map((item) => item.dateKey)
        .sort()[0],
    ).toBe('2026-10-19');

    const monthly = planFillPeriod({
      ...period,
      services: [recurring('monthly'), deep],
      consultations: [],
    });
    expect(
      monthly.proposals
        .filter((item) => item.lineId === 'monthly')
        .map((item) => item.dateKey)
        .sort()[0],
    ).toBe('2026-11-12');
  });

  it('waits a cycle after a deep clean that is already on the calendar', () => {
    const { proposals } = planFillPeriod({
      ...range,
      end: '2026-11-30',
      services: [
        service({
          key: 'biweekly',
          lineId: 'biweekly',
          frequency: 'biweekly',
          anchorDate: null,
          existingDates: [],
        }),
        service({
          key: 'deep',
          lineId: 'deep',
          title: 'Deep clean',
          frequency: 'one_time',
          anchorDate: '2026-10-12',
          existingDates: ['2026-10-12'],
        }),
      ],
      consultations: [],
    });
    expect(proposals.find((item) => item.lineId === 'deep')).toBeUndefined();
    expect(
      proposals
        .filter((item) => item.lineId === 'biweekly')
        .map((item) => item.dateKey)
        .sort()[0],
    ).toBe('2026-10-26');
  });

  it('starts a biweekly clean two weeks after the initial clean at the same property', () => {
    const { proposals } = planFillPeriod({
      start: '2026-10-21',
      end: '2026-11-18',
      workDays: [...WEEKDAYS],
      workStartMin: 8 * 60,
      workEndMin: 17 * 60,
      services: [
        service({
          key: 'regular',
          lineId: 'regular',
          quoteId: 'quote-regular',
          propertyId: 'prop-parris',
          addressLine: '3409 Parris Branch Rd',
          title: 'Bi-Weekly Standard Cleaning',
          frequency: 'biweekly',
          anchorDate: null,
          existingDates: [],
          scheduleRole: 'recurring',
        }),
        service({
          key: 'deep',
          lineId: 'deep',
          quoteId: 'quote-deep',
          propertyId: 'prop-parris',
          addressLine: '3409 Parris Branch Rd',
          title: 'Initial Deep Cleaning',
          frequency: 'one_time',
          anchorDate: null,
          existingDates: [],
          scheduleRole: 'initial',
        }),
      ],
      consultations: [],
    });

    expect(proposals.find((item) => item.lineId === 'deep')?.dateKey).toBe('2026-10-21');
    expect(
      proposals
        .filter((item) => item.lineId === 'regular')
        .map((item) => item.dateKey)
        .sort()[0],
    ).toBe('2026-11-04');
  });

  it('does not delay a biweekly clean for an initial visit at another property', () => {
    const { proposals } = planFillPeriod({
      start: '2026-10-21',
      end: '2026-11-04',
      workDays: [...WEEKDAYS],
      workStartMin: 8 * 60,
      workEndMin: 17 * 60,
      services: [
        service({
          key: 'deep',
          lineId: 'deep',
          propertyId: 'prop-a',
          frequency: 'one_time',
          anchorDate: null,
          existingDates: [],
          scheduleRole: 'initial',
        }),
        service({
          key: 'regular',
          lineId: 'regular',
          quoteId: 'quote-regular',
          propertyId: 'prop-b',
          frequency: 'biweekly',
          anchorDate: null,
          existingDates: [],
          scheduleRole: 'recurring',
        }),
      ],
      consultations: [],
    });

    expect(proposals.find((item) => item.lineId === 'regular')?.dateKey).toBe('2026-10-21');
  });

  it('treats a deep-clean job type as the initial visit even when the line repeats', () => {
    const { proposals } = planFillPeriod({
      start: '2026-10-21',
      end: '2026-11-18',
      workDays: [...WEEKDAYS],
      workStartMin: 8 * 60,
      workEndMin: 17 * 60,
      services: [
        service({
          key: 'regular',
          lineId: 'regular',
          propertyId: 'prop-parris',
          title: 'Bi-Weekly Standard Cleaning',
          frequency: 'biweekly',
          anchorDate: null,
          existingDates: [],
          scheduleRole: 'recurring',
        }),
        service({
          key: 'deep',
          lineId: 'deep',
          propertyId: 'prop-parris',
          title: 'Initial Deep Cleaning',
          frequency: 'biweekly',
          anchorDate: null,
          existingDates: [],
          scheduleRole: 'initial',
        }),
      ],
      consultations: [],
    });

    expect(proposals.find((item) => item.lineId === 'deep')?.dateKey).toBe('2026-10-21');
    expect(
      proposals
        .filter((item) => item.lineId === 'regular')
        .map((item) => item.dateKey)
        .sort()[0],
    ).toBe('2026-11-04');
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
