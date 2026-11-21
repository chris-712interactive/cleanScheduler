/** Office presets for Schedule → Recurring. Instant booking builds its own RRULE. */
export const RECURRING_SERIES_PRESETS = [
  { id: 'weekly_mon', label: 'Weekly · Monday', rrule: 'FREQ=WEEKLY;BYDAY=MO;INTERVAL=1' },
  { id: 'weekly_tue', label: 'Weekly · Tuesday', rrule: 'FREQ=WEEKLY;BYDAY=TU;INTERVAL=1' },
  { id: 'weekly_wed', label: 'Weekly · Wednesday', rrule: 'FREQ=WEEKLY;BYDAY=WE;INTERVAL=1' },
  { id: 'weekly_thu', label: 'Weekly · Thursday', rrule: 'FREQ=WEEKLY;BYDAY=TH;INTERVAL=1' },
  { id: 'weekly_fri', label: 'Weekly · Friday', rrule: 'FREQ=WEEKLY;BYDAY=FR;INTERVAL=1' },
  {
    id: 'biweekly_mon',
    label: 'Every other week · Monday',
    rrule: 'FREQ=WEEKLY;BYDAY=MO;INTERVAL=2',
  },
  { id: 'monthly_1', label: 'Monthly · 1st', rrule: 'FREQ=MONTHLY;BYMONTHDAY=1;INTERVAL=1' },
  { id: 'monthly_15', label: 'Monthly · 15th', rrule: 'FREQ=MONTHLY;BYMONTHDAY=15;INTERVAL=1' },
] as const;

export type RecurringSeriesPresetId = (typeof RECURRING_SERIES_PRESETS)[number]['id'];

const BY_ID = new Map(RECURRING_SERIES_PRESETS.map((preset) => [preset.id, preset.rrule]));

export function rruleForRecurringPreset(presetId: string): string | null {
  return BY_ID.get(presetId as RecurringSeriesPresetId) ?? null;
}

export function recurringPresetIdForRrule(rrule: string): RecurringSeriesPresetId | null {
  const normalized = rrule.trim();
  const match = RECURRING_SERIES_PRESETS.find((preset) => preset.rrule === normalized);
  return match?.id ?? null;
}
