import { describe, expect, it } from 'vitest';
import { buildDashboardCharts } from '@/lib/tenant/dashboardCharts';

const empty = {
  quoteStatusCounts: [],
  paidLast30DaysCents: 0,
  outstandingCents: 0,
  pastDueCount: 0,
  todaysJobCount: 0,
  todaysScheduledCount: 0,
  todaysCompletedCount: 0,
};

describe('buildDashboardCharts', () => {
  it('skips charts that have nothing to show', () => {
    expect(buildDashboardCharts(empty)).toEqual([]);
  });

  it('keeps a zero slice when the other side of the comparison has a value', () => {
    const charts = buildDashboardCharts({
      ...empty,
      quoteStatusCounts: [
        { status: 'draft', count: 1 },
        { status: 'sent', count: 1 },
        { status: 'accepted', count: 0 },
        { status: 'declined', count: 0 },
        { status: 'expired', count: 0 },
      ],
      paidLast30DaysCents: 30000,
    });

    expect(charts.map((chart) => chart.title)).toEqual(['Quotes', 'Collected and due']);
    expect(charts[1]?.slices.map((slice) => slice.valueLabel)).toEqual(['$300.00', '$0.00']);
    expect(charts[0]?.slices.map((slice) => slice.label)).toEqual(['Draft', 'Sent']);
  });

  it('marks outstanding money as a warning when something is overdue', () => {
    const charts = buildDashboardCharts({
      ...empty,
      outstandingCents: 48000,
      pastDueCount: 2,
      todaysJobCount: 3,
      todaysScheduledCount: 2,
      todaysCompletedCount: 1,
    });

    expect(charts[0]?.slices[1]?.tone).toBe('warning');
    expect(charts[1]?.title).toBe("Today's jobs");
  });
});
