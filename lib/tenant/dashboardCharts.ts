import { formatUsdFromCents } from '@/lib/format/money';
import type { QuoteStatusCount } from '@/lib/tenant/dashboardMetrics';
import { QUOTE_STATUS_LABEL, type QuoteStatus } from '@/lib/tenant/quoteLabels';

export type DashboardChartTone = 'brand' | 'muted' | 'success' | 'warning' | 'danger';

export type DashboardChartSlice = {
  label: string;
  valueLabel: string;
  value: number;
  tone: DashboardChartTone;
};

export type DashboardChart = {
  title: string;
  slices: DashboardChartSlice[];
};

const QUOTE_TONE: Record<QuoteStatus, DashboardChartTone> = {
  draft: 'muted',
  sent: 'brand',
  accepted: 'success',
  declined: 'danger',
  expired: 'warning',
};

export function buildDashboardCharts(input: {
  quoteStatusCounts: QuoteStatusCount[];
  paidLast30DaysCents: number;
  outstandingCents: number;
  pastDueCount: number;
  todaysJobCount: number;
  todaysScheduledCount: number;
  todaysCompletedCount: number;
}): DashboardChart[] {
  const charts: DashboardChart[] = [];

  const quoteSlices = input.quoteStatusCounts
    .filter((row) => row.count > 0)
    .map((row) => ({
      label: QUOTE_STATUS_LABEL[row.status],
      valueLabel: String(row.count),
      value: row.count,
      tone: QUOTE_TONE[row.status],
    }));
  if (quoteSlices.length > 0) {
    charts.push({ title: 'Quotes', slices: quoteSlices });
  }

  if (input.paidLast30DaysCents > 0 || input.outstandingCents > 0) {
    charts.push({
      title: 'Collected and due',
      slices: [
        {
          label: 'Collected, 30 days',
          valueLabel: formatUsdFromCents(input.paidLast30DaysCents),
          value: input.paidLast30DaysCents,
          tone: 'brand',
        },
        {
          label: 'Still outstanding',
          valueLabel: formatUsdFromCents(input.outstandingCents),
          value: input.outstandingCents,
          tone: input.pastDueCount > 0 ? 'warning' : 'muted',
        },
      ],
    });
  }

  if (input.todaysJobCount > 0) {
    const other = Math.max(
      0,
      input.todaysJobCount - input.todaysScheduledCount - input.todaysCompletedCount,
    );
    const slices: DashboardChartSlice[] = [
      {
        label: 'Scheduled',
        valueLabel: String(input.todaysScheduledCount),
        value: input.todaysScheduledCount,
        tone: 'brand',
      },
      {
        label: 'Completed',
        valueLabel: String(input.todaysCompletedCount),
        value: input.todaysCompletedCount,
        tone: 'success',
      },
    ];
    if (other > 0) {
      slices.push({
        label: 'Other',
        valueLabel: String(other),
        value: other,
        tone: 'muted',
      });
    }
    charts.push({ title: "Today's jobs", slices });
  }

  return charts;
}
