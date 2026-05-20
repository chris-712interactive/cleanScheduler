import { buildReportSearchParams } from '@/lib/reports/parseReportDateRange';

export interface ReportDatePreset {
  id: string;
  label: string;
  from: string;
  to: string;
}

function formatDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function reportDatePresets(now = new Date()): ReportDatePreset[] {
  const to = formatDateInput(now);

  const last7 = new Date(now);
  last7.setUTCDate(last7.getUTCDate() - 6);

  const mtdStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const ytdStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  return [
    { id: '7d', label: 'Last 7 days', from: formatDateInput(last7), to },
    { id: 'mtd', label: 'MTD', from: formatDateInput(mtdStart), to },
    { id: 'ytd', label: 'YTD', from: formatDateInput(ytdStart), to },
  ];
}

export function reportPresetHref(slug: string, preset: ReportDatePreset): string {
  return `/reports/${slug}${buildReportSearchParams({ from: preset.from, to: preset.to })}`;
}
