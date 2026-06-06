import type { QuoteLineFrequency } from '@/lib/tenant/quoteLineFrequency';
import { isRecurringQuoteLineFrequency } from '@/lib/tenant/quoteLineAutoSchedule';
import type { JobTypeCatalogEntry } from '@/lib/tenant/jobTypeCatalog';

export type QuoteAutoScheduleLine = {
  id: string;
  sort_order: number;
  service_label: string;
  display_title: string | null;
  frequency: QuoteLineFrequency;
  service_template_id: string | null;
};

export type QuoteAutoScheduleSettings = {
  recurringStartsAfterInitial: boolean;
  allowSameDayInitialRecurring: boolean;
};

export function frequencyIntervalDays(frequency: QuoteLineFrequency): number {
  switch (frequency) {
    case 'weekly':
      return 7;
    case 'biweekly':
      return 14;
    case 'monthly':
      return 30;
    case 'custom':
      return 7;
    default:
      return 0;
  }
}

export function shiftIsoByDays(iso: string, days: number): string {
  if (days <= 0) return iso;
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();
}

export function maxIsoTimestamp(a: string | null, b: string): string {
  if (!a) return b;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

/** Initial / one-time visits schedule before recurring cadence visits. */
export function isInitialScheduleBucket(
  line: Pick<QuoteAutoScheduleLine, 'frequency'>,
  catalogEntry: Pick<JobTypeCatalogEntry, 'schedule_role'> | null,
): boolean {
  if (!isRecurringQuoteLineFrequency(line.frequency)) return true;
  return catalogEntry?.schedule_role === 'initial';
}

export function partitionAutoScheduleLines(
  lines: QuoteAutoScheduleLine[],
  catalogByTemplateId: Map<string, JobTypeCatalogEntry>,
): { initialLines: QuoteAutoScheduleLine[]; recurringLines: QuoteAutoScheduleLine[] } {
  const initialLines: QuoteAutoScheduleLine[] = [];
  const recurringLines: QuoteAutoScheduleLine[] = [];

  const sorted = [...lines].sort((a, b) => a.sort_order - b.sort_order);
  for (const line of sorted) {
    const entry = line.service_template_id
      ? (catalogByTemplateId.get(line.service_template_id) ?? null)
      : null;
    if (isInitialScheduleBucket(line, entry)) {
      initialLines.push(line);
    } else {
      recurringLines.push(line);
    }
  }

  return { initialLines, recurringLines };
}

/** Label shown on scheduled visits — job type name, not optional quote title. */
export function resolveScheduleVisitTitle(
  line: Pick<QuoteAutoScheduleLine, 'service_label'>,
  catalogEntry: Pick<JobTypeCatalogEntry, 'name' | 'service_label'> | null,
): string {
  if (catalogEntry) {
    return (
      catalogEntry.name.trim() || catalogEntry.service_label.trim() || line.service_label.trim()
    );
  }
  return line.service_label.trim() || 'Visit';
}

export function resolveRecurringFirstVisitNotBefore(
  anchorStartIso: string | null,
  frequency: QuoteLineFrequency,
  settings: QuoteAutoScheduleSettings,
): string | null {
  if (!anchorStartIso || !settings.recurringStartsAfterInitial) return null;
  const gapDays = frequencyIntervalDays(frequency);
  if (gapDays <= 0) return anchorStartIso;
  return shiftIsoByDays(anchorStartIso, gapDays);
}

export function calendarDayKeyInUtc(iso: string): string {
  return iso.slice(0, 10);
}

export function sameCalendarDayUtc(a: string, b: string): boolean {
  return calendarDayKeyInUtc(a) === calendarDayKeyInUtc(b);
}

/** Push recurring start forward a day if it would collide with the initial visit. */
export function avoidSameDayRecurringStart(
  initialStartIso: string | null,
  recurringStartIso: string,
  settings: QuoteAutoScheduleSettings,
): string {
  if (
    !initialStartIso ||
    settings.allowSameDayInitialRecurring ||
    !sameCalendarDayUtc(initialStartIso, recurringStartIso)
  ) {
    return recurringStartIso;
  }
  return shiftIsoByDays(recurringStartIso, 1);
}
