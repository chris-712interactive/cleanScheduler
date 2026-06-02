import type { QuoteLineFrequency } from '@/lib/tenant/quoteLineFrequency';

/** Shift a visit window forward by cadence for auto-scheduled recurring sequences. */
export function offsetVisitWindowByFrequency(
  window: { startsAt: string; endsAt: string },
  sequenceIndex: number,
  frequency: QuoteLineFrequency,
): { startsAt: string; endsAt: string } {
  if (sequenceIndex <= 0) return window;

  const durationMs = new Date(window.endsAt).getTime() - new Date(window.startsAt).getTime();
  let dayGap = 0;
  switch (frequency) {
    case 'weekly':
      dayGap = 7;
      break;
    case 'biweekly':
      dayGap = 14;
      break;
    case 'monthly':
      dayGap = 30;
      break;
    case 'custom':
      dayGap = 7;
      break;
    default:
      return window;
  }

  const shiftMs = dayGap * sequenceIndex * 86_400_000;
  const newStart = new Date(new Date(window.startsAt).getTime() + shiftMs);
  return {
    startsAt: newStart.toISOString(),
    endsAt: new Date(newStart.getTime() + durationMs).toISOString(),
  };
}
