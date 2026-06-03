import { applyDurationToVisitWindow } from '@/lib/schedule/visitDuration';
import { isoToLocalDatetimeLocalValue } from '@/lib/datetime/isoToLocalDatetimeLocalValue';
import { parseTenantDatetimeLocalToIso } from '@/lib/datetime/parseTenantDatetimeLocal';

/** Recompute visit end (datetime-local) from start + expected duration. */
export function shiftEndFromStartAndDuration(
  startsLocal: string,
  durationHours: number,
  tenantTimezone: string,
): string {
  const startsIso = parseTenantDatetimeLocalToIso(startsLocal, tenantTimezone);
  if (!startsIso) return '';
  const endIso = applyDurationToVisitWindow(
    { startsAt: startsIso, endsAt: startsIso },
    durationHours,
  ).endsAt;
  return isoToLocalDatetimeLocalValue(endIso, tenantTimezone);
}
