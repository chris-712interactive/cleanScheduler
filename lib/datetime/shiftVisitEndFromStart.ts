import { applyDurationToVisitWindow } from '@/lib/schedule/visitDuration';
import { isoToLocalDatetimeLocalValue } from '@/lib/datetime/isoToLocalDatetimeLocalValue';
import { parseBrowserDatetimeLocalToIso } from '@/lib/datetime/parseBrowserDatetimeLocal';

/** Recompute visit end (datetime-local) from start + expected duration. */
export function shiftEndFromStartAndDuration(
  startsLocal: string,
  durationHours: number,
  tenantTimezone: string,
  tzOffsetMinutes: number,
): string {
  const startsIso = parseBrowserDatetimeLocalToIso(startsLocal, tzOffsetMinutes);
  if (!startsIso) return '';
  const endIso = applyDurationToVisitWindow(
    { startsAt: startsIso, endsAt: startsIso },
    durationHours,
  ).endsAt;
  return isoToLocalDatetimeLocalValue(endIso, tenantTimezone);
}
