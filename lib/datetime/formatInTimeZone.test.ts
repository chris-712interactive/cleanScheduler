import { describe, expect, it } from 'vitest';
import { formatVisitWindow } from '@/lib/datetime/formatInTimeZone';

describe('formatVisitWindow', () => {
  it('keeps a same-day window as a start date plus the end time', () => {
    expect(
      formatVisitWindow('2026-06-08T13:00:00.000Z', '2026-06-08T15:00:00.000Z', 'America/New_York'),
    ).toBe('Monday, June 8 at 9:00 AM – 11:00 AM');
  });

  it('names the end date when the window crosses midnight in the tenant timezone', () => {
    expect(
      formatVisitWindow('2026-06-09T02:00:00.000Z', '2026-06-09T05:00:00.000Z', 'America/New_York'),
    ).toBe('Monday, June 8 at 10:00 PM – Tuesday, June 9 at 1:00 AM');
  });

  it('keeps a same-day window that crosses the spring-forward hour as a time only', () => {
    expect(
      formatVisitWindow('2026-03-08T06:30:00.000Z', '2026-03-08T07:30:00.000Z', 'America/New_York'),
    ).toBe('Sunday, March 8 at 1:30 AM – 3:30 AM');
  });

  it('names both dates when an overnight window lands after the spring-forward hour', () => {
    expect(
      formatVisitWindow('2026-03-08T03:00:00.000Z', '2026-03-08T07:30:00.000Z', 'America/New_York'),
    ).toBe('Saturday, March 7 at 10:00 PM – Sunday, March 8 at 3:30 AM');
  });
});
