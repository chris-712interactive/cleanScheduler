import { describe, expect, it } from 'vitest';
import { todayJobsQueueItem } from '@/lib/tenant/dashboardTodayQueue';

describe('todayJobsQueueItem', () => {
  it('leaves Today empty when the only job is already completed', () => {
    expect(todayJobsQueueItem({ count: 1, scheduledCount: 0, todayKey: '2026-10-21' })).toBeNull();
  });

  it('leaves Today empty when nothing is on the calendar', () => {
    expect(todayJobsQueueItem({ count: 0, scheduledCount: 0, todayKey: '2026-10-21' })).toBeNull();
  });

  it('keeps a job that is still scheduled', () => {
    expect(todayJobsQueueItem({ count: 1, scheduledCount: 1, todayKey: '2026-10-21' })).toEqual({
      id: 'schedule',
      label: '1 job today',
      detail: '1 still scheduled',
      href: '/schedule?date=2026-10-21&view=day',
      tone: 'brand',
    });
  });

  it('keeps the day on the list while any job is still scheduled', () => {
    expect(
      todayJobsQueueItem({ count: 3, scheduledCount: 1, todayKey: '2026-10-21' }),
    ).toMatchObject({
      label: '3 jobs today',
      detail: '1 still scheduled',
    });
  });
});
