import type { InstantBookingFrequency } from '@/lib/booking/priceInstantOffer';

const UTC_BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

/**
 * RRULE body consumed by the existing materializer, which anchors DTSTART in UTC.
 * Weekday and month day follow that same UTC instant.
 */
export function recurringRuleFromFrequency(input: {
  frequency: InstantBookingFrequency;
  startsAt: string;
}): string | null {
  if (input.frequency === 'one_time') return null;
  const instant = new Date(input.startsAt);
  if (!Number.isFinite(instant.getTime())) return null;
  const byday = UTC_BYDAY[instant.getUTCDay()] ?? 'MO';
  if (input.frequency === 'weekly') return `FREQ=WEEKLY;INTERVAL=1;BYDAY=${byday}`;
  if (input.frequency === 'biweekly') return `FREQ=WEEKLY;INTERVAL=2;BYDAY=${byday}`;
  return `FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=${instant.getUTCDate()}`;
}
