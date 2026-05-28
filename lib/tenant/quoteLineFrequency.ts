import type { Database } from '@/lib/supabase/database.types';

export type QuoteLineFrequency = Database['public']['Enums']['quote_line_frequency'];

export const QUOTE_LINE_FREQUENCY_LABEL: Record<QuoteLineFrequency, string> = {
  one_time: 'One-time',
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  custom: 'Custom cadence',
};

/** Stable order for selects. */
export const QUOTE_LINE_FREQUENCY_OPTIONS: { value: QuoteLineFrequency; label: string }[] = [
  { value: 'one_time', label: QUOTE_LINE_FREQUENCY_LABEL.one_time },
  { value: 'weekly', label: QUOTE_LINE_FREQUENCY_LABEL.weekly },
  { value: 'biweekly', label: QUOTE_LINE_FREQUENCY_LABEL.biweekly },
  { value: 'monthly', label: QUOTE_LINE_FREQUENCY_LABEL.monthly },
  { value: 'custom', label: QUOTE_LINE_FREQUENCY_LABEL.custom },
];

const FREQUENCY_SET = new Set<QuoteLineFrequency>([
  'one_time',
  'weekly',
  'biweekly',
  'monthly',
  'custom',
]);

export function parseQuoteLineFrequency(raw: string): QuoteLineFrequency {
  const t = raw.trim() as QuoteLineFrequency;
  return FREQUENCY_SET.has(t) ? t : 'one_time';
}
