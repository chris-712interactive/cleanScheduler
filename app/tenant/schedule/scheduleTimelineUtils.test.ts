import { describe, expect, it } from 'vitest';
import { layoutVisitOnLocalDay } from './scheduleTimelineUtils';

describe('scheduleTimelineUtils day layout', () => {
  it('positions a visit proportionally within the visible hour window', () => {
    const dateKey = '2026-06-03';
    const visit = {
      starts_at: new Date(2026, 5, 3, 16, 0, 0).toISOString(),
      ends_at: new Date(2026, 5, 3, 18, 0, 0).toISOString(),
    };
    const window = { startHour: 13, endHour: 21 };

    const layout = layoutVisitOnLocalDay(visit, dateKey, window);
    expect(layout.visible).toBe(true);
    expect(layout.topPct).toBeCloseTo(37.5, 1);
    expect(layout.heightPct).toBeCloseTo(25, 1);
  });
});
