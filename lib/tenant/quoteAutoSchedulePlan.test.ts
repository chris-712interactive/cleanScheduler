import { describe, expect, it } from 'vitest';
import {
  avoidSameDayRecurringStart,
  frequencyIntervalDays,
  isInitialScheduleBucket,
  partitionAutoScheduleLines,
  resolveRecurringFirstVisitNotBefore,
  resolveScheduleVisitTitle,
  shiftIsoByDays,
} from '@/lib/tenant/quoteAutoSchedulePlan';
import type { JobTypeCatalogEntry } from '@/lib/tenant/jobTypeCatalog';

const deepClean: JobTypeCatalogEntry = {
  id: 'tpl-deep',
  service_label: 'Deep cleaning',
  name: 'Deep cleaning',
  job_type: 'residential',
  estimated_hours: 4,
  amount_cents: null,
  is_system_default: true,
  is_active: true,
  sort_order: 0,
  schedule_role: 'initial',
};

const standard: JobTypeCatalogEntry = {
  id: 'tpl-standard',
  service_label: 'Standard cleaning',
  name: 'Standard cleaning',
  job_type: 'residential',
  estimated_hours: 2,
  amount_cents: null,
  is_system_default: true,
  is_active: true,
  sort_order: 1,
  schedule_role: 'recurring',
};

describe('quoteAutoSchedulePlan', () => {
  it('treats one-time lines as initial bucket', () => {
    expect(isInitialScheduleBucket({ frequency: 'one_time' }, standard)).toBe(true);
  });

  it('treats weekly standard cleaning as recurring bucket', () => {
    expect(isInitialScheduleBucket({ frequency: 'weekly' }, standard)).toBe(false);
  });

  it('partitions deep clean + weekly into initial and recurring', () => {
    const catalog = new Map([
      ['tpl-deep', deepClean],
      ['tpl-standard', standard],
    ]);
    const { initialLines, recurringLines } = partitionAutoScheduleLines(
      [
        {
          id: 'l1',
          sort_order: 0,
          service_label: 'Deep cleaning',
          display_title: null,
          frequency: 'one_time',
          service_template_id: 'tpl-deep',
        },
        {
          id: 'l2',
          sort_order: 1,
          service_label: 'Standard cleaning',
          display_title: null,
          frequency: 'weekly',
          service_template_id: 'tpl-standard',
        },
      ],
      catalog,
    );
    expect(initialLines.map((line) => line.id)).toEqual(['l1']);
    expect(recurringLines.map((line) => line.id)).toEqual(['l2']);
  });

  it('offsets recurring first visit by cadence after initial anchor', () => {
    const anchor = '2026-06-02T14:00:00.000Z';
    const notBefore = resolveRecurringFirstVisitNotBefore(anchor, 'weekly', {
      recurringStartsAfterInitial: true,
      allowSameDayInitialRecurring: false,
    });
    expect(notBefore).toBe(shiftIsoByDays(anchor, 7));
  });

  it('uses job type name on the schedule even with custom quote title', () => {
    expect(
      resolveScheduleVisitTitle({ service_label: 'Smith residence — move-in prep' }, deepClean),
    ).toBe('Deep cleaning');
  });

  it('avoids same-day recurring when setting is off', () => {
    const bumped = avoidSameDayRecurringStart(
      '2026-06-02T14:00:00.000Z',
      '2026-06-02T16:00:00.000Z',
      { recurringStartsAfterInitial: true, allowSameDayInitialRecurring: false },
    );
    expect(bumped.slice(0, 10)).toBe('2026-06-03');
  });

  it('returns cadence day gaps', () => {
    expect(frequencyIntervalDays('weekly')).toBe(7);
    expect(frequencyIntervalDays('biweekly')).toBe(14);
  });
});
